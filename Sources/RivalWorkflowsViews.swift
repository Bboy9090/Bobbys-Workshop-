#if !STORE_EDITION
import SwiftUI
import AppKit
import UniformTypeIdentifiers

// MARK: - Persistent Real-Time WHAT / WHEN / WHERE / PROGRESS / RESULT Monitor Banner

struct LiveOperationTrackerBanner: View {
    @ObservedObject var engine: ServicingEngine
    @State private var isCollapsed: Bool = false

    private var stateBadgeColor: Color {
        switch engine.liveTaskState {
        case "RUNNING": return StudioTheme.turboBlue
        case "COMPLETED": return StudioTheme.signalGreen
        case "FAILED": return .red
        default: return .secondary
        }
    }

    private var timeFormatter: DateFormatter {
        let f = DateFormatter()
        f.dateFormat = "HH:mm:ss"
        return f
    }

    var body: some View {
        if engine.liveTaskState == "IDLE" {
            HStack(spacing: 10) {
                Image(systemName: "waveform.path.ecg")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(StudioTheme.signalGreen)
                Text("LIVE MONITOR READY")
                    .font(.system(size: 10, weight: .bold, design: .rounded))
                    .foregroundColor(StudioTheme.signalGreen)
                Text("Real hardware telemetry only — connect USB device & click any action. Saves go to ~/Downloads.")
                    .font(.system(size: 10.5))
                    .foregroundColor(.secondary)
                    .lineLimit(1)
                Spacer()
                Button {
                    let dl = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Downloads", isDirectory: true)
                    NSWorkspace.shared.open(dl)
                } label: {
                    Label("Open ~/Downloads", systemImage: "folder.fill")
                        .font(.system(size: 10, weight: .semibold))
                }
                .buttonStyle(.bordered)
                .controlSize(.mini)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 5)
            .background(Color(NSColor.windowBackgroundColor))
            .overlay(Rectangle().frame(height: 1).foregroundColor(Color.secondary.opacity(0.15)), alignment: .bottom)
        } else {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    if engine.liveTaskState == "RUNNING" {
                        ProgressView()
                            .controlSize(.small)
                    } else {
                        Image(systemName: engine.liveTaskState == "COMPLETED" ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                            .foregroundColor(stateBadgeColor)
                    }

                    Text(engine.liveTaskState == "RUNNING" ? "LIVE · RUNNING" : engine.liveTaskState)
                        .font(.system(size: 9.5, weight: .black, design: .rounded))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(stateBadgeColor.opacity(0.16)))
                        .foregroundColor(stateBadgeColor)

                    Text(engine.liveTaskTitle)
                        .font(.system(size: 11.5, weight: .bold))
                        .lineLimit(1)

                    Spacer()

                    if engine.liveTaskState == "RUNNING", let start = engine.liveTaskStartDate {
                        TimelineView(.periodic(from: start, by: 1.0)) { ctx in
                            let elapsed = max(0, Int(ctx.date.timeIntervalSince(start)))
                            Text("WHEN: Started \(engine.liveTaskStartedAt) · \(elapsed)s elapsed")
                                .font(.system(size: 10, weight: .semibold, design: .monospaced))
                                .foregroundColor(.secondary)
                        }
                    } else if engine.liveTaskStartedAt != "—" {
                        Text("WHEN: \(engine.liveTaskStartedAt) → \(engine.liveTaskFinishedAt)")
                            .font(.system(size: 10, weight: .semibold, design: .monospaced))
                            .foregroundColor(.secondary)
                    }

                    Button {
                        isCollapsed.toggle()
                    } label: {
                        Image(systemName: isCollapsed ? "chevron.down" : "chevron.up")
                            .font(.system(size: 10, weight: .bold))
                    }
                    .buttonStyle(.plain)
                    .help(isCollapsed ? "Expand details" : "Collapse details")

                    if engine.liveTaskState != "RUNNING" {
                        Button {
                            engine.liveTaskState = "IDLE"
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 11))
                                .foregroundColor(.secondary)
                        }
                        .buttonStyle(.plain)
                        .help("Dismiss completed banner")
                    }
                }

                if !isCollapsed {
                    if !engine.liveTaskWhatDescription.isEmpty {
                        HStack(alignment: .top, spacing: 6) {
                            Text("WHAT:")
                                .font(.system(size: 9.5, weight: .bold))
                                .foregroundColor(.secondary)
                                .frame(width: 48, alignment: .leading)
                            Text(engine.liveTaskWhatDescription)
                                .font(.system(size: 10.5))
                                .foregroundColor(.primary)
                                .lineLimit(2)
                        }
                    }

                    if engine.liveTaskState == "RUNNING" {
                        HStack(spacing: 8) {
                            Text("WORK:")
                                .font(.system(size: 9.5, weight: .bold))
                                .foregroundColor(.secondary)
                                .frame(width: 48, alignment: .leading)
                            if engine.liveTaskProgress > 0.0 {
                                ProgressView(value: min(1.0, max(0.0, engine.liveTaskProgress)))
                                    .frame(width: 140)
                                Text("\(Int(min(100, max(0, engine.liveTaskProgress * 100))))%")
                                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                                    .foregroundColor(StudioTheme.turboBlue)
                            }
                            Text(engine.liveTaskStageDetail.isEmpty ? "Executing real CLI process..." : engine.liveTaskStageDetail)
                                .font(.system(size: 10.5, design: .monospaced))
                                .foregroundColor(StudioTheme.turboBlue)
                                .lineLimit(2)
                            Spacer()
                        }
                    } else if !engine.liveTaskResultSummary.isEmpty {
                        HStack(alignment: .top, spacing: 6) {
                            Text("RESULT:")
                                .font(.system(size: 9.5, weight: .bold))
                                .foregroundColor(stateBadgeColor)
                                .frame(width: 48, alignment: .leading)
                            Text(engine.liveTaskResultSummary)
                                .font(.system(size: 10.5, weight: .semibold))
                                .foregroundColor(engine.liveTaskState == "FAILED" ? .red : .primary)
                                .lineLimit(3)
                            Spacer()
                        }
                    }

                    if !engine.liveTaskWherePath.isEmpty {
                        HStack(spacing: 8) {
                            Text("WHERE:")
                                .font(.system(size: 9.5, weight: .bold))
                                .foregroundColor(.secondary)
                                .frame(width: 48, alignment: .leading)
                            Text(engine.liveTaskWherePath)
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundColor(.secondary)
                                .lineLimit(1)
                                .truncationMode(.middle)
                            Spacer()
                            Button {
                                revealPathInFinder(engine.liveTaskWherePath)
                            } label: {
                                Label("Open in Finder", systemImage: "folder.fill")
                                    .font(.system(size: 10, weight: .semibold))
                            }
                            .buttonStyle(.bordered)
                            .controlSize(.mini)
                        }
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(stateBadgeColor.opacity(0.07))
            .overlay(Rectangle().frame(height: 1.5).foregroundColor(stateBadgeColor.opacity(0.35)), alignment: .bottom)
        }
    }
}

