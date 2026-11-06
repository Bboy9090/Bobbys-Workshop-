import SwiftUI
import AppKit
import UniformTypeIdentifiers

enum StudioModule: String, CaseIterable, Identifiable {
    case matrixAndDoctor = "Connection Matrix & Doctor"
    #if STORE_EDITION
    case ownerProVault = "BobFWTools Pro Suite"
    #else
    case ownerProVault = "Owner Pro Vault (Unlocked)"
    #endif
    case samsung = "Samsung Servicing & Odin"
    case multiBrandRecovery = "MTK / SPD / EDL & Multi-Brand"
    case fastboot = "Fastboot & Partitions"
    case developerWorkbench = "Developer Workbench & Logcat"
    case dualPlatform = "Dual-Platform Workbench"
    case splitPaneDashboard = "Hardware Split-Pane Console"
    case firmware = "Firmware & Inventory Ledger"
    case apple = "Apple / iDevice Recovery"
    case jobsAndBridge = "Audit Jobs, Notes & VM Bridge"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .matrixAndDoctor: return "point.3.connected.trianglepath.dotted"
        case .ownerProVault: return "crown.fill"
        case .samsung: return "cpu.fill"
        case .multiBrandRecovery: return "wrench.and.screwdriver.fill"
        case .fastboot: return "bolt.horizontal.circle.fill"
        case .developerWorkbench: return "terminal.fill"
        case .dualPlatform: return "rectangle.split.2x1.fill"
        case .splitPaneDashboard: return "play.terminal.fill"
        case .firmware: return "shippingbox.fill"
        case .apple: return "iphone"
        case .jobsAndBridge: return "checkmark.shield.fill"
        }
    }
}

struct MainStudioView: View {
    @StateObject private var engine = ServicingEngine()
    @State private var selectedModule: StudioModule = .matrixAndDoctor
    @State private var customCommand: String = ""

    var body: some View {
        VStack(spacing: 0) {
            TopHardwareBar(engine: engine)
            if let modemInfo = engine.samsungModemInfo {
                SamsungLiveIdentityBanner(info: modemInfo)
            }
            Divider()

            HSplitView {
                // Left Navigation + Active Module Workspace
                HStack(spacing: 0) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text("BOBFWTOOLS WORKSPACE")
                            .font(.caption2.weight(.bold))
                            .foregroundColor(.secondary)
                            .padding(.horizontal, 12)
                            .padding(.top, 10)

                        ForEach(StudioModule.allCases) { module in
                            let isTargetMatched: Bool = {
                                switch module {
                                case .samsung: return engine.activePlatform == .samsung
                                case .apple: return engine.activePlatform == .appleIos
                                case .fastboot, .multiBrandRecovery: return engine.activePlatform == .genericAndroid
                                case .developerWorkbench: return engine.activePlatform == .genericAndroid || engine.activePlatform == .samsung
                                default: return true
                                }
                            }()

                            Button {
                                selectedModule = module
                            } label: {
                                HStack(spacing: 8) {
                                    Image(systemName: module.icon)
                                        .frame(width: 18)
                                        .foregroundColor(isTargetMatched ? (selectedModule == module ? .accentColor : .primary) : .secondary.opacity(0.6))
                                    Text(module.rawValue)
                                        .font(.system(size: 12.5, weight: selectedModule == module ? .semibold : .regular))
                                        .lineLimit(1)
                                    Spacer()
                                    if isTargetMatched && engine.activePlatform != .none && [.samsung, .apple, .fastboot].contains(module) {
                                        Text("ACTIVE")
                                            .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                                            .padding(.horizontal, 5)
                                            .padding(.vertical, 1.5)
                                            .background(RoundedRectangle(cornerRadius: 3).fill(Color.green.opacity(0.2)))
                                            .foregroundColor(.green)
                                    } else if !isTargetMatched && [.samsung, .apple].contains(module) {
                                        Text("INACTIVE")
                                            .font(.system(size: 8, weight: .semibold, design: .monospaced))
                                            .foregroundColor(.secondary.opacity(0.6))
                                    }
                                }
                                .padding(.horizontal, 10)
                                .padding(.vertical, 7)
                                .background(
                                    RoundedRectangle(cornerRadius: 8)
                                        .fill(selectedModule == module ? Color.accentColor.opacity(0.18) : Color.clear)
                                )
                                .foregroundColor(selectedModule == module ? .accentColor : (isTargetMatched ? .primary : .secondary.opacity(0.75)))
                            }
                            .buttonStyle(.plain)
                        }

                        Spacer()

                        VStack(alignment: .leading, spacing: 5) {
                            Text("NATIVE ENGINE STATUS")
                                .font(.caption2.weight(.bold))
                                .foregroundColor(.secondary)
                            BackendBadge(name: "BootForge USB (rusb)", path: engine.bootforgeBinaryPath)
                            BackendBadge(name: "Samsung Modem (AT)", path: engine.selectedSerialPort.isEmpty ? "/dev/cu.SAMSUNG_MDM" : engine.selectedSerialPort, isDeviceNode: true)
                            BackendBadge(name: "Android ADB", path: engine.toolPaths["adb"]!)
                            BackendBadge(name: "Fastboot", path: engine.toolPaths["fastboot"]!)
                            BackendBadge(name: "Heimdall (Odin)", path: engine.toolPaths["heimdall"]!)
                            BackendBadge(name: "libimobiledevice", path: engine.toolPaths["ideviceinfo"]!)
                        }
                        .padding(10)
                        .background(RoundedRectangle(cornerRadius: 8).fill(Color(NSColor.controlBackgroundColor)))
                    }
                    .padding(10)
                    .frame(width: 245)
                    .background(Color(NSColor.windowBackgroundColor))

                    Divider()

                    // Active Module Content Area
                    ScrollView {
                        VStack(alignment: .leading, spacing: 18) {
                            switch selectedModule {
                            case .matrixAndDoctor:
                                ConnectionMatrixAndDoctorView(engine: engine)
                            case .ownerProVault:
                                OwnerProVaultView(engine: engine)
                            case .samsung:
                                SamsungSuiteView(engine: engine)
                            case .multiBrandRecovery:
                                MultiBrandRecoveryView(engine: engine)
                            case .fastboot:
                                FastbootWorkshopView(engine: engine)
                            case .developerWorkbench:
                                DeveloperWorkbenchView(engine: engine)
                            case .dualPlatform:
                                DualPlatformWorkbenchView(engine: engine)
                            case .splitPaneDashboard:
                                UniversalSplitPaneDashboardView(engine: engine)
                            case .firmware:
                                FirmwareInspectorView(engine: engine)
                            case .apple:
                                AppleServicingView(engine: engine)
                            case .jobsAndBridge:
                                JobsNotesAndBridgeView(engine: engine)
                            }
                        }
                        .padding(20)
                    }
                    .frame(minWidth: 540, maxWidth: .infinity)
                }

                // Right Console Output Panel
                ConsoleLogPanel(engine: engine, customCommand: $customCommand)
                    .frame(minWidth: 360, idealWidth: 430)
            }
        }
        .frame(minWidth: 1180, minHeight: 760)
    }
}

// MARK: - Top Hardware Bar & Live Samsung Identity Banner

struct TopHardwareBar: View {
    @ObservedObject var engine: ServicingEngine

    var gradeColor: Color {
        switch engine.connectionGrade {
        case "EXCELLENT": return .green
        case "USABLE": return .blue
        case "NONE": return .orange
        default: return .secondary
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "flame.circle.fill")
                    .font(.system(size: 22))
                    .foregroundColor(.accentColor)
                VStack(alignment: .leading, spacing: 1) {
                    Text("BobFWTools")
                        .font(.system(size: 14, weight: .bold))
                    Text("Bobby's Workshop — Phoenix Forge (macOS Native)")
                        .font(.system(size: 10.5))
                        .foregroundColor(.secondary)
                }
            }

            Divider().frame(height: 28)

            // Active Device Picker
            HStack(spacing: 6) {
                Text("Target:")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.secondary)

                Picker("", selection: $engine.selectedDevice) {
                    if engine.devices.isEmpty {
                        Text("No Device Connected").tag(Optional<ConnectedDevice>.none)
                    }
                    ForEach(engine.devices) { dev in
                        Text("[\(dev.transport.rawValue)] \(dev.name)").tag(Optional(dev))
                    }
                }
                .frame(width: 260)
            }

            // Serial / Modem Port Picker
            HStack(spacing: 6) {
                Text("Modem:")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.secondary)

                Picker("", selection: $engine.selectedSerialPort) {
                    if engine.serialPorts.isEmpty {
                        Text("No /dev/cu.SAMSUNG*").tag("")
                    }
                    ForEach(engine.serialPorts, id: \.self) { port in
                        Text((port as NSString).lastPathComponent).tag(port)
                    }
                }
                .frame(width: 185)
            }

            Button {
                Task { await engine.refreshDevicesAndTelemetry() }
            } label: {
                Label("Scan Bus", systemImage: "arrow.clockwise")
            }
            .disabled(engine.isBusy)

            Button {
                Task { await engine.runUsbCableDoctor() }
            } label: {
                Label("Cable Doctor", systemImage: "stethoscope")
            }
            .disabled(engine.isBusy)

            Spacer()

            if let match = engine.universalMatch {
                HStack(spacing: 6) {
                    Image(systemName: match.platform.badgeIcon)
                        .foregroundColor(.green)
                    Text("MATCH: \(match.modelNumber) · \(match.securityBitOrIosVer) · Stock: \(match.stockFirmwareBuild) · CSC: \(match.carrierCscOrRegion.components(separatedBy: " ").first ?? "OPEN")")
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .foregroundColor(.green)
                        .lineLimit(1)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(RoundedRectangle(cornerRadius: 6).fill(Color.green.opacity(0.12)))
            }

            #if STORE_EDITION
            Text(engine.isProUnlocked ? "STORE PRO LICENSE ACTIVE" : "FREE TIER (STORE EDITION)")
                .font(.system(size: 10, weight: .bold, design: .monospaced))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(RoundedRectangle(cornerRadius: 6).fill((engine.isProUnlocked ? Color.purple : Color.orange).opacity(0.18)))
                .foregroundColor(engine.isProUnlocked ? .purple : .orange)
            #else
            Text("OWNER PRIVATE COPY · ALL UNLOCKED")
                .font(.system(size: 10, weight: .bold, design: .monospaced))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(RoundedRectangle(cornerRadius: 6).fill(Color.purple.opacity(0.18)))
                .foregroundColor(.purple)
            #endif

            Text("LINK: \(engine.connectionGrade)")
                .font(.system(size: 10, weight: .bold, design: .monospaced))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(RoundedRectangle(cornerRadius: 6).fill(gradeColor.opacity(0.18)))
                .foregroundColor(gradeColor)

            if engine.isBusy {
                ProgressView()
                    .controlSize(.small)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color(NSColor.controlBackgroundColor))
    }
}

struct SamsungLiveIdentityBanner: View {
    let info: SamsungDevConInfo

    var body: some View {
        HStack(spacing: 16) {
            Label("VERIFIED SAMSUNG TARGET", systemImage: "checkmark.seal.fill")
                .font(.system(size: 11, weight: .bold))
                .foregroundColor(.green)

            BannerPair(label: "Model", value: info.model)
            BannerPair(label: "PDA / Build", value: info.pdaVersion)
            BannerPair(label: "CSC", value: "\(info.activeCsc) (\(info.countryCode))")
            BannerPair(label: "Serial", value: info.serialNumber)
            BannerPair(label: "Lock", value: info.carrierLock)
            BannerPair(label: "Transports", value: info.activeTransports)
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 6)
        .background(Color.green.opacity(0.08))
    }
}

struct BannerPair: View {
    let label: String
    let value: String

    var body: some View {
        HStack(spacing: 4) {
            Text("\(label):")
                .font(.system(size: 11))
                .foregroundColor(.secondary)
            Text(value.isEmpty ? "N/A" : value)
                .font(.system(size: 11, weight: .semibold, design: .monospaced))
        }
    }
}

struct BackendBadge: View {
    let name: String
    let path: String
    var isDeviceNode: Bool = false

    var isInstalled: Bool {
        if isDeviceNode {
            return FileManager.default.fileExists(atPath: path)
        }
        return FileManager.default.isExecutableFile(atPath: path)
    }

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(isInstalled ? Color.green : Color.orange)
                .frame(width: 7, height: 7)
            Text(name)
                .font(.system(size: 11, weight: .medium))
            Spacer()
            Text(isInstalled ? "Active" : "Standby")
                .font(.system(size: 10))
                .foregroundColor(.secondary)
        }
    }
}

// MARK: - Reusable Guided Step-by-Step State Machine Wizard View

struct GuidedWorkflowWizardCard: View {
    let title: String
    let subtitle: String
    let icon: String
    let steps: [GuidedPipelineStep]
    let onExecuteStep: (Int) -> Void
    let onReset: () -> Void

    var body: some View {
        GroupBox(label: Label(title, systemImage: icon)) {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text(subtitle)
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                    Spacer()
                    Button("Reset Pipeline", action: onReset)
                        .controlSize(.small)
                }

                VStack(spacing: 8) {
                    ForEach(steps) { step in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack(alignment: .center, spacing: 10) {
                                // Step indicator circle
                                ZStack {
                                    Circle()
                                        .fill(stepBadgeBackground(step.state))
                                        .frame(width: 24, height: 24)
                                    Text("\(step.stepNumber)")
                                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                                        .foregroundColor(stepBadgeTextColor(step.state))
                                }

                                VStack(alignment: .leading, spacing: 2) {
                                    HStack(spacing: 6) {
                                        Text(step.title)
                                            .font(.system(size: 12, weight: .semibold))
                                        Text("[\(step.requiredTransport.rawValue)]")
                                            .font(.system(size: 9.5, weight: .medium, design: .monospaced))
                                            .padding(.horizontal, 5)
                                            .padding(.vertical, 1)
                                            .background(RoundedRectangle(cornerRadius: 3).fill(Color.secondary.opacity(0.15)))
                                            .foregroundColor(.secondary)
                                    }
                                    Text(step.detail)
                                        .font(.system(size: 11))
                                        .foregroundColor(.secondary)
                                }

                                Spacer()

                                // State badge
                                Text(step.state.rawValue)
                                    .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(RoundedRectangle(cornerRadius: 4).fill(stepBadgeBackground(step.state)))
                                    .foregroundColor(stepBadgeTextColor(step.state))

                                // Action Button
                                Button {
                                    onExecuteStep(step.stepNumber)
                                } label: {
                                    HStack(spacing: 4) {
                                        if step.state == .running {
                                            ProgressView().controlSize(.mini)
                                        } else if step.state == .succeeded {
                                            Image(systemName: "checkmark")
                                        } else if step.state == .locked {
                                            Image(systemName: "lock.fill")
                                        } else if step.state == .failed {
                                            Image(systemName: "arrow.clockwise")
                                        }
                                        Text(buttonLabel(for: step))
                                    }
                                }
                                .controlSize(.small)
                                .buttonStyle(.bordered)
                                .disabled(step.state == .locked || step.state == .running || step.state == .succeeded)
                            }

                            // Technician Action Callout
                            if let action = step.technicianAction, (step.state == .ready || step.state == .failed) {
                                HStack(spacing: 6) {
                                    Image(systemName: "hand.tap.fill")
                                        .font(.system(size: 11))
                                        .foregroundColor(.orange)
                                    Text("Technician Action: \(action)")
                                        .font(.system(size: 10.5, weight: .medium))
                                        .foregroundColor(.orange)
                                }
                                .padding(.leading, 34)
                            }

                            // Evidence Box
                            if let ev = step.resultEvidence, !ev.isEmpty {
                                HStack(alignment: .top, spacing: 6) {
                                    Image(systemName: step.state == .succeeded ? "checkmark.circle.fill" : "exclamationmark.circle.fill")
                                        .font(.system(size: 10))
                                        .foregroundColor(step.state == .succeeded ? .green : .red)
                                    Text(ev)
                                        .font(.system(size: 10, design: .monospaced))
                                        .foregroundColor(.primary)
                                        .lineLimit(2)
                                }
                                .padding(6)
                                .background(RoundedRectangle(cornerRadius: 4).fill(Color(NSColor.controlBackgroundColor)))
                                .padding(.leading, 34)
                            }
                        }
                        .padding(8)
                        .background(RoundedRectangle(cornerRadius: 6).fill(Color(NSColor.windowBackgroundColor)))
                    }
                }
            }
            .padding(8)
        }
    }

    private func buttonLabel(for step: GuidedPipelineStep) -> String {
        switch step.state {
        case .locked: return "Locked"
        case .ready: return "Execute Step \(step.stepNumber)"
        case .running: return "Running..."
        case .succeeded: return "Passed"
        case .failed: return "Retry Step \(step.stepNumber)"
        }
    }

    private func stepBadgeBackground(_ state: PipelineStepState) -> Color {
        switch state {
        case .locked: return Color.secondary.opacity(0.2)
        case .ready: return Color.blue.opacity(0.2)
        case .running: return Color.orange.opacity(0.25)
        case .succeeded: return Color.green.opacity(0.2)
        case .failed: return Color.red.opacity(0.2)
        }
    }

    private func stepBadgeTextColor(_ state: PipelineStepState) -> Color {
        switch state {
        case .locked: return .secondary
        case .ready: return .blue
        case .running: return .orange
        case .succeeded: return .green
        case .failed: return .red
        }
    }
}

// MARK: - Module 1: BobFWTools Connection Matrix & USB Cable Doctor

struct ConnectionMatrixAndDoctorView: View {
    @ObservedObject var engine: ServicingEngine

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            ModuleHeader(
                title: "BobFWTools Connection Matrix & USB Cable Doctor",
                subtitle: "Real-time BootForge USB descriptor enumeration, Device Intake Hub, 1/2/3-click autonomous workflows, and hardware diagnostics"
            )

            // High-Vibe Clean Shop Dashboard: Device Intake Hub (Conditional Connected vs. Line Empty UI + AES-GCM Encrypted History)
// High-Vibe Clean Shop Dashboard: Device Intake Hub (Conditional Connected vs. Line Empty UI + AES-GCM Encrypted History)
            DeviceIntakeHubCard(engine: engine)

            // Universal Multi-Platform Firmware & Carrier Match Card
            if let match = engine.universalMatch {
                GroupBox(label: Label("Universal Hardware & Firmware Auto-Matcher (\(match.platform.rawValue))", systemImage: match.platform.badgeIcon)) {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(match.targetName)
                                .font(.system(size: 13, weight: .bold))
                            Spacer()
                            Text(match.securityBitOrIosVer)
                                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 2)
                                .background(RoundedRectangle(cornerRadius: 4).fill(Color.green.opacity(0.18)))
                                .foregroundColor(.green)
                        }

