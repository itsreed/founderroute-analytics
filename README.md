# FounderRoute Analytics SDKs

MIT-licensed customer SDKs for FounderRoute's native analytics. This repository contains client code, protocol documentation, fixtures, and examples only.

**Stable public release.** Protocol 2 version `1.0.0` is the supported public release. Install the exact version or npm `latest`. The release supports `automatic` and `consent` collection modes and requires FounderRoute's v2 backend. FounderRoute renders no visitor-facing consent UI; consent mode connects to UI controlled by the customer application.

| Platform | Source | Intended installation |
| --- | --- | --- |
| Browser, React, Next.js | `packages/browser` | `@founderroute/analytics@1.0.0` |
| Node server | `packages/node` | `@founderroute/analytics-node@1.0.0` |
| React Native | `packages/react-native` | `@founderroute/analytics-react-native@1.0.0` |
| iOS | `Package.swift` | Repository URL with exact tag `v1.0.0` |
| Android | `android` | `app.founderroute:analytics-android:1.0.0` |

Run `npm run build` and `npm test`. Build creates the stable browser script in `dist/1.0.0/analytics.js` with normalized line endings and packages the same native implementations into the React Native bridge. Do not also initialize a second native collector in a React Native application.

## Candidate installation behavior

Create a property in FounderRoute → Analytics → Setup & health. Copy its **public** environment key and the collector origin displayed in the generated installation prompt. Use separate test and production keys. The collector origin is the HTTPS FounderRoute application origin, without an API path.

```js
import { init } from '@founderroute/analytics';
const analytics = init({
  key: 'YOUR_PUBLIC_PROPERTY_KEY', endpoint: 'YOUR_COLLECTOR_ORIGIN',
  propertyId: 'YOUR_PROPERTY_ID', environment: 'test', collectionMode: 'automatic',
  allowedProperties: ['feature'], allowedTraits: ['role'],
});
// Automatic mode starts unless an explicit refusal is already stored.
// Optional consent mode uses the customer's own CMP via setConsent(granted).
// Use a route template when a URL contains customer-created or sensitive path segments.
analytics.page('/projects/[projectId]/editor');
analytics.identify(customer.id, { token: customer.analyticsAssertion, traits: { role: 'founder' } });
analytics.track('document_published', {feature:'editor'}, {outcomeId: operation.id});
// Call at logout and whenever the signed-in customer changes.
analytics.reset();
```

Configure the same event and trait allowlists in FounderRoute. Unknown fields are discarded. No DOM clicks, form contents, advertising identifiers, screenshots, or replay are captured. Supply opaque customer IDs, never email addresses. Identity assertions come from your authenticated server; never embed server secrets in websites or installed apps.

Neither collection mode renders visitor-facing UI. `automatic` starts without a consent grant; `consent` starts paused until the customer application calls `setConsent(true)`. A minimal property/environment refusal record is read before either mode collects. Paused consent mode creates no analytics identity or queue and sends no activity. SDK configuration lookup may be needed when mode/property details are omitted.

`optOut()` or `setConsent(false)` clears unsent events and identity and persists refusal. `optIn()` clears refusal but does not grant consent. `reset()` changes identity without changing permission; `destroy()` releases the instance without recording refusal. Refusals survive supported reloads and key rotation, but cannot survive storage being cleared or unavailable. Diagnostics expose storage failures. Previously accepted events use separate deletion controls. Legacy beta browser withdrawals may have erased all local preference evidence; existing installations remain consent-mode and the customer application must restore its actual decision.

## Confirmed server outcomes

```js
import {FounderRouteServer, signIdentity} from '@founderroute/analytics-node';
const analytics = new FounderRouteServer({secret:process.env.FOUNDERROUTE_SECRET,endpoint:process.env.FOUNDERROUTE_ORIGIN});
const event = analytics.event('signup_completed', {
  collectionMode: 'automatic', optedOut: customer.analyticsOptedOut, userId: customer.id,
  anonymousId: request.analyticsAnonymousId,
  eventId: outbox.analyticsEventId, outcomeId: `signup:${customer.id}`,
  occurredAt: customer.createdAt,
});
// Save the exact event with the successful business transaction in your durable outbox.
// The outbox retries send([event]) using the same eventId after network errors/429/5xx.
const receipt = await analytics.send([event]);
const assertion = signIdentity({secret:process.env.FOUNDERROUTE_SECRET,propertyId:process.env.FOUNDERROUTE_PROPERTY,userId:customer.id});
```

