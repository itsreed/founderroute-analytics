import SwiftUI

@main struct FounderRouteExampleApp: App {
    var body: some Scene {
        WindowGroup {
            // Replace only with an iOS PUBLIC test-property key and your collector origin.
            AnalyticsExample(publicKey: "fr_pk_REPLACE_WITH_PUBLIC_TEST_KEY", collectorOrigin: "https://collector.example.invalid")
                .padding()
        }
    }
}