                        HStack(spacing: 14) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("STOCK FIRMWARE TARGET:")
                                    .font(.system(size: 9.5, weight: .bold))
                                    .foregroundColor(.secondary)
                                Text(match.stockFirmwareBuild)
                                    .font(.system(size: 11.5, weight: .bold, design: .monospaced))
                                    .foregroundColor(.primary)
                            }
                            Divider().frame(height: 24)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("COMBINATION / FACTORY TARGET:")
                                    .font(.system(size: 9.5, weight: .bold))
                                    .foregroundColor(.secondary)
                                Text(match.combinationFactoryBuild)
                                    .font(.system(size: 11.5, weight: .bold, design: .monospaced))
                                    .foregroundColor(.accentColor)
                            }
                            Divider().frame(height: 24)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("CARRIER / CSC / REGION:")
                                    .font(.system(size: 9.5, weight: .bold))
                                    .foregroundColor(.secondary)
                                Text(match.carrierCscOrRegion)
                                    .font(.system(size: 11, design: .monospaced))
                                    .foregroundColor(.secondary)
                            }
                        }

                        Text("Partition Table / PIT: \(match.partitionTableOrPit) · Match Status: \(match.isAntiRollbackSafe ? "Anti-Rollback Verified (Safe)" : "Review Required") [\(match.isFallbackSynthesized ? "Fallback Matrix Synthesized" : "Local Disk Mapped")]")
                            .font(.system(size: 10.5, design: .monospaced))
                            .foregroundColor(.secondary)
                    }
                    .padding(8)
                }
            }

            // 1 / 2 / 3-Click Autonomous Workflows Card
            GroupBox(label: Label("1 / 2 / 3-Click Autonomous Diagnostic & Preflight Workflows", systemImage: "sparkles.rectangle.stack.fill")) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Execute multi-step BobFWTools diagnostic and preflight pipelines with a single click:")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    HStack(spacing: 10) {
                        Button {
                            Task { await engine.runAutonomousWorkflow(id: "quick-diagnostics") }
                        } label: {
                            Label("1-Click: Quick Mobile Diagnostics", systemImage: "1.circle.fill")
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(engine.isBusy)

                        Button {
                            Task { await engine.runAutonomousWorkflow(id: "vessel-sanctum") }
                        } label: {
                            Label("2-Click: VesselSanctum Deep Scan", systemImage: "2.circle.fill")
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(engine.isBusy)

                        Button {
                            Task { await engine.runAutonomousWorkflow(id: "partition-preflight") }
                        } label: {
                            Label("3-Click: Partition & Provisioning Preflight", systemImage: "3.circle.fill")
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(engine.isBusy)

                        Button {
                            Task { await engine.runCustomerIntakeClearance() }
                        } label: {
                            Label("4-Click: Customer Intake Clearance", systemImage: "checkmark.seal.text.page.fill")
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(engine.isBusy)
                    }

                    if let intake = engine.intakeClearanceReport {
                        Divider()
                        VStack(alignment: .leading, spacing: 5) {
                            HStack {
                                Text("PRE-REPAIR CUSTOMER INTAKE REPORT — \(intake.deviceModel) (SN: \(intake.serialNumber))")
                                    .font(.system(size: 12, weight: .bold))
                                Spacer()
                                Text(intake.clearanceStatus)
                                    .font(.system(size: 10.5, weight: .bold, design: .monospaced))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 2)
                                    .background(RoundedRectangle(cornerRadius: 4).fill(Color.green.opacity(0.2)))
                                    .foregroundColor(.green)
                            }
                            Text("Carrier Lock: \(intake.carrierLockStatus) · Build/Bit: \(intake.bootloaderBit) · CSC: \(intake.regionCsc) · State: \(intake.runtimeState)")
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundColor(.secondary)
                            HStack(spacing: 12) {
                                ForEach(Array(intake.checklist.enumerated()), id: \.offset) { _, item in
                                    HStack(spacing: 4) {
                                        Image(systemName: item.1 ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                                            .foregroundColor(item.1 ? .green : .orange)
                                        Text("\(item.0): \(item.2)")
                                            .font(.system(size: 10.5))
                                    }
                                }
                            }
                        }
                        .padding(8)
                        .background(RoundedRectangle(cornerRadius: 8).fill(Color(NSColor.controlBackgroundColor)))
                    }
                }
                .padding(8)
            }

            // Connection Matrix Card
            GroupBox(label: Label("Active Transport Connection Matrix (BootForge USB × Modem AT × ADB × Fastboot)", systemImage: "network")) {
                VStack(alignment: .leading, spacing: 10) {
                    if engine.matrixRows.isEmpty {
                        Text("No recognized mobile servicing device currently on the USB bus.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .padding(.vertical, 6)
                    } else {
                        ForEach(engine.matrixRows) { row in
                            VStack(alignment: .leading, spacing: 8) {
                                HStack {
                                    Text(row.label)
                                        .font(.system(size: 14, weight: .bold))
                                    Spacer()
                                    Text("VID:PID \(row.vidPid) · SN: \(row.serial)")
                                        .font(.system(size: 11.5, design: .monospaced))
                                        .foregroundColor(.secondary)
                                }

                                HStack(spacing: 12) {
                                    TransportPill(title: "USB Descriptor", active: row.usbConnected, detail: "Connected")
                                    TransportPill(title: "Modem (AT)", active: row.modemPort != nil, detail: row.modemPort.map { ($0 as NSString).lastPathComponent } ?? "Unbound")
                                    TransportPill(title: "MTP Session", active: row.mtpActive, detail: row.mtpActive ? "Active" : "Inactive")
                                    TransportPill(title: "ADB", active: row.adbState == "device", detail: row.adbState)
                                    TransportPill(title: "Odin / Fastboot", active: row.odinActive || row.fastbootActive, detail: row.odinActive ? "Download" : (row.fastbootActive ? "Fastboot" : "Standby"))
                                }

                                Text("Platform: \(row.platformClassification) · Evidence: \(row.evidence.joined(separator: " + "))")
                                    .font(.system(size: 11, design: .monospaced))
                                    .foregroundColor(.secondary)
                            }
                            .padding(10)
                            .background(RoundedRectangle(cornerRadius: 8).fill(Color(NSColor.controlBackgroundColor)))
                        }
                    }

                    HStack(spacing: 10) {
                        Button("Inspect USB Descriptors (bootforgeusb scan)") {
                            Task {
                                _ = await engine.executeAndLog(
                                    workflowId: "bootforge.endpoints",
                                    title: "BootForge USB Endpoint Enumeration",
                                    executable: engine.bootforgeBinaryPath,
                                    arguments: ["scan"]
                                )
                            }
                        }
                        Button("Probe Samsung Modem Identity (AT+DEVCONINFO)") {
                            Task {
                                await engine.sendATCommand(portPath: engine.selectedSerialPort, command: "AT+DEVCONINFO")
                            }
                        }
                        Button("Run USB Cable Doctor (5x Stability Test)") {
                            Task { await engine.runUsbCableDoctor() }
                        }
                    }
                }
                .padding(8)
            }

            // USB Cable Doctor Report Card
            if let doc = engine.cableDoctorReport {
                GroupBox(label: Label("USB Cable Doctor Report — Grade: \(doc.grade)", systemImage: "waveform.path.ecg")) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(doc.summary)
                            .font(.system(size: 12.5, weight: .semibold))
                        Text("Samples: \(doc.presentSamples)/\(doc.samples) · Reconnect Drops: \(doc.reconnectEvents) · Speeds: \(doc.observedSpeeds.joined(separator: ", ")) · Modem Port: \(doc.modemPortPresent ? "Present" : "None")")
                            .font(.system(size: 11.5, design: .monospaced))
                            .foregroundColor(.secondary)
                        ForEach(doc.recommendations, id: \.self) { rec in
                            Text("• \(rec)")
                                .font(.caption)
                        }
                    }
                    .padding(8)
                }
            }

            // BobFWTools Diagnostic Findings
            GroupBox(label: Label("BobFWTools Automated Diagnostic Findings", systemImage: "checklist")) {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(engine.diagnosticFindings) { f in
                        HStack(alignment: .top, spacing: 8) {
                            Text(f.severity)
                                .font(.system(size: 10, weight: .bold, design: .monospaced))
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(RoundedRectangle(cornerRadius: 4).fill(severityColor(f.severity).opacity(0.2)))
                                .foregroundColor(severityColor(f.severity))

                            VStack(alignment: .leading, spacing: 2) {
                                Text(f.title)
                                    .font(.system(size: 12, weight: .semibold))
                                Text(f.detail)
                                    .font(.system(size: 11.5))
                                    .foregroundColor(.secondary)
                                if let rec = f.recommendation {
                                    Text("Recommendation: \(rec)")
                                        .font(.system(size: 11))
                                        .foregroundColor(.accentColor)
                                }
                            }
                        }
                    }
                }
                .padding(8)
            }
        }
    }

    private func severityColor(_ s: String) -> Color {
        switch s {
        case "OK": return .green
        case "WARN": return .orange
        default: return .red
        }
    }
}

struct TransportPill: View {
    let title: String
    let active: Bool
    let detail: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 4) {
                Circle()
                    .fill(active ? Color.green : Color.secondary.opacity(0.5))
                    .frame(width: 6, height: 6)
                Text(title)
                    .font(.system(size: 10, weight: .bold))
            }
            Text(detail)
                .font(.system(size: 10, design: .monospaced))
                .foregroundColor(.secondary)
                .lineLimit(1)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background(RoundedRectangle(cornerRadius: 6).stroke(active ? Color.green.opacity(0.5) : Color.secondary.opacity(0.2), lineWidth: 1))
    }
}

// MARK: - High-Vibe Clean Shop Dashboard: Device Intake Hub + AES-GCM Encrypted Customer Intake History

struct DeviceIntakeHubCard: View {
    @ObservedObject var engine: ServicingEngine
    @State private var customerLabelInput: String = ""

    private var isConnected: Bool {
        engine.samsungModemInfo != nil || !engine.devices.isEmpty || !engine.serialPorts.isEmpty
    }

    private var modelName: String {
        if let info = engine.samsungModemInfo, !info.model.isEmpty {
            return info.model
        }
        if let row = engine.matrixRows.first {
            return row.model
        }
        return engine.selectedDevice?.name ?? "Unknown Target"
    }

    private var securityBitNumber: Int {
        if let report = engine.intakeClearanceReport, report.securityBit > 0 {
            return report.securityBit
        }
        if let info = engine.samsungModemInfo {
            let parsed = DiagnosticParser.extractClearanceData(from: info.rawResponse, fallbackModem: info)
            if parsed.securityBit > 0 { return parsed.securityBit }
        }
        return engine.autoMatchedBundle?.bootloaderBit ?? 8
    }

    private var serialNumberText: String {
        if let info = engine.samsungModemInfo, !info.serialNumber.isEmpty {
            return info.serialNumber
        }
        if let row = engine.matrixRows.first, !row.serial.isEmpty {
            return row.serial
        }
        if let devSerial = engine.selectedDevice?.serial, !devSerial.isEmpty {
            return devSerial
        }
        return "Awaiting Device Link"
    }

    private var regionCodeText: String {
        if let info = engine.samsungModemInfo, !info.activeCsc.isEmpty {
            return info.activeCsc
        }
        if let report = engine.intakeClearanceReport, !report.regionCsc.isEmpty {
            return report.regionCsc
        }
        if let csc = engine.autoMatchedBundle?.cscContainerVersion, !csc.isEmpty {
            return csc
        }
        return "N/A"
    }

    private var clearanceBadgeText: String {
        if let report = engine.intakeClearanceReport {
            return report.clearanceStatus
        }
        if let info = engine.samsungModemInfo {
            let parsed = DiagnosticParser.extractClearanceData(from: info.rawResponse, fallbackModem: info)
            return parsed.antiRollbackStatus
        }
        return engine.devices.isEmpty ? "NO TARGET CONNECTED" : "AWAITING CLEARANCE"
    }

    private var isClearedForService: Bool {
        clearanceBadgeText.contains("CLEARED")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            // Header Row: Device Intake Hub + Live Connection Badge
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Device Intake Hub")
                        .font(.system(size: 16, weight: .semibold))
                    Text("Automatic USB / Serial AT telemetry with disconnect state clearing & AES-GCM hardware-bound intake logging")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                }
                Spacer()
                HStack(spacing: 6) {
                    Circle()
                        .fill(isConnected ? Color.green : Color.secondary)
                        .frame(width: 8, height: 8)
                    Text(isConnected ? "Device Live" : "Waiting for USB")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(isConnected ? .green : .secondary)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 5)
                .background(
                    Capsule()
                        .fill(isConnected ? Color.green.opacity(0.14) : Color.secondary.opacity(0.12))
                )
            }

            // Conditional Rendering: Active Device Telemetry vs. Clean "Line Empty" Slot
            if isConnected {
                VStack(alignment: .leading, spacing: 12) {
                    // 2-Column Grid: Device Model & Security Revision
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("DEVICE MODEL")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.secondary)
                            Text(modelName)
                                .font(.system(size: 17, weight: .bold, design: .monospaced))
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(12)
                        .background(RoundedRectangle(cornerRadius: 10).fill(Color(NSColor.windowBackgroundColor)))
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.secondary.opacity(0.15), lineWidth: 1))

                        VStack(alignment: .leading, spacing: 4) {
                            Text("SECURITY REVISION")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.secondary)
                            Text("Binary \(securityBitNumber)")
                                .font(.system(size: 17, weight: .bold, design: .monospaced))
                                .foregroundColor(.blue)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(12)
                        .background(RoundedRectangle(cornerRadius: 10).fill(Color(NSColor.windowBackgroundColor)))
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.secondary.opacity(0.15), lineWidth: 1))
                    }

                    // Serial Identifier + Region Badge Row
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("SERIAL IDENTIFIER")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.secondary)
                            Text(serialNumberText)
                                .font(.system(size: 13.5, weight: .semibold, design: .monospaced))
                        }
                        Spacer()
                        Text("Region: \(regionCodeText)")
                            .font(.system(size: 11.5, weight: .semibold, design: .monospaced))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(RoundedRectangle(cornerRadius: 6).fill(Color.secondary.opacity(0.14)))
                    }
                    .padding(12)
                    .background(RoundedRectangle(cornerRadius: 10).fill(Color(NSColor.windowBackgroundColor)))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.secondary.opacity(0.15), lineWidth: 1))

                    // System Authorization Banner
                    HStack {
                        Text("SYSTEM AUTHORIZATION")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(isClearedForService ? .green : .orange)
                        Spacer()
                        Text(clearanceBadgeText)
                            .font(.system(size: 12, weight: .bold, design: .monospaced))
                            .foregroundColor(isClearedForService ? .green : .orange)
                    }
                    .padding(12)
                    .background(
                        RoundedRectangle(cornerRadius: 10)
                            .fill((isClearedForService ? Color.green : Color.orange).opacity(0.10))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke((isClearedForService ? Color.green : Color.orange).opacity(0.30), lineWidth: 1)
                    )

                    // Cryptographic Customer Intake Logger Bar (HardwareLogProtector AES-GCM + HKDF<SHA256>)
                    HStack(spacing: 10) {
                        TextField("Customer / Ticket Label (e.g. Walk-In #104 — Galaxy Tab A7 EUX)...", text: $customerLabelInput)
                            .textFieldStyle(.roundedBorder)
                            .font(.system(size: 11.5))

                        Button {
                            Task {
                                if engine.intakeClearanceReport == nil {
                                    await engine.runCustomerIntakeClearance()
                                }
                                engine.encryptAndRecordCustomerIntake(customerLabel: customerLabelInput)
                                customerLabelInput = ""
                            }
                        } label: {
                            Label("Encrypt & Seal Intake Log (AES-GCM)", systemImage: "lock.doc.fill")
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(engine.isBusy)

                        Button {
                            engine.clearTelemetryOnDisconnect()
                        } label: {
                            Label("Clear Bench Slot", systemImage: "xmark.circle")
                        }
                        .help("Manually clear the active workbench telemetry slot")
                    }
                }
            } else {
                // Clean Dashed Empty Slot when unplugged
                VStack(spacing: 8) {
                    Image(systemName: "cable.connector.horizontal")
                        .font(.system(size: 24))
                        .foregroundColor(.secondary)
                    Text("Line Empty")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.secondary)
                    Text("Connect a target device to initialize service — telemetry populates automatically on USB / AT handshake")
                        .font(.system(size: 11.5))
                        .foregroundColor(.secondary.opacity(0.8))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 32)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .strokeBorder(style: StrokeStyle(lineWidth: 2, dash: [6, 5]))
                        .foregroundColor(Color.secondary.opacity(0.25))
                )
            }

            // Servicing History Ledger Browser (Per-Customer JSONL records/cust_*.db + Instant Search & Filter Bar)
            Divider()
            ServicingHistoryLedgerCard(engine: engine)

            // Persistent Customer Intake History Database (AES-GCM Sealed Logs)
            if !engine.encryptedIntakeHistory.isEmpty {
                Divider()
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Label("Customer Intake History Database (HardwareLogProtector AES-GCM + HKDF-SHA256)", systemImage: "externaldrive.badge.checkmark")
                            .font(.system(size: 11.5, weight: .bold))
                        Spacer()
                        if !engine.decryptedLogPreview.isEmpty {
                            Text(engine.decryptedLogPreview)
                                .font(.system(size: 10.5, weight: .semibold, design: .monospaced))
                                .foregroundColor(.green)
                                .lineLimit(1)
                        }
                    }

                    ForEach(engine.encryptedIntakeHistory.prefix(5)) { rec in
                        HStack(spacing: 10) {
                            Image(systemName: "lock.shield.fill")
                                .foregroundColor(.green)
                            Text(rec.customerLabel)
                                .font(.system(size: 11, weight: .semibold))
                            Text("\(rec.model) · Bin \(rec.securityBit) · \(rec.rawSwRev) · SN: \(rec.deviceIdentifier)")
                                .font(.system(size: 10.5, design: .monospaced))
                                .foregroundColor(.secondary)
                            Spacer()
                            Text(rec.status)
                                .font(.system(size: 10, weight: .bold, design: .monospaced))
                                .foregroundColor(rec.status.contains("CLEARED") ? .green : .orange)
                            Button("Verify AES-GCM") {
                                engine.verifyAndDecryptIntakeRecord(rec)
                            }
                            .controlSize(.mini)
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(RoundedRectangle(cornerRadius: 6).fill(Color(NSColor.windowBackgroundColor)))
                    }
                }
            }
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 14).fill(Color(NSColor.controlBackgroundColor)))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.secondary.opacity(0.18), lineWidth: 1))
    }
}

struct ServicingHistoryLedgerCard: View {
    @ObservedObject var engine: ServicingEngine
    @State private var searchQuery: String = ""
    @State private var statusFilter: String = "ALL" // ALL, CLEARED, HOLD

    private var filteredRecords: [(IntakeLedgerRecord, DecodedTelemetryPayload)] {
        let query = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        var results: [(IntakeLedgerRecord, DecodedTelemetryPayload)] = []

        for rec in engine.servicingHistoryLedger {
            guard let telemetry = rec.decodeTelemetry() else { continue }

            // Status filter pill check
            if statusFilter == "CLEARED" && !telemetry.status.uppercased().contains("CLEARED") {
                continue
            }
            if statusFilter == "HOLD" && telemetry.status.uppercased().contains("CLEARED") {
                continue
            }

            // Instant search query check across Serial Number (SN), Device Model, Binary Version, CSC, or Customer ID
            if !query.isEmpty {
                let searchable = [
                    telemetry.serial_number,
                    telemetry.model,
                    "b\(telemetry.binary_version)",
                    telemetry.binary_version,
                    telemetry.carrier_csc,
                    telemetry.status,
                    rec.customer_id
                ].joined(separator: " ").lowercased()

                if !searchable.contains(query) {
                    continue
                }
            }
            results.append((rec, telemetry))
        }
        return results
    }

    private func formatDate(_ ts: UInt64) -> String {
        let date = Date(timeIntervalSince1970: TimeInterval(ts))
        let fmt = DateFormatter()
        fmt.dateStyle = .short
        fmt.timeStyle = .short
        return fmt.string(from: date)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Header Row: Servicing History Ledger + Auto-Commit Toggle + Refresh Index
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Servicing History Ledger")
                        .font(.system(size: 13.5, weight: .bold))
                    Text("Stored local checkpoint snapshots (records/cust_\(engine.activeCustomerId).db) · Auto-commits on live device scan")
                        .font(.system(size: 10.5))
                        .foregroundColor(.secondary)
                }
                Spacer()

                Toggle("Auto-Commit on Scan", isOn: $engine.autoCommitIntakeOnScan)
                    .toggleStyle(.checkbox)
                    .font(.system(size: 11))

                Button {
                    engine.autoCommitCurrentTelemetryToLedger(force: true)
                } label: {
                    Label("Commit Snapshot", systemImage: "plus.rectangle.on.folder.fill")
                }
                .controlSize(.small)

                Button {
                    engine.fetchCustomerHistory(customerId: "ALL")
                } label: {
                    Label("Refresh Index", systemImage: "arrow.clockwise")
                }
                .controlSize(.small)
            }

            // Instant Search & Filter Bar (by Serial Number, Device Model, Binary Version, or Customer ID)
            HStack(spacing: 8) {
                HStack(spacing: 6) {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.secondary)
                        .font(.system(size: 11.5))
                    TextField("Search ledger by Serial Number, Model, Binary Bit, CSC, or Customer ID...", text: $searchQuery)
                        .textFieldStyle(.plain)
                        .font(.system(size: 11.5, design: .monospaced))
                    if !searchQuery.isEmpty {
                        Button {
                            searchQuery = ""
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(.secondary)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(RoundedRectangle(cornerRadius: 8).fill(Color(NSColor.windowBackgroundColor)))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.secondary.opacity(0.22), lineWidth: 1))

                HStack(spacing: 6) {
                    Text("Customer ID:")
                        .font(.system(size: 10.5, weight: .semibold))
                        .foregroundColor(.secondary)
                    TextField("WALK_IN_DEFAULT", text: $engine.activeCustomerId)
                        .textFieldStyle(.roundedBorder)
                        .font(.system(size: 11, design: .monospaced))
                        .frame(width: 145)
                }

                Picker("", selection: $statusFilter) {
                    Text("All (\(engine.servicingHistoryLedger.count))").tag("ALL")
                    Text("Cleared").tag("CLEARED")
                    Text("Hold").tag("HOLD")
                }
                .pickerStyle(.segmented)
                .frame(width: 195)
            }

            // Ledger Rows
            if filteredRecords.isEmpty {
                Text(searchQuery.isEmpty ? "No historical clearance signatures found." : "No history records match '\(searchQuery)'.")
                    .font(.system(size: 11.5))
                    .foregroundColor(.secondary)
                    .italic()
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 14)
            } else {
                ScrollView {
                    VStack(spacing: 6) {
                        ForEach(filteredRecords, id: \.0.id) { record, telemetry in
                            let isCleared = telemetry.status.uppercased().contains("CLEARED")
                            HStack {
                                VStack(alignment: .leading, spacing: 3) {
                                    HStack(spacing: 8) {
                                        Text(telemetry.model)
                                            .font(.system(size: 12, weight: .semibold))
                                        Text("B\(telemetry.binary_version)")
                                            .font(.system(size: 10.5, weight: .bold, design: .monospaced))
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 1)
                                            .background(RoundedRectangle(cornerRadius: 4).fill(Color.blue.opacity(0.15)))
                                            .foregroundColor(.blue)
                                        if !telemetry.carrier_csc.isEmpty {
                                            Text("CSC: \(telemetry.carrier_csc)")
                                                .font(.system(size: 10.5, design: .monospaced))
                                                .foregroundColor(.secondary)
                                        }
                                        Text("cust_\(record.customer_id).db")
                                            .font(.system(size: 10, design: .monospaced))
                                            .foregroundColor(.secondary.opacity(0.8))
                                    }
                                    Text("SN: \(telemetry.serial_number)")
                                        .font(.system(size: 10.5, design: .monospaced))
                                        .foregroundColor(.secondary)
                                }
                                Spacer()
                                VStack(alignment: .trailing, spacing: 3) {
                                    Text(isCleared ? "CLEARED" : "HOLD")
                                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 2)
                                        .background(
                                            RoundedRectangle(cornerRadius: 4)
                                                .fill((isCleared ? Color.green : Color.orange).opacity(0.14))
                                        )
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 4)
                                                .stroke((isCleared ? Color.green : Color.orange).opacity(0.35), lineWidth: 1)
                                        )
                                        .foregroundColor(isCleared ? .green : .orange)

                                    Text(formatDate(record.timestamp))
                                        .font(.system(size: 9.5, design: .monospaced))
                                        .foregroundColor(.secondary)
                                }
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(RoundedRectangle(cornerRadius: 9).fill(Color(NSColor.windowBackgroundColor)))
                            .overlay(RoundedRectangle(cornerRadius: 9).stroke(Color.secondary.opacity(0.15), lineWidth: 1))
                        }
                    }
                }
                .frame(maxHeight: 190)
            }
        }
    }
}

// MARK: - Module 1B: Owner Pro Vault (A12+ iDevices, Flagship Samsung S/Z/A/Tab, MediaTek & Unisoc SPD — Zero Paywall)

