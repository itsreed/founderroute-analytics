import Foundation
#if canImport(UIKit)
import UIKit
#endif

public final class FounderRouteAnalytics: @unchecked Sendable {
    public static let shared = FounderRouteAnalytics()
    private let work = DispatchQueue(label: "com.founderroute.analytics", qos: .utility)
    private var key = "", endpoint = "", appId = ""
    private var verificationId: String?
    private var consent = false, sending = false, foreground = true
    private var anonymousId: String?, userId: String?, accountId: String?, identityToken: String?
    private var traits: [String: Any] = [:], allowedTraits: Set<String> = [], allowedProperties: Set<String> = []
    private var events: [[String: Any]] = []
    private var sessionId = "", lastActivity = Date.distantPast
    private var dropped = 0, rejected = 0, acknowledged = 0, failures = 0, generation = 0
    private var retryAt = Date.distantPast, lastError: String?
    private var timer: DispatchSourceTimer?, task: URLSessionDataTask?
    private var observers: [NSObjectProtocol] = []
    private let transport: URLSession
    public init(transport: URLSession = .shared) { self.transport = transport }

    public func configure(key: String, endpoint: String, appId: String, allowedProperties: [String] = [], allowedTraits: [String] = [], verificationId: String? = nil) {
        work.async {
            guard self.key.isEmpty else { return }
            guard key.hasPrefix("fr_pk_"), let url = URL(string: endpoint), url.scheme == "https" || url.host == "localhost" else { self.lastError = "invalid_configuration"; return }
            self.key = key; self.endpoint = endpoint.trimmingCharacters(in: CharacterSet(charactersIn: "/")); self.appId = appId
            self.verificationId = verificationId
            self.allowedProperties = Set(allowedProperties); self.allowedTraits = Set(allowedTraits)
            #if canImport(UIKit)
            self.observers.append(NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: nil) { [weak self] _ in
                self?.work.async { self?.foreground = false; self?.deliver() }
            })
            self.observers.append(NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: nil) { [weak self] _ in
                self?.work.async { self?.foreground = true; self?.retryAt = .distantPast; self?.deliver() }
            })
            #endif
        }
    }
    private var fileURL: URL? {
        guard !key.isEmpty else { return nil }
        return FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first?.appendingPathComponent("founderroute-\(key.suffix(16)).json")
    }
    public func setConsent(_ granted: Bool) {
        work.async {
            guard granted != self.consent, !self.key.isEmpty else { return }
            self.consent = granted; self.generation += 1
            if !granted {
                self.task?.cancel(); self.timer?.cancel(); self.timer = nil; self.events = []; self.anonymousId = nil
                self.userId = nil; self.accountId = nil; self.identityToken = nil; self.traits = [:]
                if let file = self.fileURL { try? FileManager.default.removeItem(at: file) }; return
            }
            if let file = self.fileURL, let data = try? Data(contentsOf: file), let saved = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] {
                self.dropped = saved["dropped"] as? Int ?? 0
                self.events = saved["events"] as? [[String: Any]] ?? []; self.anonymousId = saved["anonymous_id"] as? String
            }
            self.anonymousId = self.anonymousId ?? UUID().uuidString
            self.prune(); self.persist()
            let timer = DispatchSource.makeTimerSource(queue: self.work)
            timer.schedule(deadline: .now() + 15, repeating: 15)
            timer.setEventHandler { [weak self] in
                guard let self else { return }
                if self.foreground { self.enqueue("fr_session", kind: "session", properties: [:], context: ["active_ms": 15000]) }
                self.deliver()
            }
            self.timer = timer; timer.resume(); self.deliver()
        }
    }
    public func identify(_ userId: String, token: String? = nil, traits: [String: Any] = [:]) {
        work.async {
            guard self.consent else { return }
            if let old = self.userId, old != userId { self.resetIdentity() }
            self.userId = userId; self.identityToken = token; self.traits = traits
            self.enqueue("fr_identify", kind: "identify", properties: [:])
        }
    }
    public func setAccount(_ id: String?) { work.async { if self.consent { self.accountId = id } } }
    public func reset() { work.async { if self.consent { self.resetIdentity(); self.persist() } } }
    private func resetIdentity() { anonymousId = UUID().uuidString; userId = nil; accountId = nil; identityToken = nil; traits = [:]; sessionId = UUID().uuidString; lastActivity = .distantPast }
    public func track(_ name: String, properties: [String: Any] = [:], outcomeId: String? = nil) { work.async { self.enqueue(name, kind: "custom", properties: properties, outcomeId: outcomeId) } }
    public func screen(_ name: String) { work.async { self.enqueue("screen_view", kind: "screen", properties: [:], context: ["screen": String(name.prefix(150))]) } }
    public func flush() { work.async { self.deliver() } }
    public func getDiagnostics(_ completion: @escaping ([String: Any]) -> Void) {
        work.async { let result: [String: Any] = ["consent": self.consent, "queued": self.events.count, "dropped": self.dropped, "rejected": self.rejected, "acknowledged": self.acknowledged, "anonymousId": self.anonymousId.map { $0 as Any } ?? NSNull(), "lastError": self.lastError.map { $0 as Any } ?? NSNull()]; completion(result) }
    }
    private func sanitize(_ input: [String: Any], allowed: Set<String>) -> [String: Any] {
        var result: [String: Any] = [:]
        for (key, value) in input where allowed.contains(key) && key.range(of: "password|secret|token|email|phone|authorization|address|full.?name", options: .regularExpression) == nil {
            if let string = value as? String { result[key] = String(string.prefix(500)) }
            else if value is NSNumber || value is NSNull { result[key] = value }
        }
        return result
    }
    private func enqueue(_ name: String, kind: String, properties: [String: Any], context: [String: Any] = [:], outcomeId: String? = nil) {
        guard consent, let anonymousId else { return }
        let now = Date(); if now.timeIntervalSince(lastActivity) >= 1800 { sessionId = UUID().uuidString }; lastActivity = now
        var ctx: [String: Any] = ["sdk": "ios", "sdk_version": "0.1.0", "app_id": appId]
        ctx["verification_id"] = verificationId
        for (key, value) in context { ctx[key] = value }
        var event: [String: Any] = ["event_id": UUID().uuidString, "protocol": 1, "name": name, "kind": kind, "occurred_at": ISO8601DateFormatter().string(from: now), "anonymous_id": anonymousId, "session_id": sessionId, "consent": true, "properties": sanitize(properties, allowed: allowedProperties), "traits": sanitize(traits, allowed: allowedTraits), "context": ctx]
        event["user_id"] = userId; event["identity_token"] = identityToken; event["account_id"] = accountId; event["outcome_id"] = outcomeId
        guard let bytes = try? JSONSerialization.data(withJSONObject: event), bytes.count <= 8192 else { rejected += 1; lastError = "event_too_large"; return }
        events.append(event); prune(); persist()
    }
    private func prune() {
        let cutoff = Date().addingTimeInterval(-7 * 86400); let before = events.count
        events.removeAll { event in guard let at = event["occurred_at"] as? String, let date = ISO8601DateFormatter().date(from: at) else { return true }; return date < cutoff }
        dropped += before - events.count
        while events.count > 10000 || ((try? JSONSerialization.data(withJSONObject: events).count) ?? 0) > 10 * 1024 * 1024 { events.removeFirst(); dropped += 1 }
    }
    private func persist() {
        guard consent, let file = fileURL else { return }
        do {
            try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
            let data = try JSONSerialization.data(withJSONObject: ["anonymous_id": anonymousId ?? "", "events": events, "dropped": dropped])
            try data.write(to: file, options: .atomic)
            var resource = URLResourceValues(); resource.isExcludedFromBackup = true; var mutable = file; try mutable.setResourceValues(resource)
        } catch { lastError = "storage_unavailable" }
    }
    private func deliver() {
        guard consent, !sending, Date() >= retryAt, let url = URL(string: endpoint + "/api/analytics/v1/collect") else { return }
        prune(); var batch: [[String: Any]] = []
        for event in events.prefix(50) {
            guard let data = try? JSONSerialization.data(withJSONObject: ["key": key, "events": batch + [event]]), data.count <= 65536 else { break }; batch.append(event)
        }
        guard !batch.isEmpty, let body = try? JSONSerialization.data(withJSONObject: ["key": key, "events": batch]) else { return }
        var request = URLRequest(url: url); request.httpMethod = "POST"; request.httpBody = body; request.setValue("application/json", forHTTPHeaderField: "Content-Type"); request.timeoutInterval = 20
        sending = true; let currentGeneration = generation; let batchIDs = Set(batch.compactMap { $0["event_id"] as? String })
        task = transport.dataTask(with: request) { [weak self] data, response, error in
            guard let self else { return }
            self.work.async {
                self.sending = false; guard self.consent, self.generation == currentGeneration else { return }
                guard error == nil, let response = response as? HTTPURLResponse else { self.retry("network_unavailable"); return }
                let status = response.statusCode
                if status == 429 || status >= 500 { self.retry("delivery_\(status)"); return }
                guard status == 200, let data, let result = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any], let receipts = result["results"] as? [[String: Any]] else {
                    self.events.removeAll { batchIDs.contains($0["event_id"] as? String ?? "") }; self.rejected += batchIDs.count; self.lastError = "delivery_rejected"; self.persist(); return
                }
                var ids = Set<String>()
                for receipt in receipts { if let id = receipt["event_id"] as? String, let state = receipt["status"] as? String, ["accepted", "duplicate", "rejected"].contains(state) { ids.insert(id); if state == "rejected" { self.rejected += 1; self.lastError = receipt["reason"] as? String } else { self.acknowledged += 1 } } }
                self.events.removeAll { ids.contains($0["event_id"] as? String ?? "") }; self.failures = 0; self.retryAt = .distantPast; self.persist()
            }
        }
        task?.resume()
    }
    private func retry(_ error: String) { lastError = error; failures += 1; retryAt = Date().addingTimeInterval(min(300, pow(2, Double(min(8, failures))))); persist() }
    deinit { timer?.cancel(); task?.cancel(); observers.forEach { NotificationCenter.default.removeObserver($0) } }
}
