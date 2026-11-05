#!/bin/bash
# ==============================================================================
# BobFWTools Studio Core System Architecture Setup Script
# Generates complete, integrated source files for telemetry, databases, views, and tests.
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Target workspace paths matching your structural specifications
BASE_DIR="Sources"
TESTS_DIR="Tests"
DB_DIR="$HOME/Library/Application Support/BobFWTools/records"

echo "⚙️  Initializing studio local workbench storage subdirectories..."
mkdir -p "$BASE_DIR"
mkdir -p "$TESTS_DIR"
mkdir -p "$DB_DIR"

# ------------------------------------------------------------------------------
# 1. GENERATE TELEMETRY MODELS & BACKEND PERSISTENCE ENGINES
# ------------------------------------------------------------------------------
echo "📦 Writing isolated backend architecture structures -> Sources/TelemetryEngine.swift..."
cat << 'EOF' > "$BASE_DIR/TelemetryEngine.swift"
import Foundation
import SQLite3

// MARK: - Exhaustive Hardware Classification Matrix
public struct MobileDeviceHardwareProfile: Codable, Sendable {
    public let platform: DevicePlatform
    public let chipset: ChipsetArchitecture
    public let activeTransport: DeviceTransportMode
    public let constraintFlags: HardwareSecurityConstraints
    
    public init(platform: DevicePlatform, chipset: ChipsetArchitecture, activeTransport: DeviceTransportMode, constraintFlags: HardwareSecurityConstraints) {
        self.platform = platform
        self.chipset = chipset
        self.activeTransport = activeTransport
        self.constraintFlags = constraintFlags
    }
}

public enum DevicePlatform: String, Codable, Sendable {
    case iOS = "Apple iOS / iPadOS"
    case samsungAndroid = "Samsung Galaxy Android Layout"
    case genericAndroid = "AOSP Generic / Multi-OEM Android Base"
}

public enum ChipsetArchitecture: String, Codable, Sendable {
    case appleA_Series = "Apple A12-A18 Pro BootROM Stack"
    case appleM_Series = "Apple Silicon M1-M4 Diagnostic Engine"
    case samsungExynos = "Samsung Exynos Low-Level Memory Interface"
    case qualcommSnapdragon = "Qualcomm Snapdragon EDL 9008 Core"
    case mediaTekDimensity = "MediaTek Dimensity High-Speed BROM Intercept"
    case mediaTekHelio = "MediaTek Helio Legacy Preloader Layer"
    case unisocTiger = "Unisoc Tiger / Spreadtrum Diag FDL Engine"
}

public enum DeviceTransportMode: String, Codable, Sendable {
    case mtpModem = "USB Descriptor 04e8:6860 (MTP/Modem Pipe)"
    case adb = "Android Debug Bridge (POSIX Daemon)"
    case fastboot = "Fastboot Standard Interface / FastbootD"
    case odinLoke = "Samsung Odin Download Protocol (04e8:685d)"
    case AppleNormal = "Apple Normal Mode (05ac:12a8)"
    case AppleRecovery = "Apple iBoot Recovery Mode (05ac:1281)"
    case AppleDFU = "Apple BootROM DFU Interface (05ac:1227)"
    case edl9008 = "Qualcomm Emergency Download Mode (05c6:9008)"
    case bromBypass = "MediaTek BootROM Low-Level Intercept (0e8d:0003)"
    case unisocDiag = "Unisoc Diag / FDL Handshake Mode (1782:4d00)"
}

public struct HardwareSecurityConstraints: OptionSet, Codable, Sendable {
    public let rawValue: Int
    public init(rawValue: Int) { self.rawValue = rawValue }
    
    public static let oemLocked          = HardwareSecurityConstraints(rawValue: 1 << 0)
    public static let frpActive           = HardwareSecurityConstraints(rawValue: 1 << 1)
    public static let mdLocked            = HardwareSecurityConstraints(rawValue: 1 << 2)
    public static let secureBootEnabled   = HardwareSecurityConstraints(rawValue: 1 << 3)
    public static let rollbackPrevention  = HardwareSecurityConstraints(rawValue: 1 << 4)
}

// MARK: - Advanced Asynchronous Telemetry Logger & SQLite Bridge
public final class BobFWTelemetryLogger: ObservableObject, @unchecked Sendable {
    public static let shared = BobFWTelemetryLogger()
    
    @Published public var historicalLedger: [PipelineSessionRecord] = []
    public let queue = DispatchQueue(label: "com.bobfwtools.telemetry.isolation", qos: .userInitiated)
    