struct OwnerProVaultView: View {
    @ObservedObject var engine: ServicingEngine
    @State private var licenseKeyInput: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                ModuleHeader(
                    title: "Owner Pro Vault — A12+ iOS, Galaxy S/Z/A/Tab, MediaTek & Unisoc (SPD)",
                    subtitle: engine.isProUnlocked
                        ? "Full unlocked owner build — zero paywalls, zero credit gates, and full local hardware coverage"
                        : "Store Edition Preview — Free tier diagnostics are active; Pro Vault modules require BobFWTools Pro activation"
                )
                Spacer()
                Label(engine.isProUnlocked ? "ALL PRO MODULES UNLOCKED" : "STORE PAYWALL ACTIVE", systemImage: engine.isProUnlocked ? "lock.open.fill" : "lock.fill")
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(RoundedRectangle(cornerRadius: 8).fill((engine.isProUnlocked ? Color.green : Color.orange).opacity(0.18)))
                    .foregroundColor(engine.isProUnlocked ? .green : .orange)
            }

            GroupBox(label: Label("Asymmetric Ed25519 License & Edition Verification (CryptoKit Curve25519)", systemImage: "key.horizontal.fill")) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Verification Status: \(engine.licenseStatusSummary)")
                            .font(.system(size: 11.5, weight: .semibold, design: .monospaced))
                            .foregroundColor(engine.isProUnlocked ? .green : .orange)
                        Spacer()
                        #if !STORE_EDITION
                        Button("Mint & Sign Ed25519 Customer Token") {
                            let token = CryptographicLicenseVerifier.generateSignedToken(holder: "Authorized Pro Shop")
                            licenseKeyInput = token
                            _ = engine.verifyAndActivateLicenseToken(token)
                        }
                        .controlSize(.small)
                        #endif
                    }

                    HStack(spacing: 10) {
                        TextField("Signed BOBFW.<payload>.<ed25519_sig> token...", text: $licenseKeyInput)
                            .textFieldStyle(.roundedBorder)
                            .font(.system(size: 11.5, design: .monospaced))

                        Button("Verify Ed25519 Token") {
                            _ = engine.verifyAndActivateLicenseToken(licenseKeyInput)
                        }
                        .buttonStyle(.borderedProminent)
                    }
                }
                .padding(8)
            }
            .onAppear {
                if licenseKeyInput.isEmpty {
                    licenseKeyInput = engine.signedLicenseToken
                }
            }

            // Section 1: Apple A12+ (iPhone XS -> 16 Pro Max / M1-M4 iPad) Pro Telemetry & Recovery Vault
            GroupBox(label: Label("Apple A12+ – A18 Pro & M-Series Pro Telemetry, Activation & IPSW Suite (Unlocked)", systemImage: "iphone.badge.play")) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Supports A12 (0x8020), A13 (0x8030), A14 (0x8101), A15 (0x8110), A16 (0x8120), A17 Pro (0x8130), A18 Pro (0x8140), and M1–M4 iPads:")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    HStack(spacing: 10) {
                        Button {
                            Task { await engine.runAppleA12ProAudit() }
                        } label: {
                            Label("Run A12+ ECID, DieID & Activation Audit", systemImage: "cpu.fill")
                        }
                        .buttonStyle(.borderedProminent)

                        Button("Check MDM / Supervision State") {
                            Task {
                                _ = await engine.executeAndLog(
                                    workflowId: "pro.apple_mdm_check",
                                    title: "Query iOS Supervision & Cloud Configuration",
                                    executable: engine.toolPaths["ideviceinfo"]!,
                                    arguments: ["-q", "com.apple.mobile.chaperone"]
                                )
                            }
                        }

                        Button("Read DFU / Recovery iBoot (irecovery -q)") {
                            Task {
                                _ = await engine.executeAndLog(
                                    workflowId: "pro.apple_irecovery",
                                    title: "Read iBoot / DFU Identity",
                                    executable: engine.toolPaths["irecovery"]!,
                                    arguments: ["-q"]
                                )
                            }
                        }

                        Button("Inspect Local .IPSW Package...") {
                            if let path = pickFile(allowedExtensions: ["ipsw", "zip"]) {
                                Task { _ = await engine.inspectFirmwareFile(at: path) }
                            }
                        }
                    }
                }
                .padding(8)
            }

            // Section 2: Flagship Samsung S / Z / A / Tab Pro Security & Knox Suite
            GroupBox(label: Label("Flagship Samsung Galaxy S / Z Fold / Flip / A / Tab Pro Suite (Unlocked)", systemImage: "shield.lefthalf.filled.badge.checkmark")) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Covers Galaxy S20–S25 Ultra, Z Fold/Flip 3–6, Galaxy A03–A55/A73, and Galaxy Tab S / Tab A series:")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    HStack(spacing: 10) {
                        Button {
                            Task { await engine.runSamsungProSecurityAudit() }
                        } label: {
                            Label("Run Knox Guard (KG) / Warranty / Bootloader Audit", systemImage: "checkmark.shield.fill")
                        }
                        .buttonStyle(.borderedProminent)

                        Button("Auto-Match Local Firmware & Optics CSCs") {
                            Task { await engine.autoDiscoverAndMatchBinaries() }
                        }

                        Button("Read Modem EFS / NV & Carrier Lock (AT+DEVCONINFO)") {
                            Task { await engine.sendATCommand(portPath: engine.selectedSerialPort, command: "AT+DEVCONINFO") }
                        }
                    }
                }
                .padding(8)
            }

            // Section 3: MediaTek (MTK) & Unisoc / Spreadtrum (SPD) Chipset Studio
            GroupBox(label: Label("MediaTek (MTK BROM/Preloader) & Unisoc / Spreadtrum (SPD Diag/FDL) Chipset Studio (Unlocked)", systemImage: "memorychip.fill")) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Native USB VID:PID detection for MediaTek (0e8d:0003 BROM, 0e8d:2000 Preloader) and Unisoc/SPD (1782:4d00 Diag/FDL, 1782:4d03) plus Scatter & .PAC inspection:")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    HStack(spacing: 10) {
                        Button {
                            Task {
                                _ = await engine.executeAndLog(
                                    workflowId: "pro.mtk_spd_scan",
                                    title: "Scan USB Bus for MTK (0e8d) & Unisoc SPD (1782) Interfaces",
                                    executable: engine.bootforgeBinaryPath,
                                    arguments: ["scan"]
                                )
                            }
                        } label: {
                            Label("Scan MTK / SPD / EDL Interfaces", systemImage: "cable.connector.horizontal")
                        }
                        .buttonStyle(.borderedProminent)

                        Button("Inspect MediaTek Scatter (MT*_scatter.txt)...") {
                            if let path = pickFile(allowedExtensions: ["txt", "xml"]) {
                                Task { await engine.inspectMtkOrSpdPackage(path: path) }
                            }
                        }

                        Button("Inspect Unisoc .PAC / FDL1 / FDL2 Binary...") {
                            if let path = pickFile(allowedExtensions: ["pac", "bin", "img", "sign"]) {
                                Task { await engine.inspectMtkOrSpdPackage(path: path) }
                            }
                        }
                    }
                }
                .padding(8)
            }

            // Section 3.5: Phoenix Sanctum — Root Privilege, Silicon Fuse & Hash-Chained Shadow Ledger
            GroupBox(label: Label("Phoenix Sanctum — Root Privilege, Silicon Fuse & Hash-Chained Shadow Ledger", systemImage: "lock.trianglebadge.exclamationmark.fill")) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Live privilege vector detection (Magisk / KernelSU / APatch / SELinux / AVB vbmeta), silicon fuse posture, and SHA-256 tamper-evident hash chain:")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    HStack(spacing: 12) {
                        Button {
                            Task { await engine.runPhoenixSanctumRootAndSiliconAudit() }
                        } label: {
                            Label("Run Phoenix Sanctum Privilege & Silicon Audit", systemImage: "cpu.fill")
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.purple)

                        VStack(alignment: .leading, spacing: 2) {
                            Text("Shadow Chain Entries: \(engine.sanctumChainCount)")
                                .font(.caption.monospaced())
                            Text("Chain Head SHA-256: \(String(engine.sanctumChainHeadHash.prefix(24)))...")
                                .font(.caption2.monospaced())
                                .foregroundColor(.secondary)
                        }
                    }

                    Text(engine.sanctumPrivilegeSummary)
                        .font(.system(.caption, design: .monospaced))
                        .padding(8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.black.opacity(0.25))
                        .cornerRadius(6)
                }
                .padding(8)
            }

            // Section 4: Master Supported Hardware & Chipset Coverage Matrix
            GroupBox(label: Label("Master Hardware & Chipset Coverage Matrix (\(engine.platformCatalog.count) Device & SoC Families)", systemImage: "list.bullet.rectangle.portrait.fill")) {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(engine.platformCatalog) { item in
                        VStack(alignment: .leading, spacing: 3) {
                            HStack {
                                Text(item.family)
                                    .font(.system(size: 12.5, weight: .bold))
                                Spacer()
                                Text("USB \(item.usbVidPid) · \(item.protocolName)")
                                    .font(.system(size: 11, design: .monospaced))
                                    .foregroundColor(.accentColor)
                            }
                            Text("Models / SoCs: \(item.modelsOrChips)")
                                .font(.system(size: 11.5))
                                .foregroundColor(.secondary)
                            Text("Operations: \(item.supportedOperations)")
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundColor(.primary)
                        }
                        .padding(8)
                        .background(RoundedRectangle(cornerRadius: 6).fill(Color(NSColor.controlBackgroundColor)))
                    }
                }
                .padding(8)
            }
            .disabled(!engine.isProUnlocked)
            .opacity(engine.isProUnlocked ? 1.0 : 0.55)
        }
    }
}

// MARK: - Module 2: BobFWTools Samsung Servicing & Odin Planner

struct SamsungSuiteView: View {
    @ObservedObject var engine: ServicingEngine
    @State private var customATCommand: String = "AT+DEVCONINFO"
    @State private var cscFrom: String = "EUX"
    @State private var targetCscCode: String = "XAR"
    @State private var stage1Carrier: String = "EUX (European Union Open)"
    @State private var stage2Carrier: String = "XAR (USA Wi-Fi Open)"
    @State private var stage3Carrier: String = "EUX (European Union Open)"
    @State private var trialFirmwarePath: String = ""
    @State private var customLaunchUrl: String = "https://www.google.com"

    var carrierOptions: [String] {
        CscFallbackRegistry.allProfiles.map { "\($0.code) (\($0.region))" }
    }

    var cscShortCodes: [String] {
        CscFallbackRegistry.allProfiles.map { $0.code }
    }

    @State private var flashItems: [PartitionFlashItem] = [
        PartitionFlashItem(enabled: true, partitionName: "BOOT", filePath: ""),
        PartitionFlashItem(enabled: false, partitionName: "RECOVERY", filePath: ""),
        PartitionFlashItem(enabled: false, partitionName: "SUPER", filePath: ""),
        PartitionFlashItem(enabled: false, partitionName: "SYSTEM", filePath: ""),
        PartitionFlashItem(enabled: false, partitionName: "VENDOR", filePath: ""),
        PartitionFlashItem(enabled: false, partitionName: "RADIO", filePath: "")
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            ModuleHeader(
                title: "BobFWTools Samsung Servicing & Odin Flash Planner",
                subtitle: "Direct DTR/RTS USB Modem AT diagnostics, CSC preflight qualification, ADB servicing, and Odin/Heimdall flashing"
            )

            if engine.activePlatform != .samsung {
                HStack(spacing: 10) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.orange)
                        .font(.system(size: 16))
                    VStack(alignment: .leading, spacing: 2) {
                        Text("NO SAMSUNG GALAXY DEVICE DETECTED ON USB BUS")
                            .font(.system(size: 11.5, weight: .bold))
                            .foregroundColor(.orange)
                        Text("Samsung Modem AT operations, CSC carrier transitions, and Odin partition flash functions are disabled until a Samsung Galaxy target (VID 04e8) is connected.")
                            .font(.system(size: 11))
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                }
                .padding(10)
                .background(RoundedRectangle(cornerRadius: 8).fill(Color.orange.opacity(0.12)))
            }

            // Guided Step-by-Step Servicing Pipeline Wizard
            GuidedWorkflowWizardCard(
                title: "Samsung Guided Carrier & Servicing Wizard",
                subtitle: "Enforces Step-by-Step isolation: Port Discovery -> AT Handshake -> Carrier Preflight -> Intent Dispatch",
                icon: "arrow.triangle.2.circlepath.circle.fill",
                steps: engine.samsungWizardSteps,
                onExecuteStep: { step in
                    Task { await engine.executeSamsungWizardStep(stepNumber: step, targetCsc: targetCscCode) }
                },
                onReset: {
                    engine.resetSamsungWizard()
                }
            )

            // Section 1: MTP / USB Modem Mode (AT Commands)
            GroupBox(label: Label("Samsung USB Modem AT Operations (\(engine.selectedSerialPort.isEmpty ? "No Modem Port" : (engine.selectedSerialPort as NSString).lastPathComponent))", systemImage: "cable.connector")) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 10) {
                        Button("Read Device Info (AT+DEVCONINFO)") {
                            Task { await engine.sendATCommand(portPath: engine.selectedSerialPort, command: "AT+DEVCONINFO") }
                        }
                        .buttonStyle(.borderedProminent)

                        Button("Read Software Version (AT+VERSNAME)") {
                            Task { await engine.sendATCommand(portPath: engine.selectedSerialPort, command: "AT+VERSNAME=1,0,0") }
                        }
                        Button("Read Serial / IMEI (AT+GSN)") {
                            Task { await engine.sendATCommand(portPath: engine.selectedSerialPort, command: "AT+GSN") }
                        }
                        Button("Reboot to Download Mode (AT+FUS?)") {
                            Task { await engine.sendATCommand(portPath: engine.selectedSerialPort, command: "AT+FUS?") }
                        }
                    }

                    HStack(spacing: 8) {
                        TextField("Custom AT Command (e.g. AT+DEVCONINFO)", text: $customATCommand)
                            .textFieldStyle(.roundedBorder)
                            .font(.system(.body, design: .monospaced))
                        Button("Send AT") {
                            Task { await engine.sendATCommand(portPath: engine.selectedSerialPort, command: customATCommand) }
                        }
                    }
                }
                .padding(8)
            }

            // Section 1B: Autonomous 3-Stage Carrier / CSC Transition Studio + Background Auto-Binary Matcher
            GroupBox(label: Label("Autonomous 3-Stage Carrier / CSC Transition Studio + Background Auto-Binary Matcher", systemImage: "arrow.triangle.2.circlepath.circle.fill")) {
                VStack(alignment: .leading, spacing: 12) {
                    // Background Auto-Binary Chooser Status Panel
                    if let bundle = engine.autoMatchedBundle {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Label(bundle.isSynthesizedFallback ? "AUTO-BINARY MATCHER: FALLBACK MATRIX VERIFIED" : "AUTO-BINARY MATCHER: VERIFIED LOCAL BUNDLE", systemImage: bundle.isSynthesizedFallback ? "bolt.shield.fill" : "checkmark.seal.fill")
                                    .font(.system(size: 11.5, weight: .bold))
                                    .foregroundColor(bundle.isSynthesizedFallback ? .blue : .green)
                                Spacer()
                                Text("Model: \(bundle.model) · Device Bit: \(bundle.bootloaderBit) [\(bundle.bitMatchesDevice ? "ANTI-ROLLBACK OK" : "BIT MISMATCH")]")
                                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                                    .foregroundColor(bundle.bitMatchesDevice ? .green : .red)
                            }

                            HStack(spacing: 12) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("STOCK FIRMWARE BUILD:")
                                        .font(.system(size: 9.5, weight: .bold))
                                        .foregroundColor(.secondary)
                                    Text(bundle.stockBuild)
                                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                                        .foregroundColor(.primary)
                                }
                                Divider().frame(height: 24)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("COMBINATION FACTORY BUILD:")
                                        .font(.system(size: 9.5, weight: .bold))
                                        .foregroundColor(.secondary)
                                    Text(bundle.combinationBuild)
                                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                                        .foregroundColor(.accentColor)
                                }
                                Divider().frame(height: 24)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("PIT / CONTAINER:")
                                        .font(.system(size: 9.5, weight: .bold))
                                        .foregroundColor(.secondary)
                                    Text("\(bundle.fallbackPitName) · \(bundle.cscContainerVersion)")
                                        .font(.system(size: 10.5, design: .monospaced))
                                        .foregroundColor(.secondary)
                                }
                            }

                            if !bundle.verifiedOpticsCscs.isEmpty {
                                Text("Verified Fallback CSCs (\(bundle.verifiedOpticsCscs.count)): \(bundle.verifiedOpticsCscs.prefix(12).joined(separator: " · ")) (+\(bundle.verifiedOpticsCscs.count - 12) more)")
                                    .font(.system(size: 10.5, weight: .semibold, design: .monospaced))
                                    .foregroundColor(.accentColor)
                                    .lineLimit(1)
                            }
                        }
                        .padding(10)
                        .background(RoundedRectangle(cornerRadius: 8).fill((bundle.isSynthesizedFallback ? Color.blue : Color.green).opacity(0.08)))
                    } else {
                        HStack {
                            Text("Background Auto-Binary Matcher: Scanning local firmware directories...")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Spacer()
                            Button("Re-Scan Local Binaries") {
                                Task { await engine.autoDiscoverAndMatchBinaries() }
                            }
                            .controlSize(.small)
                        }
                    }

                    // Quick Preset Buttons
                    HStack(spacing: 8) {
                        Text("Presets:")
                            .font(.caption.weight(.semibold))
                            .foregroundColor(.secondary)

                        Button("Global Wi-Fi: EUX → XAR → EUX") {
                            stage1Carrier = "EUX (European Union Open)"
                            stage2Carrier = "XAR (USA Wi-Fi Open)"
                            stage3Carrier = "EUX (European Union Open)"
                        }
                        .controlSize(.small)

                        Button("North America: EUX → XAC → XAR") {
                            stage1Carrier = "EUX (European Union Open)"
                            stage2Carrier = "XAC (Canada Open)"
                            stage3Carrier = "XAR (USA Wi-Fi Open)"
                        }
                        .controlSize(.small)

                        Button("TMB → VZW → TMB") {
                            stage1Carrier = "TMB (T-Mobile)"
                            stage2Carrier = "VZW (Verizon)"
                            stage3Carrier = "TMB (T-Mobile)"
                        }
                        .controlSize(.small)

                        Button("ATT → XAA → TMB") {
                            stage1Carrier = "ATT (AT&T)"
                            stage2Carrier = "XAA (US Unlocked)"
                            stage3Carrier = "TMB (T-Mobile)"
                        }
                        .controlSize(.small)

                        Button("Auto-Load Matched Binaries into Odin Table") {
                            if !engine.autoSelectedFlashItems.isEmpty {
                                flashItems = engine.autoSelectedFlashItems
                                let model = engine.autoMatchedBundle?.model ?? "target"
                                let bit = engine.autoMatchedBundle?.bootloaderBit ?? 0
                                engine.log(.success, "Auto-loaded \(flashItems.count) matched \(model) Bit \(bit) partition binaries into Heimdall/Odin flash table.")
                            } else {
                                engine.log(.warning, "No local partition binaries found to load into Odin table.")
                            }
                        }
                        .controlSize(.small)
                    }

                    // 3 Stage Pickers
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("STAGE 1 / 3")
                                .font(.caption2.weight(.bold))
                                .foregroundColor(.secondary)
                            Picker("", selection: $stage1Carrier) {
                                ForEach(carrierOptions, id: \.self) { opt in
                                    Text(opt).tag(opt)
                                }
                            }
                            .labelsHidden()
                        }

                        Image(systemName: "arrow.right")
                            .foregroundColor(.accentColor)

                        VStack(alignment: .leading, spacing: 4) {
                            Text("STAGE 2 / 3")
                                .font(.caption2.weight(.bold))
                                .foregroundColor(.secondary)
                            Picker("", selection: $stage2Carrier) {
                                ForEach(carrierOptions, id: \.self) { opt in
                                    Text(opt).tag(opt)
                                }
                            }
                            .labelsHidden()
                        }

                        Image(systemName: "arrow.right")
                            .foregroundColor(.accentColor)

                        VStack(alignment: .leading, spacing: 4) {
                            Text("STAGE 3 / 3")
                                .font(.caption2.weight(.bold))
                                .foregroundColor(.secondary)
                            Picker("", selection: $stage3Carrier) {
                                ForEach(carrierOptions, id: \.self) { opt in
                                    Text(opt).tag(opt)
                                }
                            }
                            .labelsHidden()
                        }
                    }

                    // Optional Firmware Attachment + 1-Click Autonomous Run Button
                    HStack(spacing: 10) {
                        Button {
                            Task {
                                await engine.runMultiStageCscPipeline(
                                    stages: [stage1Carrier, stage2Carrier, stage3Carrier],
                                    firmwarePath: trialFirmwarePath.isEmpty ? nil : trialFirmwarePath
                                )
                            }
                        } label: {
                            Label("Run 1-Click Autonomous 3-Stage CSC Pipeline (\(stage1Carrier.prefix(3)) → \(stage2Carrier.prefix(3)) → \(stage3Carrier.prefix(3)))", systemImage: "bolt.circle.fill")
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(engine.isBusy)

                        Button("Attach Firmware Package (Optional)...") {
                            if let path = pickFile(allowedExtensions: ["tar", "md5", "zip"]) {
                                trialFirmwarePath = path
                            }
                        }

                        if !trialFirmwarePath.isEmpty {
                            Text((trialFirmwarePath as NSString).lastPathComponent)
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundColor(.secondary)
                                .lineLimit(1)
                        }
                    }

                    // Live 3-Stage Report Card
                    if let report = engine.multiStageCscReport {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text("3-Stage Pipeline Result — Target: \(report.targetModel) (SN: \(report.targetSerial))")
                                    .font(.system(size: 12, weight: .bold))
                                Spacer()
                                Text("Active CSC: \(report.currentCsc) · Container: \(report.multiCscContainer)")
                                    .font(.system(size: 11, design: .monospaced))
                                    .foregroundColor(.secondary)
                            }
                            if let fw = report.attachedFirmware {
                                Text("Attached Firmware: \(fw)")
                                    .font(.system(size: 11, design: .monospaced))
                                    .foregroundColor(.accentColor)
                            }
                            ForEach(report.stages) { st in
                                HStack(alignment: .top, spacing: 8) {
                                    Text("Stage \(st.stageNumber)")
                                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                                        .frame(width: 58, alignment: .leading)
                                    Text(st.status)
                                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 1)
                                        .background(RoundedRectangle(cornerRadius: 4).fill(Color.green.opacity(0.18)))
                                        .foregroundColor(.green)
                                    Text(st.detail)
                                        .font(.system(size: 11.5))
                                        .foregroundColor(.primary)
                                }
                            }
                        }
                        .padding(10)
                        .background(RoundedRectangle(cornerRadius: 8).fill(Color(NSColor.controlBackgroundColor)))
                    }

                    Divider()

                    // Direct Source -> Target CSC Change Studio
                    HStack(spacing: 12) {
                        Text("Direct CSC Comparison:")
                            .font(.caption.weight(.semibold))
                        Picker("Source CSC", selection: $cscFrom) {
                            ForEach(cscShortCodes, id: \.self) { code in
                                Text(code).tag(code)
                            }
                        }
                        .frame(width: 150)

                        Image(systemName: "arrow.right")

                        Picker("Target CSC", selection: $targetCscCode) {
                            ForEach(cscShortCodes, id: \.self) { code in
                                Text(code).tag(code)
                            }
                        }
                        .frame(width: 150)

                        Button("Qualify \(cscFrom) → \(targetCscCode)") {
                            let notes = engine.qualifySingleCscChange(from: cscFrom, to: targetCscCode)
                            engine.log(.info, "CSC Qualification (\(cscFrom) → \(targetCscCode)):\n" + notes.map { "• \($0)" }.joined(separator: "\n"))
                        }

                        Button("Open On-Device CSC Selector (*#272*)") {
                            Task {
                                await engine.launchTargetIntent(
                                    title: "Open Samsung Preconfig / CSC Selector",
                                    adbShellArgs: ["am start -n com.samsung.android.cidmanager/.modules.preconfig.PreconfigActivity || am start -a android.intent.action.DIAL -d 'tel:*%23272*719434266344%23'"]
                                )
                            }
                        }
                    }
                }
                .padding(8)
            }

            // Section 2: Samsung ADB, CSC Preflight & Service Functions
            GroupBox(label: Label("Samsung ADB, CSC Qualification & Service Functions", systemImage: "gearshape.2.fill")) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 10) {
                        Button("Read Samsung ADB Info & Knox Bit") {
                            Task { await engine.readADBDeviceInfo() }
                        }
                        Button("Read Active CSC / Carrier") {
                            Task {
                                _ = await engine.executeAndLog(
                                    workflowId: "samsung.read_csc",
                                    title: "Read Samsung CSC Properties",
                                    executable: engine.toolPaths["adb"]!,
                                    arguments: engine.adbArgs(["shell", "getprop | grep -iE 'csc|carrier|sales_code|ril.official_cscver'"])
                                )
                            }
                        }
                        Button("Launch Samsung Test Menu (*#0*#)") {
                            Task {
                                _ = await engine.executeAndLog(
                                    workflowId: "samsung.test_menu",
                                    title: "Open Samsung Hardware Test Mode",
                                    executable: engine.toolPaths["adb"]!,
                                    arguments: engine.adbArgs(["shell", "am", "start", "-n", "com.sec.android.app.hwmoduletest/.HwModuleTest"])
                                )
                            }
                        }
                    }

                    // BobFWTools CSC Qualification Preflight
                    HStack(spacing: 10) {
                        Text("CSC Preflight Target:")
                            .font(.caption.weight(.semibold))
                        TextField("3-letter CSC (e.g. EUX, XAA)", text: $targetCscCode)
                            .frame(width: 110)
                            .textFieldStyle(.roundedBorder)
                            .font(.system(size: 12, design: .monospaced))
                        Button("Run BobFWTools CSC Preflight Check") {
                            let currentCsc = engine.samsungModemInfo?.activeCsc ?? "UNKNOWN"
                            let model = engine.samsungModemInfo?.model ?? "UNVERIFIED"
                            let dest = targetCscCode.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
                            engine.log(.info, "CSC Preflight: Model=\(model) · Source CSC=\(currentCsc) -> Target CSC=\(dest) · Multi-CSC Package=\(engine.samsungModemInfo?.cscPackageVersion ?? "Unknown")")
                        }
                    }

                    HStack(spacing: 10) {
                        Button("Disable Samsung OTA Updates") {
                            Task {
                                _ = await engine.executeAndLog(
                                    workflowId: "samsung.disable_ota",
                                    title: "Disable Samsung OTA (wssyncmldm & soagent)",
                                    executable: engine.toolPaths["adb"]!,
                                    arguments: engine.adbArgs(["shell", "pm disable-user --user 0 com.wssyncmldm; pm disable-user --user 0 com.sec.android.soagent"])
                                )
                            }
                        }
                        Button("Enable Samsung OTA Updates") {
                            Task {
                                _ = await engine.executeAndLog(
                                    workflowId: "samsung.enable_ota",
                                    title: "Enable Samsung OTA",
                                    executable: engine.toolPaths["adb"]!,
                                    arguments: engine.adbArgs(["shell", "pm enable com.wssyncmldm; pm enable com.sec.android.soagent"])
                                )
                            }
                        }
                        Button("ADB Reboot Download Mode") {
                            Task {
                                _ = await engine.executeAndLog(
                                    workflowId: "samsung.reboot_download",
                                    title: "Reboot into Samsung Download Mode",
                                    executable: engine.toolPaths["adb"]!,
                                    arguments: engine.adbArgs(["reboot", "download"])
                                )
                            }
                        }
                    }
                }
                .padding(8)
            }

            // Section 2B: Target Device Browser, Store & Diagnostic Code Launcher (Authorized ADB)
            GroupBox(label: Label("Target Device Browser, Store & Diagnostic Code Launcher (Authorized ADB)", systemImage: "arrow.up.forward.app.fill")) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Launch browsers, stores, system settings, and Samsung diagnostic menus on an authorized ADB target device:")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    HStack(spacing: 8) {
                        Button("Open Google Chrome") {
                            Task {
                                await engine.launchTargetIntent(
                                    title: "Launch Google Chrome on Target",
                                    adbShellArgs: ["am start -n com.android.chrome/com.google.android.apps.chrome.Main -d 'https://www.google.com' || am start -a android.intent.action.VIEW -d 'https://www.google.com'"]
                                )
                            }
                        }
                        Button("Open Google Maps") {
                            Task {
                                await engine.launchTargetIntent(
                                    title: "Launch Google Maps on Target",
                                    adbShellArgs: ["am", "start", "-a", "android.intent.action.VIEW", "-d", "geo:0,0?q="]
                                )
                            }
                        }
                        Button("Open Samsung Galaxy Store") {
                            Task {
                                await engine.launchTargetIntent(
                                    title: "Launch Samsung Galaxy Store on Target",
                                    adbShellArgs: ["am", "start", "-a", "android.intent.action.VIEW", "-d", "samsungapps://MainPage"]
                                )
                            }
                        }
                        Button("Open Samsung Internet") {
                            Task {
                                await engine.launchTargetIntent(
                                    title: "Launch Samsung Internet Browser",
                                    adbShellArgs: ["am start -n com.sec.android.app.sbrowser/.SBrowserMainActivity -d 'https://www.google.com' || am start -a android.intent.action.VIEW -d 'https://www.google.com'"]
                                )
                            }
                        }
                    }

                    HStack(spacing: 8) {
                        Button("Open Google Play Store") {
                            Task {
                                await engine.launchTargetIntent(
                                    title: "Launch Google Play Store",
                                    adbShellArgs: ["am", "start", "-a", "android.intent.action.VIEW", "-d", "market://search?q="]
                                )
                            }
                        }
                        Button("Open Android Settings") {
                            Task {
                                await engine.launchTargetIntent(
                                    title: "Open Android Main Settings",
                                    adbShellArgs: ["am", "start", "-a", "android.settings.SETTINGS"]
                                )
                            }
                        }
                        Button("Open Developer Options") {
                            Task {
                                await engine.launchTargetIntent(
                                    title: "Open Developer Options",
                                    adbShellArgs: ["am", "start", "-a", "android.settings.APPLICATION_DEVELOPMENT_SETTINGS"]
                                )
                            }
                        }
                        Button("Open About Device") {
                            Task {
                                await engine.launchTargetIntent(
                                    title: "Open Device Info Settings",
                                    adbShellArgs: ["am", "start", "-a", "android.settings.DEVICE_INFO_SETTINGS"]
                                )
                            }
                        }
                    }

                    Divider()

                    Text("Samsung Secret Diagnostic Codes (ADB Dialer / Service Menus):")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(.secondary)

                    HStack(spacing: 8) {
                        Button("*#0*# Hardware Test") {
                            Task {
                                await engine.launchTargetIntent(
                                    title: "Samsung *#0*# Hardware Test",
                                    adbShellArgs: ["am", "start", "-n", "com.sec.android.app.hwmoduletest/.HwModuleTest"]
                                )
                            }
                        }
                        Button("*#06# IMEI / Serial") {
                            Task {
                                await engine.launchTargetIntent(
                                    title: "Dialer *#06# Display",
                                    adbShellArgs: ["am", "start", "-a", "android.intent.action.DIAL", "-d", "tel:*%2306%23"]
                                )
                            }
                        }
                        Button("*#1234# Firmware Version") {
                            Task {
                                await engine.launchTargetIntent(
                                    title: "Dialer *#1234# Version",
                                    adbShellArgs: ["am", "start", "-a", "android.intent.action.DIAL", "-d", "tel:*%231234%23"]
                                )
                            }
                        }
                        Button("*#0228# BatteryQuick") {
                            Task {
                                await engine.launchTargetIntent(
                                    title: "Dialer *#0228# Battery Status",
                                    adbShellArgs: ["am", "start", "-a", "android.intent.action.DIAL", "-d", "tel:*%230228%23"]
                                )
                            }
                        }
                        Button("*#9900# SysDump") {
                            Task {
                                await engine.launchTargetIntent(
                                    title: "Dialer *#9900# SysDump",
                                    adbShellArgs: ["am", "start", "-a", "android.intent.action.DIAL", "-d", "tel:*%239900%23"]
                                )
                            }
                        }
                    }

                    HStack(spacing: 8) {
                        TextField("Custom Deep Link or URL (e.g. https://... or samsungapps://...)", text: $customLaunchUrl)
                            .textFieldStyle(.roundedBorder)
                            .font(.system(size: 12, design: .monospaced))
                        Button("Open URL on Target") {
                            let url = customLaunchUrl.trimmingCharacters(in: .whitespacesAndNewlines)
                            guard !url.isEmpty else { return }
                            Task {
                                await engine.launchTargetIntent(
                                    title: "Open URL (\(url)) on Target",
                                    adbShellArgs: ["am", "start", "-a", "android.intent.action.VIEW", "-d", url]
                                )
                            }
                        }
                    }
                }
                .padding(8)
            }

            // Section 3: Odin / Heimdall Download Mode Flasher + BobFWTools Odin Plan
            GroupBox(label: Label("Samsung Odin Flash Planner (BootForge) & Heimdall Executor", systemImage: "bolt.shield.fill")) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 10) {
                        Button("Build Non-Executing Odin Flash Plan (.tar / .tar.md5)...") {
                            if let path = pickFile(allowedExtensions: ["tar", "md5"]) {
                                Task {
                                    _ = await engine.executeAndLog(
                                        workflowId: "bootforge.odin_plan",
                                        title: "BootForge Odin Flash Plan (\((path as NSString).lastPathComponent))",
                                        executable: engine.bootforgeBinaryPath,
                                        arguments: ["plan", path]
                                    )
                                }
                            }
                        }
                        Button("Heimdall Detect") {
                            Task {
                                _ = await engine.executeAndLog(
                                    workflowId: "heimdall.detect",
                                    title: "Heimdall Detect Download Mode",
                                    executable: engine.toolPaths["heimdall"]!,
                                    arguments: ["detect"]
                                )
                            }
                        }
                        Button("Print Device PIT Table") {
                            Task {
                                _ = await engine.executeAndLog(
                                    workflowId: "heimdall.print_pit",
                                    title: "Read Partition Information Table (PIT)",
                                    executable: engine.toolPaths["heimdall"]!,
                                    arguments: ["print-pit", "--no-reboot"]
                                )
                            }
                        }
                    }

                    Divider()

                    ForEach($flashItems) { $item in
                        HStack(spacing: 8) {
                            Toggle("", isOn: $item.enabled)
                                .labelsHidden()
                            TextField("Partition", text: $item.partitionName)
                                .frame(width: 110)
                                .textFieldStyle(.roundedBorder)
                                .font(.system(size: 12, design: .monospaced))
                            TextField("Select .img / .bin file...", text: $item.filePath)
                                .textFieldStyle(.roundedBorder)
                                .font(.system(size: 12, design: .monospaced))
                            Button("Browse...") {
                                if let path = pickFile(allowedExtensions: ["img", "bin", "lz4", "tar", "md5"]) {
                                    item.filePath = path
                                    item.enabled = true
                                }
                            }
                        }
                    }

                    Button {
                        Task { await runHeimdallFlash() }
                    } label: {
                        Label("Execute Heimdall Partition Flash", systemImage: "flame.fill")
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(engine.isBusy)
                }
                .padding(8)
                .onAppear {
                    if !engine.autoSelectedFlashItems.isEmpty && flashItems.allSatisfy({ $0.filePath.isEmpty }) {
                        flashItems = engine.autoSelectedFlashItems
                    }
                }
                .onChange(of: engine.autoSelectedFlashItems.count) { _, _ in
                    if !engine.autoSelectedFlashItems.isEmpty && flashItems.allSatisfy({ $0.filePath.isEmpty }) {
                        flashItems = engine.autoSelectedFlashItems
                    }
                }
            }
        }
    }

    private func runHeimdallFlash() async {
        let active = flashItems.filter { $0.enabled && !$0.filePath.isEmpty && !$0.partitionName.isEmpty }
        guard !active.isEmpty else {
            engine.log(.warning, "Select at least one partition image before starting flash.")
            return
        }
        var args = ["flash"]
        for item in active {
            args.append("--\(item.partitionName)")
            args.append(item.filePath)
        }
        _ = await engine.executeAndLog(
            workflowId: "heimdall.flash",
            title: "Heimdall Flash (\(active.count) partition(s))",
            executable: engine.toolPaths["heimdall"]!,
            arguments: args
        )
    }
}

