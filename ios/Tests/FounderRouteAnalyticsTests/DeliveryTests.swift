import XCTest
@testable import FounderRouteAnalytics

private final class CollectorProtocol: URLProtocol {
    static let lock = NSLock()
    static var received: [[String: Any]] = []
    static var offline = false
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.lock.lock(); let offline = Self.offline; Self.lock.unlock()
        if offline { client?.urlProtocol(self, didFailWithError: URLError(.notConnectedToInternet)); return }
        var body = request.httpBody ?? Data()
        if body.isEmpty, let stream = request.httpBodyStream {
            stream.open(); defer { stream.close() }; var buffer = [UInt8](repeating: 0, count: 4096)
            while stream.hasBytesAvailable { let n = stream.read(&buffer, maxLength: buffer.count); if n <= 0 { break }; body.append(buffer, count: n) }
        }
        let payload = (try? JSONSerialization.jsonObject(with: body)) as? [String: Any] ?? [:]
        let events = payload["events"] as? [[String: Any]] ?? []
        Self.lock.lock(); Self.received.append(contentsOf: events); Self.lock.unlock()
        let receipt = try! JSONSerialization.data(withJSONObject: ["results": events.map { ["event_id": $0["event_id"]!, "status": "accepted"] }])
        client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: receipt); client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

final class DeliveryTests: XCTestCase {
    private func diagnostics(_ sdk: FounderRouteAnalytics) async -> [String: Any] {
        await withCheckedContinuation { continuation in sdk.getDiagnostics { continuation.resume(returning: $0) } }
    }
    func testConsentAndAcknowledgedDelivery() async throws {
        CollectorProtocol.received = []; CollectorProtocol.offline = false
        let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [CollectorProtocol.self]
        let sdk = FounderRouteAnalytics(transport: URLSession(configuration: config))
        let key = "fr_pk_" + UUID().uuidString
        sdk.configure(key: key, endpoint: "https://collector.example", appId: "example.fixture", collectionMode: "consent", propertyId: key, environment: "test")
        sdk.track("before_consent"); sdk.flush()
        let before = await diagnostics(sdk); XCTAssertEqual(before["queued"] as? Int, 0); XCTAssertTrue(before["anonymousId"] is NSNull)
        sdk.setConsent(true); sdk.setCampaignContext("example://welcome?fr_link=01234567-89ab-4cde-8fab-0123456789ab&utm_source=distribution&email=private@example.com"); sdk.track("published", outcomeId: "operation-1"); sdk.flush()
        for _ in 0..<100 { if (await diagnostics(sdk))["acknowledged"] as? Int == 1 { break }; try await Task.sleep(nanoseconds: 20_000_000) }
        let delivered = await diagnostics(sdk); XCTAssertEqual(delivered["acknowledged"] as? Int, 1); XCTAssertEqual(delivered["queued"] as? Int, 0)
        XCTAssertEqual(CollectorProtocol.received.first?["outcome_id"] as? String, "operation-1")
        let campaign = CollectorProtocol.received.first?["context"] as? [String:Any]
        XCTAssertEqual(campaign?["campaign_link"] as? String,"01234567-89ab-4cde-8fab-0123456789ab")
        XCTAssertEqual(campaign?["utm_source"] as? String,"distribution")
        XCTAssertNil(campaign?["email"])
        sdk.setConsent(false); let withdrawn = await diagnostics(sdk); XCTAssertTrue(withdrawn["anonymousId"] is NSNull)
    }
    func testOfflineQueueSurvivesNewClientWithSameConsentAndEventIdentity() async throws {
        CollectorProtocol.received = []; CollectorProtocol.offline = true
        let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [CollectorProtocol.self]
        let key = "fr_pk_" + UUID().uuidString
        var first: FounderRouteAnalytics? = FounderRouteAnalytics(transport: URLSession(configuration: config))
        first!.configure(key: key, endpoint: "https://collector.example", appId: "example.fixture", collectionMode: "consent", propertyId: key, environment: "test")
        first!.setConsent(true); first!.track("document_published", outcomeId: "offline-operation"); first!.flush()
        for _ in 0..<100 { if (await diagnostics(first!))["lastError"] as? String == "network_unavailable" { break }; try await Task.sleep(nanoseconds: 20_000_000) }
        let queued = await diagnostics(first!); XCTAssertEqual(queued["queued"] as? Int, 1)
        let file = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!.appendingPathComponent("founderroute-\(key)-test.json")
        let persisted = try JSONSerialization.jsonObject(with: Data(contentsOf: file)) as! [String: Any]
        let expectedId = (persisted["events"] as! [[String: Any]])[0]["event_id"] as! String
        first = nil; CollectorProtocol.offline = false
        let restarted = FounderRouteAnalytics(transport: URLSession(configuration: config))
        restarted.configure(key: key, endpoint: "https://collector.example", appId: "example.fixture", collectionMode: "consent", propertyId: key, environment: "test")
        // The application restores its existing consent decision after restart.
        restarted.setConsent(true)
        for _ in 0..<100 { if (await diagnostics(restarted))["acknowledged"] as? Int == 1 { break }; try await Task.sleep(nanoseconds: 20_000_000) }
        XCTAssertEqual(CollectorProtocol.received.first?["event_id"] as? String, expectedId)
        let delivered = await diagnostics(restarted); XCTAssertEqual(delivered["queued"] as? Int, 0)
        restarted.setConsent(false); _ = await diagnostics(restarted)
    }
}
