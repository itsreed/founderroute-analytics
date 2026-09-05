import XCTest
@testable import FounderRouteAnalytics
final class ConsentTests: XCTestCase {
    func testNoIdentityOrEventsBeforeConsent() {
        let client = FounderRouteAnalytics()
        client.configure(key: "fr_pk_test", endpoint: "https://example.com", appId: "test.app")
        client.track("should_not_exist")
        let done = expectation(description: "diagnostics")
        client.getDiagnostics { data in
            XCTAssertEqual(data["queued"] as? Int, 0)
            XCTAssertEqual(data["consent"] as? Bool, false)
            done.fulfill()
        }
        waitForExpectations(timeout: 2)
    }
}