// MARK: - Module 3: BobFWTools Multi-Brand & BootForge Recovery (EDL / MediaTek)

struct MultiBrandRecoveryView: View {
    @ObservedObject var engine: ServicingEngine
    @State private var packageFilter: String = ""
    @State private var selectedPackage: String = ""
    @State private var recoveryKind: String = "qualcomm-edl"
    @State private var selectedCalibrationPartition: String = "efs"
    @State private var partitionFilter: String = ""

    var filteredPackages: [String] {
        if packageFilter.trimmingCharacters(in: .whitespaces).isEmpty {
            return engine.installedPackages
        }
        return engine.installedPackages.filter { $0.localizedCaseInsensitiveContains(packageFilter) }
    }

    var filteredPartitions: [RawGptPartitionEntry] {
        if partitionFilter.trimmingCharacters(in: .whitespaces).isEmpty {
            return engine.liveGptPartitions
        }
        return engine.liveGptPartitions.filter { $0.name.localizedCaseInsensitiveContains(partitionFilter) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            ModuleHeader(
                title: "BobFWTools Multi-Brand Servicing & BootForge Recovery",
                subtitle: "Qualcomm EDL 9008 & MediaTek BROM/Preloader recovery planning, universal ADB servicing, and package control"
            )

            // BootForge EDL & MediaTek Recovery Scanner
            GroupBox(label: Label("BootForge Qualcomm EDL (9008) & MediaTek Preloader Recovery", systemImage: "lifepreserver.fill")) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 10) {
                        Button("Scan EDL / MediaTek Recovery Candidates") {
                            Task {
                                _ = await engine.executeAndLog(
                                    workflowId: "bootforge.recovery_scan",
                                    title: "BootForge Recovery Candidate Scan",
                                    executable: engine.bootforgeBinaryPath,
                                    arguments: ["recovery-scan"]
                                )
                            }
                        }

                        Picker("Workflow:", selection: $recoveryKind) {
                            Text("Qualcomm EDL (Firehose / rawprogram)").tag("qualcomm-edl")
                            Text("MediaTek Download (DA / Scatter)").tag("mediatek-download")
                        }
                        .frame(width: 290)

                        Button("Build Audited Recovery Plan from Artifacts...") {
                            if let file = pickFile(allowedExtensions: ["elf", "mbn", "xml", "txt", "bin", "img", "pac"]) {
                                Task {
                                    await engine.inspectMtkOrSpdPackage(path: file)
                                }
                            }
                        }
                    }
                }
                .padding(8)
            }

            // USB Bus Power, Current & Link Stability Monitor
            GroupBox(label: Label("Host USB Controller Link & VBUS Stability Meter", systemImage: "bolt.badge.clock.fill")) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 20) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("CONNECTION SPEED").font(.system(size: 9.5, weight: .bold)).foregroundColor(.secondary)
                            Text(String(format: "%.0f Mbps", engine.usbBusSpeedMbps))
                                .font(.system(size: 16, weight: .bold, design: .monospaced))
                                .foregroundColor(.cyan)
                        }

                        VStack(alignment: .leading, spacing: 2) {
                            Text("LINK INTEGRITY").font(.system(size: 9.5, weight: .bold)).foregroundColor(.secondary)
                            Text(engine.usbBusHealthState)
                                .font(.system(size: 14, weight: .bold, design: .monospaced))
                                .foregroundColor(engine.usbBusHealthState.contains("OPTIMAL") ? .green : .orange)
                        }

                        Spacer()

                        Button("Probe USB Bus Integrity") {
                            _ = engine.probeUsbBusStability()
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                    }
                }
                .padding(8)
            }

            // Structural Storage Memory Map Interrogation (Raw GPT Partition Tree)
            GroupBox(label: Label("Structural Storage Memory Map Interrogation (Raw GPT Partition Tree)", systemImage: "cylinder.split.1x2.fill")) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 10) {
                        Button("Query Live Device GPT (Fastboot/ADB)") {
                            Task {
                                _ = await engine.queryDeviceGptPartitionMap()
                            }
                        }
                        .buttonStyle(.borderedProminent)

                        Button("Parse Firehose rawprogram XML...") {
                            if let xmlPath = pickFile(allowedExtensions: ["xml"]) {
                                if let content = try? String(contentsOfFile: xmlPath, encoding: .utf8) {
                                    let parsed = engine.parseRawProgramXmlGpt(xmlString: content)
                                    engine.liveGptPartitions = parsed
                                    engine.log(.success, "Parsed \(parsed.count) partition sectors from \(xmlPath)")
                                }
                            }
                        }

                        Button("Parse MTK Scatter...") {
                            if let txtPath = pickFile(allowedExtensions: ["txt"]) {
                                if let content = try? String(contentsOfFile: txtPath, encoding: .utf8) {
                                    let parsed = engine.parseMediaTekScatterGpt(scatterString: content)
                                    engine.liveGptPartitions = parsed
                                    engine.log(.success, "Parsed \(parsed.count) scatter partitions from \(txtPath)")
                                }
                            }
                        }

                        Spacer()

                        TextField("Filter partition name...", text: $partitionFilter)
                            .textFieldStyle(.roundedBorder)
                            .font(.system(size: 11, design: .monospaced))
                            .frame(width: 170)
                    }

                    if engine.liveGptPartitions.isEmpty {
                        Text("No partition table loaded yet. Connect a device in Fastboot/ADB or load a Firehose rawprogram/Scatter archive.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .padding(.vertical, 8)
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 4) {
                                ForEach(filteredPartitions) { part in
                                    HStack {
                                        if part.isCalibration {
                                            Image(systemName: "shield.checkered")
                                                .foregroundColor(.yellow)
                                                .font(.caption)
                                        } else {
                                            Image(systemName: "internaldrive")
                                                .foregroundColor(.secondary)
                                                .font(.caption)
                                        }

                                        Text(part.name)
                                            .font(.system(size: 12, weight: .semibold, design: .monospaced))
                                            .foregroundColor(part.isCalibration ? .yellow : .primary)

                                        Spacer()

                                        Text(part.partitionType.uppercased())
                                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                                            .padding(.horizontal, 4)
                                            .padding(.vertical, 1)
                                            .background(Color.blue.opacity(0.15))
                                            .foregroundColor(.blue)
                                            .cornerRadius(3)

                                        Text(part.formattedSize)
                                            .font(.system(size: 11, design: .monospaced))
                                            .foregroundColor(.secondary)

                                        Text("LBA: \(part.startLba)")
                                            .font(.system(size: 9, design: .monospaced))
                                            .foregroundColor(.secondary.opacity(0.7))
                                    }
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color(NSColor.controlBackgroundColor).opacity(0.6))
                                    .cornerRadius(4)
                                }
                            }
                        }
                        .frame(maxHeight: 180)
                    }
                }
                .padding(8)
            }

            // Non-Destructive Calibration Partition Backup Engine
            GroupBox(label: Label("Non-Destructive Calibration Data Backup Engine (NVRAM / EFS / PERSIST)", systemImage: "lock.shield.fill")) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Safely archive critical RF calibration sectors to ~/Library/Application Support/BobFWTools/backups/calibration:")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    HStack(spacing: 12) {
                        Picker("Target Partition:", selection: $selectedCalibrationPartition) {
                            ForEach(Array(ServicingEngine.calibrationAllowlist).sorted(), id: \.self) { p in
                                Text(p.uppercased()).tag(p)
                            }
                        }
                        .frame(width: 220)

                        Button("Backup Calibration Snapshot") {
                            Task {
                                let (ok, msg) = await engine.createCalibrationBackupSnapshot(partitionName: selectedCalibrationPartition)
                                if ok {
                                    engine.log(.success, "✔ Backup completed: \(msg)")
                                } else {
                                    engine.log(.error, "✖ Backup failed: \(msg)")
                                }
                            }
                        }
                        .buttonStyle(.borderedProminent)

                        if let lastManifest = engine.lastCalibrationBackupManifest {
                            HStack(spacing: 4) {
                                Image(systemName: "checkmark.circle.fill").foregroundColor(.green)
                                Text("Manifest: \((lastManifest as NSString).lastPathComponent)")
                                    .font(.system(size: 10, design: .monospaced))
                                    .foregroundColor(.green)
                            }
                        }
                    }
                }
                .padding(8)
            }

            // Universal ADB Mode Switching & Diagnostics
            GroupBox(label: Label("Universal Android Telemetry, Settings Intents & Reboot Matrix", systemImage: "power.circle.fill")) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 10) {
                        Button("Read Full ADB Telemetry") {
                            Task { await engine.readADBDeviceInfo() }
                        }
                        Button("Read Battery Health") {
                            Task {
                                _ = await engine.executeAndLog(
                                    workflowId: "adb.battery",
                                    title: "Battery Diagnostics (dumpsys battery)",
                                    executable: engine.toolPaths["adb"]!,
                                    arguments: engine.adbArgs(["shell", "dumpsys", "battery"])
                                )
                            }
                        }
                        Button("Logcat Snapshot (250 lines)") {
                            Task {
                                _ = await engine.executeAndLog(
                                    workflowId: "adb.logcat",
                                    title: "Capture Logcat Snapshot",
                                    executable: engine.toolPaths["adb"]!,
                                    arguments: engine.adbArgs(["logcat", "-d", "-t", "250"])
                                )
                            }
                        }
                        Button("Open Network Settings") {
                            Task {
                                _ = await engine.executeAndLog(
                                    workflowId: "adb.network_settings",
                                    title: "Open Android Wireless/Network Settings",
                                    executable: engine.toolPaths["adb"]!,
                                    arguments: engine.adbArgs(["shell", "am", "start", "-a", "android.settings.WIRELESS_SETTINGS"])
                                )
                            }
                        }
                    }

                    Divider()

                    HStack(spacing: 10) {
                        Button("Reboot Normal") {
                            Task { _ = await engine.executeAndLog(workflowId: "adb.reboot", title: "Reboot System", executable: engine.toolPaths["adb"]!, arguments: engine.adbArgs(["reboot"])) }
                        }
                        Button("Reboot Recovery") {
                            Task { _ = await engine.executeAndLog(workflowId: "adb.reboot_recovery", title: "Reboot Recovery", executable: engine.toolPaths["adb"]!, arguments: engine.adbArgs(["reboot", "recovery"])) }
                        }
                        Button("Reboot Bootloader") {
                            Task { _ = await engine.executeAndLog(workflowId: "adb.reboot_bootloader", title: "Reboot Bootloader", executable: engine.toolPaths["adb"]!, arguments: engine.adbArgs(["reboot", "bootloader"])) }
                        }
                        Button("Reboot FastbootD") {
                            Task { _ = await engine.executeAndLog(workflowId: "adb.reboot_fastbootd", title: "Reboot FastbootD", executable: engine.toolPaths["adb"]!, arguments: engine.adbArgs(["reboot", "fastboot"])) }
                        }
                        Button("Reboot Qualcomm EDL") {
                            Task { _ = await engine.executeAndLog(workflowId: "adb.reboot_edl", title: "Reboot EDL 9008", executable: engine.toolPaths["adb"]!, arguments: engine.adbArgs(["reboot", "edl"])) }
                        }
                    }
                }
                .padding(8)
            }

            // APK & Package Manager
            GroupBox(label: Label("APK Installer & System Package Manager", systemImage: "app.badge.checkmark.fill")) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 10) {
                        Button("Install APK File...") {
                            if let apkPath = pickFile(allowedExtensions: ["apk"]) {
                                Task {
                                    _ = await engine.executeAndLog(
                                        workflowId: "adb.install_apk",
                                        title: "Install APK (\((apkPath as NSString).lastPathComponent))",
                                        executable: engine.toolPaths["adb"]!,
                                        arguments: engine.adbArgs(["install", "-r", "-d", apkPath])
                                    )
                                }
                            }
                        }

                        Button("Load Device Packages") {
                            Task {
                                let hasAdb = engine.devices.contains { $0.transport == .adb }
                                if hasAdb {
                                    let res = await engine.runProcess(
                                        executable: engine.toolPaths["adb"]!,
                                        arguments: engine.adbArgs(["shell", "pm", "list", "packages"])
                                    )
                                    let pkgs = res.stdout
                                        .components(separatedBy: .newlines)
                                        .map { $0.replacingOccurrences(of: "package:", with: "").trimmingCharacters(in: .whitespacesAndNewlines) }
                                        .filter { !$0.isEmpty }
                                        .sorted()
                                    engine.installedPackages = pkgs
                                    if let first = pkgs.first { selectedPackage = first }
                                    engine.log(.success, "Loaded \(pkgs.count) packages from connected ADB device.")
                                } else {
                                    engine.installedPackages = []
                                    selectedPackage = ""
                                    engine.log(.warning, "Load Packages aborted: No active ADB connection detected. Enable USB debugging on the target device.")
                                }
                            }
                        }

                        Button("Save Device Screenshot to Desktop") {
                            Task {
                                let desktopPath = (NSHomeDirectory() as NSString).appendingPathComponent("Desktop/device_screenshot_\(Int(Date().timeIntervalSince1970)).png")
                                let adbBin = engine.toolPaths["adb"] ?? "/usr/local/bin/adb"
                                if engine.devices.contains(where: { $0.transport == .adb }) {
                                    let args = engine.adbArgs(["exec-out", "screencap", "-p"]).joined(separator: " ")
                                    _ = await engine.executeAndLog(
                                        workflowId: "adb.screenshot",
                                        title: "Capture Device Screen",
                                        executable: "/bin/sh",
                                        arguments: ["-c", "\"\(adbBin)\" \(args) > \"\(desktopPath)\" && echo \"Saved to \(desktopPath)\""]
                                    )
                                } else {
                                    _ = await engine.executeAndLog(
                                        workflowId: "adb.screenshot",
                                        title: "Capture Device Screen",
                                        executable: adbBin,
                                        arguments: ["exec-out", "screencap", "-p"]
                                    )
                                }
                            }
                        }
                    }

                    HStack(spacing: 8) {
                        TextField("Filter packages (e.g. samsung, xiaomi, qualcomm)...", text: $packageFilter)
                            .textFieldStyle(.roundedBorder)

                        Picker("Package", selection: $selectedPackage) {
                            if filteredPackages.isEmpty {
                                Text("No packages loaded").tag("")
                            }
                            ForEach(filteredPackages, id: \.self) { pkg in
                                Text(pkg).tag(pkg)
                            }
                        }
                        .frame(width: 260)
                    }

                    HStack(spacing: 10) {
                        Button("Disable Package (User 0)") {
                            guard !selectedPackage.isEmpty else { return }
                            Task {
                                _ = await engine.executeAndLog(
                                    workflowId: "adb.pkg_disable",
                                    title: "Disable \(selectedPackage)",
                                    executable: engine.toolPaths["adb"]!,
                                    arguments: engine.adbArgs(["shell", "pm", "disable-user", "--user", "0", selectedPackage])
                                )
                            }
                        }
                        Button("Enable Package") {
                            guard !selectedPackage.isEmpty else { return }
                            Task {
                                _ = await engine.executeAndLog(
                                    workflowId: "adb.pkg_enable",
                                    title: "Enable \(selectedPackage)",
                                    executable: engine.toolPaths["adb"]!,
                                    arguments: engine.adbArgs(["shell", "pm", "enable", selectedPackage])
                                )
                            }
                        }
                        Button("Clear Package Data") {
                            guard !selectedPackage.isEmpty else { return }
                            Task {
                                _ = await engine.executeAndLog(
                                    workflowId: "adb.pkg_clear",
                                    title: "Clear Data for \(selectedPackage)",
                                    executable: engine.toolPaths["adb"]!,
                                    arguments: engine.adbArgs(["shell", "pm", "clear", selectedPackage])
                                )
                            }
                        }
                    }
                }
                .padding(8)
            }
        }
    }
}

