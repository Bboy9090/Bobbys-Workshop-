#if !STORE_EDITION
import Foundation
import SwiftUI
import AppKit
import CryptoKit
import IOKit
import IOKit.usb
import UserNotifications
import UniformTypeIdentifiers

// MARK: - 1. Signed IPSW & Android Factory Image / Debloat Manager

struct IpswFirmwareEntry: Identifiable, Hashable {
    var id: String { "\(buildid)-\(version)" }
    let version: String
    let buildid: String
    let sha1sum: String
    let sha256sum: String
    let filesize: Int64
    let url: String
    let releasedate: String
    let signed: Bool
}

struct DebloatPackageItem: Identifiable, Codable, Hashable {
    var id: String { packageName }
    var packageName: String
    var label: String
    var category: String
}

@MainActor
final class FirmwareCatalogAndRestoreEngine: ObservableObject {
    @Published var productTypeInput: String = ""
    @Published var ipswEntries: [IpswFirmwareEntry] = []
    @Published var isQueryingCatalog: Bool = false
    @Published var downloadProgress: Double = 0.0
    @Published var downloadStatus: String = "Standby"
    @Published var stagedIpswPath: String = ""
    @Published var stagedIpswSha256: String = ""
    @Published var isDownloadingOrRestoring: Bool = false

    @Published var factoryZipPath: String = ""
    @Published var factoryBoardInfo: String = ""
    @Published var factoryFlashPreview: String = ""
    @Published var debloatJsonText: String = ""
    @Published var debloatStatus: String = ""

    private var activeTask: Task<Void, Never>? = nil

    init() {
        loadOrCreateDebloatProfile()
    }

    func cancelActive() {
        activeTask?.cancel()
        activeTask = nil
        isDownloadingOrRestoring = false
        downloadStatus = "Cancelled by operator"
    }

    func fetchIpswCatalog(for rawProduct: String, engine: ServicingEngine) async {
        let product = rawProduct.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !product.isEmpty else {
            downloadStatus = "Enter a ProductType (e.g. iPhone14,2 or iPad6,11) or connect an Apple device."
            return
        }
        isQueryingCatalog = true
        defer { isQueryingCatalog = false }
        engine.beginLiveTask(
            title: "Owner Pro: Querying ipsw.me Signed Firmware Catalog",
            what: "Fetching signed/unsigned builds & SHA checksums from api.ipsw.me/v4/device/\(product).",
            wherePath: NSHomeDirectory() + "/Downloads/BobFWTools_IPSW",
            initialStage: "Requesting api.ipsw.me..."
        )
        guard let url = URL(string: "https://api.ipsw.me/v4/device/\(product)?type=ipsw") else {
            engine.finishLiveTask(success: false, summary: "Invalid ProductType URL for \(product).")
            return
        }
        do {
            let (data, resp) = try await URLSession.shared.data(from: url)
            let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
            guard code == 200,
                  let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let fwList = json["firmwares"] as? [[String: Any]] else {
                downloadStatus = "ipsw.me returned HTTP \(code) for \(product)."
                engine.finishLiveTask(success: false, summary: downloadStatus)
                return
            }
            let parsed: [IpswFirmwareEntry] = fwList.compactMap { item in
                guard let ver = item["version"] as? String,
                      let build = item["buildid"] as? String,
                      let dlUrl = item["url"] as? String else { return nil }
                return IpswFirmwareEntry(
                    version: ver,
                    buildid: build,
                    sha1sum: (item["sha1sum"] as? String) ?? "",
                    sha256sum: (item["sha256sum"] as? String) ?? "",
                    filesize: (item["filesize"] as? Int64) ?? Int64((item["filesize"] as? Int) ?? 0),
                    url: dlUrl,
                    releasedate: (item["releasedate"] as? String) ?? "",
                    signed: (item["signed"] as? Bool) ?? false
                )
            }
            self.ipswEntries = parsed
            let signedCount = parsed.filter(\.signed).count
            downloadStatus = "Loaded \(parsed.count) build(s) for \(product) (\(signedCount) currently signed)."
            engine.finishLiveTask(success: true, summary: downloadStatus)
        } catch {
            downloadStatus = "Catalog lookup failed: \(error.localizedDescription)"
            engine.finishLiveTask(success: false, summary: downloadStatus)
        }
    }

