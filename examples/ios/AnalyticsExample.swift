import SwiftUI
import UIKit
import FounderRouteAnalytics

struct AnalyticsExample: View {
    let publicKey: String; let collectorOrigin: String
    @State private var consent = false
    var body: some View {
        VStack {
            Toggle("Allow analytics", isOn: $consent).onChange(of: consent) { granted in
                FounderRouteAnalytics.shared.setConsent(granted)
                if granted { FounderRouteAnalytics.shared.screen("Home") }
            }
            Button("Publish document") { FounderRouteAnalytics.shared.track("document_published", outcomeId: UUID().uuidString) }
            Button("Log out") { FounderRouteAnalytics.shared.reset() }
        }.onAppear { FounderRouteAnalytics.shared.configure(key: publicKey, endpoint: collectorOrigin, appId: Bundle.main.bundleIdentifier ?? "example.app") }
    }
}
// UIKit screen transitions use the same singleton; never install a second collector.
final class EditorViewController: UIViewController {
    override func viewDidAppear(_ animated: Bool) { super.viewDidAppear(animated); FounderRouteAnalytics.shared.screen("Editor") }
}
