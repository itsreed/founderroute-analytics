// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "FounderRouteAnalytics", platforms: [.iOS(.v15)], products: [.library(name: "FounderRouteAnalytics", targets: ["FounderRouteAnalytics"])], targets: [.target(name: "FounderRouteAnalytics", resources: [.process("PrivacyInfo.xcprivacy")]), .testTarget(name: "FounderRouteAnalyticsTests", dependencies: ["FounderRouteAnalytics"])])
