import SwiftUI
import AppKit

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
            }
            .padding(8)
        }
    }
}

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
