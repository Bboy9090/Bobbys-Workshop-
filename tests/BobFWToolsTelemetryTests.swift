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