Signup means successful account creation, not login. Use matching `outcomeId` values for browser and server observations of the same successful action. Authentication and each subject's collection preference must be checked by your server before issuing an assertion or creating an event. Do not trust a user ID supplied in an unauthenticated request.

## Delivery and diagnostics

`flush()` attempts delivery; it does not promise completion after every app close. Read `getDiagnostics()` for queue, dropped, rejected, and acknowledged counts. Browser queues retain at most 1,000 events/1 MiB/24 hours. Mobile queues retain at most 10,000 events/10 MiB/seven days. The oldest events expire at the limit. A beacon submission does not remove events until a collector receipt arrives. Public receipts acknowledge durable acceptance, not completed report calculation.

Android uses WorkManager with connectivity constraints and restores previously permitted delivery after process restart. WorkManager remains subject to operating-system scheduling limits. iOS retries when the app is active and when lifecycle execution is permitted; force-quit delivery is not guaranteed. See [Android background work](https://developer.android.com/develop/background-work/background-tasks/persistent).

## Linking and campaigns

Web page events capture allowlisted UTM fields and `fr_link`. Register both origins and the explicit destination-property binding before using `decorateLink(url, destinationPropertyId)`. When collection is permitted on the destination, call `consumeHandoff(token)` using `fr_handoff`, then remove that parameter from the address bar. Tokens are opaque, single use, and expire in five minutes. Do not put user IDs in URLs. Installed mobile deep links must explicitly pass campaign context; deferred attribution through an app-store installation is outside this release.

## Native builds

Run `swift test --package-path ios` on macOS and `gradle -p android test assembleRelease` with JDK 17 and Android SDK 35. CI runs macOS/iOS, Android, and JavaScript independently. React Native uses its native module and requires rebuilding the app after installation; Expo Go does not include this custom module.

The included Apple privacy manifest declares analytics product interaction and user IDs. Review the application's combined privacy manifest and store disclosures against the events and traits it actually sends. See [Apple privacy manifests](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files).

## Release checklist

1. Use the confirmed npm scope `@founderroute` and Maven Central namespace `app.founderroute`; confirm registry publishing access; configure registry credentials in repository secrets, never source files.
2. Pass native build/device, offline/restart, consent, and server conformance tests.
3. Pin compatible versions of every package and protocol fixture together.
4. Publish npm packages, signed Maven artifacts, and an immutable Swift tag; attach the versioned script to the release and host it on the FounderRoute collector origin.
5. Preserve the previous release for rollback. Stable publication follows the controlled hosted lifecycle and reconciliation checks. Dedicated staging and isolated capacity testing remain deferred; never substitute production load testing for those gates.

## Publishing a tested release

The `Publish npm release` GitHub workflow publishes all three public npm packages together. Trusted publisher connections are configured for `itsreed/founderroute-analytics`, workflow `publish-npm.yml`, environment `npm-release`. Publishing uses GitHub OIDC; do not recreate the obsolete bootstrap token. Stable `1.0.0` uses npm tag `latest`.

The `Stage Maven Central release` workflow builds and signs the Maven coordinate in `release.json`, then uploads it as a user-managed deployment. The environment-protected `Publish validated Maven deployment` workflow publishes only an exact validated deployment ID and waits for Maven Central to confirm completion. Stable `app.founderroute:analytics-android:1.0.0` must reach `PUBLISHED` before its import into FounderRoute.


`release.json` defines exact candidate versions, protocol support and distribution
tag. `npm run build` emits a checksum manifest beside the hosted script, recording
its source commit and whether inputs were modified. `npm run release:check`
rejects version or embedded native-source drift. Publishing workflows require the
matching release tag; merely pushing a branch does not publish packages. Their
trusted workflow filenames and GitHub environment bindings remain unchanged.