    public struct PipelineSessionRecord: Identifiable, Codable, Sendable {
        public let id: UUID
        public let timestamp: Date
        public let workflowId: String
        public let hardwareProfile: MobileDeviceHardwareProfile?
        public let executionStatus: OperationalStatus
        public let capturedException: ExceptionDiagnosticBlob?
    }
    
    public enum OperationalStatus: String, Codable, Sendable {
        case processStaged = "Pipeline Staged"
        case executing = "Active Command Vector Outbound"
        case success = "Execution Absolute Success"
        case faultInterrupted = "Execution Halted via Trapped Subprocess Exception"
        case busTimeout = "Hardware Transport Communication Timeout"
    }
    
    public struct ExceptionDiagnosticBlob: Codable, Sendable {
        public let systemErrorCode: Int32
        public let errorDomain: String
        public let lowerLevelRawOutput: String
        public let targetedMitigationAdvice: String
    }
    
    public var ledgerDatabasePath: String {
        let homeDirectory = NSHomeDirectory()
        let recordsDir = "\(homeDirectory)/Library/Application Support/BobFWTools/records"
        try? FileManager.default.createDirectory(atPath: recordsDir, withIntermediateDirectories: true)
        return "\(recordsDir)/workspace.db"
    }
    
    private init() {
        initializeTelemetryDatabaseTable()
    }
    
    public func recordPipelineEvent(
        workflowId: String,
        profile: MobileDeviceHardwareProfile?,
        status: OperationalStatus,
        fault: ExceptionDiagnosticBlob? = nil
    ) {
        queue.async {
            let record = PipelineSessionRecord(
                id: UUID(),
                timestamp: Date(),
                workflowId: workflowId,
                hardwareProfile: profile,
                executionStatus: status,
                capturedException: fault
            )
            self.commitRecordToSQLite(record: record)
            DispatchQueue.main.async {
                self.historicalLedger.append(record)
            }
        }
    }
    
    public func initializeTelemetryDatabaseTable() {
        var db: OpaquePointer?
        guard sqlite3_open_v2(ledgerDatabasePath, &db, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK else { return }
        defer { sqlite3_close(db) }
        
        let schemaSQL = """
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS telemetry_records (
            id TEXT PRIMARY KEY,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            workflow_id TEXT,
            chipset TEXT,
            transport TEXT,
            status TEXT,
            error_code INTEGER,
            error_domain TEXT,
            raw_output TEXT,
            mitigation_advice TEXT
        );
        """
        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, schemaSQL, -1, &statement, nil) == SQLITE_OK {
            _ = sqlite3_step(statement)
        }
        sqlite3_finalize(statement)
    }
    
    internal func commitRecordToSQLite(record: PipelineSessionRecord) {
        var db: OpaquePointer?
        guard sqlite3_open_v2(ledgerDatabasePath, &db, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK else { return }
        defer { sqlite3_close(db) }
        
        let querySQL = "INSERT INTO telemetry_records (id, workflow_id, chipset, transport, status, error_code, error_domain, raw_output, mitigation_advice) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);"
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, querySQL, -1, &statement, nil) == SQLITE_OK else { return }
        defer { sqlite3_finalize(statement) }

        let SQLITE_TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
        
        sqlite3_bind_text(statement, 1, record.id.uuidString, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 2, record.workflowId, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 3, record.hardwareProfile?.chipset.rawValue ?? "UNKNOWN", -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 4, record.hardwareProfile?.activeTransport.rawValue ?? "UNKNOWN", -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 5, record.executionStatus.rawValue, -1, SQLITE_TRANSIENT)
        
        if let fault = record.capturedException {
            sqlite3_bind_int(statement, 6, fault.systemErrorCode)
            sqlite3_bind_text(statement, 7, fault.errorDomain, -1, SQLITE_TRANSIENT)
            sqlite3_bind_text(statement, 8, fault.lowerLevelRawOutput, -1, SQLITE_TRANSIENT)
            sqlite3_bind_text(statement, 9, fault.targetedMitigationAdvice, -1, SQLITE_TRANSIENT)
        } else {
            for index in 6...9 { sqlite3_bind_null(statement, Int32(index)) }
        }
        
        _ = sqlite3_step(statement)
    }
    
