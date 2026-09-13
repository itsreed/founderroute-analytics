require "json"
package = JSON.parse(File.read(File.join(__dir__, "package.json")))
Pod::Spec.new do |s|
  s.name = "FounderRouteAnalytics"
  s.version = package["version"]
  s.summary = "Native FounderRoute Analytics for React Native"
  s.homepage = "https://github.com/itsreed/founderroute-analytics"
  s.license = "MIT"
  s.author = "FounderRoute"
  s.source = { :git => s.homepage + ".git", :tag => "v#{s.version}" }
  s.platform = :ios, "15.0"
  s.swift_version = "5.9"
  s.source_files = "ios/**/*.{swift,h,m}"
  s.resource_bundles = {"FounderRoutePrivacy" => ["ios/core/PrivacyInfo.xcprivacy"]}
  s.dependency "React-Core"
end
