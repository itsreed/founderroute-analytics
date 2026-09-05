import Foundation
import React

@objc(FounderRouteAnalyticsModule)
final class FounderRouteAnalyticsModule: NSObject {
    private let analytics = FounderRouteAnalytics.shared
    @objc static func requiresMainQueueSetup() -> Bool { false }
    @objc func configure(_ key: String, endpoint: String, appId: String, properties: [String], traits: [String]) { analytics.configure(key: key, endpoint: endpoint, appId: appId, allowedProperties: properties, allowedTraits: traits) }
    @objc func setConsent(_ value: Bool) { analytics.setConsent(value) }
    @objc func identify(_ id: String, token: String?, traits: [String: Any]) { analytics.identify(id, token: token, traits: traits) }
    @objc func setAccount(_ id: String?) { analytics.setAccount(id) }
    @objc func track(_ name: String, properties: [String: Any], outcomeId: String?) { analytics.track(name, properties: properties, outcomeId: outcomeId) }
    @objc func screen(_ name: String) { analytics.screen(name) }
    @objc func reset() { analytics.reset() }
    @objc func flush() { analytics.flush() }
    @objc func getDiagnostics(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) { analytics.getDiagnostics { resolve($0) } }
}
