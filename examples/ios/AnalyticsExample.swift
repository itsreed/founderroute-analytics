import SwiftUI
import UIKit
import FounderRouteAnalytics

struct AnalyticsExample: View {
    let publicKey: String; let collectorOrigin: String
    var body: some View {
        VStack {
            Button("Publish document") { FounderRouteAnalytics.shared.track("document_published", outcomeId: UUID().uuidString) }
            Button("Log out") { FounderRouteAnalytics.shared.reset() }
        }.onAppear { FounderRouteAnalytics.shared.configure(key: publicKey, endpoint: collectorOrigin, appId: Bundle.main.bundleIdentifier ?? "example.app", collectionMode: "automatic") }
    }
}
// UIKit screen transitions use the same singleton; never install a second collector.
final class EditorViewController: UIViewController {
    override func viewDidAppear(_ animated: Bool) { super.viewDidAppear(animated); FounderRouteAnalytics.shared.screen("Editor") }
}