private func revealPathInFinder(_ rawPath: String) {
    let trimmed = rawPath.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return }
    let url = URL(fileURLWithPath: trimmed)
    var isDir: ObjCBool = false
    if FileManager.default.fileExists(atPath: trimmed, isDirectory: &isDir) {
        if isDir.boolValue {
            NSWorkspace.shared.open(url)
        } else {
            NSWorkspace.shared.activateFileViewerSelecting([url])
        }
    } else {
        let dl = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Downloads", isDirectory: true)
        NSWorkspace.shared.open(dl)
    }
}

// MARK: - Reusable Plain-English Guide Strip (WHAT / WHEN / WHERE) Inside Every Workflow Card

struct WorkflowGuideHeaderStrip: View {
    let whatText: String
    let whenStatusText: String
    let isReady: Bool
    let wherePath: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top, spacing: 8) {
                Text("WHAT IT DOES:")
                    .font(.system(size: 9.5, weight: .heavy))
                    .foregroundColor(.secondary)
                    .frame(width: 88, alignment: .leading)
                Text(whatText)
                    .font(.system(size: 11))
                    .foregroundColor(.primary)
            }
            HStack(alignment: .center, spacing: 8) {
                Text("WHEN TO RUN:")
                    .font(.system(size: 9.5, weight: .heavy))
                    .foregroundColor(.secondary)
                    .frame(width: 88, alignment: .leading)
                HStack(spacing: 5) {
                    Circle()
                        .fill(isReady ? Color.green : Color.orange)
                        .frame(width: 7, height: 7)
                    Text(whenStatusText)
                        .font(.system(size: 10.5, weight: .semibold))
                        .foregroundColor(isReady ? .green : .orange)
                }
            }
            HStack(alignment: .center, spacing: 8) {
                Text("WHERE IT SAVES:")
                    .font(.system(size: 9.5, weight: .heavy))
                    .foregroundColor(.secondary)
                    .frame(width: 88, alignment: .leading)
                Text(wherePath)
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundColor(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Spacer()
                Button {
                    revealPathInFinder(wherePath)
                } label: {
                    Label("Open Folder", systemImage: "folder")
                        .font(.system(size: 10, weight: .semibold))
                }
                .buttonStyle(.bordered)
                .controlSize(.mini)
            }
        }
        .padding(8)
        .background(RoundedRectangle(cornerRadius: 6).fill(Color(NSColor.controlBackgroundColor)))
        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.secondary.opacity(0.18), lineWidth: 1))
    }
}

// MARK: - Rival Workflows Suite Cards (3uTools, ReiBoot, iMazing, UnlockTool, Chimera, Palera1n)

struct UnifiedBootloopRescueCenterCard: View {
    @ObservedObject var engine: ServicingEngine

    private var readiness: (Bool, String) {
        if engine.detectedAppleMode == .recovery || engine.detectedAppleMode == .dfu {
            return (true, "READY — Apple Device in \(engine.detectedAppleMode == .dfu ? "DFU" : "Recovery") Mode")
        }
        if engine.detectedAppleMode == .normal {
            return (true, "READY — Apple Device in Normal Mode (Track 2/3 Supported)")
        }
        if let dev = engine.selectedDevice {
            return (true, "READY — Android Connected via \(dev.transport.rawValue)")
        }
        return (false, "WAITING FOR USB — Connect iPhone, iPad, or Android in Normal/Recovery/DFU/Fastboot")
    }

    var body: some View {
        GroupBox(label: Label("Unified 3-Track System Rescue & Bootloop Center (ReiBoot Workflow)", systemImage: "lifepreserver.fill")) {
            VStack(alignment: .leading, spacing: 10) {
                WorkflowGuideHeaderStrip(
                    whatText: "Escapes stuck Recovery/Fastboot screens, repairs bootloops while keeping photos & data, or stages clean factory DFU restores.",
                    whenStatusText: readiness.1,
                    isReady: readiness.0,
                    wherePath: NSHomeDirectory() + "/Downloads"
                )

                HStack(alignment: .top, spacing: 10) {
                    VStack(alignment: .leading, spacing: 4) {
                        Button {
                            Task { await engine.runUnifiedStandardBootRescue(track: "exit_recovery_dfu") }
                        } label: {
                            Label("Track 1: 1-Click Exit Recovery / Fastboot", systemImage: "arrow.uturn.left.circle.fill")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.green)
                        .disabled(engine.isBusy)
                        Text("SAFE · KEEPS DATA · Use first if stuck on Computer+Cable or Fastboot screen.")
                            .font(.system(size: 9.5))
                            .foregroundColor(.secondary)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Button {
                            Task { await engine.runUnifiedStandardBootRescue(track: "retain_data_repair") }
                        } label: {
                            Label("Track 2: Standard Repair (Keep Data)", systemImage: "checkmark.shield.fill")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.blue)
                        .disabled(engine.isBusy)
                        Text("KEEPS DATA · Fetches Update IPSW / HOME_CSC & runs non-destructive Revive.")
                            .font(.system(size: 9.5))
                            .foregroundColor(.secondary)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Button {
                            Task { await engine.runUnifiedStandardBootRescue(track: "deep_dfu_restore") }
                        } label: {
                            Label("Track 3: Deep DFU / Clean Staging", systemImage: "bolt.shield.fill")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.indigo)
                        .disabled(engine.isBusy)
                        Text("WIPES DEVICE · Recovery-First DFU pipeline for severe corruption or iPad DFU drops.")
                            .font(.system(size: 9.5))
                            .foregroundColor(.secondary)
                    }
                }
            }
            .padding(8)
        }
    }
}

struct AppleAuthorizedRecoveryAndActivationCard: View {
    @ObservedObject var engine: ServicingEngine