    func downloadAndVerifyIpsw(_ entry: IpswFirmwareEntry, engine: ServicingEngine) {
        guard let url = URL(string: entry.url) else { return }
        let ipswDir = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Downloads/BobFWTools_IPSW", isDirectory: true)
        try? FileManager.default.createDirectory(at: ipswDir, withIntermediateDirectories: true)
        let fileName = url.lastPathComponent.isEmpty ? "\(entry.buildid).ipsw" : url.lastPathComponent
        let destUrl = ipswDir.appendingPathComponent(fileName)

        isDownloadingOrRestoring = true
        downloadProgress = 0.0
        downloadStatus = "Downloading \(fileName)..."
        engine.beginLiveTask(
            title: "Owner Pro: Downloading & Verifying \(fileName)",
            what: "Streaming official Apple IPSW and verifying SHA checksum.",
            wherePath: destUrl.path,
            initialStage: "Connecting to Apple CDN..."
        )

        activeTask = Task {
            do {
                let (bytes, response) = try await URLSession.shared.bytes(from: url)
                let expected = max(1, response.expectedContentLength > 0 ? response.expectedContentLength : entry.filesize)
                FileManager.default.createFile(atPath: destUrl.path, contents: nil)
                let fh = try FileHandle(forWritingTo: destUrl)
                defer { try? fh.close() }

                var hasher256 = SHA256()
                var hasher1 = Insecure.SHA1()
                var buffer = Data()
                buffer.reserveCapacity(1_048_576)
                var received: Int64 = 0
                var lastUiUpdate = Date()

                for try await byte in bytes {
                    try Task.checkCancellation()
                    buffer.append(byte)
                    received += 1
                    if buffer.count >= 524_288 {
                        fh.write(buffer)
                        hasher256.update(data: buffer)
                        hasher1.update(data: buffer)
                        buffer.removeAll(keepingCapacity: true)
                        if Date().timeIntervalSince(lastUiUpdate) >= 0.4 {
                            lastUiUpdate = Date()
                            let pct = min(0.99, Double(received) / Double(expected))
                            let mbDone = Double(received) / 1_048_576.0
                            let mbTotal = Double(expected) / 1_048_576.0
                            let msg = String(format: "%.1f / %.1f MB (%.0f%%)", mbDone, mbTotal, pct * 100)
                            self.downloadProgress = pct
                            self.downloadStatus = msg
                            engine.updateLiveTaskProgress(stage: "Downloading: \(msg)", progress: pct, wherePath: destUrl.path)
                        }
                    }
                }
                if !buffer.isEmpty {
                    fh.write(buffer)
                    hasher256.update(data: buffer)
                    hasher1.update(data: buffer)
                }

                let sha256Hex = hasher256.finalize().map { String(format: "%02x", $0) }.joined()
                let sha1Hex = hasher1.finalize().map { String(format: "%02x", $0) }.joined()

                let sha256Ok = entry.sha256sum.isEmpty || entry.sha256sum.lowercased() == sha256Hex
                let sha1Ok = entry.sha1sum.isEmpty || entry.sha1sum.lowercased() == sha1Hex
                let verified = sha256Ok && sha1Ok

                self.stagedIpswPath = destUrl.path
                self.stagedIpswSha256 = sha256Hex
                self.downloadProgress = 1.0
                self.isDownloadingOrRestoring = false
                self.downloadStatus = verified
                    ? "Verified IPSW staged: \(fileName) (SHA-256: \(sha256Hex.prefix(16))...)"
                    : "Checksum mismatch on \(fileName)!"
                engine.finishLiveTask(success: verified, summary: self.downloadStatus, wherePath: destUrl.path)
            } catch {
                self.isDownloadingOrRestoring = false
                self.downloadStatus = "Download failed: \(error.localizedDescription)"
                engine.finishLiveTask(success: false, summary: self.downloadStatus, wherePath: destUrl.path)
            }
        }
    }

    func importLocalIpsw(engine: ServicingEngine) {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.allowedContentTypes = [UTType(filenameExtension: "ipsw") ?? .data]
        guard panel.runModal() == .OK, let url = panel.url else { return }
        stagedIpswPath = url.path
        downloadStatus = "Computing SHA-256 for \(url.lastPathComponent)..."
        Task.detached(priority: .userInitiated) {
            let digest = Self.computeFileSha256(url: url) ?? "Unavailable"
            await MainActor.run {
                self.stagedIpswSha256 = digest
                self.downloadStatus = "Imported \(url.lastPathComponent) · SHA-256: \(digest.prefix(16))..."
                engine.finishLiveTask(success: true, summary: self.downloadStatus, wherePath: url.path)
            }
        }
    }

    nonisolated static func computeFileSha256(url: URL) -> String? {
        guard let fh = try? FileHandle(forReadingFrom: url) else { return nil }
        defer { try? fh.close() }
        var hasher = SHA256()
        while autoreleasepool(invoking: {
            let chunk = fh.readData(ofLength: 1_048_576)
            if chunk.isEmpty { return false }
            hasher.update(data: chunk)
            return true
        }) {}
        return hasher.finalize().map { String(format: "%02x", $0) }.joined()
    }

    func runRestoreWithStagedIpsw(eraseAll: Bool, useCfgutil: Bool, engine: ServicingEngine) async {
        guard !stagedIpswPath.isEmpty, FileManager.default.fileExists(atPath: stagedIpswPath) else {
            downloadStatus = "Stage or download an .ipsw file first."
            return
        }
        let binName = useCfgutil ? "cfgutil" : "idevicerestore"
        guard let binPath = engine.resolveOwnerCli(binName) else {
            downloadStatus = "\(binName) binary not installed on host."
            engine.finishLiveTask(success: false, summary: downloadStatus)
            return
        }
        let args: [String] = useCfgutil
            ? ["restore"]
            : (eraseAll ? ["--erase", stagedIpswPath] : [stagedIpswPath])

        isDownloadingOrRestoring = true
        defer { isDownloadingOrRestoring = false }

        engine.beginLiveTask(
            title: "Owner Pro: \(binName) \(eraseAll ? "Clean Restore" : "Update/Keep Data")",
            what: "Executing \(binName) \(args.joined(separator: " ")) on connected Apple USB device.",
            wherePath: stagedIpswPath,
            initialStage: "Starting \(binName)..."
        )
        let res = await engine.runProcessStreaming(executable: binPath, arguments: args) { line in
            DispatchQueue.main.async {
                self.downloadStatus = line
                engine.updateLiveTaskProgress(stage: line, wherePath: self.stagedIpswPath)
            }
        }
        engine.finishLiveTask(
            success: res.exitCode == 0,
            summary: res.exitCode == 0 ? "\(binName) completed cleanly." : "\(binName) exited with code \(res.exitCode).",
            wherePath: stagedIpswPath
        )
    }