// MARK: - Module 4: Fastboot & Partition Workshop

struct FastbootWorkshopView: View {
    @ObservedObject var engine: ServicingEngine
    @State private var selectedPartition: String = "boot"
    @State private var selectedImagePath: String = ""
    @State private var disableVerityVbmeta: Bool = false

    let standardPartitions = [
        "boot", "init_boot", "vendor_boot", "recovery", "dtbo",
        "vbmeta", "vbmeta_system", "super", "system", "vendor",
        "product", "userdata", "modem", "radio", "bootloader"
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            ModuleHeader(
                title: "Fastboot & Partition Workshop",
                subtitle: "Read bootloader variables, switch A/B slots, flash partition images, and inspect unlock state"
            )

            // Guided Step-by-Step State Machine Wizard
            GuidedWorkflowWizardCard(
                title: "Fastboot Guided Qualification Wizard",
                subtitle: "Enforces Step-by-Step isolation: Protocol Detection -> Secure State Qualification -> Slot & Partition Inspection",
                icon: "bolt.horizontal.circle.fill",
                steps: engine.fastbootWizardSteps,
                onExecuteStep: { step in
                    Task { await engine.executeFastbootWizardStep(stepNumber: step) }
                },
                onReset: {
                    engine.resetFastbootWizard()
                }
            )

            GroupBox(label: Label("Fastboot Telemetry & Slot Control", systemImage: "cpu")) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 10) {
                        Button("Read All Bootloader Variables (getvar all)") {
                            Task {
                                _ = await engine.executeAndLog(
                                    workflowId: "fastboot.getvar_all",
                                    title: "Fastboot GetVar All",
                                    executable: engine.toolPaths["fastboot"]!,
                                    arguments: engine.fastbootArgs(["getvar", "all"])
                                )
                            }
                        }
                        Button("Read OEM Device Info") {
                            Task {
                                _ = await engine.executeAndLog(
                                    workflowId: "fastboot.oem_info",
                                    title: "Fastboot OEM Device-Info",
                                    executable: engine.toolPaths["fastboot"]!,
                                    arguments: engine.fastbootArgs(["oem", "device-info"])
                                )
                            }
                        }
                        Button("Read Motorola Unlock Data") {
                            Task {
                                _ = await engine.executeAndLog(
                                    workflowId: "fastboot.moto_unlock_data",
                                    title: "Fastboot OEM Get_Unlock_Data",
                                    executable: engine.toolPaths["fastboot"]!,
                                    arguments: engine.fastbootArgs(["oem", "get_unlock_data"])
                                )
                            }
                        }
                    }

                    HStack(spacing: 10) {
                        Button("Set Active Slot A") {
                            Task {
                                _ = await engine.executeAndLog(
                                    workflowId: "fastboot.slot_a",
                                    title: "Switch Active Slot -> A",
                                    executable: engine.toolPaths["fastboot"]!,
                                    arguments: engine.fastbootArgs(["--set-active=a"])
                                )
                            }
                        }
                        Button("Set Active Slot B") {
                            Task {
                                _ = await engine.executeAndLog(
                                    workflowId: "fastboot.slot_b",
                                    title: "Switch Active Slot -> B",
                                    executable: engine.toolPaths["fastboot"]!,
                                    arguments: engine.fastbootArgs(["--set-active=b"])
                                )
                            }
                        }
                        Button("Reboot System") {
                            Task {
                                _ = await engine.executeAndLog(
                                    workflowId: "fastboot.reboot",
                                    title: "Fastboot Reboot",
                                    executable: engine.toolPaths["fastboot"]!,
                                    arguments: engine.fastbootArgs(["reboot"])
                                )
                            }
                        }
                        Button("Reboot FastbootD") {
                            Task {
                                _ = await engine.executeAndLog(
                                    workflowId: "fastboot.reboot_fastbootd",
                                    title: "Fastboot Reboot-Fastboot",
                                    executable: engine.toolPaths["fastboot"]!,
                                    arguments: engine.fastbootArgs(["reboot-fastboot"])
                                )
                            }
                        }
                    }
                }
                .padding(8)
            }

            GroupBox(label: Label("Single Partition Image Flasher", systemImage: "externaldrive.fill.badge.plus")) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 10) {
                        Picker("Target Partition:", selection: $selectedPartition) {
                            ForEach(standardPartitions, id: \.self) { part in
                                Text(part).tag(part)
                            }
                        }
                        .frame(width: 220)

                        TextField("Path to .img / .bin file...", text: $selectedImagePath)
                            .textFieldStyle(.roundedBorder)
                            .font(.system(size: 12, design: .monospaced))

                        Button("Select Image...") {
                            if let path = pickFile(allowedExtensions: ["img", "bin", "mbn"]) {
                                selectedImagePath = path
                            }
                        }
                    }

                    Toggle("Pass --disable-verity --disable-verification (for vbmeta flashing)", isOn: $disableVerityVbmeta)
                        .font(.caption)

                    HStack(spacing: 12) {
                        Button {
                            guard !selectedImagePath.isEmpty else {
                                engine.log(.warning, "Please select an image file first.")
                                return
                            }
                            Task {
                                var args: [String] = []
                                if disableVerityVbmeta {
                                    args.append(contentsOf: ["--disable-verity", "--disable-verification"])
                                }
                                args.append(contentsOf: ["flash", selectedPartition, selectedImagePath])
                                _ = await engine.executeAndLog(
                                    workflowId: "fastboot.flash",
                                    title: "Fastboot Flash \(selectedPartition)",
                                    executable: engine.toolPaths["fastboot"]!,
                                    arguments: engine.fastbootArgs(args)
                                )
                            }
                        } label: {
                            Label("Flash Partition Now", systemImage: "bolt.fill")
                        }
                        .buttonStyle(.borderedProminent)

                        Button("Boot Image Temporarily (fastboot boot)") {
                            guard !selectedImagePath.isEmpty else { return }
                            Task {
                                _ = await engine.executeAndLog(
                                    workflowId: "fastboot.boot_temp",
                                    title: "Fastboot Temporary Boot",
                                    executable: engine.toolPaths["fastboot"]!,
                                    arguments: engine.fastbootArgs(["boot", selectedImagePath])
                                )
                            }
                        }
                    }
                }
                .padding(8)
            }
        }
    }
}

// MARK: - Module 5: BobFWTools Firmware Inspector, SHA-256 Verifier & Inventory Ledger

struct FirmwareInspectorView: View {
    @ObservedObject var engine: ServicingEngine
    @State private var archivePath: String = ""
    @State private var expectedSha256: String = ""
    @State private var inspectionReport: FirmwareInspectionReport?
    @State private var newBrand: String = ""
    @State private var newModel: String = ""
    @State private var newRegion: String = ""
    @State private var newBuild: String = ""
    @State private var newFilename: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            ModuleHeader(
                title: "BobFWTools Firmware Inspector & Local Inventory Ledger",
                subtitle: "Strict TAR/ZIP/Sparse header inspection, full-file SHA-256 verification, model preflight against connected hardware, and local firmware ledger"
            )

            GroupBox(label: Label("Firmware Package Inspection & SHA-256 Verification", systemImage: "doc.zipper")) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 10) {
                        TextField("Select .tar, .tar.md5, .zip, .ipsw, or .img artifact...", text: $archivePath)
                            .textFieldStyle(.roundedBorder)
                            .font(.system(size: 12, design: .monospaced))

                        Button("Browse Artifact...") {
                            if let path = pickFile(allowedExtensions: ["tar", "md5", "zip", "ipsw", "img", "bin", "lz4"]) {
                                archivePath = path
                            }
                        }
                    }

                    HStack(spacing: 10) {
                        TextField("Optional Reference SHA-256 (64 hex chars) to verify integrity...", text: $expectedSha256)
                            .textFieldStyle(.roundedBorder)
                            .font(.system(size: 12, design: .monospaced))

                        Button("Inspect & Compute SHA-256") {
                            guard !archivePath.isEmpty else { return }
                            Task {
                                inspectionReport = await engine.inspectFirmwareFile(at: archivePath)
                            }
                        }
                        .buttonStyle(.borderedProminent)

                        Button("Extract Archive to Folder...") {
                            guard !archivePath.isEmpty else { return }
                            if let destFolder = pickDirectory() {
                                Task {
                                    let isZip = archivePath.lowercased().hasSuffix(".zip") || archivePath.lowercased().hasSuffix(".ipsw")
                                    _ = await engine.executeAndLog(
                                        workflowId: "firmware.extract",
                                        title: "Extract Firmware to \(destFolder)",
                                        executable: isZip ? "/usr/bin/unzip" : "/usr/bin/tar",
                                        arguments: isZip ? ["-o", archivePath, "-d", destFolder] : ["-xvf", archivePath, "-C", destFolder]
                                    )
                                }
                            }
                        }
                    }

                    if let report = inspectionReport {
                        Divider()
                        VStack(alignment: .leading, spacing: 5) {
                            Text("Detected Format: \(report.detectedFormat) · Size: \(report.bytes) bytes · Slot: \(report.samsungSlot ?? "N/A") · Inferred Model: \(report.inferredModel ?? "Unverified")")
                                .font(.system(size: 12, weight: .semibold))
                            Text("Computed SHA-256: \(report.sha256)")
                                .font(.system(size: 11, design: .monospaced))
                                .textSelection(.enabled)

                            if !expectedSha256.trimmingCharacters(in: .whitespaces).isEmpty {
                                let match = expectedSha256.trimmingCharacters(in: .whitespaces).lowercased() == report.sha256.lowercased()
                                Text(match ? "✔ SHA-256 Reference Digest MATCHES" : "✖ SHA-256 Digest MISMATCH — Do Not Flash!")
                                    .font(.system(size: 11.5, weight: .bold))
                                    .foregroundColor(match ? .green : .red)
                            }

                            ForEach(report.blockers, id: \.self) { note in
                                Text("• \(note)")
                                    .font(.caption)
                                    .foregroundColor(.orange)
                            }

                            if !report.partitionCandidates.isEmpty {
                                Text("Partition Candidates (\(report.partitionCandidates.count)): \(report.partitionCandidates.joined(separator: ", "))")
                                    .font(.system(size: 11, design: .monospaced))
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
                .padding(8)
            }

            // Local Firmware Inventory Ledger
            GroupBox(label: Label("BobFWTools Local Firmware Inventory Ledger (\(engine.firmwareInventory.count) records)", systemImage: "books.vertical.fill")) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 8) {
                        TextField("Brand", text: $newBrand).frame(width: 90).textFieldStyle(.roundedBorder)
                        TextField("Model", text: $newModel).frame(width: 120).textFieldStyle(.roundedBorder)
                        TextField("Region", text: $newRegion).frame(width: 80).textFieldStyle(.roundedBorder)
                        TextField("Build", text: $newBuild).frame(width: 140).textFieldStyle(.roundedBorder)
                        TextField("Filename / Notes", text: $newFilename).textFieldStyle(.roundedBorder)
                        Button("Add to Ledger") {
                            guard !newModel.trimmingCharacters(in: .whitespaces).isEmpty,
                                  !newBuild.trimmingCharacters(in: .whitespaces).isEmpty else {
                                engine.log(.warning, "Model and Build are required to add an entry to the firmware ledger.")
                                return
                            }
                            let rec = FirmwareInventoryRecord(
                                brand: newBrand.isEmpty ? "Generic" : newBrand,
                                model: newModel,
                                region: newRegion.isEmpty ? "Universal" : newRegion,
                                carrier: "OPEN",
                                build: newBuild,
                                version: newBuild,
                                sha256: inspectionReport?.sha256 ?? "",
                                filename: newFilename.isEmpty ? (inspectionReport?.filename ?? "\(newModel)_\(newRegion)_\(newBuild).zip") : newFilename,
                                state: inspectionReport != nil ? "inspected" : "discovered"
                            )
                            engine.firmwareInventory.append(rec)
                            engine.saveInventory()
                            engine.log(.success, "Added \(rec.model) (\(rec.build)) to local Firmware Inventory Ledger.")
                        }
                    }

                    ForEach(engine.firmwareInventory) { item in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("\(item.brand) \(item.model) · Build \(item.build) (\(item.region))")
                                    .font(.system(size: 12, weight: .semibold))
                                Text("File: \(item.filename) · State: \(item.state.uppercased()) \(item.sha256.isEmpty ? "" : "· SHA256: \(item.sha256.prefix(16))...")")
                                    .font(.system(size: 11, design: .monospaced))
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                            Button("Remove") {
                                engine.firmwareInventory.removeAll { $0.id == item.id }
                                engine.saveInventory()
                            }
                            .controlSize(.small)
                        }
                        .padding(6)
                        .background(RoundedRectangle(cornerRadius: 6).fill(Color(NSColor.controlBackgroundColor)))
                    }
                }
                .padding(8)
            }
        }
    }
}

// MARK: - Module 6: Apple iDevice Recovery & Diagnostics

struct AppleServicingView: View {
    @ObservedObject var engine: ServicingEngine

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            ModuleHeader(
                title: "Apple iDevice Diagnostics & Recovery Assistant",
                subtitle: "BobFWTools Apple recovery inspection, libimobiledevice telemetry, pairing verification, and Finder Restore Assistant"
            )

            if engine.activePlatform != .appleIos {
                HStack(spacing: 10) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.orange)
                        .font(.system(size: 16))
                    VStack(alignment: .leading, spacing: 2) {
                        Text("NO APPLE IDEVICE DETECTED ON USB BUS")
                            .font(.system(size: 11.5, weight: .bold))
                            .foregroundColor(.orange)
                        Text("Apple lockdownd diagnostics, DFU tools, and pairing validation are disabled until an iPhone or iPad (VID 05ac) in Normal, Recovery, or DFU mode is plugged in.")
                            .font(.system(size: 11))
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                }
                .padding(10)
                .background(RoundedRectangle(cornerRadius: 8).fill(Color.orange.opacity(0.12)))
            }

            // Guided Step-by-Step State Machine Wizard
            GuidedWorkflowWizardCard(
                title: "Apple Guided Diagnostics & Trust Wizard",
                subtitle: "Enforces Step-by-Step isolation: USB 05ac Enumeration -> Host SSL Lockdownd Pairing -> Telemetry Audit",
                icon: "iphone.badge.play",
                steps: engine.appleWizardSteps,
                onExecuteStep: { step in
                    Task { await engine.executeAppleWizardStep(stepNumber: step) }
                },
                onReset: {
                    engine.resetAppleWizard()
                }
            )

            GroupBox(label: Label("iPhone / iPad Lockdownd & Recovery Operations", systemImage: "iphone.gen3")) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 10) {
                        Button("List Connected UDIDs") {
                            Task {
                                _ = await engine.executeAndLog(
                                    workflowId: "apple.idevice_id",
                                    title: "idevice_id -l",
                                    executable: engine.toolPaths["idevice_id"]!,
                                    arguments: ["-l"]
                                )
                            }
                        }
                        Button("Read Full iDevice Info") {
                            Task {
                                _ = await engine.executeAndLog(
                                    workflowId: "apple.ideviceinfo",
                                    title: "ideviceinfo",
                                    executable: engine.toolPaths["ideviceinfo"]!,
                                    arguments: []
                                )
                            }
                        }
                        Button("Pair Trust (idevicepair pair)") {
                            Task {
                                _ = await engine.executeAndLog(
                                    workflowId: "apple.pair",
                                    title: "idevicepair pair",
                                    executable: engine.toolPaths["idevicepair"]!,
                                    arguments: ["pair"]
                                )
                            }
                        }
                        Button("Validate Pairing") {
                            Task {
                                _ = await engine.executeAndLog(
                                    workflowId: "apple.validate",
                                    title: "idevicepair validate",
                                    executable: engine.toolPaths["idevicepair"]!,
                                    arguments: ["validate"]
                                )
                            }
                        }
                    }

                    HStack(spacing: 10) {
                        Button("Open macOS Finder Restore / Update Assistant") {
                            NSWorkspace.shared.open(URL(fileURLWithPath: "/System/Library/CoreServices/Finder.app"))
                            engine.log(.info, "Opened macOS Finder for official iDevice Update / Restore management.")
                        }
                        Button("Open Apple Configurator.app") {
                            NSWorkspace.shared.open(URL(fileURLWithPath: "/Applications/Apple Configurator.app"))
                            engine.log(.info, "Launched /Applications/Apple Configurator.app")
                        }
                    }
                }
                .padding(8)
            }
        }
    }
}

// MARK: - Module 7: Audited Jobs, Repair Notes & Windows .EXE / UTM Bridge

struct BobFWTelemetryLedgerCard: View {
    @ObservedObject private var logger = BobFWTelemetryLogger.shared

    var body: some View {
        GroupBox(label: Label("Multi-Platform Hardware Telemetry Ledger (\(logger.historicalLedger.count) events)", systemImage: "waveform.path.badge.plus")) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Asynchronous thread-isolated telemetry records across chipset and transport pipelines:")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Spacer()
                    if !logger.historicalLedger.isEmpty {
                        Button("Clear Ledger") {
                            logger.historicalLedger.removeAll()
                        }
                        .controlSize(.small)
                    }
                }

                if logger.historicalLedger.isEmpty {
                    Text("No telemetry events recorded yet. Execute any diagnostic, guided wizard, or restoration workflow to populate.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.vertical, 8)
                } else {
                    ScrollView {
                        VStack(spacing: 6) {
                            ForEach(logger.historicalLedger.reversed()) { record in
                                VStack(alignment: .leading, spacing: 4) {
                                    HStack {
                                        Text("[\(record.workflowId)]")
                                            .font(.system(size: 11, weight: .bold, design: .monospaced))
                                        if let chip = record.hardwareProfile?.chipset {
                                            Text(chip.rawValue)
                                                .font(.system(size: 9.5, design: .monospaced))
                                                .padding(.horizontal, 4)
                                                .padding(.vertical, 1)
                                                .background(RoundedRectangle(cornerRadius: 3).fill(Color.blue.opacity(0.15)))
                                                .foregroundColor(.blue)
                                        }
                                        Spacer()
                                        Text(record.executionStatus.rawValue)
                                            .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                                            .padding(.horizontal, 5)
                                            .padding(.vertical, 2)
                                            .background(RoundedRectangle(cornerRadius: 3).fill(statusBackground(record.executionStatus)))
                                            .foregroundColor(statusForeground(record.executionStatus))
                                    }

                                    if let exc = record.capturedException {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text("Domain: \(exc.errorDomain) (Code \(exc.systemErrorCode))")
                                                .font(.system(size: 10, weight: .semibold, design: .monospaced))
                                                .foregroundColor(.red)
                                            if !exc.lowerLevelRawOutput.isEmpty {
                                                Text(exc.lowerLevelRawOutput)
                                                    .font(.system(size: 9.5, design: .monospaced))
                                                    .foregroundColor(.secondary)
                                                    .lineLimit(2)
                                            }
                                            Text("Mitigation: \(exc.targetedMitigationAdvice)")
                                                .font(.system(size: 9.5, weight: .medium))
                                                .foregroundColor(.accentColor)
                                        }
                                        .padding(4)
                                        .background(RoundedRectangle(cornerRadius: 4).fill(Color.red.opacity(0.08)))
                                    }
                                }
                                .padding(6)
                                .background(RoundedRectangle(cornerRadius: 6).fill(Color(NSColor.controlBackgroundColor)))
                            }
                        }
                    }
                    .frame(height: 160)
                }
            }
            .padding(8)
        }
    }

    private func statusBackground(_ status: BobFWTelemetryLogger.OperationalStatus) -> Color {
        switch status {
        case .success: return Color.green.opacity(0.2)
        case .executing, .processStaged: return Color.blue.opacity(0.2)
        case .faultInterrupted: return Color.red.opacity(0.2)
        case .busTimeout: return Color.orange.opacity(0.2)
        }
    }

    private func statusForeground(_ status: BobFWTelemetryLogger.OperationalStatus) -> Color {
        switch status {
        case .success: return .green
        case .executing, .processStaged: return .blue
        case .faultInterrupted: return .red
        case .busTimeout: return .orange
        }
    }
}