    public func fetchDatabaseStorageMetrics() -> (rowCount: Int, sizeInBytes: Int64) {
        var rows = 0
        var db: OpaquePointer?
        guard sqlite3_open_v2(ledgerDatabasePath, &db, SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK else { return (0, 0) }
        defer { sqlite3_close(db) }
        
        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, "SELECT COUNT(*) FROM telemetry_records;", -1, &statement, nil) == SQLITE_OK {
            if sqlite3_step(statement) == SQLITE_ROW { rows = Int(sqlite3_column_int(statement, 0)) }
        }
        sqlite3_finalize(statement)
        
        if let attributes = try? FileManager.default.attributesOfItem(atPath: ledgerDatabasePath),
           let fileSize = attributes[.size] as? Int64 {
            return (rows, fileSize)
        }
        return (rows, 0)
    }

    public func purgeTelemetryLedger() {
        var db: OpaquePointer?
        guard sqlite3_open_v2(ledgerDatabasePath, &db, SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK else { return }
        defer { sqlite3_close(db) }
        _ = sqlite3_exec(db, "DELETE FROM telemetry_records; VACUUM;", nil, nil, nil)
        DispatchQueue.main.async {
            self.historicalLedger.removeAll()
        }
    }
    
    public static func exceptionBlobBuilder(code: Int32, domain: String, raw: String, advice: String) -> ExceptionDiagnosticBlob {
        return ExceptionDiagnosticBlob(systemErrorCode: code, errorDomain: domain, lowerLevelRawOutput: raw, targetedMitigationAdvice: advice)
    }
}
EOF

# ------------------------------------------------------------------------------
# 2. GENERATE GRAPHICAL USER INTERFACE PANELS
# ------------------------------------------------------------------------------
echo "📦 Writing frontend user interface layouts -> Sources/TelemetryConsoleViews.swift..."
cat << 'EOF' > "$BASE_DIR/TelemetryConsoleViews.swift"
import SwiftUI

public struct BobFWTelemetryConsoleView: View {
    @ObservedObject private var telemetry = BobFWTelemetryLogger.shared
    @State private var filterQuery: String = ""
    @State private var autoScrollToBottom: Bool = true
    public init() {}

    var filteredLogs: [BobFWTelemetryLogger.PipelineSessionRecord] {
        if filterQuery.isEmpty { return telemetry.historicalLedger }
        return telemetry.historicalLedger.filter { $0.workflowId.localizedCaseInsensitiveContains(filterQuery) }
    }