    private var modeStatus: (Bool, String) {
        switch engine.detectedAppleMode {
        case .normal:
            return (true, "READY — Normal Mode Connected (Can Inspect Activation/MDM, Keep-Data Revive, or Stage Restore)")
        case .recovery:
            return (true, "READY — Recovery Mode Connected (Ready for Finder / Apple Configurator Restore or Update)")
        case .dfu:
            return (true, "READY — DFU Mode Connected (Ready for Official Signed IPSW Restore via Finder / Configurator)")
        case .restoreOS:
            return (true, "READY — RestoreOS / Ramdisk Mode Connected")
        case .none:
            return (false, "WAITING FOR APPLE USB — Connect iPhone or iPad via USB (including A7–A11 iPhone 5s–X)")
        }
    }

    var body: some View {
        GroupBox(label: Label("Official Apple Passcode Restore, Activation & Supervision Center", systemImage: "checkmark.seal.fill")) {
            VStack(alignment: .leading, spacing: 10) {
                WorkflowGuideHeaderStrip(
                    whatText: "Authorized Apple recovery paths: official Passcode/Recovery Restore (Finder/Configurator), Setup Assistant preserve-data Revive, live Activation & MDM Supervision audit, and official iCloud/Apple Support portals.",
                    whenStatusText: modeStatus.1,
                    isReady: modeStatus.0,
                    wherePath: NSHomeDirectory() + "/Downloads"
                )

                HStack(spacing: 10) {
                    Button {
                        Task { await engine.launchAppleFinderRestoreFlow() }
                    } label: {
                        Label("Official Passcode / Recovery Restore (Finder)", systemImage: "arrow.clockwise.circle.fill")
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.blue)
                    .disabled(engine.isBusy)

                    Button {
                        Task { await engine.runUnifiedStandardBootRescue(track: "retain_data_repair") }
                    } label: {
                        Label("Setup / Bootloop Revive (Keep Data)", systemImage: "checkmark.shield.fill")
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.green)
                    .disabled(engine.isBusy)

                    Button {
                        Task { await engine.queryAppleActivationAndMdmState() }
                    } label: {
                        Label("Inspect Activation & Supervision", systemImage: "person.badge.key.fill")
                    }
                    .buttonStyle(.bordered)
                    .disabled(engine.isBusy)

                    Spacer()
                }

                #if !STORE_EDITION
                Divider()
                OwnerProBenchSuiteDrawer(engine: engine)
                #endif

                if !engine.appleActivationAndMdmAudit.isEmpty {
                    VStack(spacing: 4) {
                        ForEach(engine.appleActivationAndMdmAudit.keys.sorted(), id: \.self) { key in
                            HStack {
                                Text(key)
                                    .font(.system(size: 11, weight: .semibold))
                                    .frame(width: 175, alignment: .leading)
                                Text(engine.appleActivationAndMdmAudit[key] ?? "—")
                                    .font(.system(size: 10.5, design: .monospaced))
                                Spacer()
                            }
                            .padding(.vertical, 3)
                            .padding(.horizontal, 8)
                            .background(RoundedRectangle(cornerRadius: 4).fill(Color(NSColor.controlBackgroundColor)))
                        }
                    }
                }

                HStack(spacing: 14) {
                    Text("Official Activation Lock Removal:")
                        .font(.system(size: 10.5, weight: .bold))
                        .foregroundColor(.secondary)
                    Link("iCloud Find Devices (Owner Sign-Out)", destination: URL(string: "https://www.icloud.com/find")!)
                    Link("Apple Activation Lock Support", destination: URL(string: "https://al-support.apple.com")!)
                    Spacer()
                }
                .font(.system(size: 11, weight: .semibold))
            }
            .padding(8)
        }
    }
}

#if !STORE_EDITION
struct OwnerProBenchSuiteDrawer: View {
    @ObservedObject var engine: ServicingEngine
    @State private var isExpanded: Bool = true
    @State private var selectedTab: Int = 0
    @State private var identityPath: String = ""
    @State private var keyPath: String = ""
    @State private var p12Passphrase: String = ""
    @State private var shopOrgName: String = "Bobby's Workshop"
    @State private var shopDepartment: String = "Refurb Bench"
    @State private var skipAllSetup: Bool = true
    @State private var profilePath: String = ""
    @State private var ipaPath: String = ""
    @State private var mdmBypassCode: String = ""
    @State private var mdmSerialOrImei: String = ""
    @State private var mdmServerUrl: String = ""

    private func pickFile(extensions: [String], completion: (String) -> Void) {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        panel.allowedContentTypes = extensions.compactMap { UTType(filenameExtension: $0) }
        if panel.runModal() == .OK, let url = panel.url {
            completion(url.path)
        }
    }

    private func formatBytes(_ bytes: Int64) -> String {
        guard bytes > 0 else { return "—" }
        return ByteCountFormatter.string(fromByteCount: bytes, countStyle: .file)
    }

    var body: some View {
        DisclosureGroup(isExpanded: $isExpanded) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    Picker("Bench Module", selection: $selectedTab) {
                        Text("Telemetry & Battery").tag(0)
                        Text("Panic Log Audit").tag(1)
                        Text("cfgutil Bench").tag(2)
                        Text("Console & iRecovery").tag(3)
                    }
                    .pickerStyle(.segmented)

                    if engine.isOwnerBenchRunning {
                        Button("Cancel") {
                            engine.cancelActiveOwnerBenchTask()
                        }
                        .buttonStyle(.bordered)
                        .tint(.red)
                    }
                }

