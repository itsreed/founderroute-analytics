import XCTest
@testable import FounderRouteAnalytics
final class ConsentTests: XCTestCase {
    func testNoIdentityOrEventsBeforeConsent() {
        let client = FounderRouteAnalytics()
        client.configure(key: "fr_pk_test", endpoint: "https://example.com", appId: "test.app", collectionMode: "consent", propertyId: UUID().uuidString, environment: "test")
        client.track("should_not_exist")
        let done = expectation(description: "diagnostics")
        client.getDiagnostics { data in
            XCTAssertEqual(data["queued"] as? Int, 0)
            XCTAssertEqual(data["consent"] as? Bool, false)
            done.fulfill()
        }
        waitForExpectations(timeout: 2)
    }

    private func diagnostics(_ sdk: FounderRouteAnalytics) async -> [String: Any] {
        await withCheckedContinuation { continuation in sdk.getDiagnostics { continuation.resume(returning: $0) } }
    }
    func testAutomaticRefusalSurvivesKeyRotationAndOptInDoesNotGrantConsent() async {
        let property = UUID().uuidString
        let first = FounderRouteAnalytics()
        first.configure(key: "fr_pk_first", endpoint: "https://collector.example", appId: "test.app", collectionMode: "automatic", propertyId: property, environment: "test")
        first.track("value")
        let active = await diagnostics(first)
        XCTAssertEqual(active["queued"] as? Int, 1)
        XCTAssertEqual(active["consent"] as? Bool, false)
        first.optOut(); first.reset(); first.setCollectionMode("automatic")
        let denied = await diagnostics(first)
        XCTAssertEqual(denied["queued"] as? Int, 0)
        XCTAssertEqual(denied["optedOut"] as? Bool, true)
        first.destroy(); _ = await diagnostics(first)
        let rotated = FounderRouteAnalytics()
        rotated.configure(key: "fr_pk_rotated", endpoint: "https://collector.example", appId: "test.app", collectionMode: "automatic", propertyId: property, environment: "test")
        rotated.track("blocked")
        let blocked = await diagnostics(rotated)
        XCTAssertEqual(blocked["collectionEnabled"] as? Bool, false)
        XCTAssertEqual(blocked["queued"] as? Int, 0)
        rotated.setCollectionMode("consent"); rotated.optIn(); rotated.track("still_blocked")
        let paused = await diagnostics(rotated)
        XCTAssertEqual(paused["queued"] as? Int, 0)
        rotated.setCollectionMode("automatic"); rotated.track("resumed")
        let resumed = await diagnostics(rotated)
        XCTAssertEqual(resumed["queued"] as? Int, 1)
        XCTAssertEqual(resumed["consentState"] as? String, "not_provided")
        rotated.optOut(); _ = await diagnostics(rotated); rotated.destroy()
    }
}