    public var body: some View {
        VStack(spacing: 0) {
            HStack {
                Label("Studio Hardware Telemetry Log Engine", systemImage: "cpu.fill")
                    .font(.headline)
                    .foregroundColor(.white)
                Spacer()
                TextField("Filter by Workflow ID...", text: $filterQuery)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 200)
                Button(action: { telemetry.historicalLedger.removeAll() }) {
                    Label("Purge View Engine Buffer", systemImage: "trash")
                }
                .buttonStyle(.bordered)
                .foregroundColor(.red)
            }
            .padding()
            .background(Color(NSColor.windowBackgroundColor))

            Divider()

            ScrollViewReader { proxy in
                List(filteredLogs) { record in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(record.timestamp, style: .time)
                                .font(.system(.caption, design: .monospaced))
                                .foregroundColor(.gray)
                            Text("[\(record.workflowId)]")
                                .font(.system(.caption, design: .monospaced))
                                .foregroundColor(.orange)
                            Spacer()
                            Text(record.executionStatus.rawValue)
                                .font(.system(size: 10, weight: .bold, design: .monospaced))
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(statusColorModifier(record.executionStatus))
                                .foregroundColor(.black)
                                .cornerRadius(4)
                        }
                        if let profile = record.hardwareProfile {
                            Text("Target: \(profile.chipset.rawValue) | Transport Vector: \(profile.activeTransport.rawValue)")
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundColor(.cyan)
                        }
                        if let fault = record.capturedException {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("⚠️ FAULT [DOMAIN: \(fault.errorDomain)] - CODE: \(fault.systemErrorCode)")
                                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                                    .foregroundColor(.red)
                                Text("Raw: \(fault.lowerLevelRawOutput)")
                                    .font(.system(size: 11, design: .monospaced))
                                    .foregroundColor(.gray)
                                Text("Bench Advice: \(fault.targetedMitigationAdvice)")
                                    .font(.system(size: 11, weight: .medium))
                                    .foregroundColor(.green)
                            }
                            .padding(8)
                            .background(Color.red.opacity(0.15))
                            .cornerRadius(4)
                        }
                    }
                    .padding(.vertical, 4)
                    .id(record.id)
                }
                .background(Color.black)
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

public struct BobFWDatabaseMonitorView: View {
    @ObservedObject private var logger = BobFWTelemetryLogger.shared
    @State private var loggedRowsCount: Int = 0
    @State private var databaseSizeString: String = "0 KB"
    private let monitoringTimer = Timer.publish(every: 2.0, on: .main, in: .common).autoconnect()
    public init() {}

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "square.stack.3d.up.fill")
                    .font(.title2)
                    .foregroundColor(.orange)
                VStack(alignment: .leading, spacing: 2) {
                    Text("SQLite Audit Ledger Storage Monitor").font(.headline)
                    Text("Target Workspace File Vector Tracking Allocation").font(.caption).foregroundColor(.gray)
                }
                Spacer()
                Button(action: { refreshStorageMetrics() }) { Image(systemName: "arrow.clockwise") }.buttonStyle(.plain)
            }
            Divider()
            HStack(spacing: 20) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("COMMITTED ENTRIES").font(.system(size: 10, weight: .bold)).foregroundColor(.gray)
                    Text("\(loggedRowsCount)").font(.system(size: 22, weight: .bold, design: .monospaced))
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text("LEDGER DISK SPACE").font(.system(size: 10, weight: .bold)).foregroundColor(.gray)
                    Text(databaseSizeString).font(.system(size: 22, weight: .bold, design: .monospaced)).foregroundColor(.cyan)
                }
            }
            Button(action: { logger.purgeTelemetryLedger(); refreshStorageMetrics() }) {
                HStack { Spacer(); Image(systemName: "bolt.fill"); Text("Purge Metrics Indices"); Spacer() }
            }
            .buttonStyle(.bordered).tint(.orange)
        }
        .padding()
        .background(Color(NSColor.windowBackgroundColor).opacity(0.8))
        .cornerRadius(8)
        .onAppear { refreshStorageMetrics() }
        .onReceive(monitoringTimer) { _ in refreshStorageMetrics() }
    }

    private func refreshStorageMetrics() {
        let stats = logger.fetchDatabaseStorageMetrics()
        self.loggedRowsCount = stats.rowCount
        let byteFormatter = ByteCountFormatter()
        byteFormatter.allowedUnits = [.useKB, .useMB]
        byteFormatter.countStyle = .file
        self.databaseSizeString = byteFormatter.string(fromByteCount: stats.sizeInBytes)
    }
}
EOF

# ------------------------------------------------------------------------------
# 3. GENERATE TARGET VERIFICATION XCUNITTESTS
# ------------------------------------------------------------------------------
echo "📦 Writing multi-client stress target tests -> Tests/BobFWToolsTelemetryTests.swift..."
cat << 'EOF' > "$TESTS_DIR/BobFWToolsTelemetryTests.swift"
import XCTest
import Foundation

final class BobFWToolsTelemetryTests: XCTestCase {
    var logManager: BobFWTelemetryLogger!
    var simulatedHardwareProfile: MobileDeviceHardwareProfile!

    override func setUp() {
        super.setUp()
        logManager = BobFWTelemetryLogger.shared
        simulatedHardwareProfile = MobileDeviceHardwareProfile(
            platform: .samsungAndroid,
            chipset: .samsungExynos,
            activeTransport: .odinLoke,
            constraintFlags: [.frpActive, .rollbackPrevention]
        )
    }

    override func tearDown() {
        logManager.historicalLedger.removeAll()
        logManager = nil
        super.tearDown()
    }

    func testTelemetryLoggingConcurrencyPerformance() {
        let executionExpectation = expectation(description: "Stress Threads Staged Cleanly")
        executionExpectation.expectedFulfillmentCount = 10
        for index in 1...10 {
            logManager.recordPipelineEvent(
                workflowId: "test.stress_vector.\(index)",
                profile: self.simulatedHardwareProfile,
                status: .executing
            )
            executionExpectation.fulfill()
        }
        waitForExpectations(timeout: 2.0)
    }

    func testTrappedSubprocessExceptionHandlingOnDisconnect() {
        let hardwareDropException = BobFWTelemetryLogger.exceptionBlobBuilder(
            code: 504,
            domain: "USB_BUS_CONNECTION_DEAD",
            raw: "IOKit error: broken connection handle.",
            advice: "Isolate lines. Run Cable Doctor."
        )
        logManager.recordPipelineEvent(
            workflowId: "mtk.preloader.stage",
            profile: simulatedHardwareProfile,
            status: .busTimeout,
            fault: hardwareDropException
        )
    }
}
EOF

echo "✨ All components successfully written, structured, and staged!"