                if selectedTab == 0 {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 8) {
                            Button {
                                Task { _ = await engine.fetchOwnerHardwareTelemetry() }
                            } label: {
                                Label("Fetch Deep Telemetry & Diagnostics", systemImage: "battery.100.bolt")
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(.orange)
                            .disabled(engine.isOwnerBenchRunning)

                            Button {
                                Task { await engine.prepareSafeAuthorizedRestoreSnapshot() }
                            } label: {
                                Label("Pre-Restore Snapshot + Stage DFU", systemImage: "tray.and.arrow.down.fill")
                            }
                            .buttonStyle(.bordered)
                            .disabled(engine.isOwnerBenchRunning)

                            Button {
                                Task { _ = await engine.generateDiagnosticBenchReport(platform: "ios") }
                            } label: {
                                Label("Export iOS PDF & CSV", systemImage: "doc.richtext")
                            }
                            .buttonStyle(.bordered)
                            .disabled(engine.isOwnerBenchRunning)

                            Spacer()
                        }

                        if let t = engine.ownerHardwareTelemetry {
                            HStack(spacing: 12) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Battery Health: \(t.batteryHealthPct)% · \(t.cycleCount) Cycles")
                                        .font(.system(size: 11.5, weight: .bold))
                                    ProgressView(value: Double(t.batteryHealthPct), total: 100.0)
                                        .tint(t.batteryHealthPct >= 80 ? .green : .orange)
                                        .frame(width: 220)
                                    Text("\(t.nominalCapacityMah) / \(t.designCapacityMah) mAh · \(t.chargingState) · \(t.temperatureCelsius.map { String(format: "%.1f°C", $0) } ?? "Temp N/A")")
                                        .font(.system(size: 10, design: .monospaced))
                                        .foregroundColor(.secondary)
                                }
                                Divider().frame(height: 44)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Storage: \(formatBytes(t.totalDataAvailableBytes)) free / \(formatBytes(t.totalDiskBytes)) total")
                                        .font(.system(size: 10.5, weight: .semibold))
                                    Text("System Partition: \(formatBytes(t.totalSystemBytes))")
                                        .font(.system(size: 10, design: .monospaced))
                                        .foregroundColor(.secondary)
                                }
                                Spacer()
                            }
                            .padding(8)
                            .background(RoundedRectangle(cornerRadius: 6).fill(Color(NSColor.controlBackgroundColor)))

                            Text("HW: \(t.productType) (\(t.hardwareModel)) · ChipID: \(t.chipId) · DieID: \(t.dieId) · BB: \(t.basebandVersion) · SN: \(t.serialNumber)")
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundColor(.secondary)

                            ForEach(t.diagnosticsFlags.keys.sorted(), id: \.self) { k in
                                Text("Diagnostics [\(k)]: \(t.diagnosticsFlags[k] ?? "")")
                                    .font(.system(size: 10, design: .monospaced))
                                    .foregroundColor((t.diagnosticsFlags[k] ?? "").localizedCaseInsensitiveContains("fail") ? .red : .green)
                            }
                        } else {
                            Text("Click 'Fetch Deep Telemetry & Diagnostics' with a trusted iPhone/iPad connected to inspect battery health, storage, SoC IDs, and idevicediagnostics flags.")
                                .font(.system(size: 10.5))
                                .foregroundColor(.secondary)
                        }
                    }
                } else if selectedTab == 1 {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 8) {
                            Button {
                                Task { _ = await engine.extractAndAnalyzePanicLogs() }
                            } label: {
                                Label("Pull & Scan .ips / Panic Logs (-e)", systemImage: "doc.text.magnifyingglass")
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(.orange)
                            .disabled(engine.isOwnerBenchRunning)

                            if let report = engine.ownerPanicAuditReport {
                                Button {
                                    revealPathInFinder(report.snapshotDirectory)
                                } label: {
                                    Label("Open Raw .ips Folder", systemImage: "folder.fill")
                                }
                                .buttonStyle(.bordered)
                            }
                            Spacer()
                        }

                        if let report = engine.ownerPanicAuditReport {
                            Text("Scanned \(report.scannedFilesCount) .ips/panic file(s) in \(report.snapshotDirectory) — \(report.findings.count) hardware signature match(es).")
                                .font(.system(size: 10.5, weight: .semibold))
                            if report.findings.isEmpty {
                                Text("No common hardware panic signatures (watchdog, SMC, AOP, I2C, NAND, Baseband, thermalmonitord, Tristar/Hydra) detected.")
                                    .font(.system(size: 10.5))
                                    .foregroundColor(.green)
                            } else {
                                ForEach(report.findings) { f in
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("\(f.matchedSignature) — \(f.fileName) (\(f.timestamp))")
                                            .font(.system(size: 10.5, weight: .bold))
                                            .foregroundColor(.orange)
                                        Text("Bench Hint: \(f.subsystemHint)")
                                            .font(.system(size: 10))
                                        Text(f.snippet)
                                            .font(.system(size: 9.5, design: .monospaced))
                                            .foregroundColor(.secondary)
                                            .lineLimit(1)
                                    }
                                    .padding(6)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(RoundedRectangle(cornerRadius: 5).fill(Color.orange.opacity(0.10)))
                                }
                            }
                        } else {
                            Text("Click 'Pull & Scan .ips / Panic Logs' to extract logs via idevicecrashreport -e and scan for hardware faults.")
                                .font(.system(size: 10.5))
                                .foregroundColor(.secondary)
                        }
                    }
                } else if selectedTab == 2 {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 8) {
                            TextField("Supervision Identity (.p12 / .der)...", text: $identityPath)
                                .textFieldStyle(.roundedBorder)
                                .font(.system(size: 10.5, design: .monospaced))
                            Button("Browse") { pickFile(extensions: ["p12", "der", "cer"]) { identityPath = $0 } }
                                .controlSize(.small)
                            Button("Prepare / Supervise") {
                                Task { await engine.runCfgutilBenchWorkflow(.prepareSupervise(identityPath: identityPath, profilePath: profilePath.isEmpty ? nil : profilePath)) }
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(.orange)
                        }

                        HStack(spacing: 8) {
                            TextField("Private Key (.pem, if .der)...", text: $keyPath)
                                .textFieldStyle(.roundedBorder)
                                .font(.system(size: 10.5, design: .monospaced))
                            Button("Key") { pickFile(extensions: ["pem", "key"]) { keyPath = $0 } }
                                .controlSize(.small)
                            SecureField(".p12 Passphrase", text: $p12Passphrase)
                                .textFieldStyle(.roundedBorder)
                                .frame(width: 120)
                            TextField("Org Name", text: $shopOrgName)
                                .textFieldStyle(.roundedBorder)
                                .frame(width: 125)
                            TextField("Dept", text: $shopDepartment)
                                .textFieldStyle(.roundedBorder)
                                .frame(width: 95)
                        }

                        HStack(spacing: 10) {
                            Toggle("Skip All Setup Assistants (Auto-Boot to Home)", isOn: $skipAllSetup)
                                .font(.system(size: 10.5, weight: .semibold))
                            Spacer()
                            Button {
                                Task {
                                    await engine.runSupervisedShopPrepare(
                                        identityPath: identityPath,
                                        keyPath: keyPath.isEmpty ? nil : keyPath,
                                        p12Passphrase: p12Passphrase.isEmpty ? nil : p12Passphrase,
                                        orgName: shopOrgName,
                                        department: shopDepartment,
                                        wifiProfilePath: profilePath.isEmpty ? nil : profilePath,
                                        skipAll: skipAllSetup,
                                        skipKeys: ["Passcode", "AppleID", "Siri", "Location", "Diagnostics", "Biometric", "Restore", "TermsOfAddress"]
                                    )
                                }
                            } label: {
                                Label("Shop Inventory Auto-Prepare (cfgutil prepare)", systemImage: "wand.and.stars")
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(.green)
                            .disabled(engine.isOwnerBenchRunning)
                        }

                        HStack(spacing: 8) {
                            TextField("Profile (.mobileconfig)...", text: $profilePath)
                                .textFieldStyle(.roundedBorder)
                                .font(.system(size: 10.5, design: .monospaced))
                            Button("Browse") { pickFile(extensions: ["mobileconfig"]) { profilePath = $0 } }
                                .controlSize(.small)
                            Button("Install Profile") {
                                Task { await engine.runCfgutilBenchWorkflow(.installProfile(profilePath: profilePath)) }
                            }
                            .buttonStyle(.bordered)
                        }

                        HStack(spacing: 8) {
                            TextField("App Package (.ipa)...", text: $ipaPath)
                                .textFieldStyle(.roundedBorder)
                                .font(.system(size: 10.5, design: .monospaced))
                            Button("Browse") { pickFile(extensions: ["ipa"]) { ipaPath = $0 } }
                                .controlSize(.small)
                            Button("Install App (.ipa)") {
                                Task { await engine.runCfgutilBenchWorkflow(.installApp(ipaPath: ipaPath)) }
                            }
                            .buttonStyle(.bordered)
                        }

                        HStack(spacing: 8) {
                            Button("cfgutil list") { Task { await engine.runOwnerCfgutilTechnicianAction(action: "list") } }
                                .buttonStyle(.bordered)
                            Button("cfgutil revive") { Task { await engine.runOwnerCfgutilTechnicianAction(action: "revive") } }
                                .buttonStyle(.bordered)
                            Button("cfgutil restore") { Task { await engine.runOwnerCfgutilTechnicianAction(action: "restore") } }
                                .buttonStyle(.bordered)
                            Spacer()
                        }

                        Divider()
                        Text("Authorized MDM Escrow Activation Lock Clear:")
                            .font(.system(size: 10.5, weight: .bold))
                        HStack(spacing: 8) {
                            TextField("Serial / IMEI", text: $mdmSerialOrImei)
                                .textFieldStyle(.roundedBorder)
                                .frame(width: 140)
                            TextField("MDM Escrowed Bypass Code", text: $mdmBypassCode)
                                .textFieldStyle(.roundedBorder)
                            TextField("MDM URL (optional, else opens ABM)", text: $mdmServerUrl)
                                .textFieldStyle(.roundedBorder)
                            Button("Clear / Open ABM") {
                                Task {
                                    await engine.runCfgutilBenchWorkflow(.clearActivationLockMdmEscrow(
                                        bypassCode: mdmBypassCode,
                                        serialOrImei: mdmSerialOrImei,
                                        mdmServerUrl: mdmServerUrl.isEmpty ? nil : mdmServerUrl
                                    ))
                                }
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(.blue)
                        }
                    }
                } else {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 8) {
                            Picker("Severity", selection: $engine.ownerSyslogFilterSeverity) {
                                Text("All").tag("All")
                                Text("Error / Fault").tag("Error / Fault")
                                Text("Warning").tag("Warning")
                                Text("Notice / Bootloop").tag("Notice / Bootloop")
                            }
                            .frame(width: 170)

                            TextField("Process filter (e.g. SpringBoard)...", text: $engine.ownerSyslogProcessFilter)
                                .textFieldStyle(.roundedBorder)
                                .font(.system(size: 10.5, design: .monospaced))
                                .frame(width: 175)

                            if engine.isOwnerSyslogStreaming {
                                Button("Stop Syslog") { engine.streamDeviceSyslog(start: false) }
                                    .buttonStyle(.borderedProminent)
                                    .tint(.red)
                            } else {
                                Button("Start Syslog") { engine.streamDeviceSyslog(start: true) }
                                    .buttonStyle(.borderedProminent)
                                    .tint(.indigo)
                            }

                            Button("Query irecovery -q") {
                                Task { await engine.queryOwnerIrecoveryStatus() }
                            }
                            .buttonStyle(.bordered)

                            Spacer()
                        }

                        if !engine.ownerIrecoveryStatus.isEmpty {
                            HStack(spacing: 10) {
                                ForEach(["MODE", "CPID", "BDID", "ECID", "SRTG", "PWND", "NONC"], id: \.self) { k in
                                    VStack(alignment: .leading, spacing: 1) {
                                        Text(k).font(.system(size: 8.5, weight: .bold)).foregroundColor(.secondary)
                                        Text(engine.ownerIrecoveryStatus[k] ?? "—").font(.system(size: 9.5, design: .monospaced))
                                    }
                                }
                                Spacer()
                            }
                            .padding(6)
                            .background(RoundedRectangle(cornerRadius: 5).fill(Color.cyan.opacity(0.10)))
                        }

                        ScrollView {
                            VStack(alignment: .leading, spacing: 2) {
                                if engine.ownerSyslogLines.isEmpty {
                                    Text("Owner Pro live syslog standby. Click 'Start Syslog' with a paired device connected.")
                                        .font(.system(size: 10, design: .monospaced))
                                        .foregroundColor(.secondary)
                                } else {
                                    ForEach(Array(engine.ownerSyslogLines.suffix(100).enumerated()), id: \.offset) { _, line in
                                        Text(line)
                                            .font(.system(size: 9.5, design: .monospaced))
                                            .frame(maxWidth: .infinity, alignment: .leading)
                                    }
                                }
                            }
                            .padding(6)
                        }
                        .frame(height: 120)
                        .background(RoundedRectangle(cornerRadius: 5).fill(Color.black.opacity(0.86)))
                    }
                }
            }
            .padding(8)
        } label: {
            Text("OWNER PRO BENCH SUITE (Telemetry · Panic Audit · cfgutil · Console/iRecovery)")
                .font(.system(size: 10.5, weight: .black))
                .foregroundColor(StudioTheme.voltGold)
        }
        .padding(8)
        .background(RoundedRectangle(cornerRadius: 6).fill(StudioTheme.voltGold.opacity(0.08)))
    }
}
#endif