    // Android Factory Image & Debloat
    func inspectAndroidFactoryZip(engine: ServicingEngine) {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.allowedContentTypes = [UTType.zip]
        guard panel.runModal() == .OK, let url = panel.url else { return }
        factoryZipPath = url.path

        Task.detached(priority: .userInitiated) {
            let infoProc = Process()
            infoProc.executableURL = URL(fileURLWithPath: "/usr/bin/unzip")
            infoProc.arguments = ["-p", url.path, "*android-info.txt"]
            let p1 = Pipe()
            infoProc.standardOutput = p1
            infoProc.standardError = Pipe()
            try? infoProc.run()
            infoProc.waitUntilExit()
            let infoText = String(data: p1.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""

            let shProc = Process()
            shProc.executableURL = URL(fileURLWithPath: "/usr/bin/unzip")
            shProc.arguments = ["-p", url.path, "*flash-all.sh"]
            let p2 = Pipe()
            shProc.standardOutput = p2
            shProc.standardError = Pipe()
            try? shProc.run()
            shProc.waitUntilExit()
            let shText = String(data: p2.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""

            await MainActor.run {
                self.factoryBoardInfo = infoText.isEmpty ? "No android-info.txt found in zip." : infoText
                self.factoryFlashPreview = shText.isEmpty ? "No flash-all.sh found in zip." : String(shText.prefix(600))
                engine.finishLiveTask(success: !infoText.isEmpty || !shText.isEmpty, summary: "Inspected factory archive \(url.lastPathComponent).", wherePath: url.path)
            }
        }
    }

    func flashAndroidFactoryZip(engine: ServicingEngine) async {
        guard !factoryZipPath.isEmpty, FileManager.default.fileExists(atPath: factoryZipPath) else {
            engine.finishLiveTask(success: false, summary: "Select an Android factory .zip archive first.")
            return
        }
        guard let fb = engine.resolveOwnerCli("fastboot") else {
            engine.finishLiveTask(success: false, summary: "fastboot binary not found.")
            return
        }
        engine.beginLiveTask(
            title: "Owner Pro: Fastboot Unlock Gate & Factory Flash",
            what: "Verifying fastboot getvar unlocked == yes before flashing factory images.",
            wherePath: factoryZipPath,
            initialStage: "Checking fastboot getvar unlocked..."
        )
        let lockRes = await engine.runProcess(executable: fb, arguments: ["getvar", "unlocked"], logCommand: false)
        let combined = (lockRes.stdout + "\n" + lockRes.stderr).lowercased()
        guard combined.contains("unlocked: yes") else {
            engine.finishLiveTask(success: false, summary: "Refused flash: bootloader is NOT confirmed unlocked (`fastboot getvar unlocked` did not return `yes`).")
            return
        }
        let tempDir = FileManager.default.temporaryDirectory.appendingPathComponent("bobfw_fb_\(Int(Date().timeIntervalSince1970))", isDirectory: true)
        try? FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        _ = await engine.runProcess(executable: "/usr/bin/unzip", arguments: ["-o", factoryZipPath, "-d", tempDir.path], logCommand: false)
        let scriptRes = await engine.runProcess(executable: "/usr/bin/find", arguments: [tempDir.path, "-name", "flash-all.sh"], logCommand: false)
        guard let scriptPath = scriptRes.stdout.components(separatedBy: .newlines).first(where: { !$0.isEmpty }) else {
            engine.finishLiveTask(success: false, summary: "No flash-all.sh script extracted from archive.")
            return
        }
        let flashRes = await engine.runProcessStreaming(executable: "/bin/bash", arguments: [scriptPath]) { line in
            DispatchQueue.main.async {
                engine.updateLiveTaskProgress(stage: line, wherePath: self.factoryZipPath)
            }
        }
        engine.finishLiveTask(success: flashRes.exitCode == 0, summary: "Factory flash exited with code \(flashRes.exitCode).", wherePath: factoryZipPath)
    }

    private var debloatProfileUrl: URL {
        let dir = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Documents/BobFWTools_BenchReports", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("debloat_profile.json")
    }

    func loadOrCreateDebloatProfile() {
        if let data = try? Data(contentsOf: debloatProfileUrl),
           let str = String(data: data, encoding: .utf8), !str.isEmpty {
            debloatJsonText = str
            return
        }
        let defaults = [
            DebloatPackageItem(packageName: "com.facebook.appmanager", label: "Meta App Manager", category: "Carrier/Preload"),
            DebloatPackageItem(packageName: "com.facebook.system", label: "Meta App Installer", category: "Carrier/Preload"),
            DebloatPackageItem(packageName: "com.samsung.android.app.spage", label: "Samsung Free", category: "OEM Preload"),
            DebloatPackageItem(packageName: "com.att.dh", label: "AT&T Device Help", category: "Carrier")
        ]
        if let encoded = try? JSONEncoder().encode(defaults),
           let pretty = String(data: encoded, encoding: .utf8) {
            debloatJsonText = pretty
            try? pretty.write(to: debloatProfileUrl, atomically: true, encoding: .utf8)
        }
    }

    func saveDebloatProfile() {
        try? debloatJsonText.write(to: debloatProfileUrl, atomically: true, encoding: .utf8)
        debloatStatus = "Saved debloat profile to \(debloatProfileUrl.lastPathComponent)."
    }

    func runDebloatProfile(disableOnly: Bool, engine: ServicingEngine) async {
        guard let adb = engine.resolveOwnerCli("adb") else {
            debloatStatus = "adb binary not found."
            return
        }
        guard let data = debloatJsonText.data(using: .utf8),
              let items = try? JSONDecoder().decode([DebloatPackageItem].self, from: data), !items.isEmpty else {
            debloatStatus = "Invalid JSON package profile."
            return
        }
        saveDebloatProfile()
        var results: [String] = []
        for item in items {
            let subcmd = disableOnly
                ? ["shell", "pm", "disable-user", "--user", "0", item.packageName]
                : ["shell", "pm", "uninstall", "--user", "0", item.packageName]
            let r = await engine.runProcess(executable: adb, arguments: engine.adbArgs(subcmd), logCommand: false)
            results.append("\(item.packageName): \(r.exitCode == 0 ? "OK" : "Skip/Absent")")
        }
        debloatStatus = results.joined(separator: " | ")
        engine.finishLiveTask(success: true, summary: "Debloat pass finished on \(items.count) package(s).", wherePath: debloatProfileUrl.path)
    }

    func restoreDebloatProfile(engine: ServicingEngine) async {
        guard let adb = engine.resolveOwnerCli("adb"),
              let data = debloatJsonText.data(using: .utf8),
              let items = try? JSONDecoder().decode([DebloatPackageItem].self, from: data) else { return }
        var restored = 0
        for item in items {
            _ = await engine.runProcess(executable: adb, arguments: engine.adbArgs(["shell", "cmd", "package", "install-existing", item.packageName]), logCommand: false)
            let r = await engine.runProcess(executable: adb, arguments: engine.adbArgs(["shell", "pm", "enable", item.packageName]), logCommand: false)
            if r.exitCode == 0 { restored += 1 }
        }
        debloatStatus = "Re-enabled \(restored)/\(items.count) package(s)."
        engine.finishLiveTask(success: true, summary: debloatStatus)
    }
}

// MARK: - 2. Raw USB & Disk Partition Inspector / Block Imager

struct DiskTopologyItem: Identifiable, Hashable {
    var id: String { deviceIdentifier }
    let deviceIdentifier: String
    let mediaName: String
    let totalSizeBytes: Int64
    let blockSize: Int
    let isInternal: Bool
    let containsBootRoot: Bool
    let partitionScheme: String
    let mountPoints: [String]

    var isSafeExternalTarget: Bool {
        !isInternal && deviceIdentifier != "disk0" && !containsBootRoot
    }
}

@MainActor
final class RawDiskImagingEngine: ObservableObject {
    @Published var disks: [DiskTopologyItem] = []
    @Published var selectedDiskId: String = ""
    @Published var sourceImagePath: String = ""
    @Published var imagingStatus: String = "Standby — Internal/Boot disks are permanently locked out."
    @Published var imagingProgress: Double = 0.0
    @Published var throughputMbPerSec: Double = 0.0
    @Published var etaSeconds: Int = 0
    @Published var isImaging: Bool = false

    private var imagingTask: Task<Void, Never>? = nil

    func cancelImaging() {
        imagingTask?.cancel()
        imagingTask = nil
        isImaging = false
        imagingStatus = "Raw imaging cancelled by operator."
    }

    func refreshDiskTopology() async {
        let items: [DiskTopologyItem] = await Task.detached(priority: .userInitiated) {
            let listProc = Process()
            listProc.executableURL = URL(fileURLWithPath: "/usr/sbin/diskutil")
            listProc.arguments = ["list", "-plist"]
            let pipe = Pipe()
            listProc.standardOutput = pipe
            try? listProc.run()
            listProc.waitUntilExit()
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            guard let plist = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any],
                  let allDisks = plist["AllDisksAndPartitions"] as? [[String: Any]] else {
                return []
            }

            var results: [DiskTopologyItem] = []
            for d in allDisks {
                guard let devId = d["DeviceIdentifier"] as? String else { continue }
                let infoProc = Process()
                infoProc.executableURL = URL(fileURLWithPath: "/usr/sbin/diskutil")
                infoProc.arguments = ["info", "-plist", devId]
                let iPipe = Pipe()
                infoProc.standardOutput = iPipe
                try? infoProc.run()
                infoProc.waitUntilExit()
                let iData = iPipe.fileHandleForReading.readDataToEndOfFile()
                let info = (try? PropertyListSerialization.propertyList(from: iData, format: nil) as? [String: Any]) ?? [:]

                let isInternal = (info["Internal"] as? Bool) ?? true
                let mediaName = (info["MediaName"] as? String) ?? (info["IORegistryEntryName"] as? String) ?? "Physical Disk"
                let sizeBytes = (info["TotalSize"] as? Int64) ?? Int64((d["Size"] as? Int) ?? 0)
                let blockSize = (info["DeviceBlockSize"] as? Int) ?? 512
                let scheme = (info["Content"] as? String) ?? (d["Content"] as? String) ?? "Unknown"

                var mounts: [String] = []
                if let parts = d["Partitions"] as? [[String: Any]] {
                    for p in parts {
                        if let m = p["MountPoint"] as? String, !m.isEmpty { mounts.append(m) }
                    }
                }
                let containsRoot = mounts.contains("/") || mounts.contains(where: { $0.hasPrefix("/System/Volumes") })
                results.append(DiskTopologyItem(
                    deviceIdentifier: devId,
                    mediaName: mediaName,
                    totalSizeBytes: sizeBytes,
                    blockSize: blockSize,
                    isInternal: isInternal,
                    containsBootRoot: containsRoot,
                    partitionScheme: scheme,
                    mountPoints: mounts
                ))
            }
            return results
        }.value

        self.disks = items
        if selectedDiskId.isEmpty, let firstExt = items.first(where: \.isSafeExternalTarget) {
            selectedDiskId = firstExt.deviceIdentifier
        }
        imagingStatus = "Enumerated \(items.count) physical disk(s). External writable targets: \(items.filter(\.isSafeExternalTarget).count)."
    }

    func pickImageFile() {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.allowedContentTypes = [UTType.data, UTType.diskImage]
        if panel.runModal() == .OK, let url = panel.url {
            sourceImagePath = url.path
        }
    }

    func writeRawDiskImage(engine: ServicingEngine) {
        guard let target = disks.first(where: { $0.deviceIdentifier == selectedDiskId }),
              target.isSafeExternalTarget else {
            imagingStatus = "BLOCKED: Select a safe EXTERNAL non-boot disk (disk0 and internal drives are permanently locked out)."
            engine.finishLiveTask(success: false, summary: imagingStatus)
            return
        }
        guard !sourceImagePath.isEmpty, FileManager.default.fileExists(atPath: sourceImagePath) else {
            imagingStatus = "Select a valid .img or .iso file first."
            return
        }

        let srcUrl = URL(fileURLWithPath: sourceImagePath)
        let rawDevPath = "/dev/r\(target.deviceIdentifier)"
        isImaging = true
        imagingProgress = 0
        imagingStatus = "Unmounting /dev/\(target.deviceIdentifier) and hashing source..."
        engine.beginLiveTask(
            title: "Owner Pro: Raw Disk Write -> \(rawDevPath)",
            what: "Unmounting external volume and streaming raw blocks with post-write SHA-256 verification.",
            wherePath: srcUrl.path,
            initialStage: imagingStatus
        )

        imagingTask = Task {
            let unmountProc = Process()
            unmountProc.executableURL = URL(fileURLWithPath: "/usr/sbin/diskutil")
            unmountProc.arguments = ["unmountDisk", "/dev/\(target.deviceIdentifier)"]
            try? unmountProc.run()
            unmountProc.waitUntilExit()

            let result: (Bool, String) = await Task.detached(priority: .userInitiated) {
                guard let expectedSha = FirmwareCatalogAndRestoreEngine.computeFileSha256(url: srcUrl),
                      let srcAttrs = try? FileManager.default.attributesOfItem(atPath: srcUrl.path),
                      let totalBytes = (srcAttrs[.size] as? NSNumber)?.int64Value, totalBytes > 0 else {
                    return (false, "Unable to hash or size source image.")
                }

                guard let inFh = try? FileHandle(forReadingFrom: srcUrl) else {
                    return (false, "Cannot open source image for reading.")
                }
                defer { try? inFh.close() }

                guard let outFh = FileHandle(forWritingAtPath: rawDevPath) else {
                    return (false, "Permission denied opening \(rawDevPath) (raw block writes require elevated root disk permissions).")
                }
                defer { try? outFh.close() }

                let chunkSize = 1_048_576
                var written: Int64 = 0
                let started = Date()

                while true {
                    if Task.isCancelled { return (false, "Cancelled during write.") }
                    let chunk = inFh.readData(ofLength: chunkSize)
                    if chunk.isEmpty { break }
                    outFh.write(chunk)
                    written += Int64(chunk.count)
                    let elapsed = max(0.1, Date().timeIntervalSince(started))
                    let mbPerSec = (Double(written) / 1_048_576.0) / elapsed
                    let remainingBytes = max(0, totalBytes - written)
                    let eta = mbPerSec > 0 ? Int((Double(remainingBytes) / 1_048_576.0) / mbPerSec) : 0
                    let pct = min(0.95, Double(written) / Double(totalBytes))
                    await MainActor.run {
                        self.imagingProgress = pct
                        self.throughputMbPerSec = mbPerSec
                        self.etaSeconds = eta
                        self.imagingStatus = String(format: "Writing %.1f MB/s · ETA %ds", mbPerSec, eta)
                    }
                }
                try? outFh.synchronize()

                // Post-write SHA-256 verification readback
                guard let verifyFh = FileHandle(forReadingAtPath: rawDevPath) else {
                    return (false, "Write completed, but unable to reopen \(rawDevPath) for SHA-256 verification.")
                }
                defer { try? verifyFh.close() }
                var hasher = SHA256()
                var remainingToVerify = totalBytes
                while remainingToVerify > 0 {
                    if Task.isCancelled { return (false, "Cancelled during verification.") }
                    let toRead = Int(min(Int64(chunkSize), remainingToVerify))
                    let data = verifyFh.readData(ofLength: toRead)
                    if data.isEmpty { break }
                    hasher.update(data: data)
                    remainingToVerify -= Int64(data.count)
                }
                let actualSha = hasher.finalize().map { String(format: "%02x", $0) }.joined()
                let matched = actualSha == expectedSha
                return (matched, matched ? "Verified SHA-256 (\(actualSha.prefix(16))...) on \(rawDevPath)" : "Post-write SHA-256 mismatch!")
            }.value

            self.isImaging = false
            self.imagingProgress = result.0 ? 1.0 : 0.0
            self.imagingStatus = result.1
            engine.finishLiveTask(success: result.0, summary: result.1, wherePath: srcUrl.path)
        }
    }
}

// MARK: - 3. Persistent USB Hotplug Bench Watcher (IOKit + LaunchAgent + UNUserNotificationCenter)

struct HotplugBenchEvent: Identifiable, Hashable {
    let id = UUID()
    let timestamp: String
    let modeLabel: String
    let detail: String
    let snapshotPath: String
}

@MainActor
final class UsbHotplugBenchWatcher: ObservableObject {
    @Published var isWatching: Bool = false
    @Published var isLaunchAgentEnabled: Bool = false
    @Published var events: [HotplugBenchEvent] = []
    @Published var lastBannerSummary: String = "Hotplug Watcher Idle"