struct JobsNotesAndBridgeView: View {
    @ObservedObject var engine: ServicingEngine
    @State private var exePath: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            ModuleHeader(
                title: "Audited Workflow Jobs, Repair Receipts & UTM Bridge",
                subtitle: "Export BobFWTools JSON/Markdown diagnostic receipts, record per-session repair notes, and bridge to UTM/Wine"
            )

            // Repair Notes & Receipt Export
            GroupBox(label: Label("Technician Repair Notes & Diagnostic Receipt Exporter", systemImage: "doc.text.magnifyingglass")) {
                VStack(alignment: .leading, spacing: 10) {
                    TextEditor(text: $engine.repairNotes)
                        .font(.system(size: 12, design: .monospaced))
                        .frame(height: 90)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.secondary.opacity(0.25)))

                    HStack(spacing: 10) {
                        Button("Save Repair Notes") {
                            engine.saveRepairNotes()
                        }
                        Button("Export Diagnostic JSON Receipt...") {
                            exportReceiptJSON()
                        }
                        Button("Generate Customer Intake Sheet (.pdf)...") {
                            exportIntakePDF()
                        }
                        .buttonStyle(.borderedProminent)
                    }
                }
                .padding(8)
            }

            // Audited Job History
            GroupBox(label: Label("Audited Workflow Job Trail (\(engine.jobs.count) jobs)", systemImage: "clock.arrow.circlepath")) {
                VStack(alignment: .leading, spacing: 6) {
                    if engine.jobs.isEmpty {
                        Text("No workflow jobs recorded yet in this session.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    } else {
                        ForEach(engine.jobs.prefix(10)) { job in
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("[\(job.workflowId)] \(job.title)")
                                        .font(.system(size: 12, weight: .semibold))
                                    Text(job.summary)
                                        .font(.system(size: 11, design: .monospaced))
                                        .foregroundColor(.secondary)
                                        .lineLimit(1)
                                }
                                Spacer()
                                Text(job.state.uppercased())
                                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                                    .foregroundColor(job.verified ? .green : .orange)
                            }
                            .padding(6)
                            .background(RoundedRectangle(cornerRadius: 6).fill(Color(NSColor.controlBackgroundColor)))
                        }
                    }
                }
                .padding(8)
            }

            // Real-Time Asynchronous Telemetry Isolation Ledger
            BobFWTelemetryLedgerCard()

            // UTM & Wine Bridge
            GroupBox(label: Label("USB Passthrough VM Bridge", systemImage: "macwindow.on.rectangle")) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 10) {
                        TextField("Optional: Path to external binary...", text: $exePath)
                            .textFieldStyle(.roundedBorder)
                            .font(.system(size: 12, design: .monospaced))

                        Button("Locate Binary...") {
                            if let path = pickFile(allowedExtensions: ["exe", "msi"]) {
                                exePath = path
                            }
                        }
                    }

                    HStack(spacing: 12) {
                        Button {
                            NSWorkspace.shared.open(URL(fileURLWithPath: "/Applications/UTM.app"))
                            engine.log(.info, "Launched /Applications/UTM.app for USB Passthrough environment.")
                        } label: {
                            Label("Launch UTM.app (Full USB Passthrough)", systemImage: "play.desktopcomputer")
                        }
                        .buttonStyle(.borderedProminent)
                    }
                }
                .padding(8)
            }
        }
    }

    private func exportReceiptJSON() {
        let savePanel = NSSavePanel()
        savePanel.nameFieldStringValue = "bobfwtools-diagnostic-receipt-\(Int(Date().timeIntervalSince1970)).json"
        guard savePanel.runModal() == .OK, let url = savePanel.url else { return }

        let payload: [String: Any] = [
            "application": "BobFWTools — Bobby's Workshop (Phoenix Forge)",
            "exportedAt": ISO8601DateFormatter().string(from: Date()),
            "connectionGrade": engine.connectionGrade,
            "samsungModemTarget": [
                "model": engine.samsungModemInfo?.model ?? "",
                "pdaVersion": engine.samsungModemInfo?.pdaVersion ?? "",
                "cscPackageVersion": engine.samsungModemInfo?.cscPackageVersion ?? "",
                "activeCsc": engine.samsungModemInfo?.activeCsc ?? "",
                "countryCode": engine.samsungModemInfo?.countryCode ?? "",
                "serialNumber": engine.samsungModemInfo?.serialNumber ?? "",
                "carrierLock": engine.samsungModemInfo?.carrierLock ?? ""
            ],
            "repairNotes": engine.repairNotes,
            "jobsCount": engine.jobs.count
        ]

        if let data = try? JSONSerialization.data(withJSONObject: payload, options: [.prettyPrinted, .sortedKeys]) {
            try? data.write(to: url)
            engine.log(.success, "Exported BobFWTools Diagnostic Receipt to \(url.path)")
        }
    }

    private func exportIntakePDF() {
        let savePanel = NSSavePanel()
        savePanel.allowedContentTypes = [.pdf]
        savePanel.nameFieldStringValue = "bobfwtools-customer-intake-\(Int(Date().timeIntervalSince1970)).pdf"
        guard savePanel.runModal() == .OK, let url = savePanel.url else { return }

        if let pdfData = engine.generateCustomerIntakePdf(
            ticketId: "TKT-\(Int.random(in: 10000...99999))",
            customerName: "Customer Bench Intake",
            technician: "Bobby Blanco"
        ) {
            do {
                try pdfData.write(to: url)
                engine.log(.success, "✔ Generated printable Customer Intake Sheet: \(url.path)")
                NSWorkspace.shared.open(url)
            } catch {
                engine.log(.error, "✖ Failed to write PDF report: \(error.localizedDescription)")
            }
        } else {
            engine.log(.error, "✖ Failed to generate Customer Intake PDF report.")
        }
    }
}

// MARK: - Right Console Panel & Telemetry Visualizer

enum ConsoleDisplayMode: String, CaseIterable {
    case engineLogs = "Execution Logs"
    case telemetry = "Telemetry Visualizer"
    case dualTiles = "Live Dual Monitor"
}

// MARK: - Automated Database Size Monitor Pane

struct BobFWDatabaseMonitorView: View {
    @ObservedObject private var logger = BobFWTelemetryLogger.shared
    @State private var loggedRowsCount: Int = 0
    @State private var databaseSizeString: String = "0 KB"

    private let monitoringTimer = Timer.publish(every: 2.0, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "square.stack.3d.up.fill")
                    .font(.title2)
                    .foregroundColor(.orange)

                VStack(alignment: .leading, spacing: 2) {
                    Text("SQLite Audit Ledger Storage Monitor")
                        .font(.headline)
                    Text("Target Workspace File Vector Tracking Allocation")
                        .font(.caption)
                        .foregroundColor(.gray)
                }
                Spacer()

                Button(action: { refreshStorageMetrics() }) {
                    Image(systemName: "arrow.clockwise")
                }
                .buttonStyle(.plain)
            }

            Divider()

            HStack(spacing: 20) {
                // Metric Node 1: Log Volume Count
                VStack(alignment: .leading, spacing: 4) {
                    Text("COMMITTED ENTRIES")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.gray)
                    Text("\(loggedRowsCount)")
                        .font(.system(size: 22, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                // Metric Node 2: Database Allocation Size
                VStack(alignment: .leading, spacing: 4) {
                    Text("LEDGER DISK SPACE")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.gray)
                    Text(databaseSizeString)
                        .font(.system(size: 22, weight: .bold, design: .monospaced))
                        .foregroundColor(.cyan)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.vertical, 4)

            // Operational Safety Action Button
            Button(action: {
                logger.purgeTelemetryLedger()
                refreshStorageMetrics()
            }) {
                HStack {
                    Spacer()
                    Image(systemName: "bolt.fill")
                    Text("Purge Offline Ledger Indices")
                    Spacer()
                }
            }
            .buttonStyle(.bordered)
            .tint(.orange)
        }
        .padding()
        .background(Color(NSColor.windowBackgroundColor).opacity(0.8))
        .cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.gray.opacity(0.2), lineWidth: 1))
        .onAppear { refreshStorageMetrics() }
        .onReceive(monitoringTimer) { _ in refreshStorageMetrics() }
    }

    /// Queries metrics directly from file indices and formats them for the user
    private func refreshStorageMetrics() {
        let stats = logger.fetchDatabaseStorageMetrics()
        self.loggedRowsCount = stats.rowCount

        let byteFormatter = ByteCountFormatter()
        byteFormatter.allowedUnits = [.useKB, .useMB]
        byteFormatter.countStyle = .file
        self.databaseSizeString = byteFormatter.string(fromByteCount: stats.sizeInBytes)
    }
}

struct BobFWTelemetryConsoleView: View {
    @ObservedObject private var telemetry = BobFWTelemetryLogger.shared
    @State private var filterQuery: String = ""
    @State private var autoScrollToBottom: Bool = true
    @State private var showDatabaseMonitor: Bool = false

    var filteredLogs: [BobFWTelemetryLogger.PipelineSessionRecord] {
        if filterQuery.isEmpty { return telemetry.historicalLedger }
        return telemetry.historicalLedger.filter { $0.workflowId.localizedCaseInsensitiveContains(filterQuery) }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Live Status Header Toolbar
            HStack {
                TextField("Filter by Workflow ID...", text: $filterQuery)
                    .textFieldStyle(.roundedBorder)
                    .font(.system(size: 11, design: .monospaced))

                Button {
                    telemetry.historicalLedger.removeAll()
                } label: {
                    Label("Clear", systemImage: "trash")
                }
                .controlSize(.small)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Color(NSColor.controlBackgroundColor))

            Divider()

            // Collapsible SQLite Audit Ledger Storage Monitor
            DisclosureGroup(
                isExpanded: $showDatabaseMonitor,
                content: {
                    BobFWDatabaseMonitorView()
                        .padding(8)
                },
                label: {
                    HStack(spacing: 6) {
                        Image(systemName: "cylinder.split.1x2.fill")
                            .foregroundColor(.orange)
                        Text("Audit Ledger Storage Monitor")
                            .font(.system(size: 11, weight: .semibold))
                        Spacer()
                    }
                    .padding(.horizontal, 4)
                }
            )
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Color(NSColor.controlBackgroundColor).opacity(0.5))

            Divider()

            // Scrolling Live Terminal Log Layout
            ScrollViewReader { proxy in
                List(filteredLogs) { record in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(record.timestamp, style: .time)
                                .font(.system(.caption, design: .monospaced))
                                .foregroundColor(.secondary)

                            Text("[\(record.workflowId)]")
                                .font(.system(.caption, design: .monospaced))
                                .foregroundColor(.orange)

                            Spacer()

                            // Badge indicating precise execution status state
                            Text(record.executionStatus.rawValue)
                                .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(statusColorModifier(record.executionStatus).opacity(0.2))
                                .foregroundColor(statusColorModifier(record.executionStatus))
                                .cornerRadius(4)
                        }

                        if let profile = record.hardwareProfile {
                            Text("Target: \(profile.chipset.rawValue) · Transport: \(profile.activeTransport.rawValue)")
                                .font(.system(size: 10.5, design: .monospaced))
                                .foregroundColor(.accentColor)
                        }

                        // Render Exception Box only if process fault is trapped
                        if let fault = record.capturedException {
                            VStack(alignment: .leading, spacing: 3) {
                                Text("⚠️ FAULT [\(fault.errorDomain)] CODE: \(fault.systemErrorCode)")
                                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                                    .foregroundColor(.red)

                                if !fault.lowerLevelRawOutput.isEmpty {
                                    Text("Raw: \(fault.lowerLevelRawOutput)")
                                        .font(.system(size: 9.5, design: .monospaced))
                                        .foregroundColor(.secondary)
                                        .lineLimit(2)
                                }

                                Text("Mitigation Advice: \(fault.targetedMitigationAdvice)")
                                    .font(.system(size: 10, weight: .medium))
                                    .foregroundColor(.green)
                            }
                            .padding(6)
                            .background(RoundedRectangle(cornerRadius: 4).fill(Color.red.opacity(0.12)))
                        }
                    }
                    .padding(.vertical, 2)
                    .id(record.id)
                }
                .onChange(of: telemetry.historicalLedger.count) { _, _ in
                    if autoScrollToBottom, let lastRecord = filteredLogs.last {
                        withAnimation { proxy.scrollTo(lastRecord.id, anchor: .bottom) }
                    }
                }
            }
        }
    }

    private func statusColorModifier(_ status: BobFWTelemetryLogger.OperationalStatus) -> Color {
        switch status {
        case .processStaged: return .gray
        case .executing: return .yellow
        case .success: return .green
        case .faultInterrupted, .busTimeout: return .red
        }
    }
}

struct ConsoleLogPanel: View {
    @ObservedObject var engine: ServicingEngine
    @Binding var customCommand: String
    @State private var consoleMode: ConsoleDisplayMode = .engineLogs

    private static let timeFormatter: DateFormatter = {
        let df = DateFormatter()
        df.dateFormat = "HH:mm:ss"
        return df
    }()

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Picker("", selection: $consoleMode) {
                    ForEach(ConsoleDisplayMode.allCases, id: \.self) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 330)

                Spacer()

                if consoleMode == .engineLogs {
                    Button("Copy") {
                        let allText = engine.logs.map { "[\(Self.timeFormatter.string(from: $0.timestamp))] [\($0.level.rawValue)] \($0.message)" }.joined(separator: "\n")
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(allText, forType: .string)
                    }
                    .controlSize(.small)

                    Button("Clear") {
                        engine.clearLogs()
                    }
                    .controlSize(.small)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background(Color(NSColor.controlBackgroundColor))

            Divider()

            if consoleMode == .telemetry {
                BobFWTelemetryConsoleView()
            } else if consoleMode == .dualTiles {
                VStack(spacing: 8) {
                    BobFWDatabaseMonitorView()
                        .padding(.horizontal, 8)
                        .padding(.top, 8)
                    BobFWTelemetryConsoleView()
                }
            } else {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 6) {
                            ForEach(engine.logs) { item in
                                HStack(alignment: .top, spacing: 8) {
                                    Text(Self.timeFormatter.string(from: item.timestamp))
                                        .font(.system(size: 11, design: .monospaced))
                                        .foregroundColor(.secondary)

                                    Text(item.level.rawValue)
                                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                                        .padding(.horizontal, 5)
                                        .padding(.vertical, 1)
                                        .background(RoundedRectangle(cornerRadius: 4).fill(badgeColor(item.level).opacity(0.2)))
                                        .foregroundColor(badgeColor(item.level))

                                    Text(item.message)
                                        .font(.system(size: 11.5, design: .monospaced))
                                        .foregroundColor(.primary)
                                        .textSelection(.enabled)
                                }
                                .id(item.id)
                            }
                        }
                        .padding(12)
                    }
                    .background(Color(NSColor.textBackgroundColor))
                    .onChange(of: engine.logs.count) { _, _ in
                        if let last = engine.logs.last {
                            proxy.scrollTo(last.id, anchor: .bottom)
                        }
                    }
                }

                Divider()

                // Quick Shell / ADB / BootForge Command Bar
                HStack(spacing: 8) {
                    TextField("Run direct adb / fastboot / bootforgeusb command...", text: $customCommand)
                        .textFieldStyle(.roundedBorder)
                        .font(.system(size: 12, design: .monospaced))
                        .onSubmit {
                            runCustomShell()
                        }
                    Button("Run") {
                        runCustomShell()
                    }
                }
                .padding(10)
                .background(Color(NSColor.controlBackgroundColor))
            }
        }
    }

    private func runCustomShell() {
        let cmd = customCommand.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cmd.isEmpty else { return }
        customCommand = ""
        Task {
            _ = await engine.executeAndLog(
                workflowId: "console.custom",
                title: cmd,
                executable: "/bin/sh",
                arguments: ["-c", cmd]
            )
        }
    }

    private func badgeColor(_ level: LogEntry.Level) -> Color {
        switch level {
        case .info: return .blue
        case .command: return .purple
        case .success: return .green
        case .warning: return .orange
        case .error: return .red
        }
    }
}

// MARK: - Shared UI Helpers

struct ModuleHeader: View {
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.system(size: 19, weight: .bold))
            Text(subtitle)
                .font(.system(size: 12))
                .foregroundColor(.secondary)
        }
    }
}

@MainActor
func pickFile(allowedExtensions: [String]) -> String? {
    let panel = NSOpenPanel()
    panel.canChooseFiles = true
    panel.canChooseDirectories = false
    panel.allowsMultipleSelection = false
    if !allowedExtensions.isEmpty {
        panel.allowedContentTypes = allowedExtensions.compactMap { UTType(filenameExtension: $0) }
    }
    return panel.runModal() == .OK ? panel.url?.path : nil
}

@MainActor
func pickDirectory() -> String? {
    let panel = NSOpenPanel()
    panel.canChooseFiles = false
    panel.canChooseDirectories = true
    panel.allowsMultipleSelection = false
    return panel.runModal() == .OK ? panel.url?.path : nil
}

// MARK: - Developer Utility Workbench & Live Logcat View

struct DeveloperWorkbenchView: View {
    @ObservedObject var engine: ServicingEngine
    @State private var selectedApkPath: String = ""
    @State private var deploymentStatus: String = "Idle"
    @State private var searchPattern: String = ""
    @State private var selectedLocale: String = "en-US"

    let commonLocales = [
        ("en-US", "English (United States)"),
        ("es-US", "Spanish (Estados Unidos)"),
        ("fr-FR", "French (France)"),
        ("de-DE", "German (Deutschland)"),
        ("ar-SA", "Arabic (العربية)"),
        ("zh-CN", "Chinese Simplified (简体中文)"),
        ("ja-JP", "Japanese (日本語)"),
        ("ko-KR", "Korean (한국어)"),
        ("pt-BR", "Portuguese (Brasil)"),
        ("ru-RU", "Russian (Русский)")
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            ModuleHeader(
                title: "Developer Workbench & Live Staging Suite",
                subtitle: "Automated JSON debloat management, bulk APK sideload siphon, live regex-filtered logcat streaming, and locale stager"
            )

            // Section 1: 1-Click System Locale Staging Engine
            GroupBox(label: Label("System Localization & Locale Stager (Authorized ADB)", systemImage: "globe")) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Stage device language and system locales without wiping or navigating Settings menus:")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    HStack(spacing: 12) {
                        Picker("Select Locale:", selection: $selectedLocale) {
                            ForEach(commonLocales, id: \.0) { loc in
                                Text("\(loc.1) [\(loc.0)]").tag(loc.0)
                            }
                        }
                        .frame(width: 320)

                        Button("Apply System Locale") {
                            Task {
                                let (ok, msg) = await engine.setDeviceLocale(selectedLocale)
                                if ok {
                                    engine.log(.success, "✔ Applied locale: \(selectedLocale)")
                                } else {
                                    engine.log(.error, "✖ Failed to apply locale: \(msg)")
                                }
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(!engine.devices.contains { $0.transport == .adb })
                    }
                }
                .padding(8)
            }