struct AppleSiliconSecurityAndCheckm8Card: View {
    @ObservedObject var engine: ServicingEngine

    private var hasApple: Bool {
        engine.detectedAppleMode != .none || engine.activePlatform == .appleIos
    }

    var body: some View {
        GroupBox(label: Label("Apple Silicon Security, Checkm8 BootROM & USB Charger Power Inspector", systemImage: "cpu.fill")) {
            VStack(alignment: .leading, spacing: 10) {
                WorkflowGuideHeaderStrip(
                    whatText: "Checks A5–A11 Checkm8 BootROM eligibility (Palera1n/SSH Ramdisk) vs A12+ SecureROM, plus live IORegistry USB PD charger wattage.",
                    whenStatusText: hasApple
                        ? "READY — Apple USB Transport Detected (\(engine.detectedAppleMode.rawValue))"
                        : "WAITING FOR USB — Connect iPhone or iPad via USB (Normal, Recovery, or DFU)",
                    isReady: hasApple,
                    wherePath: NSHomeDirectory() + "/Downloads"
                )

                HStack {
                    Spacer()
                    Button {
                        Task { await engine.queryAppleSiliconAndChargerDiagnostics() }
                    } label: {
                        Label("Probe Live Silicon & Charger Telemetry", systemImage: "bolt.horizontal.circle.fill")
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.cyan)
                }

                if engine.appleSiliconSecurityReport.isEmpty {
                    Text("No live scan run yet. Click 'Probe Live Silicon & Charger Telemetry' above to read real SoC CPID & AppleSmartBattery AdapterDetails.")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                } else {
                    VStack(spacing: 4) {
                        ForEach(engine.appleSiliconSecurityReport.keys.sorted(), id: \.self) { key in
                            HStack {
                                Text(key)
                                    .font(.system(size: 11, weight: .semibold))
                                    .frame(width: 205, alignment: .leading)
                                Text(engine.appleSiliconSecurityReport[key] ?? "—")
                                    .font(.system(size: 10.5, design: .monospaced))
                                    .foregroundColor((engine.appleSiliconSecurityReport[key] ?? "").contains("VULNERABLE") ? .orange : .primary)
                                Spacer()
                            }
                            .padding(.vertical, 4)
                            .padding(.horizontal, 8)
                            .background(RoundedRectangle(cornerRadius: 4).fill(Color(NSColor.controlBackgroundColor)))
                        }
                    }
                }
            }
            .padding(8)
        }
    }
}