    private var notifyPort: IONotificationPortRef? = nil
    private var matchedIter: io_iterator_t = 0
    private var terminatedIter: io_iterator_t = 0
    private weak var engineRef: ServicingEngine? = nil

    private var launchAgentUrl: URL {
        FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/LaunchAgents/com.bobfwtools.benchwatcher.plist")
    }

    init() {
        isLaunchAgentEnabled = FileManager.default.fileExists(atPath: launchAgentUrl.path)
    }

    func startWatching(engine: ServicingEngine) {
        stopWatching()
        self.engineRef = engine

        if Bundle.main.bundleIdentifier != nil {
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
        }

        guard let port = IONotificationPortCreate(kIOMainPortDefault) else {
            lastBannerSummary = "Failed to allocate IOKit IONotificationPort."
            return
        }
        self.notifyPort = port
        IONotificationPortSetDispatchQueue(port, DispatchQueue.main)

        let selfPtr = Unmanaged.passUnretained(self).toOpaque()
        let matchDict = IOServiceMatching(kIOUSBDeviceClassName)

        let callback: IOServiceMatchingCallback = { refcon, iterator in
            guard let refcon = refcon else { return }
            let watcher = Unmanaged<UsbHotplugBenchWatcher>.fromOpaque(refcon).takeUnretainedValue()
            var service = IOIteratorNext(iterator)
            while service != 0 {
                let vid = (IORegistryEntryCreateCFProperty(service, "idVendor" as CFString, kCFAllocatorDefault, 0)?.takeRetainedValue() as? NSNumber)?.intValue ?? 0
                let pid = (IORegistryEntryCreateCFProperty(service, "idProduct" as CFString, kCFAllocatorDefault, 0)?.takeRetainedValue() as? NSNumber)?.intValue ?? 0
                let name = (IORegistryEntryCreateCFProperty(service, "USB Product Name" as CFString, kCFAllocatorDefault, 0)?.takeRetainedValue() as? String) ?? "USB Device"
                let serial = (IORegistryEntryCreateCFProperty(service, "USB Serial Number" as CFString, kCFAllocatorDefault, 0)?.takeRetainedValue() as? String) ?? ""
                IOObjectRelease(service)
                Task { @MainActor in
                    watcher.handleAttach(vid: vid, pid: pid, name: name, serial: serial)
                }
                service = IOIteratorNext(iterator)
            }
        }

        IOServiceAddMatchingNotification(port, kIOMatchedNotification, matchDict, callback, selfPtr, &matchedIter)
        // Drain initial iterator
        var initObj = IOIteratorNext(matchedIter)
        while initObj != 0 {
            IOObjectRelease(initObj)
            initObj = IOIteratorNext(matchedIter)
        }

        isWatching = true
        lastBannerSummary = "Watching IOKit USB Attach Events (0x05AC Apple + Android ADB/Fastboot)..."
    }

