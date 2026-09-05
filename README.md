# FounderRoute Analytics SDKs

MIT-licensed customer SDKs for FounderRoute's native analytics. This repository contains client code, protocol documentation, fixtures, and examples only.

**Development preview.** Version 0.1.0 is not a stable release. Native build, offline/restart, cross-platform reconciliation, privacy, and production capacity gates must pass before stable publication. Package names are intended publication targets; a source checkout is usable before registry publication.

| Platform | Source | Intended installation |
| --- | --- | --- |
| Browser, React, Next.js | `packages/browser` | `@founderroute/analytics@0.1.0` |
| Node server | `packages/node` | `@founderroute/analytics-node@0.1.0` |
| React Native | `packages/react-native` | `@founderroute/analytics-react-native@0.1.0` |
| iOS | `Package.swift` | Swift Package Manager repository URL, pin a release tag |
| Android | `android` | `app.founderroute:analytics-android:0.1.0` |

Run `npm run build` and `npm test`. Build creates the pinned browser script in `dist/0.1.0/analytics.js` and packages the same native implementations into the React Native bridge. Do not also initialize a second native collector in a React Native application.

## Installation

Create a property in FounderRoute → Analytics → Setup & health. Copy its **public** environment key and the collector origin displayed in the generated installation prompt. Use separate test and production keys. The collector origin is the HTTPS FounderRoute application origin, without an API path.

```js
import { init } from '@founderroute/analytics';
const analytics = init({
  key: 'YOUR_PUBLIC_PROPERTY_KEY', endpoint: 'YOUR_COLLECTOR_ORIGIN',
  allowedProperties: ['feature'], allowedTraits: ['role'],
});
// Call only from the application's consent decision; never assume consent.
consentManager.onChange(granted => analytics.setConsent(granted));
// Use a route template when a URL contains customer-created or sensitive path segments.
analytics.page('/projects/[projectId]/editor');
analytics.identify(customer.id, { token: customer.analyticsAssertion, traits: { role: 'founder' } });
analytics.track('document_published', {feature:'editor'}, {outcomeId: operation.id});
// Call at logout and whenever the signed-in customer changes.
analytics.reset();
```

Configure the same event and trait allowlists in FounderRoute. Unknown fields are discarded. No DOM clicks, form contents, advertising identifiers, screenshots, or replay are captured. Supply opaque customer IDs, never email addresses. Identity assertions come from your authenticated server; never embed server secrets in websites or installed apps.

Before consent, no identity or event storage is read or written and no activity is sent or buffered. Withdrawal clears unsent events and local identity. Previously accepted events are removed with FounderRoute's separate deletion controls. Persist and restore your application consent decision appropriately after restart.

## Confirmed server outcomes

```js
import {FounderRouteServer, signIdentity} from '@founderroute/analytics-node';
const analytics = new FounderRouteServer({secret:process.env.FOUNDERROUTE_SECRET,endpoint:process.env.FOUNDERROUTE_ORIGIN});
const event = analytics.event('signup_completed', {
  consent: customer.analyticsConsent, userId: customer.id,
  anonymousId: request.analyticsAnonymousId,
  eventId: outbox.analyticsEventId, outcomeId: `signup:${customer.id}`,
  occurredAt: customer.createdAt,
});
// Save the exact event with the successful business transaction in your durable outbox.
// The outbox retries send([event]) using the same eventId after network errors/429/5xx.
const receipt = await analytics.send([event]);
const assertion = signIdentity({secret:process.env.FOUNDERROUTE_SECRET,propertyId:process.env.FOUNDERROUTE_PROPERTY,userId:customer.id});
```

Signup means successful account creation, not login. Use matching `outcomeId` values for browser and server observations of the same successful action. Authentication and consent must be checked by your server before issuing an assertion or creating an event. Do not trust a user ID supplied in an unauthenticated request.

## Delivery and diagnostics

`flush()` attempts delivery; it does not promise completion after every app close. Read `getDiagnostics()` for queue, dropped, rejected, and acknowledged counts. Browser queues retain at most 1,000 events/1 MiB/24 hours. Mobile queues retain at most 10,000 events/10 MiB/seven days. The oldest events expire at the limit. A beacon submission does not remove events until a collector receipt arrives. Public receipts acknowledge durable acceptance, not completed report calculation.

Android uses WorkManager with connectivity constraints and restores previously consented delivery after process restart. WorkManager remains subject to operating-system scheduling limits. iOS retries when the app is active and when lifecycle execution is permitted; force-quit delivery is not guaranteed. See [Android background work](https://developer.android.com/develop/background-work/background-tasks/persistent).

## Linking and campaigns

Web page events capture allowlisted UTM fields and `fr_link`. Register both origins and the explicit destination-property binding before using `decorateLink(url, destinationPropertyId)`. After consent on the destination call `consumeHandoff(token)` using `fr_handoff`, then remove that parameter from the address bar. Tokens are opaque, single use, and expire in five minutes. Do not put user IDs in URLs. Installed mobile deep links must explicitly pass campaign context; deferred attribution through an app-store installation is outside this release.

## Native builds

Run `swift test --package-path ios` on macOS and `gradle -p android test assembleRelease` with JDK 17 and Android SDK 35. CI runs macOS/iOS, Android, and JavaScript independently. React Native uses its native module and requires rebuilding the app after installation; Expo Go does not include this custom module.

The included Apple privacy manifest declares analytics product interaction and user IDs. Review the application's combined privacy manifest and store disclosures against the events and traits it actually sends. See [Apple privacy manifests](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files).

## Release checklist

1. Use the confirmed npm scope `@founderroute` and Maven Central namespace `app.founderroute`; confirm registry publishing access; configure registry credentials in repository secrets, never source files.
2. Pass native build/device, offline/restart, consent, and server conformance tests.
3. Pin compatible versions of every package and protocol fixture together.
4. Publish npm packages, signed Maven artifacts, and an immutable Swift tag; attach the versioned script to the release and host it on the FounderRoute collector origin.
5. Preserve the previous release for rollback. Stable publication follows FounderRoute staging reconciliation and capacity gates.