struct AppleLiveSyslogWorkbenchCard: View {
    @ObservedObject var engine: ServicingEngine
    private let filterPresets = [
        "All",
        "Setup Assistant (purplebuddy)",
        "Kernel & Thermal",
        "Wi-Fi & Network",
        "MDM & CloudConfig",
        "SpringBoard & Crash"
    ]

    var body: some View {
        GroupBox(label: Label("Live iOS / iPadOS Real-Time Syslog Streamer & Bootloop Trap (idevicesyslog)", systemImage: "waveform.path.ecg.rectangle")) {
            VStack(alignment: .leading, spacing: 10) {
                WorkflowGuideHeaderStrip(
                    whatText: "Streams live console output from your iPhone/iPad over USB and automatically alerts on purplebuddy, watchdogd, or thermal bootloops.",
                    whenStatusText: engine.isAppleSyslogStreaming
                        ? "STREAMING LIVE — Capturing \(engine.appleSyslogLines.count) buffered line(s)"
                        : (engine.detectedAppleMode == .normal
                            ? "READY — Normal Mode Paired Device Detected"
                            : "NEEDS NORMAL BOOT — Device must be booted & trusted to stream idevicesyslog"),
                    isReady: engine.detectedAppleMode == .normal || engine.isAppleSyslogStreaming,
                    wherePath: NSHomeDirectory() + "/Downloads"
                )

                HStack(spacing: 8) {
                    Picker("Filter Preset", selection: $engine.appleSyslogFilterPreset) {
                        ForEach(filterPresets, id: \.self) { preset in
                            Text(preset).tag(preset)
                        }
                    }
                    .frame(width: 240)

                    TextField("Keyword filter...", text: $engine.appleSyslogKeywordFilter)
                        .textFieldStyle(.roundedBorder)
                        .font(.system(size: 11, design: .monospaced))
                        .frame(width: 160)

                    Spacer()

                    if engine.isAppleSyslogStreaming {
                        Button("Stop Stream") {
                            engine.stopAppleLiveSyslogStream()
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.red)
                    } else {
                        Button {
                            engine.startAppleLiveSyslogStream()
                        } label: {
                            Label("Start Live Syslog", systemImage: "play.fill")
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.indigo)
                    }

                    Button("Clear") {
                        engine.clearAppleLiveSyslog()
                    }
                    .buttonStyle(.bordered)

                    Button {
                        engine.exportAppleLiveSyslog()
                    } label: {
                        Label("Save .log", systemImage: "square.and.arrow.down")
                    }
                    .buttonStyle(.bordered)
                    .disabled(engine.appleSyslogLines.isEmpty)
                }

                if !engine.appleSyslogBootloopWarning.isEmpty {
                    HStack(spacing: 8) {
                        Image(systemName: "exclamationmark.octagon.fill")
                            .foregroundColor(.red)
                        Text(engine.appleSyslogBootloopWarning)
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(.red)
                    }
                    .padding(8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 6).fill(Color.red.opacity(0.12)))
                }

                ScrollView {
                    VStack(alignment: .leading, spacing: 2) {
                        if engine.appleSyslogLines.isEmpty {
                            Text("Syslog console idle. Connect an unlocked, trusted iPhone/iPad via USB and click 'Start Live Syslog'.")
                                .font(.system(size: 10.5, design: .monospaced))
                                .foregroundColor(.secondary)
                        } else {
                            ForEach(Array(engine.appleSyslogLines.suffix(120).enumerated()), id: \.offset) { _, line in
                                Text(line)
                                    .font(.system(size: 10, design: .monospaced))
                                    .foregroundColor(line.localizedCaseInsensitiveContains("error") || line.localizedCaseInsensitiveContains("panic") ? .red : (line.localizedCaseInsensitiveContains("purplebuddy") ? .orange : .primary))
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }
                    }
                    .padding(8)
                }
                .frame(height: 155)
                .background(RoundedRectangle(cornerRadius: 6).fill(Color.black.opacity(0.88)))
            }
            .padding(8)
        }
    }
}

struct AppleBackupAndPairingVaultCard: View {
    @ObservedObject var engine: ServicingEngine