    func stopWatching() {
        if matchedIter != 0 { IOObjectRelease(matchedIter); matchedIter = 0 }
        if terminatedIter != 0 { IOObjectRelease(terminatedIter); terminatedIter = 0 }
        if let port = notifyPort { IONotificationPortDestroy(port); notifyPort = nil }
        isWatching = false
        lastBannerSummary = "Hotplug Watcher Stopped"
    }

    private func handleAttach(vid: Int, pid: Int, name: String, serial: String) {
        let androidVids: Set<Int> = [0x18D1, 0x04E8, 0x22B8, 0x2717, 0x0BB4, 0x2A70, 0x12D1, 0x17EF]
        guard vid == 0x05AC || androidVids.contains(vid) else { return }

        let modeLabel: String
        if vid == 0x05AC {
            switch pid {
            case 0x1227: modeLabel = "iOS DFU (0x1227)"
            case 0x1281: modeLabel = "iOS Recovery (0x1281)"
            case 0x12A8, 0x12AB: modeLabel = "iOS Normal (0x\(String(format: "%04X", pid)))"
            default: modeLabel = "Apple USB (0x\(String(format: "%04X", pid)))"
            }
        } else {
            modeLabel = "Android USB (VID 0x\(String(format: "%04X", vid)))"
        }

        let stamp = Int(Date().timeIntervalSince1970)
        let dir = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Documents/BobFWTools_BenchReports", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let snapUrl = dir.appendingPathComponent("hotplug_intake_\(String(format: "%04x_%04x", vid, pid))_\(stamp).txt")
        let body = """
        BobFWTools Hotplug Intake Snapshot
        Timestamp: \(ISO8601DateFormatter().string(from: Date()))
        Mode: \(modeLabel)
        USB Product: \(name)
        USB Serial: \(serial.isEmpty ? "Not Disclosed" : serial)
        """
        try? body.write(to: snapUrl, atomically: true, encoding: .utf8)

        let ev = HotplugBenchEvent(
            timestamp: DateFormatter.localizedString(from: Date(), dateStyle: .none, timeStyle: .medium),
            modeLabel: modeLabel,
            detail: "\(name) · SN: \(serial.isEmpty ? "—" : serial)",
            snapshotPath: snapUrl.path
        )
        events.insert(ev, at: 0)
        if events.count > 25 { events.removeLast() }
        lastBannerSummary = "Attached: \(modeLabel) — \(name)"

        if Bundle.main.bundleIdentifier != nil {
            let content = UNMutableNotificationContent()
            content.title = "BobFWTools Bench Watcher: \(modeLabel)"
            content.body = "\(name) attached — intake snapshot saved."
            let req = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
            UNUserNotificationCenter.current().add(req, withCompletionHandler: nil)
        }
    }

