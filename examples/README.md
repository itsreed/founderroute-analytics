# Example installation

Use test-environment public keys. Register each origin/app ID in FounderRoute before running. Enable only the events and properties you actually instrument.

- **Plain web:** set `FOUNDERROUTE_PUBLIC_KEY` and `FOUNDERROUTE_ORIGIN`, then `node examples/web/server.mjs`. Open `http://127.0.0.1:4318`. Set `FOUNDERROUTE_PROPERTY_ID` to the test property UUID. Automatic mode starts without a visitor prompt. Publish, flush, and compare accepted/processed health receipts.
- **React:** mount `react/AnalyticsExample.jsx` with `publicKey` and `collectorOrigin` in a React application. The same browser package observes SPA navigation.
- **Next.js:** install dependencies inside `next`, set `NEXT_PUBLIC_FOUNDERROUTE_KEY` and `NEXT_PUBLIC_FOUNDERROUTE_ORIGIN`, then run its development command. The example mounts the React component in an App Router client boundary. Production installations can use the package's `next` adapter.
- **Node:** `node examples/node/outbox.mjs` sends one page of a durable outbox file. The file must contain event envelopes created atomically with confirmed application outcomes and each subject's collection context. Configure `FOUNDERROUTE_SECRET`, `FOUNDERROUTE_ORIGIN`, and `FOUNDERROUTE_OUTBOX_FILE`. This example has one consumer; use database leases for production concurrency.
- **React Native:** install the native package in a React Native application, run CocoaPods for iOS, and rebuild both applications. Mount `App.jsx` with an `endpoint` and separate `ios:{key,appId}` / `android:{key,appId}` configurations. Use a development build rather than Expo Go.
- **SwiftUI/UIKit:** install XcodeGen, run `xcodegen generate` inside `examples/ios`, then open `AnalyticsExample.xcodeproj`. Replace the public test key and collector origin in `ExampleApp.swift` and register bundle ID `example.founderroute`. The project uses the local Swift package at the repository root. Both views call the same native singleton. A published release can instead be added to another Xcode project using the repository URL and a pinned tag.
- **Android Compose:** replace the public test key and collector origin in `examples/android/src/main/java/example/founderroute/MainActivity.kt`, then run `gradle -p android :example:installDebug`. Register app ID `example.founderroute`. The sample app depends on the same library project that is published to Maven.

The example applications use automatic collection and render no consent UI. Their buttons demonstrate screens and client-observed feature usage; a successful account creation must still be instrumented on the customer's backend with the Node/HTTP example. Complete device restart/offline testing and a server-confirmed signup flow before marking production setup ready.


Optional consent integration belongs to the customer application: select
`collectionMode: "consent"` and call `setConsent(true)` only for an actual grant
from its stored preference or CMP. Use `setConsent(false)` or `optOut()` for a
refusal. `optIn()` clears refusal but does not grant consent. Neither SDK mode
renders visitor-facing UI. Server event helpers must read each subject's stored
preferences; a browser-only opt-out cannot automatically update a separate server.

These working examples target the protocol 2 candidate, which has not yet been
published or deployed. Do not point the candidate at a v1-only beta backend.