    private var whereDisplay: String {
        if !engine.appleBackupDestinationPath.isEmpty {
            return engine.appleBackupDestinationPath
        }
        return NSHomeDirectory() + "/Downloads/BobFWTools_Backups"
    }

    var body: some View {
        GroupBox(label: Label("Local iOS Backup, Crash/Panic Extractor & Lockdown Pairing Vault (iMazing Workflow)", systemImage: "externaldrive.badge.checkmark")) {
            VStack(alignment: .leading, spacing: 10) {
                WorkflowGuideHeaderStrip(
                    whatText: "Audits macOS /var/db/lockdown Trust certificates, pulls .ips/.panic logs without deleting them (-k), and runs full local USB backups.",
                    whenStatusText: engine.detectedAppleMode == .normal
                        ? "READY — Unlocked & Trusted Normal Mode iDevice Detected"
                        : "WAITING FOR NORMAL MODE — Boot device, unlock screen, and tap Trust This Computer",
                    isReady: engine.detectedAppleMode == .normal,
                    wherePath: whereDisplay
                )

                HStack(spacing: 10) {
                    Button {
                        Task { await engine.inspectHostLockdownPairing() }
                    } label: {
                        Label("Inspect Lockdown Vault", systemImage: "lock.shield.fill")
                    }
                    .buttonStyle(.bordered)

                    Button {
                        Task {
                            _ = await engine.executeAndLog(
                                workflowId: "apple.pair_vault",
                                title: "Trust / Pair Connected iDevice",
                                executable: engine.toolPaths["idevicepair"] ?? "/usr/local/bin/idevicepair",
                                arguments: ["pair"]
                            )
                        }
                    } label: {
                        Label("Trust / Pair Device", systemImage: "checkmark.circle.fill")
                    }
                    .buttonStyle(.bordered)

                    Button {
                        Task { await engine.runAppleLocalBackup() }
                    } label: {
                        Label("Run Full Local Backup (idevicebackup2)", systemImage: "tray.and.arrow.down.fill")
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.blue)
                    .disabled(engine.isBusy)

                    Button {
                        Task { await engine.pullAllAppleCrashReports() }
                    } label: {
                        Label("Pull Crash & Panic Logs (-k)", systemImage: "doc.text.magnifyingglass")
                    }
                    .buttonStyle(.bordered)
                }

                if !engine.applePairingRecordsFound.isEmpty {
                    HStack(spacing: 8) {
                        Text("Host /var/db/lockdown records (\(engine.applePairingRecordsFound.count)): \(engine.applePairingRecordsFound.prefix(4).joined(separator: ", "))")
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundColor(.secondary)
                        Spacer()
                        Button("Open Vault") { revealPathInFinder("/var/db/lockdown") }
                            .buttonStyle(.bordered)
                            .controlSize(.mini)
                    }
                }
                if !engine.appleCrashReportsPulledPath.isEmpty {
                    HStack(spacing: 8) {
                        Text("Latest Crash/Panic Dump: \(engine.appleCrashReportsPulledPath)")
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundColor(.green)
                        Spacer()
                        Button("Open Dump") { revealPathInFinder(engine.appleCrashReportsPulledPath) }
                            .buttonStyle(.bordered)
                            .controlSize(.mini)
                    }
                }
                if !engine.appleBackupDestinationPath.isEmpty {
                    HStack(spacing: 8) {
                        Text("Latest Local Backup Vault: \(engine.appleBackupDestinationPath)")
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundColor(.blue)
                        Spacer()
                        Button("Open Backup") { revealPathInFinder(engine.appleBackupDestinationPath) }
                            .buttonStyle(.bordered)
                            .controlSize(.mini)
                    }
                }
            }
            .padding(8)
        }
    }
}

struct AndroidDeepSecurityAndFrpAuditCard: View {
    @ObservedObject var engine: ServicingEngine

    private var hasAdb: Bool {
        engine.selectedDevice?.transport == .adb
    }

    var body: some View {
        GroupBox(label: Label("Android Deep Security, Knox Guard, FRP, AVB & Radio EFS Snapshot (Chimera / UnlockTool)", systemImage: "shield.lefthalf.filled")) {
            VStack(alignment: .leading, spacing: 10) {
                WorkflowGuideHeaderStrip(
                    whatText: "Interrogates real Bootloader Lock, AVB/VBMeta, Samsung Knox eFuse, Knox Guard (KG), RMM, FRP node & Radio CSC, plus backs up EFS partition tables.",
                    whenStatusText: hasAdb
                        ? "READY — Android ADB Device Authorized (\(engine.selectedDevice?.name ?? "Connected"))"
                        : "WAITING FOR ADB — Connect Android USB cable & enable USB Debugging in Developer Options",
                    isReady: hasAdb,
                    wherePath: NSHomeDirectory() + "/Downloads"
                )

                HStack(spacing: 10) {
                    Button {
                        Task { await engine.runAndroidDeepSecurityAudit() }
                    } label: {
                        Label("Run Deep Knox / KG / FRP / AVB Security Audit", systemImage: "magnifyingglass.circle.fill")
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.orange)
                    .disabled(engine.isBusy)

                    Button {
                        Task { await engine.backupAndroidRadioCalibrationPartitions() }
                    } label: {
                        Label("Backup EFS / persist / modemst Radio Calibration", systemImage: "antenna.radiowaves.left.and.right")
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.purple)
                    .disabled(engine.isBusy)

                    Spacer()
                }

                if engine.androidDeepSecurityAudit.isEmpty {
                    Text("No live ADB security audit run yet. Click 'Run Deep Knox / KG / FRP / AVB Security Audit' with USB Debugging active.")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                } else {
                    VStack(spacing: 4) {
                        ForEach(engine.androidDeepSecurityAudit.keys.sorted(), id: \.self) { key in
                            HStack {
                                Text(key)
                                    .font(.system(size: 11, weight: .semibold))
                                    .frame(width: 175, alignment: .leading)
                                Text(engine.androidDeepSecurityAudit[key] ?? "—")
                                    .font(.system(size: 10.5, design: .monospaced))
                                    .foregroundColor(.primary)
                                Spacer()
                            }
                            .padding(.vertical, 4)
                            .padding(.horizontal, 8)
                            .background(RoundedRectangle(cornerRadius: 4).fill(Color(NSColor.controlBackgroundColor)))
                        }
                    }
                }

                #if !STORE_EDITION
                Divider()
                OwnerAndroidBenchDiagnosticsPanel(engine: engine)
                #endif
            }
            .padding(8)
        }
    }
}

