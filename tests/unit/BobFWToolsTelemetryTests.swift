import Foundation

/// Comprehensive Verification Test Suite for BobFWTelemetryLogger & SQLite ACID Persistence
@main
struct BobFWToolsTelemetryTests {
    static func main() {
        print("======================================================================")
        print("  BobFWTools Telemetry Logger & SQLite ACID Persistence Test Suite")
        print("======================================================================")

        var passedCount = 0
        var failedCount = 0

        func assertTest(_ condition: Bool, _ testName: String, detail: String = "") {
            if condition {
                print("  ✅ [PASS] \(testName)")
                if !detail.isEmpty {
                    print("            ↳ \(detail)")
                }
                passedCount += 1
            } else {
                print("  ❌ [FAIL] \(testName)")
                if !detail.isEmpty {
                    print("            ↳ Failure details: \(detail)")
                }
                failedCount += 1
            }
        }

        // Setup isolated test database path in /tmp
        let testRunId = UUID().uuidString.prefix(8)
        let tempDbPath = "/tmp/bobfw_telemetry_test_\(testRunId).db"
        print("[SETUP] Initializing isolated SQLite ledger at: \(tempDbPath)")
        BobFWTelemetryLogger.shared.initializeTelemetryDatabaseTable(customPath: tempDbPath)

        // -------------------------------------------------------------------------
        // Test 1: testTelemetryLoggingConcurrencyPerformance
        // -------------------------------------------------------------------------
        print("\n[TEST 1] testTelemetryLoggingConcurrencyPerformance")
        print("         Executing 50 concurrent asynchronous telemetry dispatches...")

        let concurrencyCount = 50
        let group = DispatchGroup()
        let dispatchStartTime = DispatchTime.now()

        let chipsets: [ChipsetArchitecture] = [
            .qualcommSnapdragon,
            .samsungExynos,
            .mediaTekDimensity,
            .unisocTiger,
            .appleA_Series
        ]

        let transports: [DeviceTransportMode] = [
            .adb,
            .fastboot,
            .mtpModem,
            .odinLoke,
            .edl9008
        ]

        for i in 1...concurrencyCount {
            group.enter()
            let chipset = chipsets[i % chipsets.count]
            let transport = transports[i % transports.count]

            DispatchQueue.global(qos: .userInitiated).async {
                let profile = MobileDeviceHardwareProfile(
                    platform: .samsungAndroid,
                    chipset: chipset,
                    activeTransport: transport,
                    constraintFlags: .secureBootEnabled
                )

                let status: BobFWTelemetryLogger.OperationalStatus = (i % 5 == 0) ? .faultInterrupted : .executing

                let fault: BobFWTelemetryLogger.ExceptionDiagnosticBlob? = (status == .faultInterrupted)
                    ? BobFWTelemetryLogger.exceptionBlobBuilder(
                        code: Int32(100 + i),
                        domain: "TEST_CONCURRENCY_DOMAIN",
                        raw: "Subprocess mock trapped exit for test event #\(i)",
                        advice: "Verify serial bus line \(i) timing constraints."
                    )
                    : nil

                BobFWTelemetryLogger.shared.recordPipelineEvent(
                    workflowId: "test.concurrency.event.\(i)",
                    profile: profile,
                    status: status,
                    fault: fault
                )
                group.leave()
            }
        }

        group.wait()
        let dispatchEndTime = DispatchTime.now()
        let dispatchDurationMs = Double(dispatchEndTime.uptimeNanoseconds - dispatchStartTime.uptimeNanoseconds) / 1_000_000.0

        // Flush SQLite queue to ensure all async transactions are committed
        BobFWTelemetryLogger.shared.flushPendingWrites()

        // Pump main runloop to process DispatchQueue.main.async updates to published historicalLedger
        RunLoop.main.run(until: Date(timeIntervalSinceNow: 0.2))

        let recordCount = BobFWTelemetryLogger.shared.fetchTelemetryRecordCount()
        let memoryCount = BobFWTelemetryLogger.shared.historicalLedger.count

        assertTest(
            dispatchDurationMs < 500.0,
            "Caller thread non-blocking performance",
            detail: "50 dispatches completed in \(String(format: "%.2f", dispatchDurationMs)) ms (benchmark threshold: < 500 ms)"
        )

        assertTest(
            recordCount == concurrencyCount,
            "SQLite transactional persistence integrity",
            detail: "Expected \(concurrencyCount) committed rows in telemetry_records, found \(recordCount)"
        )

        assertTest(
            memoryCount >= concurrencyCount,
            "In-memory published ledger sync",
            detail: "historicalLedger contains \(memoryCount) items (>= \(concurrencyCount))"
        )

        // -------------------------------------------------------------------------
        // Test 2: testTrappedSubprocessExceptionHandlingOnDisconnect
        // -------------------------------------------------------------------------
        print("\n[TEST 2] testTrappedSubprocessExceptionHandlingOnDisconnect")
        print("         Simulating trapped hardware bus disconnect (Code 504: busTimeout)...")

        let disconnectWorkflowId = "hardware.disconnect.trapped.test.\(testRunId)"
        let disconnectProfile = MobileDeviceHardwareProfile(
            platform: .samsungAndroid,
            chipset: .qualcommSnapdragon,
            activeTransport: .odinLoke,
            constraintFlags: [.secureBootEnabled, .rollbackPrevention]
        )

        let disconnectFault = BobFWTelemetryLogger.exceptionBlobBuilder(
            code: 504,
            domain: "USB_SUBSYSTEM_IOKIT",
            raw: "kIOReturnNotResponding (0xe00002ed): device dropped off USB bus mid-pipeline",
            advice: "Inspect physical USB-C cable continuity, verify device port VBUS, and re-arm USB bus listener."
        )

        BobFWTelemetryLogger.shared.recordPipelineEvent(
            workflowId: disconnectWorkflowId,
            profile: disconnectProfile,
            status: .busTimeout,
            fault: disconnectFault
        )

        BobFWTelemetryLogger.shared.flushPendingWrites()
        RunLoop.main.run(until: Date(timeIntervalSinceNow: 0.1))

        let recordedStatus = BobFWTelemetryLogger.shared.fetchLastRecordedStatus(workflowId: disconnectWorkflowId)
        let capturedCode = BobFWTelemetryLogger.shared.fetchLastCapturedExceptionCode(workflowId: disconnectWorkflowId)

        assertTest(
            recordedStatus == .busTimeout,
            "Trapped subprocess status recorded accurately",
            detail: "Expected status: \(BobFWTelemetryLogger.OperationalStatus.busTimeout.rawValue), retrieved: \(recordedStatus?.rawValue ?? "nil")"
        )

        assertTest(
            capturedCode == 504,
            "Trapped error code 504 persisted to SQLite",
            detail: "Expected error_code: 504, retrieved: \(capturedCode != nil ? String(capturedCode!) : "nil")"
        )

        // -------------------------------------------------------------------------
        // Test 3: testDatabaseStorageMetricsAndPurge
        // -------------------------------------------------------------------------
        print("\n[TEST 3] testDatabaseStorageMetricsAndPurge")
        print("         Validating live sector sizing metrics and offline purge...")

        let metricsBeforePurge = BobFWTelemetryLogger.shared.fetchDatabaseStorageMetrics()
        assertTest(
            metricsBeforePurge.rowCount == concurrencyCount + 1,
            "Storage metrics row count matches total commits",
            detail: "Expected \(concurrencyCount + 1) rows, measured \(metricsBeforePurge.rowCount)"
        )

        assertTest(
            metricsBeforePurge.sizeInBytes > 0,
            "Ledger disk allocation size non-zero",
            detail: "Measured ledger file size: \(metricsBeforePurge.sizeInBytes) bytes"
        )

        BobFWTelemetryLogger.shared.purgeTelemetryLedger()
        BobFWTelemetryLogger.shared.flushPendingWrites()
        RunLoop.main.run(until: Date(timeIntervalSinceNow: 0.1))

        let metricsAfterPurge = BobFWTelemetryLogger.shared.fetchDatabaseStorageMetrics()
        let memoryCountAfterPurge = BobFWTelemetryLogger.shared.historicalLedger.count

        assertTest(
            metricsAfterPurge.rowCount == 0 && memoryCountAfterPurge == 0,
            "Purge offline ledger indices reset disk and memory counters",
            detail: "Row count: \(metricsAfterPurge.rowCount), in-memory count: \(memoryCountAfterPurge)"
        )

        // Clean up temporary database file
        try? FileManager.default.removeItem(atPath: tempDbPath)
        try? FileManager.default.removeItem(atPath: "\(tempDbPath)-wal")
        try? FileManager.default.removeItem(atPath: "\(tempDbPath)-shm")
        print("\n[TEARDOWN] Cleaned up test database: \(tempDbPath)")

        // Reconnect singleton to default workspace database
        BobFWTelemetryLogger.shared.initializeTelemetryDatabaseTable()

        print("\n======================================================================")
        print("  SUMMARY: \(passedCount) tests passed, \(failedCount) tests failed.")
        print("======================================================================")

        if failedCount > 0 {
            exit(1)
        } else {
            print("  ✨ All telemetry persistence & concurrency tests passed with 100% fidelity.")
        }
    }
}