    func toggleLaunchAgent(enable: Bool) {
        let dir = launchAgentUrl.deletingLastPathComponent()
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        if enable {
            let plist: [String: Any] = [
                "Label": "com.bobfwtools.benchwatcher",
                "ProgramArguments": ["/Applications/BobFWTools.app/Contents/MacOS/BobFWTools", "--bench-watcher"],
                "RunAtLoad": true,
                "KeepAlive": false
            ]
            if let data = try? PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0) {
                try? data.write(to: launchAgentUrl)
            }
            isLaunchAgentEnabled = FileManager.default.fileExists(atPath: launchAgentUrl.path)
            lastBannerSummary = "Installed LaunchAgent at \(launchAgentUrl.lastPathComponent)"
        } else {
            try? FileManager.default.removeItem(at: launchAgentUrl)
            isLaunchAgentEnabled = false
            lastBannerSummary = "Removed LaunchAgent \(launchAgentUrl.lastPathComponent)"
        }
    }
}

// MARK: - 4. Unified 7-Tab Owner Pro Dashboard

struct OwnerProDashboardHubView: View {
    @ObservedObject var engine: ServicingEngine
    @StateObject private var fwEngine = FirmwareCatalogAndRestoreEngine()
    @StateObject private var diskEngine = RawDiskImagingEngine()
    @StateObject private var watcher = UsbHotplugBenchWatcher()
    @State private var selectedTab: Int = 0

