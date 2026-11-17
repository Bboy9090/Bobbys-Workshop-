#if STORE_EDITION
import SwiftUI
import AppKit
import IOKit
import IOKit.usb
import ExternalAccessory
import UniformTypeIdentifiers

// MARK: - Store Edition Sandboxed USB & ExternalAccessory Models (Public Frameworks Only)

struct StoreDetectedUsbDevice: Identifiable, Hashable {
    let id: String
    let name: String
    let vendorName: String
    let vendorIdHex: String
    let productIdHex: String
    let modeLabel: String
    let transportLabel: String
}

@MainActor
final class StoreComplianceEngine: ObservableObject {
    @Published var usbDevices: [StoreDetectedUsbDevice] = []
    @Published var accessories: [String] = []
    @Published var selectedCarouselStep: Int = 0
    @Published var selectedDeviceFamily: String = "iPhone 8–16 / USB-C iPad (Side Button)"
    @Published var lastStatusMessage: String = "Ready — Public IOKit & ExternalAccessory Read-Only Scanner"
    @Published var checklistNotes: String = ""

    let deviceFamilies = [
        "iPhone 8–16 / USB-C iPad (Side Button)",
        "iPhone 7 / 7 Plus (Volume Down + Side)",
        "iPhone 6s / SE 1st / Home-Button iPad (A9/A9X)",
        "Face ID iPad Pro / Air / Mini (Quick Vol+ / Vol- / Top)"
    ]

    init() {
        scanPublicUsbAndAccessories()
    }

    func scanPublicUsbAndAccessories() {
        var found: [StoreDetectedUsbDevice] = []
        if let matching = IOServiceMatching(kIOUSBDeviceClassName) {
            var iterator: io_iterator_t = 0
            let kr = IOServiceGetMatchingServices(kIOMainPortDefault, matching, &iterator)
            if kr == KERN_SUCCESS {
                defer { IOObjectRelease(iterator) }
                var service = IOIteratorNext(iterator)
                while service != 0 {
                    defer {
                        IOObjectRelease(service)
                        service = IOIteratorNext(iterator)
                    }
                    let vid = (IORegistryEntryCreateCFProperty(service, "idVendor" as CFString, kCFAllocatorDefault, 0)?.takeRetainedValue() as? NSNumber)?.intValue ?? 0
                    let pid = (IORegistryEntryCreateCFProperty(service, "idProduct" as CFString, kCFAllocatorDefault, 0)?.takeRetainedValue() as? NSNumber)?.intValue ?? 0
                    let prodName = (IORegistryEntryCreateCFProperty(service, "USB Product Name" as CFString, kCFAllocatorDefault, 0)?.takeRetainedValue() as? String) ?? "USB Device"
                    let vendorName = (IORegistryEntryCreateCFProperty(service, "USB Vendor Name" as CFString, kCFAllocatorDefault, 0)?.takeRetainedValue() as? String) ?? "Unknown Vendor"

                    guard vid != 0 else { continue }
                    let mode: String
                    if vid == 0x05AC {
                        switch pid {
                        case 0x1227: mode = "DFU Mode (0x1227)"
                        case 0x1281: mode = "Recovery Mode (0x1281)"
                        case 0x12A8, 0x12AB: mode = "Normal / Paired Mode"
                        default: mode = "Apple USB (0x\(String(format: "%04X", pid)))"
                        }
                    } else {
                        mode = "USB Peripheral"
                    }
                    found.append(StoreDetectedUsbDevice(
                        id: "\(vid)-\(pid)-\(found.count)",
                        name: prodName,
                        vendorName: vendorName,
                        vendorIdHex: String(format: "0x%04X", vid),
                        productIdHex: String(format: "0x%04X", pid),
                        modeLabel: mode,
                        transportLabel: "Public IOKit USB"
                    ))
                }
            }
        }
        self.usbDevices = found

        let eaNames = EAAccessoryManager.shared().connectedAccessories.map {
            "\($0.name) (\($0.manufacturer) · FW \($0.firmwareRevision))"
        }
        self.accessories = eaNames
        self.lastStatusMessage = "Scanned \(found.count) USB device(s) & \(eaNames.count) ExternalAccessory connection(s) via public macOS APIs."
    }

    func openFinder() {
        NSWorkspace.shared.open(URL(fileURLWithPath: "/System/Library/CoreServices/Finder.app"))
        lastStatusMessage = "Opened Finder — select your connected iPhone or iPad in the sidebar to Update or Restore."
    }

    func openAppleConfigurator() {
        let url = URL(fileURLWithPath: "/Applications/Apple Configurator.app")
        if FileManager.default.fileExists(atPath: url.path) {
            NSWorkspace.shared.open(url)
            lastStatusMessage = "Opened Apple Configurator for official Revive, Restore, or Supervision."
        } else {
            if let storeUrl = URL(string: "macappstore://apps.apple.com/app/id1037126344") {
                NSWorkspace.shared.open(storeUrl)
            }
            lastStatusMessage = "Apple Configurator not found in /Applications — opened Mac App Store page."
        }
    }