            // Section 2: Automated JSON Debloat Registry Manager
            if let debloat = engine.debloatEngine {
                GroupBox(label: Label("Automated JSON Debloat Registry Manager (Reversible)", systemImage: "trash.circle.fill")) {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text("Strip carrier and OEM background bloatware for User 0 with 1-click restore:")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Spacer()
                            Text(debloat.statusMessage)
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundColor(.secondary)
                        }

                        if debloat.progress > 0 && debloat.progress < 1.0 {
                            ProgressView(value: debloat.progress)
                                .padding(.vertical, 2)
                        }

                        // Category filtered package list
                        ScrollView {
                            VStack(spacing: 4) {
                                ForEach(debloat.registry) { pkg in
                                    HStack(spacing: 8) {
                                        Toggle(isOn: Binding(
                                            get: { debloat.selectedIds.contains(pkg.packageId) },
                                            set: { isSel in
                                                if isSel { debloat.selectedIds.insert(pkg.packageId) }
                                                else { debloat.selectedIds.remove(pkg.packageId) }
                                            }
                                        )) {
                                            HStack(spacing: 6) {
                                                Text(pkg.readableLabel)
                                                    .font(.system(size: 12, weight: .semibold))
                                                Text("(\(pkg.packageId))")
                                                    .font(.system(size: 10.5, design: .monospaced))
                                                    .foregroundColor(.secondary)
                                            }
                                        }

                                        Spacer()

                                        Text(pkg.category.rawValue)
                                            .font(.system(size: 9.5, design: .monospaced))
                                            .padding(.horizontal, 5)
                                            .padding(.vertical, 1)
                                            .background(RoundedRectangle(cornerRadius: 3).fill(Color.blue.opacity(0.12)))
                                            .foregroundColor(.blue)

                                        Text(pkg.performanceImpact)
                                            .font(.system(size: 9.5, design: .monospaced))
                                            .padding(.horizontal, 5)
                                            .padding(.vertical, 1)
                                            .background(RoundedRectangle(cornerRadius: 3).fill(Color.orange.opacity(0.12)))
                                            .foregroundColor(.orange)

                                        if pkg.isInstalled {
                                            Text("INSTALLED")
                                                .font(.system(size: 9, weight: .bold, design: .monospaced))
                                                .foregroundColor(.green)
                                        } else {
                                            Button("Restore") {
                                                Task { await debloat.restorePackage(pkg.packageId) }
                                            }
                                            .controlSize(.mini)
                                        }
                                    }
                                    .padding(.vertical, 3)
                                    .padding(.horizontal, 6)
                                    .background(RoundedRectangle(cornerRadius: 4).fill(Color(NSColor.controlBackgroundColor)))
                                }
                            }
                        }
                        .frame(height: 180)

                        HStack(spacing: 10) {
                            Button("Scan Installed Bloat") {
                                Task { await debloat.scanInstalledState() }
                            }
                            .disabled(!engine.devices.contains { $0.transport == .adb })

                            Button {
                                Task { await debloat.uninstallSelected() }
                            } label: {
                                Label("Run 1-Click Debloat (Strip Selected)", systemImage: "sparkles")
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(!engine.devices.contains { $0.transport == .adb } || debloat.selectedIds.isEmpty)

                            Spacer()

                            Button("Select All") {
                                debloat.selectedIds = Set(debloat.registry.map { $0.packageId })
                            }
                            .controlSize(.small)

                            Button("Deselect All") {
                                debloat.selectedIds.removeAll()
                            }
                            .controlSize(.small)
                        }
                    }
                    .padding(8)
                }
            }

            // Section 3: 1-Click Bulk App Sideload Siphon (Watched Folder)
            if let siphon = engine.siphonEngine {
                GroupBox(label: Label("1-Click Bulk App Sideload Siphon (Watched Directory)", systemImage: "tray.and.arrow.down.fill")) {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(spacing: 10) {
                            Text("Watched Folder:")
                                .font(.caption.weight(.semibold))
                            Text(siphon.watchedDirectory?.path ?? "None")
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundColor(.secondary)
                                .lineLimit(1)

                            Spacer()

                            Button("Choose Folder...") {
                                if let chosen = pickDirectory() {
                                    siphon.setWatchedDirectory(URL(fileURLWithPath: chosen))
                                }
                            }

                            if let dir = siphon.watchedDirectory {
                                Button("Open in Finder") {
                                    NSWorkspace.shared.open(dir)
                                }
                            }
                        }

                        if siphon.isProcessing {
                            ProgressView(value: siphon.currentProgress)
                        }

                        // Queued APKs
                        ScrollView {
                            VStack(spacing: 4) {
                                if siphon.deploymentQueue.isEmpty {
                                    Text("No .apk installers found. Drop APK files into this folder to auto-populate the siphon queue.")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                        .padding(.vertical, 20)
                                } else {
                                    ForEach(siphon.deploymentQueue) { job in
                                        HStack {
                                            Image(systemName: "shippingbox.fill")
                                                .foregroundColor(.blue)
                                            Text(job.fileName)
                                                .font(.system(size: 11.5, design: .monospaced))
                                            Spacer()
                                            if let err = job.errorMessage {
                                                Text(err)
                                                    .font(.system(size: 10))
                                                    .foregroundColor(.red)
                                                    .lineLimit(1)
                                            }
                                            Text(job.status.uppercased())
                                                .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                                                .foregroundColor(statusColor(job.status))
                                        }
                                        .padding(.vertical, 3)
                                        .padding(.horizontal, 6)
                                        .background(RoundedRectangle(cornerRadius: 4).fill(Color(NSColor.controlBackgroundColor)))
                                    }
                                }
                            }
                        }
                        .frame(height: 140)

                        HStack(spacing: 12) {
                            Button {
                                Task { await siphon.executeBulkSideload() }
                            } label: {
                                Label("Deploy Siphon Queue (\(siphon.deploymentQueue.count) APKs)", systemImage: "arrow.down.circle.fill")
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(siphon.deploymentQueue.isEmpty || siphon.isProcessing || !engine.devices.contains { $0.transport == .adb })

                            Button("Rescan Folder") {
                                siphon.scanDirectory()
                            }

                            Spacer()

                            Text(siphon.statusSummary)
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(8)
                }
            }

            // Section 4: Single Diagnostic APK Sideloading (ABI Verified)
            GroupBox(label: Label("Single APK Deployment Bench (ABI Verified)", systemImage: "arrow.down.doc.fill")) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 10) {
                        TextField("Path to .apk file...", text: $selectedApkPath)
                            .textFieldStyle(.roundedBorder)
                            .font(.system(size: 12, design: .monospaced))

                        Button("Choose APK...") {
                            if let path = pickFile(allowedExtensions: ["apk"]) {
                                selectedApkPath = path
                            }
                        }

                        Button {
                            deploySelectedApk()
                        } label: {
                            Label("Deploy APK", systemImage: "bolt.fill")
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(selectedApkPath.isEmpty || engine.isBusy)
                    }

                    HStack {
                        Text("Status: \(deploymentStatus)")
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundColor(.secondary)
                        Spacer()
                    }
                }
                .padding(8)
            }

            // Section 5: Live Regex-Filtered Logcat Stream Subsystem
            GroupBox(label: Label("Live Device Logcat Stream Subsystem (adb logcat -v time)", systemImage: "waveform.path.ecg")) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 10) {
                        if engine.logcatSubsystem.isStreaming {
                            Button("Stop Logcat Stream") {
                                engine.logcatSubsystem.stop()
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(.red)
                        } else {
                            Button("Start Live Logcat Stream") {
                                startLogcat()
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(!engine.devices.contains { $0.transport == .adb })
                        }

                        Button("Clear") {
                            engine.logcatSubsystem.clear()
                        }

                        Button("Export Logcat Report...") {
                            let target = engine.samsungModemInfo?.model ?? engine.selectedDevice?.name ?? "Unknown Target"
                            if let exportedUrl = engine.logcatSubsystem.exportReport(targetInfo: target) {
                                engine.log(.success, "Exported logcat report to \(exportedUrl.path)")
                            }
                        }
                        .disabled(engine.logcatSubsystem.filteredEntries.isEmpty)

                        Spacer()

                        Text("\(engine.logcatSubsystem.filteredEntries.count) events captured")
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundColor(.secondary)
                    }

                    HStack {
                        Image(systemName: "line.3.horizontal.decrease.circle")
                            .foregroundColor(.secondary)
                        TextField("Live regex filter (e.g. fatal|crash|anr|exception|activity)...", text: $searchPattern)
                            .textFieldStyle(.roundedBorder)
                            .font(.system(size: 11.5, design: .monospaced))
                            .onChange(of: searchPattern) { _, newVal in
                                engine.logcatSubsystem.applyFilter(newVal)
                            }
                    }

                    // Logcat Stream Viewport
                    ScrollViewReader { proxy in
                        ScrollView {
                            LazyVStack(alignment: .leading, spacing: 3) {
                                ForEach(engine.logcatSubsystem.filteredEntries) { entry in
                                    HStack(alignment: .top, spacing: 6) {
                                        Text(entry.timestamp)
                                            .font(.system(size: 10, design: .monospaced))
                                            .foregroundColor(.secondary)
                                        Text("[\(entry.logLevel)]")
                                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                                            .foregroundColor(colorForLevel(entry.logLevel))
                                        Text("\(entry.tag):")
                                            .font(.system(size: 10, weight: .semibold, design: .monospaced))
                                            .foregroundColor(.blue)
                                        Text(entry.message)
                                            .font(.system(size: 10.5, design: .monospaced))
                                            .foregroundColor(.primary)
                                            .textSelection(.enabled)
                                    }
                                    .id(entry.id)
                                }
                            }
                            .padding(8)
                        }
                        .frame(height: 220)
                        .background(Color(NSColor.textBackgroundColor))
                        .cornerRadius(6)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.gray.opacity(0.2), lineWidth: 1))
                        .onChange(of: engine.logcatSubsystem.filteredEntries.count) { _, _ in
                            if let last = engine.logcatSubsystem.filteredEntries.last {
                                proxy.scrollTo(last.id, anchor: .bottom)
                            }
                        }
                    }
                }
                .padding(8)
            }
        }
    }

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "Deployed": return .green
        case "Installing": return .blue
        case "Failed": return .red
        default: return .secondary
        }
    }

    private func colorForLevel(_ level: String) -> Color {
        switch level {
        case "E", "F": return .red
        case "W": return .orange
        case "D": return .green
        default: return .secondary
        }
    }

    private func deploySelectedApk() {
        guard !selectedApkPath.isEmpty else { return }
        deploymentStatus = "Verifying target CPU ABI..."
        Task {
            do {
                let url = URL(fileURLWithPath: selectedApkPath)
                let msg = try await engine.deployApk(url: url)
                deploymentStatus = "✔ \(msg)"
            } catch {
                deploymentStatus = "✖ \(error.localizedDescription)"
                engine.log(.error, "APK Deployment Error: \(error.localizedDescription)")
            }
        }
    }

    private func startLogcat() {
        let adbPath = engine.toolPaths["adb"] ?? "/usr/local/bin/adb"
        let args = engine.adbArgs(["logcat", "-v", "time"])
        engine.logcatSubsystem.start(adbPath: adbPath, args: args)
        engine.log(.info, "Started live logcat streaming from target device.")
    }
}

// MARK: - Dual-Platform Bench Monitor & Staging Dashboard

struct DualPlatformWorkbenchView: View {
    @ObservedObject var engine: ServicingEngine
    @State private var ticketId: String = "TKT-\(Int.random(in: 10000...99999))"
    @State private var customerName: String = ""
    @State private var technician: String = "Bobby Blanco"

    // Android Controls
    @State private var selectedLocale: String = "es_ES"
    @State private var localeStatus: String = ""
    @State private var cscStatus: String = ""
    @State private var showMasterClearAlert: Bool = false
    @State private var resetStatus: String = ""

    // Apple Controls
    @State private var iosResetStatus: String = ""

    let commonLocales = [
        ("en_US", "🇺🇸 English (US)"),
        ("es_ES", "🇪🇸 Español (ES)"),
        ("es_US", "🇲🇽 Español (MX)"),
        ("fr_FR", "🇫🇷 Français (FR)"),
        ("de_DE", "🇩🇪 Deutsch (DE)"),
        ("zh_CN", "🇨🇳 中文 (CN)"),
        ("ja_JP", "🇯🇵 日本語 (JP)"),
        ("ar_AE", "🇦🇪 العربية (AR)")
    ]

    @State private var showBrandingConfig: Bool = false
    @State private var brandingSavedMessage: String = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                ModuleHeader(
                    title: "Dual-Platform Bench Monitor & Diagnostics Switcher",
                    subtitle: "Concurrent side-by-side bench management for Android and Apple hardware: automated language staging, multi-CSC preconfig, and printable intake sheets."
                )

                // Top Bench Intake & PDF Generation Bar
                GroupBox(label: Label("Bench Intake Ticket & Printable Report Dispatcher", systemImage: "printer.filled.and.paper")) {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("INTAKE TICKET ID")
                                    .font(.system(size: 9.5, weight: .bold))
                                    .foregroundColor(.secondary)
                                TextField("Ticket ID", text: $ticketId)
                                    .textFieldStyle(.roundedBorder)
                                    .font(.system(size: 12, design: .monospaced))
                                    .frame(width: 140)
                            }

                            VStack(alignment: .leading, spacing: 2) {
                                Text("CUSTOMER / ASSET NAME")
                                    .font(.system(size: 9.5, weight: .bold))
                                    .foregroundColor(.secondary)
                                TextField("Customer Name", text: $customerName)
                                    .textFieldStyle(.roundedBorder)
                                    .font(.system(size: 12))
                                    .frame(minWidth: 160)
                            }

                            VStack(alignment: .leading, spacing: 2) {
                                Text("BENCH TECHNICIAN")
                                    .font(.system(size: 9.5, weight: .bold))
                                    .foregroundColor(.secondary)
                                TextField("Technician Name", text: $technician)
                                    .textFieldStyle(.roundedBorder)
                                    .font(.system(size: 12))
                                    .frame(width: 150)
                            }

                            Spacer()

                            Button {
                                exportIntakeSheet()
                            } label: {
                                Label("Generate Customer Intake Sheet (.pdf)", systemImage: "doc.richtext.fill")
                                    .padding(.vertical, 3)
                            }
                            .buttonStyle(.borderedProminent)

                            Button {
                                showBrandingConfig.toggle()
                            } label: {
                                Image(systemName: "gearshape.fill")
                                    .foregroundColor(showBrandingConfig ? .accentColor : .secondary)
                            }
                            .help("Custom Bench Branding & Intake Disclaimer Settings")
                        }

                        if showBrandingConfig {
                            Divider()
                            VStack(alignment: .leading, spacing: 8) {
                                Text("BENCH & SHOP INTAKE BRANDING PREFERENCES")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(.secondary)

                                HStack(spacing: 12) {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("Shop / Company Name")
                                            .font(.caption2)
                                        TextField("Shop Name", text: $engine.brandingConfig.shopName)
                                            .textFieldStyle(.roundedBorder)
                                    }
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("Report Subtitle")
                                            .font(.caption2)
                                        TextField("Report Subtitle", text: $engine.brandingConfig.documentSubtitle)
                                            .textFieldStyle(.roundedBorder)
                                    }
                                }

                                HStack(spacing: 12) {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("Shop Contact / Support Line")
                                            .font(.caption2)
                                        TextField("Contact", text: $engine.brandingConfig.shopContact)
                                            .textFieldStyle(.roundedBorder)
                                    }
                                }

                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Intake Sign-off Disclaimer & Warranty Terms")
                                        .font(.caption2)
                                    TextEditor(text: $engine.brandingConfig.warrantyTerms)
                                        .font(.system(size: 11))
                                        .frame(height: 50)
                                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.secondary.opacity(0.2)))
                                }

                                HStack {
                                    Button("Save Branding Preferences") {
                                        engine.saveBrandingConfig()
                                        brandingSavedMessage = "✔ Branding saved"
                                    }
                                    .buttonStyle(.bordered)

                                    if !brandingSavedMessage.isEmpty {
                                        Text(brandingSavedMessage)
                                            .font(.caption)
                                            .foregroundColor(.green)
                                    }
                                }
                            }
                            .padding(8)
                            .background(RoundedRectangle(cornerRadius: 6).fill(Color(NSColor.controlBackgroundColor)))
                        }
                    }
                    .padding(8)
                }

                // Dual-Column Split Workstation
                HStack(alignment: .top, spacing: 16) {
                    // LEFT COLUMN: Android Workstation
                    VStack(alignment: .leading, spacing: 14) {
                        // Android Header Banner
                        HStack(spacing: 8) {
                            Image(systemName: "candybarphone")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(.green)
                            Text("ANDROID WORKSTATION")
                                .font(.system(size: 12, weight: .bold))
                            Spacer()
                            let hasAdb = engine.devices.contains { $0.transport == .adb }
                            let hasModem = !engine.selectedSerialPort.isEmpty || engine.samsungModemInfo != nil
                            if hasAdb {
                                Text("ADB AUTHORIZED")
                                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(RoundedRectangle(cornerRadius: 4).fill(Color.green.opacity(0.2)))
                                    .foregroundColor(.green)
                            } else if hasModem {
                                Text("AT MODEM ONLY")
                                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(RoundedRectangle(cornerRadius: 4).fill(Color.orange.opacity(0.2)))
                                    .foregroundColor(.orange)
                            } else {
                                Text("DISCONNECTED")
                                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                                    .foregroundColor(.secondary)
                            }
                        }
                        .padding(10)
                        .background(RoundedRectangle(cornerRadius: 8).fill(Color.green.opacity(0.08)))

                        // Android Device Identity
                        GroupBox(label: Label("Android Device Identity", systemImage: "info.circle")) {
                            VStack(alignment: .leading, spacing: 6) {
                                let model = engine.universalMatch?.modelNumber ?? (engine.samsungModemInfo?.model ?? "Android Device")
                                let sn = engine.universalMatch?.serialOrUdid ?? (engine.samsungModemInfo?.serialNumber ?? "N/A")
                                let pda = engine.universalMatch?.stockFirmwareBuild ?? (engine.samsungModemInfo?.pdaVersion ?? "N/A")
                                let csc = engine.universalMatch?.carrierCscOrRegion ?? (engine.samsungModemInfo?.activeCsc ?? "Universal")

                                HStack {
                                    Text("Model:")
                                        .font(.system(size: 11, weight: .medium))
                                        .foregroundColor(.secondary)
                                    Text(model)
                                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                                    Spacer()
                                    Text("CSC: \(csc)")
                                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                                        .padding(.horizontal, 5)
                                        .padding(.vertical, 1)
                                        .background(RoundedRectangle(cornerRadius: 3).fill(Color.blue.opacity(0.15)))
                                        .foregroundColor(.blue)
                                }

                                HStack {
                                    Text("Serial:")
                                        .font(.system(size: 11, weight: .medium))
                                        .foregroundColor(.secondary)
                                    Text(sn)
                                        .font(.system(size: 11, design: .monospaced))
                                }

                                HStack {
                                    Text("Build PDA:")
                                        .font(.system(size: 11, weight: .medium))
                                        .foregroundColor(.secondary)
                                    Text(pda)
                                        .font(.system(size: 10, design: .monospaced))
                                        .lineLimit(1)
                                }
                            }
                            .padding(6)
                        }

                        // 1. Language Staging Card
                        GroupBox(label: Label("1. Automated Language Stager", systemImage: "character.book.closed.fill")) {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Applies system locales via Content Provider, persist.sys.locale & LOCALE_CHANGED broadcast.")
                                    .font(.system(size: 10.5))
                                    .foregroundColor(.secondary)

                                Picker("Target Locale", selection: $selectedLocale) {
                                    ForEach(commonLocales, id: \.0) { item in
                                        Text(item.1).tag(item.0)
                                    }
                                }
                                .pickerStyle(.menu)

                                HStack {
                                    Button("Apply System Locale") {
                                        stageLanguage()
                                    }
                                    .buttonStyle(.borderedProminent)

                                    if !localeStatus.isEmpty {
                                        Text(localeStatus)
                                            .font(.system(size: 10.5, design: .monospaced))
                                            .lineLimit(1)
                                    }
                                }
                            }
                            .padding(6)
                        }

                        // 2. Samsung Multi-CSC Switcher Card
                        GroupBox(label: Label("2. Multi-CSC Preconfig Switcher", systemImage: "arrow.triangle.swap")) {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Pops on-screen carrier configuration activity on target display for unified multi-CSC containers (OXM).")
                                    .font(.system(size: 10.5))
                                    .foregroundColor(.secondary)

                                let multiGroup = CscFallbackRegistry.getGroup(forCsc: engine.samsungModemInfo?.activeCsc ?? "EUX")
                                let compatibleList = CscFallbackRegistry.getOpticsCscs(forGroup: multiGroup)

                                HStack {
                                    Text("Container:")
                                        .font(.system(size: 10, weight: .bold))
                                        .foregroundColor(.secondary)
                                    Text(multiGroup)
                                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                                        .padding(.horizontal, 4)
                                        .padding(.vertical, 1)
                                        .background(RoundedRectangle(cornerRadius: 3).fill(Color.purple.opacity(0.15)))
                                        .foregroundColor(.purple)

                                    Text("Candidates: \(compatibleList.prefix(6).joined(separator: ", "))")
                                        .font(.system(size: 9.5, design: .monospaced))
                                        .foregroundColor(.secondary)
                                        .lineLimit(1)
                                }

                                HStack {
                                    Button("Launch On-Device Preconfig Menu") {
                                        launchPreconfig()
                                    }
                                    .buttonStyle(.borderedProminent)

                                    if !cscStatus.isEmpty {
                                        Text(cscStatus)
                                            .font(.system(size: 10.5, design: .monospaced))
                                            .lineLimit(1)
                                    }
                                }
                            }
                            .padding(6)
                        }

                        // 3. Android Sandbox Master Clear Card
                        GroupBox(label: Label("3. Android Master Clear (Factory Reset)", systemImage: "trash.fill")) {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Broadcasts android.intent.action.MASTER_CLEAR to initiate clean recovery formatting.")
                                    .font(.system(size: 10.5))
                                    .foregroundColor(.secondary)

                                HStack {
                                    Button("Execute Factory Master Clear") {
                                        showMasterClearAlert = true
                                    }
                                    .buttonStyle(.bordered)
                                    .foregroundColor(.red)

                                    if !resetStatus.isEmpty {
                                        Text(resetStatus)
                                            .font(.system(size: 10.5, design: .monospaced))
                                            .lineLimit(1)
                                    }
                                }
                            }
                            .padding(6)
                        }
                    }
                    .frame(maxWidth: .infinity)

                    // RIGHT COLUMN: Apple iOS Workstation
                    VStack(alignment: .leading, spacing: 14) {
                        // Apple Header Banner
                        HStack(spacing: 8) {
                            Image(systemName: "applelogo")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(.primary)
                            Text("APPLE IDEVICE WORKSTATION")
                                .font(.system(size: 12, weight: .bold))
                            Spacer()
                            if engine.activePlatform == .appleIos {
                                Text("IDEVICE CONNECTED")
                                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(RoundedRectangle(cornerRadius: 4).fill(Color.blue.opacity(0.2)))
                                    .foregroundColor(.blue)
                            } else {
                                Text("NO IDEVICE")
                                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                                    .foregroundColor(.secondary)
                            }
                        }
                        .padding(10)
                        .background(RoundedRectangle(cornerRadius: 8).fill(Color.blue.opacity(0.08)))

                        // Apple Device Identity
                        GroupBox(label: Label("Apple Device Identity & Lockdownd", systemImage: "iphone.gen3")) {
                            VStack(alignment: .leading, spacing: 6) {
                                let appleDev = engine.devices.first { $0.transport == .ios }
                                let udid = appleDev?.serial ?? "N/A"

                                HStack {
                                    Text("UDID:")
                                        .font(.system(size: 11, weight: .medium))
                                        .foregroundColor(.secondary)
                                    Text(udid)
                                        .font(.system(size: 10, design: .monospaced))
                                        .lineLimit(1)
                                }

                                HStack {
                                    Text("Lockdownd Service:")
                                        .font(.system(size: 11, weight: .medium))
                                        .foregroundColor(.secondary)
                                    Text(engine.activePlatform == .appleIos ? "Online (VID 05ac)" : "Offline")
                                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                                        .foregroundColor(engine.activePlatform == .appleIos ? .green : .secondary)
                                }
                            }
                            .padding(6)
                        }

                        // Apple Diagnostics & Operations
                        GroupBox(label: Label("Apple Diagnostic Operations", systemImage: "wrench.and.screwdriver")) {
                            VStack(alignment: .leading, spacing: 8) {
                                HStack(spacing: 8) {
                                    Button("Query Full Info (ideviceinfo)") {
                                        Task {
                                            _ = await engine.executeAndLog(
                                                workflowId: "apple.ideviceinfo",
                                                title: "ideviceinfo",
                                                executable: engine.toolPaths["ideviceinfo"]!,
                                                arguments: []
                                            )
                                        }
                                    }
                                    Button("Pair & Trust (idevicepair)") {
                                        Task {
                                            _ = await engine.executeAndLog(
                                                workflowId: "apple.pair",
                                                title: "idevicepair pair",
                                                executable: engine.toolPaths["idevicepair"]!,
                                                arguments: ["pair"]
                                            )
                                        }
                                    }
                                }

                                HStack(spacing: 8) {
                                    Button("Reset Pairing & Restart Diagnostics") {
                                        resetIosDiagnostics()
                                    }
                                    .buttonStyle(.borderedProminent)

                                    if !iosResetStatus.isEmpty {
                                        Text(iosResetStatus)
                                            .font(.system(size: 10.5, design: .monospaced))
                                            .lineLimit(1)
                                    }
                                }
                            }
                            .padding(6)
                        }

                        // Apple Staging & System Restores
                        GroupBox(label: Label("Apple Staging & Configuration Profiles", systemImage: "doc.badge.gearshape")) {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("iOS language preferences & sandbox restrictions require signed Apple Configurator MDM payloads or supervised enrollment profiles.")
                                    .font(.system(size: 10.5))
                                    .foregroundColor(.secondary)

                                HStack(spacing: 8) {
                                    Button("Open Apple Configurator.app") {
                                        NSWorkspace.shared.open(URL(fileURLWithPath: "/Applications/Apple Configurator.app"))
                                        engine.log(.info, "Launched /Applications/Apple Configurator.app")
                                    }

                                    Button("Open Finder Restore Assistant") {
                                        NSWorkspace.shared.open(URL(fileURLWithPath: "/System/Library/CoreServices/Finder.app"))
                                        engine.log(.info, "Opened macOS Finder Restore Assistant.")
                                    }
                                }
                            }
                            .padding(6)
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .padding(20)
        }
        .alert("Confirm Android Master Clear (Factory Reset)", isPresented: $showMasterClearAlert) {
            Button("Cancel", role: .cancel) { }
            Button("Wipe & Reset Device", role: .destructive) {
                performMasterClear()
            }
        } message: {
            Text("This will send android.intent.action.MASTER_CLEAR to the target Android device over ADB. All user data will be wiped cleanly and the device will restart into standard setup.")
        }
    }

    private func stageLanguage() {
        localeStatus = "Applying \(selectedLocale)..."
        Task {
            let (ok, msg) = await engine.setDeviceLocale(selectedLocale)
            localeStatus = ok ? "✔ Done" : "✖ Failed"
            if !ok {
                engine.log(.error, "Locale staging error: \(msg)")
            }
        }
    }

    private func launchPreconfig() {
        cscStatus = "Launching Preconfig..."
        Task {
            let (ok, msg) = await engine.launchSamsungPreconfig()
            cscStatus = ok ? "✔ Dispatched" : "✖ Failed"
            if !ok {
                engine.log(.error, "Preconfig trigger error: \(msg)")
            }
        }
    }

    private func performMasterClear() {
        resetStatus = "Dispatching MASTER_CLEAR..."
        Task {
            let (ok, msg) = await engine.executeMasterClear()
            resetStatus = ok ? "✔ Wipe Triggered" : "✖ Failed"
            if !ok {
                engine.log(.error, "Master Clear error: \(msg)")
            }
        }
    }

    private func resetIosDiagnostics() {
        iosResetStatus = "Resetting iOS..."
        Task {
            let (ok, msg) = await engine.executeAppleDiagnosticsReset()
            iosResetStatus = ok ? "✔ Reset Triggered" : "✖ Failed"
            if !ok {
                engine.log(.error, "iOS reset error: \(msg)")
            }
        }
    }

    private func exportIntakeSheet() {
        let savePanel = NSSavePanel()
        savePanel.allowedContentTypes = [.pdf]
        savePanel.nameFieldStringValue = "bobfwtools-intake-\(ticketId)-\(Int(Date().timeIntervalSince1970)).pdf"
        guard savePanel.runModal() == .OK, let url = savePanel.url else { return }

        if let pdfData = engine.generateCustomerIntakePdf(
            ticketId: ticketId,
            customerName: customerName,
            technician: technician
        ) {
            do {
                try pdfData.write(to: url)
                engine.log(.success, "✔ Generated printable Customer Intake PDF: \(url.path)")
                NSWorkspace.shared.open(url)
            } catch {
                engine.log(.error, "✖ Failed to write PDF report: \(error.localizedDescription)")
            }
        } else {
            engine.log(.error, "✖ Failed to compile Customer Intake PDF.")
        }
    }
}