#if !STORE_EDITION
struct OwnerAndroidBenchDiagnosticsPanel: View {
    @ObservedObject var engine: ServicingEngine

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("OWNER PRO: ANDROID ADB / FASTBOOT BENCH DIAGNOSTICS & RECEIPT GENERATOR")
                .font(.system(size: 10, weight: .black))
                .foregroundColor(StudioTheme.voltGold)

            HStack(spacing: 10) {
                Button {
                    Task { _ = await engine.fetchAndroidBenchDiagnostics() }
                } label: {
                    Label("Scan Device (ADB / Fastboot)", systemImage: "cpu")
                }
                .buttonStyle(.borderedProminent)
                .tint(.orange)
                .disabled(engine.isOwnerBenchRunning)

                Button {
                    Task { _ = await engine.captureAndroidBugreportSnapshot() }
                } label: {
                    Label("Capture Bugreport (logcat + dropbox)", systemImage: "ladybug.fill")
                }
                .buttonStyle(.bordered)
                .disabled(engine.isOwnerBenchRunning)

                Button {
                    Task { _ = await engine.generateDiagnosticBenchReport(platform: "android") }
                } label: {
                    Label("Export Android PDF & CSV Receipt", systemImage: "doc.richtext")
                }
                .buttonStyle(.borderedProminent)
                .tint(.blue)
                .disabled(engine.isOwnerBenchRunning)

                if !engine.ownerLatestReportDir.isEmpty {
                    Button("Open Reports Folder") {
                        revealPathInFinder(engine.ownerLatestReportDir)
                    }
                    .buttonStyle(.bordered)
                }

                Spacer()
            }

            if let a = engine.ownerAndroidBenchTelemetry {
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(a.transportMode): \(a.manufacturer) \(a.marketingName) (\(a.codename)) · Android \(a.androidVersion) · SPL \(a.securityPatch) · SN: \(a.serialNumber)")
                        .font(.system(size: 10.5, weight: .bold))
                    Text("Battery: \(a.batteryLevelPct)% (\(a.chargingStatus), \(a.batteryHealth), \(a.voltageMv)mV\(a.temperatureCelsius.map { String(format: ", %.1f°C", $0) } ?? "")) · Storage: \(a.storageAvailable) free / \(a.storageTotal) · RAM: \(a.ramAvailable) / \(a.ramTotal)")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(.secondary)
                    Text("Bootloader Locked: \(a.bootloaderLocked) · Verified Boot: \(a.verifiedBootState) · Baseband: \(a.baseband)")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(.secondary)
                }
                .padding(8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 6).fill(Color(NSColor.controlBackgroundColor)))
            } else {
                Text("Click 'Scan Device (ADB / Fastboot)' to inspect properties, battery dumpsys, storage/RAM, or Fastboot getvar all.")
                    .font(.system(size: 10.5))
                    .foregroundColor(.secondary)
            }
        }
        .padding(8)
        .background(RoundedRectangle(cornerRadius: 6).fill(StudioTheme.voltGold.opacity(0.08)))
    }
}
#endif

struct RivalWorkflowsDirectoryCard: View {
    @ObservedObject var engine: ServicingEngine

    var body: some View {
        GroupBox(label: Label("Rival Software Workflows Directory & Official Tool Portals", systemImage: "rectangle.grid.2x2.fill")) {
            VStack(alignment: .leading, spacing: 10) {
                Text("1-Click native BobFWTools Studio workflows modeled after industry repair tools (every button executes real hardware/network commands — watch the Live Monitor bar above for progress & output path):")
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                    workflowButton("3uTools Component & Battery Audit", subtitle: "Checks real MLB, battery & panics", icon: "stethoscope") {
                        Task { _ = await engine.queryAppleHardwareAudit() }
                    }
                    workflowButton("ReiBoot Exit Recovery / Loop", subtitle: "Exits stuck cable / Fastboot screens", icon: "arrow.uturn.left.circle") {
                        Task { await engine.runUnifiedStandardBootRescue(track: "exit_recovery_dfu") }
                    }
                    workflowButton("Recovery-First DFU Staging", subtitle: "Staged A9/A9X iPad DFU entry", icon: "bolt.badge.automatic") {
                        Task { await engine.stageRecoveryThenDfuPipeline() }
                    }
                    workflowButton("iMazing Crash & Panic Pull", subtitle: "Saves .ips/.panic logs to Downloads", icon: "externaldrive.fill") {
                        Task { await engine.pullAllAppleCrashReports() }
                    }
                    workflowButton("Palera1n Checkm8 & Power", subtitle: "Inspects BootROM & VBUS wattage", icon: "cpu.fill") {
                        Task { await engine.queryAppleSiliconAndChargerDiagnostics() }
                    }
                    workflowButton("Chimera / UnlockTool Security", subtitle: "Audits Knox, KG, AVB & FRP state", icon: "shield.checkered") {
                        Task { await engine.runAndroidDeepSecurityAudit() }
                    }
                }

                Divider()

                HStack(spacing: 12) {
                    Text("Official Portals:")
                        .font(.system(size: 10.5, weight: .bold))
                        .foregroundColor(.secondary)
                    Link("IPSW.me", destination: URL(string: "https://ipsw.me")!)
                    Link("SamFW", destination: URL(string: "https://samfw.com")!)
                    Link("Android Flash Tool", destination: URL(string: "https://flash.android.com")!)
                    Link("libimobiledevice", destination: URL(string: "https://github.com/libimobiledevice/libimobiledevice")!)
                    Link("palera1n", destination: URL(string: "https://github.com/palera1n/palera1n")!)
                    Button("Apple Configurator") {
                        NSWorkspace.shared.open(URL(fileURLWithPath: "/Applications/Apple Configurator.app"))
                    }
                    .controlSize(.mini)
                    Spacer()
                }
                .font(.system(size: 11, weight: .semibold))
            }
            .padding(8)
        }
    }

    private func workflowButton(_ title: String, subtitle: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.accentColor)
                    .frame(width: 22)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 10.5, weight: .bold))
                        .lineLimit(1)
                    Text(subtitle)
                        .font(.system(size: 9.5))
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
                Spacer()
            }
            .padding(.vertical, 7)
            .padding(.horizontal, 9)
            .background(RoundedRectangle(cornerRadius: 6).fill(Color(NSColor.controlBackgroundColor)))
            .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.secondary.opacity(0.16), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}
#endif