    func exportIntakeChecklist() {
        let panel = NSSavePanel()
        panel.title = "Export Sandboxed Intake Checklist"
        panel.nameFieldStringValue = "BobFWTools_Intake_Checklist.md"
        panel.allowedContentTypes = [UTType(filenameExtension: "md") ?? .plainText]
        guard panel.runModal() == .OK, let destUrl = panel.url else { return }

        let usbLines = usbDevices.isEmpty
            ? "- No external USB devices detected at export time."
            : usbDevices.map { "- **\($0.name)** (\($0.vendorName)) · VID `\($0.vendorIdHex)` PID `\($0.productIdHex)` · Mode: \($0.modeLabel)" }.joined(separator: "\n")

        let content = """
        # BobFWTools Studio — Sandboxed Intake Checklist

        - **Generated:** \(ISO8601DateFormatter().string(from: Date()))
        - **Selected Recovery / DFU Guide:** \(selectedDeviceFamily)

        ## Detected USB Devices (Public IOKit)
        \(usbLines)

        ## Authorized Operator Steps
        1. Verify customer proof of ownership / MDM organization authorization.
        2. Confirm USB data cable integrity (prefer USB-A to Lightning on A9/A9X iPads).
        3. Use **Finder** or **Apple Configurator** for official signed Update (Revive) or clean Restore.
        4. For Activation Lock removal, direct the owner to `https://www.icloud.com/find` or `https://al-support.apple.com`.

        ## Technician Notes
        \(checklistNotes.isEmpty ? "_None entered._" : checklistNotes)
        """
        do {
            try content.write(to: destUrl, atomically: true, encoding: .utf8)
            lastStatusMessage = "Exported sandboxed intake checklist to \(destUrl.lastPathComponent)."
        } catch {
            lastStatusMessage = "Failed to export checklist: \(error.localizedDescription)"
        }
    }
}

struct MainStudioView: View {
    @StateObject private var store = StoreComplianceEngine()

