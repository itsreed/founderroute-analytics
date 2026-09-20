# Public release implementation progress

Stable `1.0.0` is prepared from the tested `1.0.0-rc.2` source after the live
FounderRoute collector, scheduled worker, deduplication and workspace-deletion
smoke journey passed in production. RC1 and RC2 remain immutable.

## Implemented

- Browser collection state separates mode, permission, refusal, and effective collection.
- Explicit automatic/consent configuration with property/environment refusal scope.
- Missing configuration resolves through the planned v2 config API and fails paused.
- Withdrawal persists a minimal refusal and clears unsent data; opt-in does not
  fabricate a consent grant; reset and destroy do not imply withdrawal.
- Browser events/handoffs use protocol 2 collection metadata. Legacy queued events
  preserve their original protocol and metadata.
- React consent integration is a hook and renders no UI.
- Node explicit collection context uses protocol 2; legacy consent callers keep v1.
- Swift/Android collection modes and persistent refusal are implemented locally;
  React Native forwards the same configuration and controls through native bridges.
  Native builds and the implemented device tests passed in CI.
- All stable packages use 1.0.0. release.json and the build integrity manifest
  pin source/version information; native-copy and version drift checks pass.

## Verified

- SDK unit suite: 19 passed, including legacy-queue migration and paused configuration.
- Two Chromium scenarios passed: consent pause/grant/withdrawal and automatic
  collection, including cross-tab refusal, reload/key rotation, lost acknowledgements,
  duplicate delivery, no SDK visitor UI, and normalized SPA navigation.
- FounderRoute backend contract suite: 8 passed, including protocol 2 metadata.
- Candidate source `871a3d83afdbb878cfb8520a934b39cd603b70bd` passed
  browser, JavaScript, iOS, Android emulator, and React Native Linux/macOS CI:
  https://github.com/itsreed/founderroute-analytics/actions/runs/35477385963
- npm `1.0.0-rc.2` packages were published under `next` and resolved from the
  public registry. `latest` remains the previous beta.
- Swift tag and GitHub prerelease `v1.0.0-rc.2` are public.
- Signed Maven deployment `0544b63e-3f1f-48fd-9b35-a67e9a7eb287` reached
  `PUBLISHED`; the public POM returns HTTP 200 from Maven Central:
  https://repo1.maven.org/maven2/app/founderroute/analytics-android/1.0.0-rc.2/analytics-android-1.0.0-rc.2.pom

## Required next

1. Run cross-platform conformance at the stable source revision.
2. Publish stable npm, Swift and Maven artifacts without replacing RC1 or RC2.
3. Mark the release manifest published, import it into FounderRoute and deploy the
   immutable `/analytics/1.0.0/analytics.js` URL.
4. Verify installation from each public registry and observe production health.

Protocol 2 and the public-access migrations are live. FounderRoute serves the RC2
hosted script, collection/dashboard access uses all four plan entitlements, and the
database emergency pause remains independent. Cross-product synchronization stays
disabled until its separate reconciliation gate passes.

Staging discovery: on 2026-09-13, Supabase listed only stager and vibelint in the
organization. The new-project tool quoted USD 0/month, but creation was rejected
because an organization administrator already had two active free projects. The
founder explicitly deferred staging on 2026-09-19 for the controlled production
rollout. Nothing was created, paused or upgraded. Capacity remains unverified and
the 10-million-event/load tests must not run against production.

Private backend verification also passes the PostgreSQL-engine migration/replay/
privacy/cohort suite with mixed v1/v2 events and preserved property defaults.
Native automatic/refusal tests passed in CI. The candidate source passed all six
cross-platform jobs before publication.

The private app now imports RC2's checksum-verified script and schemas,
uses its manifest in installation prompts, and has removed its editable SDK copy.
The app's 13 Analytics tests, type check, targeted lint and production build passed.
The live production smoke proved automatic configuration, durable acceptance,
scheduled processing, verification exclusion, duplicate delivery and workspace
deletion. Stable registry publication and stable-manifest import remain.

FounderRoute's canonical plan catalog enables Analytics for Free, Founder, Founder
Pro and Founder Scale with the current owner-wide allowances of 1,000, 100,000,
1,000,000 and 5,000,000 production events per subscription period respectively.
The public rollout must preserve those limits rather than introduce a paid-only gate.
