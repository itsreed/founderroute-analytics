# Example installation

Use test-environment public keys. Register each origin/app ID in FounderRoute before running. Enable only the events and properties you actually instrument.

- **Plain web:** set `FOUNDERROUTE_PUBLIC_KEY` and `FOUNDERROUTE_ORIGIN`, then `node examples/web/server.mjs`. Open `http://127.0.0.1:4318`. Denied consent must show no SDK queue or collection requests. Grant, publish, flush, and compare accepted/processed health receipts.
- **React:** mount `react/AnalyticsExample.jsx` with `publicKey` and `collectorOrigin` in a React application. The same browser package observes SPA navigation.
- **Next.js:** install dependencies inside `next`, set `NEXT_PUBLIC_FOUNDERROUTE_KEY` and `NEXT_PUBLIC_FOUNDERROUTE_ORIGIN`, then run its development command. The example mounts the React component in an App Router client boundary. Production installations can use the package's `next` adapter.
- **Node:** `node examples/node/outbox.mjs` sends one page of a durable outbox file. The file must contain consented event envelopes created atomically with confirmed application outcomes. Configure `FOUNDERROUTE_SECRET`, `FOUNDERROUTE_ORIGIN`, and `FOUNDERROUTE_OUTBOX_FILE`. This example has one consumer; use database leases for production concurrency.
- **React Native:** install the native package in a React Native application, run CocoaPods for iOS, and rebuild both applications. Mount `App.jsx` with an `endpoint` and separate `ios:{key,appId}` / `android:{key,appId}` configurations. Use a development build rather than Expo Go.
- **SwiftUI/UIKit:** add `ios/Package.swift` as a local Swift package in Xcode and use `ios/AnalyticsExample.swift`. Pass the selected public key and collector origin. Both views call the same native singleton.
- **Android Compose:** add the Android library as a Gradle module, initialize it in your Application with the selected public key and app ID, and pass it to `android/AnalyticsExample.kt`.

Native example views are integration sources to mount in an application, not separately signed app bundles. Complete device restart/offline testing and a server-confirmed signup flow before marking production setup ready.