    private var guideSteps: [(title: String, detail: String)] {
        switch store.selectedDeviceFamily {
        case "iPhone 7 / 7 Plus (Volume Down + Side)":
            return [
                ("Step 1: Connect USB Cable", "Connect device directly to your Mac with a reliable USB data cable."),
                ("Step 2: Hold Side + Volume Down", "Press and hold Side + Volume Down together for 8–10 seconds until screen goes black."),
                ("Step 3: Release Side, Keep Volume Down", "Hold Volume Down for 5 more seconds. Screen stays black in DFU; Finder prompts to Restore.")
            ]
        case "iPhone 6s / SE 1st / Home-Button iPad (A9/A9X)":
            return [
                ("Step 1: Prefer USB-A Cable (A9/A9X)", "On A9/A9X iPads, use a USB-A to Lightning cable rather than direct USB-C PD to avoid DFU drops."),
                ("Step 2: Hold Power + Home", "Hold Top/Side Power + Home buttons together for 8 seconds until screen turns black."),
                ("Step 3: Release Power, Keep Home", "Continue holding Home for 5 seconds until Finder / Apple Configurator detects DFU mode.")
            ]
        case "Face ID iPad Pro / Air / Mini (Quick Vol+ / Vol- / Top)":
            return [
                ("Step 1: Connect USB-C Cable", "Attach iPad directly to Mac."),
                ("Step 2: Quick Tap Sequence", "Quickly press & release Volume Up, quickly press & release Volume Down, then hold Top button."),
                ("Step 3: Recovery -> DFU Handoff", "Keep holding Top button until Recovery appears, or combine Top + Vol Down for 5s then release Top for DFU.")
            ]
        default:
            return [
                ("Step 1: Connect USB Cable", "Attach iPhone 8 or newer directly to Mac."),
                ("Step 2: Quick Tap Sequence", "Quickly press & release Volume Up, then Volume Down, then hold Side button until screen turns black."),
                ("Step 3: Hold Side + Vol Down", "Hold Side + Volume Down for 5s, release Side, and hold Volume Down 5s more until Finder detects DFU.")
            ]
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 12) {
                    Image(systemName: "checkmark.shield.fill")
                        .font(.system(size: 28))
                        .foregroundColor(.blue)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("BobFWTools Studio — Mac App Store Edition")
                            .font(.system(size: 18, weight: .bold))
                        Text("Sandboxed Read-Only USB Inspector, Guided DFU Carousel & Official Apple Handoff")
                            .font(.system(size: 11.5))
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    Button {
                        store.scanPublicUsbAndAccessories()
                    } label: {
                        Label("Refresh USB Scan", systemImage: "arrow.clockwise")
                    }
                    .buttonStyle(.borderedProminent)
                }
                .padding()
                .background(RoundedRectangle(cornerRadius: 10).fill(Color(NSColor.controlBackgroundColor)))

                Text(store.lastStatusMessage)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(.secondary)

                // 1. Read-Only Public IOKit & ExternalAccessory Inspector
                GroupBox(label: Label("Read-Only USB & ExternalAccessory Inspector (Public IOKit)", systemImage: "cable.connector")) {
                    VStack(alignment: .leading, spacing: 8) {
                        if store.usbDevices.isEmpty {
                            Text("No USB devices detected. Connect an iPhone/iPad and click Refresh USB Scan.")
                                .font(.system(size: 11.5))
                                .foregroundColor(.secondary)
                        } else {
                            ForEach(store.usbDevices) { dev in
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("\(dev.name) — \(dev.vendorName)")
                                            .font(.system(size: 12, weight: .semibold))
                                        Text("VID \(dev.vendorIdHex) · PID \(dev.productIdHex) · \(dev.transportLabel)")
                                            .font(.system(size: 10.5, design: .monospaced))
                                            .foregroundColor(.secondary)
                                    }
                                    Spacer()
                                    Text(dev.modeLabel)
                                        .font(.system(size: 10.5, weight: .bold))
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(Capsule().fill(Color.blue.opacity(0.14)))
                                        .foregroundColor(.blue)
                                }
                                .padding(6)
                                .background(RoundedRectangle(cornerRadius: 6).fill(Color(NSColor.windowBackgroundColor)))
                            }
                        }
                        if !store.accessories.isEmpty {
                            Divider()
                            Text("ExternalAccessory Connections: \(store.accessories.joined(separator: ", "))")
                                .font(.system(size: 10.5, design: .monospaced))
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(8)
                }

                // 2. Guided Recovery / DFU Operator Carousel
                GroupBox(label: Label("Guided Recovery & DFU Operator Carousel", systemImage: "iphone.radiowaves.left.and.right")) {
                    VStack(alignment: .leading, spacing: 10) {
                        Picker("Device Family", selection: $store.selectedDeviceFamily) {
                            ForEach(store.deviceFamilies, id: \.self) { fam in
                                Text(fam).tag(fam)
                            }
                        }
                        .onChange(of: store.selectedDeviceFamily) { _ in
                            store.selectedCarouselStep = 0
                        }

                        let step = guideSteps[min(store.selectedCarouselStep, guideSteps.count - 1)]
                        VStack(alignment: .leading, spacing: 6) {
                            Text(step.title)
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(.blue)
                            Text(step.detail)
                                .font(.system(size: 12))
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(RoundedRectangle(cornerRadius: 8).fill(Color.blue.opacity(0.08)))

                        HStack {
                            Button("Previous") {
                                store.selectedCarouselStep = max(0, store.selectedCarouselStep - 1)
                            }
                            .disabled(store.selectedCarouselStep == 0)

                            Text("Step \(store.selectedCarouselStep + 1) of \(guideSteps.count)")
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundColor(.secondary)

                            Button("Next") {
                                store.selectedCarouselStep = min(guideSteps.count - 1, store.selectedCarouselStep + 1)
                            }
                            .disabled(store.selectedCarouselStep >= guideSteps.count - 1)

                            Spacer()
                        }
                    }
                    .padding(8)
                }

                // 3. Official Finder & Apple Configurator Handoff + Portals
                GroupBox(label: Label("Official Apple Recovery Handoff & Activation Portals", systemImage: "arrow.up.forward.app.fill")) {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(spacing: 12) {
                            Button {
                                store.openFinder()
                            } label: {
                                Label("Open Finder (Official Update / Restore)", systemImage: "macwindow")
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(.blue)

                            Button {
                                store.openAppleConfigurator()
                            } label: {
                                Label("Open Apple Configurator", systemImage: "wrench.and.screwdriver")
                            }
                            .buttonStyle(.bordered)

                            Spacer()
                        }

                        HStack(spacing: 16) {
                            Link("Apple Activation Lock Support", destination: URL(string: "https://al-support.apple.com")!)
                            Link("Apple Business Manager Docs", destination: URL(string: "https://support.apple.com/guide/apple-business-manager/welcome/web")!)
                            Link("iCloud Find Devices", destination: URL(string: "https://www.icloud.com/find")!)
                            Spacer()
                        }
                        .font(.system(size: 11.5, weight: .semibold))
                    }
                    .padding(8)
                }

                // 4. Sandboxed Intake Checklist Export (NSSavePanel)
                GroupBox(label: Label("Sandboxed Intake Checklist Export", systemImage: "doc.text.fill")) {
                    VStack(alignment: .leading, spacing: 8) {
                        TextField("Technician notes for intake checklist...", text: $store.checklistNotes)
                            .textFieldStyle(.roundedBorder)
                        HStack {
                            Button {
                                store.exportIntakeChecklist()
                            } label: {
                                Label("Save Intake Checklist (.md)...", systemImage: "square.and.arrow.down")
                            }
                            .buttonStyle(.borderedProminent)
                            Spacer()
                        }
                    }
                    .padding(8)
                }
            }
            .padding(20)
        }
        .frame(minWidth: 900, minHeight: 650)
    }
}
#endif