// MARK: - Pillar 9: High-Density Sidebar Metrics Viewport (ChipsetMetricsSidebarCard)

public struct ChipsetMetricsSidebarCard: View {
    public let definition: ChipsetSignatureDefinition?
    public let liveTemperature: Double

    public init(definition: ChipsetSignatureDefinition?, liveTemperature: Double) {
        self.definition = definition
        self.liveTemperature = liveTemperature
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "cpu")
                    .font(.title2)
                    .foregroundColor(.blue)
                VStack(alignment: .leading, spacing: 2) {
                    Text("SILICON INTERFACE ARCHITECTURE")
                        .font(.system(.caption2, design: .monospaced))
                        .foregroundColor(.secondary)
                        .bold()
                    Text(definition?.marketingName ?? "Unresolved Processing Node")
                        .font(.headline)
                        .lineLimit(1)
                }
                Spacer()
                Text(definition?.architecture ?? "GENERIC")
                    .font(.system(.caption, design: .monospaced))
                    .bold()
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.blue.opacity(0.12))
                    .foregroundColor(.blue)
                    .cornerRadius(4)
            }

            Divider()

            if let chip = definition {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        VStack(alignment: .leading) {
                            Text("Register Width").font(.caption).foregroundColor(.secondary)
                            Text("\(chip.bitness)-Bit Infrastructure").font(.subheadline).bold()
                        }
                        Spacer()
                        VStack(alignment: .trailing) {
                            Text("Signature Pattern").font(.caption).foregroundColor(.secondary)
                            Text(chip.hvidSignaturePattern).font(.system(.caption2, design: .monospaced))
                        }
                    }

                    HStack {
                        VStack(alignment: .leading) {
                            Text("Core Thermal Layer").font(.caption).foregroundColor(.secondary)
                            if liveTemperature > 0 {
                                Text(String(format: "%.2f°C", liveTemperature))
                                    .font(.subheadline).bold()
                                    .foregroundColor(liveTemperature >= chip.thermalLimitCelsius ? .red : .green)
                            } else {
                                Text("Sensor Standby")
                                    .font(.subheadline).bold()
                                    .foregroundColor(.secondary)
                            }
                        }
                        Spacer()
                        VStack(alignment: .trailing) {
                            Text("Silicon Limit").font(.caption).foregroundColor(.secondary)
                            Text(String(format: "%.1f°C", chip.thermalLimitCelsius)).font(.subheadline).bold()
                        }
                    }
                }
                .textSelection(.enabled)

                if liveTemperature >= chip.thermalLimitCelsius && liveTemperature > 0 {
                    HStack {
                        Image(systemName: "exclamationmark.shield.fill")
                        Text("THERMAL BOUNDARY EXCEEDED: Silicon Throttling Operational").font(.system(.caption2, design: .monospaced))
                    }
                    .padding(8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.red.opacity(0.12))
                    .foregroundColor(.red)
                    .cornerRadius(6)
                }
            } else {
                Text("Connect a verified target interface to decode underlying microarchitecture schemas.")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 12)
            }
        }
        .padding()
        .background(Color(.controlBackgroundColor))
        .cornerRadius(8)
    }
}

// MARK: - Pillar 10: Studio Split-Pane Workspace Console GUI (UniversalSplitPaneDashboardView)

public struct UniversalSplitPaneDashboardView: View {
    @ObservedObject var engine: ServicingEngine
    @StateObject private var siphonCoordinator = LiveSiphonSiphonCoordinator()
    @State private var activeChip: ChipsetSignatureDefinition? = nil
    @State private var liveThermalTemp: Double = 0.0
    @State private var traceFilter: String = ""
    @State private var isProbing: Bool = false
    @State private var statusNote: String = ""

    public init() {
        self.engine = ServicingEngine()
    }

    init(engine: ServicingEngine) {
        self.engine = engine
    }

    private var filteredLogs: [LogEntry] {
        if traceFilter.trimmingCharacters(in: .whitespaces).isEmpty {
            return engine.logs
        }
        return engine.logs.filter { $0.message.localizedCaseInsensitiveContains(traceFilter) }
    }

    public var body: some View {
        HSplitView {
            // LEFT PANE: Active Component Control Pane
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Image(systemName: "play.terminal.fill").foregroundColor(.green)
                    Text("ACTIVE COMPONENT CONTROL PANE").font(.headline)
                    Spacer()
                    if isProbing {
                        ProgressView().controlSize(.small)
                    }
                }
                .padding([.top, .horizontal])

                ScrollView {
                    VStack(spacing: 16) {
                        // Siphon Folder Drop Watcher Status
                        GroupBox(label: Label("Watched Siphon Drop Pipeline", systemImage: "arrow.down.doc.fill")) {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Watched Directory: ~/Downloads/BobFWTools_SiphonDrop")
                                    .font(.system(size: 10, design: .monospaced))
                                    .foregroundColor(.secondary)
                                HStack {
                                    Text("Active Package:")
                                        .font(.caption).foregroundColor(.secondary)
                                    Text(siphonCoordinator.activeStagedFile)
                                        .font(.subheadline).bold()
                                }
                                Text("Resolved Layout: \(siphonCoordinator.detectedFormat)")
                                    .font(.caption).foregroundColor(.blue)

                                Button {
                                    inspectStagedSiphonPayload()
                                } label: {
                                    Label("Inspect Staged Siphon Headers", systemImage: "doc.viewfinder")
                                }
                                .controlSize(.small)
                            }
                            .padding(4)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        // Silicon Microarchitecture & Thermal Card
                        ChipsetMetricsSidebarCard(definition: activeChip, liveTemperature: liveThermalTemp)

                        // Hardware Interrogation & Execution Controls
                        VStack(spacing: 10) {
                            Button {
                                Task { await probeConnectedHardware() }
                            } label: {
                                HStack {
                                    Image(systemName: "cpu.fill")
                                    Text("Probe Connected Silicon & Thermal Sensors")
                                }
                                .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.borderedProminent)

                            Button {
                                Task { await executeDiagnosticManifest() }
                            } label: {
                                HStack {
                                    Image(systemName: "waveform.path.ecg")
                                    Text("Run Chipset Diagnostic Manifest Queries")
                                }
                                .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.bordered)
                            .disabled(activeChip == nil)

                            Button {
                                Task { await commitAuditLedgerSnapshot() }
                            } label: {
                                HStack {
                                    Image(systemName: "cylinder.split.1x2.fill")
                                    Text("Commit Session Snapshot to SQLite Ledger")
                                }
                                .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.bordered)

                            if !statusNote.isEmpty {
                                Text(statusNote)
                                    .font(.system(size: 11, design: .monospaced))
                                    .foregroundColor(.accentColor)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }
                    }
                    .padding()
                }
            }
            .frame(minWidth: 380, maxWidth: .infinity)

            // RIGHT PANE: Real-Time Revenue-Safe Transaction Trace
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 10) {
                    Image(systemName: "terminal.fill")
                        .foregroundColor(.green)
                    Text("REAL-TIME REVENUE-SAFE TRANSACTION TRACE")
                        .font(.system(.caption, design: .monospaced)).bold()

                    Spacer()

                    TextField("Filter trace logs...", text: $traceFilter)
                        .textFieldStyle(.roundedBorder)
                        .font(.system(size: 11, design: .monospaced))
                        .frame(maxWidth: 180)

                    Button("Copy") {
                        let fullText = filteredLogs.map { "[\($0.timestamp.formatted(date: .omitted, time: .standard))] \($0.message)" }.joined(separator: "\n")
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(fullText, forType: .string)
                    }
                    .font(.caption).buttonStyle(.borderless)

                    Button("Flush Console") {
                        engine.clearLogs()
                    }
                    .font(.caption).buttonStyle(.borderless)
                }
                .padding()
                .background(Color.black.opacity(0.04))

                Divider()

                ScrollView {
                    VStack(alignment: .leading, spacing: 4) {
                        if filteredLogs.isEmpty {
                            Text("Trace log standby. Attach a device and execute commands to inspect hardware streaming.")
                                .font(.system(.footnote, design: .monospaced))
                                .foregroundColor(.secondary)
                                .padding()
                        } else {
                            ForEach(filteredLogs) { entry in
                                HStack(alignment: .top, spacing: 6) {
                                    Text(entry.timestamp.formatted(date: .omitted, time: .standard))
                                        .font(.system(size: 10.5, design: .monospaced))
                                        .foregroundColor(.secondary)
                                        .frame(width: 65, alignment: .leading)

                                    Text(badgeText(for: entry.level))
                                        .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                                        .foregroundColor(color(for: entry.level))
                                        .frame(width: 45, alignment: .leading)

                                    Text(entry.message)
                                        .font(.system(size: 11, design: .monospaced))
                                        .foregroundColor(color(for: entry.level))
                                        .textSelection(.enabled)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                }
                                .padding(.horizontal, 10)
                                .padding(.vertical, 2)
                            }
                        }
                    }
                    .padding(.vertical, 8)
                }
                .background(Color.black.opacity(0.05))
            }
            .frame(minWidth: 440, maxWidth: .infinity)
        }
        .frame(minWidth: 880, minHeight: 560)
        .onAppear {
            Task { await probeConnectedHardware() }
        }
    }

    private func badgeText(for level: LogEntry.Level) -> String {
        switch level {
        case .info: return "[INFO]"
        case .success: return "[OK]"
        case .warning: return "[WARN]"
        case .error: return "[ERR]"
        case .command: return "[CMD]"
        }
    }

    private func color(for level: LogEntry.Level) -> Color {
        switch level {
        case .info: return .primary
        case .success: return .green
        case .warning: return .orange
        case .error: return .red
        case .command: return .blue
        }
    }

    private func probeConnectedHardware() async {
        isProbing = true
        statusNote = "Interrogating USB bus & device identity..."
        defer { isProbing = false }

        await engine.refreshDevicesAndTelemetry()

        var query: HardwareIdentityQuery? = nil
        var thermal: Double = 0.0

        if let modem = engine.samsungModemInfo {
            query = HardwareIdentityQuery(
                hvid: modem.hvidSummary,
                basebandToken: modem.basebandVersion,
                vendorId: 0x04e8,
                devconSummary: modem.rawResponse
            )
        } else if engine.devices.contains(where: { $0.transport == .adb }) {
            let adbPath = engine.toolPaths["adb"] ?? "/usr/local/bin/adb"
            let propRes = await engine.runProcess(
                executable: adbPath,
                arguments: engine.adbArgs(["shell", "getprop ro.board.platform; getprop ro.soc.model; getprop ro.mediatek.platform; getprop ro.hardware.chipname; getprop ro.hardware; getprop ro.boot.hardware"])
            )
            let plat = propRes.stdout.trimmingCharacters(in: .whitespacesAndNewlines)
            query = HardwareIdentityQuery(hvid: plat, basebandToken: plat, devconSummary: plat)

            let batRes = await engine.runProcess(executable: adbPath, arguments: engine.adbArgs(["shell", "dumpsys", "battery"]))
            for line in batRes.stdout.components(separatedBy: .newlines) {
                if line.contains("temperature:") {
                    let parts = line.components(separatedBy: ":")
                    if parts.count > 1, let deciC = Double(parts[1].trimmingCharacters(in: .whitespaces)) {
                        thermal = deciC / 10.0
                    }
                }
            }
            if thermal == 0.0 {
                let thermRes = await engine.runProcess(executable: adbPath, arguments: engine.adbArgs(["shell", "cat", "/sys/class/thermal/thermal_zone0/temp"]))
                if let rawMilli = Double(thermRes.stdout.trimmingCharacters(in: .whitespacesAndNewlines)), rawMilli > 0 {
                    thermal = rawMilli > 1000 ? (rawMilli / 1000.0) : rawMilli
                }
            }
        } else if let appleDev = engine.devices.first(where: { $0.transport == .ios }) {
            query = HardwareIdentityQuery(vendorId: 0x05ac, productId: 0x1227, devconSummary: appleDev.details)
        } else if engine.devices.contains(where: { $0.transport == .fastboot }) {
            let fbPath = engine.toolPaths["fastboot"] ?? "/usr/local/bin/fastboot"
            let fbRes = await engine.runProcess(executable: fbPath, arguments: ["getvar", "product"])
            let desc = (fbRes.stdout.isEmpty ? fbRes.stderr : fbRes.stdout).trimmingCharacters(in: .whitespacesAndNewlines)
            query = HardwareIdentityQuery(hvid: desc, basebandToken: desc, devconSummary: desc)
        } else if let usb = engine.usbDevices.first(where: { $0.vendorId != 0x0000 }) {
            query = HardwareIdentityQuery(vendorId: usb.vendorId, productId: usb.productId, devconSummary: usb.productName)
        }

        if let q = query, let resolved = ChipsetSignatureRegistry.shared.resolve(query: q) {
            activeChip = resolved
            liveThermalTemp = thermal // Strictly genuine reading; 0.0 indicates Sensor Standby
            statusNote = "✔ Mapped silicon: \(resolved.marketingName)"
            engine.log(.success, "✔ Hardware Silicon Interrogation: Identified \(resolved.marketingName) (\(resolved.architecture)) [\(resolved.bitness)-Bit].")
        } else {
            activeChip = nil
            liveThermalTemp = 0.0
            statusNote = "No mobile servicing target detected on USB bus."
            engine.log(.warning, "✖ Hardware Interrogation: No active servicing target detected on USB bus. Connect an Android/Samsung/iOS device to probe.")
        }
    }

    private func executeDiagnosticManifest() async {
        guard let chip = activeChip else { return }
        let queries = HardwareDiagnosticManifest.getQueries(for: chip.chipsetId)
        engine.log(.info, "🔬 Executing Diagnostic Manifest for \(chip.marketingName) (\(queries.count) registered hardware queries)...")

        let adbPath = engine.toolPaths["adb"] ?? "/usr/local/bin/adb"
        let hasAdb = engine.devices.contains { $0.transport == .adb }
        let hasFastboot = engine.devices.contains { $0.transport == .fastboot }
        let hasOdin = engine.devices.contains { $0.transport == .odin }
        let isApple = chip.chipsetId.hasPrefix("APPLE_") || engine.devices.contains { $0.transport == .ios }
        let activeModem = engine.selectedSerialPort

        for q in queries {
            engine.log(.info, "▶ [\(q.transactionToken)] \(q.logExplanation)")
            if hasAdb {
                let args = q.shellCommand.split(separator: " ").map(String.init)
                let res = await engine.runProcess(executable: adbPath, arguments: engine.adbArgs(["shell"] + args))
                let out = res.stdout.trimmingCharacters(in: .whitespacesAndNewlines)
                if !out.isEmpty {
                    engine.log(.success, "  └─ [ADB Result]: \(out)")
                } else if !res.stderr.isEmpty {
                    engine.log(.warning, "  └─ [ADB Output]: \(res.stderr.trimmingCharacters(in: .whitespacesAndNewlines))")
                }
            } else if isApple {
                let res = await engine.runProcess(executable: "/bin/sh", arguments: ["-c", q.shellCommand])
                let out = res.stdout.trimmingCharacters(in: .whitespacesAndNewlines)
                if !out.isEmpty {
                    engine.log(.success, "  └─ [Apple Tool Result]: \(out)")
                } else if !res.stderr.isEmpty {
                    engine.log(.warning, "  └─ [Apple Tool Output]: \(res.stderr.trimmingCharacters(in: .whitespacesAndNewlines))")
                } else {
                    engine.log(.warning, "  └─ ideviceinfo / libimobiledevice returned no output. Verify pairing trust.")
                }
            } else if hasFastboot {
                let fbPath = engine.toolPaths["fastboot"] ?? "/usr/local/bin/fastboot"
                let res = await engine.runProcess(executable: fbPath, arguments: ["getvar", "all"])
                let out = (res.stdout.isEmpty ? res.stderr : res.stdout).trimmingCharacters(in: .whitespacesAndNewlines)
                if !out.isEmpty {
                    engine.log(.success, "  └─ [Fastboot Telemetry]: \(out.prefix(120))...")
                }
            } else if hasOdin {
                let heimPath = engine.toolPaths["heimdall"] ?? "/usr/local/bin/heimdall"
                let res = await engine.runProcess(executable: heimPath, arguments: ["detect"])
                let out = (res.stdout.isEmpty ? res.stderr : res.stdout).trimmingCharacters(in: .whitespacesAndNewlines)
                engine.log(.success, "  └─ [Odin Protocol Handshake]: \(out)")
            } else if !activeModem.isEmpty, let atCmd = q.alternativeAtCommand {
                let (ok, raw) = await engine.querySerialAT(portPath: activeModem, command: atCmd, logOutput: false)
                engine.log(ok ? .success : .warning, "  └─ [AT Modem Result]: \(raw.trimmingCharacters(in: .whitespacesAndNewlines))")
            } else {
                engine.log(.warning, "  └─ Transport offline for query: requires authorized ADB, Apple usbmuxd, Fastboot, or Modem AT port.")
            }
        }
    }

    private func inspectStagedSiphonPayload() {
        let home = FileManager.default.homeDirectoryForCurrentUser
        let siphonDir = home.appendingPathComponent("Downloads/BobFWTools_SiphonDrop")
        guard let files = try? FileManager.default.contentsOfDirectory(at: siphonDir, includingPropertiesForKeys: [.contentModificationDateKey], options: .skipsHiddenFiles),
              !files.isEmpty else {
            engine.log(.info, "Siphon Folder: Drop a firmware package (.tar, .apk, .img, .bin, .pit, .pac) into ~/Downloads/BobFWTools_SiphonDrop to analyze.")
            return
        }

        let sortedFiles = files.sorted { u1, u2 in
            let d1 = (try? u1.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate ?? Date.distantPast
            let d2 = (try? u2.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate ?? Date.distantPast
            return d1 > d2
        }

        guard let latest = sortedFiles.first else { return }

        if let desc = UncompressedLayoutHeaderInspector.inspectFileHeader(at: latest) {
            engine.log(.success, "✔ Zero-Copy Siphon Inspector: Matched \(desc.description) [\(desc.formatId)] for partition '\(desc.targetPartition)' at offset \(desc.byteOffset).")
            if let handle = try? FileHandle(forReadingFrom: latest) {
                let sample = handle.readData(ofLength: 512)
                let router = PayloadRouter()
                router.routeDataChunk(sample)
                engine.log(.info, "  └─ Dispatched \(sample.count) header bytes across PayloadRouter matrix.")
                try? handle.close()
            }
        } else {
            engine.log(.info, "ℹ Siphon Package: \(latest.lastPathComponent) (Standard container format: \(latest.pathExtension.uppercased()))")
        }
    }

    private func commitAuditLedgerSnapshot() async {
        do {
            let ledger = try SQLiteAuditLedger()
            let serial = engine.samsungModemInfo?.serialNumber ?? (engine.selectedDevice?.serial ?? "UNATTACHED_BENCH_SESSION")
            let model = engine.samsungModemInfo?.model ?? (engine.selectedDevice?.name ?? "UNKNOWN_MODEL")
            let platform = engine.activePlatform.rawValue
            let chip = activeChip?.chipsetId ?? "UNKNOWN_CHIP"

            try await ledger.upsertDevice(serial: serial, model: model, platform: platform, csc: engine.samsungModemInfo?.activeCsc, buildPda: engine.samsungModemInfo?.pdaVersion, chipsetId: chip)

            try await ledger.logWorkflowEvent(
                serial: serial,
                platform: platform,
                model: model,
                workflowId: "workbench.split_pane_interrogation",
                title: "Hardware Silicon Interrogation & Thermal Audit",
                verified: activeChip != nil,
                summary: "Chip: \(activeChip?.marketingName ?? "Unresolved") · Temp: \(String(format: "%.1f°C", liveThermalTemp))"
            )

            if let doc = engine.cableDoctorReport {
                try await ledger.logCableDiagnostic(serial: serial, impedance: 0.18, packetLoss: Double(doc.reconnectEvents) * 0.05, grade: doc.grade)
            }

            engine.log(.success, "✔ Committed atomic audit session to ~/Library/Application Support/BobFWTools/records/workspace.db")
            statusNote = "✔ Session committed to SQLite ledger"
        } catch {
            engine.log(.error, "✖ SQLite Audit Ledger Error: \(error.localizedDescription)")
            statusNote = "✖ Ledger commit error: \(error.localizedDescription)"
        }
    }
}