    var body: some View {
        GroupBox(label: Label("Owner Pro Unified Bench Dashboard (7 Unsandboxed Modules)", systemImage: "crown.fill")) {
            VStack(alignment: .leading, spacing: 10) {
                Picker("Owner Pro Module", selection: $selectedTab) {
                    Text("Telemetry & Power").tag(0)
                    Text("Firmware & IPSW").tag(1)
                    Text("Panic & Logs").tag(2)
                    Text("Provisioning & Debloat").tag(3)
                    Text("Raw Disk Imager").tag(4)
                    Text("Hotplug Watcher").tag(5)
                    Text("Bench Reports").tag(6)
                }
                .pickerStyle(.segmented)

                switch selectedTab {
                case 0:
                    OwnerProBenchSuiteDrawer(engine: engine)
                case 1:
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 8) {
                            TextField("ProductType (e.g. iPhone14,2 or iPad6,11)...", text: $fwEngine.productTypeInput)
                                .textFieldStyle(.roundedBorder)
                                .frame(width: 220)
                            Button("Use Connected") {
                                fwEngine.productTypeInput = engine.resolvedAppleProductType
                            }
                            .buttonStyle(.bordered)
                            Button("Fetch ipsw.me Catalog") {
                                let target = fwEngine.productTypeInput.isEmpty ? engine.resolvedAppleProductType : fwEngine.productTypeInput
                                Task { await fwEngine.fetchIpswCatalog(for: target, engine: engine) }
                            }
                            .buttonStyle(.borderedProminent)
                            Button("Import Local .ipsw") {
                                fwEngine.importLocalIpsw(engine: engine)
                            }
                            .buttonStyle(.bordered)
                            if fwEngine.isDownloadingOrRestoring {
                                Button("Cancel") { fwEngine.cancelActive() }
                                    .buttonStyle(.bordered)
                                    .tint(.red)
                            }
                            Spacer()
                        }
                        Text(fwEngine.downloadStatus)
                            .font(.system(size: 10.5, design: .monospaced))
                            .foregroundColor(.secondary)
                        if fwEngine.downloadProgress > 0 && fwEngine.downloadProgress < 1.0 {
                            ProgressView(value: fwEngine.downloadProgress)
                        }
                        if !fwEngine.stagedIpswPath.isEmpty {
                            HStack(spacing: 8) {
                                Button("idevicerestore (Update / Keep Data)") {
                                    Task { await fwEngine.runRestoreWithStagedIpsw(eraseAll: false, useCfgutil: false, engine: engine) }
                                }
                                .buttonStyle(.borderedProminent)
                                .tint(.blue)
                                Button("idevicerestore --erase (Clean Restore)") {
                                    Task { await fwEngine.runRestoreWithStagedIpsw(eraseAll: true, useCfgutil: false, engine: engine) }
                                }
                                .buttonStyle(.borderedProminent)
                                .tint(.red)
                                Button("cfgutil restore") {
                                    Task { await fwEngine.runRestoreWithStagedIpsw(eraseAll: true, useCfgutil: true, engine: engine) }
                                }
                                .buttonStyle(.bordered)
                            }
                        }
                        ScrollView {
                            VStack(spacing: 4) {
                                ForEach(fwEngine.ipswEntries.prefix(20)) { entry in
                                    HStack {
                                        Text("iOS \(entry.version) (\(entry.buildid))")
                                            .font(.system(size: 11, weight: .bold))
                                        Text(entry.signed ? "SIGNED" : "UNSIGNED")
                                            .font(.system(size: 9.5, weight: .black))
                                            .foregroundColor(entry.signed ? .green : .secondary)
                                        Spacer()
                                        if entry.signed {
                                            Button("Download & Verify") {
                                                fwEngine.downloadAndVerifyIpsw(entry, engine: engine)
                                            }
                                            .controlSize(.mini)
                                            .buttonStyle(.borderedProminent)
                                        }
                                    }
                                    .padding(5)
                                    .background(RoundedRectangle(cornerRadius: 4).fill(Color(NSColor.controlBackgroundColor)))
                                }
                            }
                        }
                        .frame(maxHeight: 150)

                        Divider()
                        HStack(spacing: 8) {
                            Button("Inspect Android Factory .zip") { fwEngine.inspectAndroidFactoryZip(engine: engine) }
                                .buttonStyle(.bordered)
                            Button("Fastboot Flash (Unlocked Gate)") {
                                Task { await fwEngine.flashAndroidFactoryZip(engine: engine) }
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(.orange)
                            Text(fwEngine.factoryBoardInfo)
                                .font(.system(size: 10, design: .monospaced))
                                .lineLimit(1)
                        }
                    }
                case 2:
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Button("Pull & Scan .ips / Panic Logs (-e)") {
                                Task { _ = await engine.extractAndAnalyzePanicLogs() }
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(.orange)
                            Button("Capture Android Logcat & Dropbox") {
                                Task { _ = await engine.captureAndroidBugreportSnapshot() }
                            }
                            .buttonStyle(.bordered)
                            Spacer()
                        }
                        if let report = engine.ownerPanicAuditReport {
                            Text("Scanned \(report.scannedFilesCount) file(s) — \(report.findings.count) hardware signature match(es).")
                                .font(.system(size: 10.5, weight: .semibold))
                        }
                    }
                case 3:
                    VStack(alignment: .leading, spacing: 8) {
                        Text("ADB Non-Root Carrier Bloatware Cleaner (Editable JSON Profile):")
                            .font(.system(size: 11, weight: .bold))
                        TextEditor(text: $fwEngine.debloatJsonText)
                            .font(.system(size: 10, design: .monospaced))
                            .frame(height: 110)
                            .border(Color.secondary.opacity(0.25))
                        HStack(spacing: 8) {
                            Button("Save Profile") { fwEngine.saveDebloatProfile() }
                                .buttonStyle(.bordered)
                            Button("Disable Bloat (pm disable-user)") {
                                Task { await fwEngine.runDebloatProfile(disableOnly: true, engine: engine) }
                            }
                            .buttonStyle(.borderedProminent)
                            Button("Uninstall User 0") {
                                Task { await fwEngine.runDebloatProfile(disableOnly: false, engine: engine) }
                            }
                            .buttonStyle(.bordered)
                            Button("Undo / Re-Enable") {
                                Task { await fwEngine.restoreDebloatProfile(engine: engine) }
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(.green)
                        }
                        if !fwEngine.debloatStatus.isEmpty {
                            Text(fwEngine.debloatStatus)
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundColor(.secondary)
                        }
                    }
                case 4:
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 8) {
                            Button("Refresh diskutil Topology") {
                                Task { await diskEngine.refreshDiskTopology() }
                            }
                            .buttonStyle(.borderedProminent)
                            Button("Select .img / .iso") { diskEngine.pickImageFile() }
                                .buttonStyle(.bordered)
                            Button("Write Raw Image (External Only)") {
                                diskEngine.writeRawDiskImage(engine: engine)
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(.red)
                            .disabled(diskEngine.isImaging)
                            if diskEngine.isImaging {
                                Button("Cancel") { diskEngine.cancelImaging() }
                                    .buttonStyle(.bordered)
                            }
                        }
                        Text(diskEngine.imagingStatus)
                            .font(.system(size: 10.5, design: .monospaced))
                        if diskEngine.isImaging {
                            ProgressView(value: diskEngine.imagingProgress)
                        }
                        ForEach(diskEngine.disks) { d in
                            HStack {
                                Button(d.deviceIdentifier == diskEngine.selectedDiskId ? "● \(d.deviceIdentifier)" : "○ \(d.deviceIdentifier)") {
                                    if d.isSafeExternalTarget { diskEngine.selectedDiskId = d.deviceIdentifier }
                                }
                                .buttonStyle(.plain)
                                .disabled(!d.isSafeExternalTarget)
                                Text("\(d.mediaName) · \(ByteCountFormatter.string(fromByteCount: d.totalSizeBytes, countStyle: .file)) · \(d.partitionScheme)")
                                    .font(.system(size: 10.5))
                                Spacer()
                                Text(d.isSafeExternalTarget ? "EXTERNAL (SAFE)" : "LOCKED OUT (INTERNAL/BOOT)")
                                    .font(.system(size: 9.5, weight: .bold))
                                    .foregroundColor(d.isSafeExternalTarget ? .green : .red)
                            }
                            .padding(4)
                            .background(RoundedRectangle(cornerRadius: 4).fill(Color(NSColor.controlBackgroundColor)))
                        }
                    }
                case 5:
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 10) {
                            if watcher.isWatching {
                                Button("Stop Hotplug Watcher") { watcher.stopWatching() }
                                    .buttonStyle(.borderedProminent)
                                    .tint(.red)
                            } else {
                                Button("Start Hotplug Watcher") { watcher.startWatching(engine: engine) }
                                    .buttonStyle(.borderedProminent)
                                    .tint(.green)
                            }
                            Toggle("Install LaunchAgent (~/Library/LaunchAgents)", isOn: Binding(
                                get: { watcher.isLaunchAgentEnabled },
                                set: { watcher.toggleLaunchAgent(enable: $0) }
                            ))
                            .font(.system(size: 11))
                            Spacer()
                        }
                        Text(watcher.lastBannerSummary)
                            .font(.system(size: 10.5, design: .monospaced))
                            .foregroundColor(.secondary)
                        ForEach(watcher.events.prefix(8)) { ev in
                            HStack {
                                Text("[\(ev.timestamp)] \(ev.modeLabel) — \(ev.detail)")
                                    .font(.system(size: 10, design: .monospaced))
                                Spacer()
                                Button("Open Snapshot") {
                                    NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: ev.snapshotPath)])
                                }
                                .controlSize(.mini)
                            }
                        }
                    }
                default:
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 10) {
                            Button("Export iOS PDF & CSV Report") {
                                Task { _ = await engine.generateDiagnosticBenchReport(platform: "ios") }
                            }
                            .buttonStyle(.borderedProminent)
                            Button("Export Android PDF & CSV Report") {
                                Task { _ = await engine.generateDiagnosticBenchReport(platform: "android") }
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(.orange)
                            Button("Open BenchReports Folder") {
                                let dir = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Documents/BobFWTools_BenchReports", isDirectory: true)
                                try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
                                NSWorkspace.shared.open(dir)
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                }
            }
            .padding(8)
        }
    }
}
#endif
