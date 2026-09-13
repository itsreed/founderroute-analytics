# Public release implementation progress

The public-release plan is in progress. These working-tree changes are not a
published release and must not replace any published beta artifact.

## Implemented locally

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
  Native builds and device conformance are still unverified.
- Browser/Node candidate versions are 1.0.0-rc.1. Other platform package versions are not yet aligned;
  release version alignment intentionally remains unsatisfied.

## Verified locally

- SDK unit suite: 18 passed, including legacy-queue migration and paused configuration.
- Two Chromium scenarios passed: consent pause/grant/withdrawal and automatic
  collection, including cross-tab refusal, reload/key rotation, lost acknowledgements,
  duplicate delivery, no SDK visitor UI, and normalized SPA navigation.
- FounderRoute backend contract suite: 8 passed, including protocol 2 metadata.

## Required next

1. Expand native automatic/refusal and background restoration fixtures.
2. Compile and run Swift, Android, React Native consumer/device tests in CI;
   review native races, lifecycle cleanup, persistence and configuration fallback.
3. Validate the new private-app v2 routes against a hosted backend. The additive
   migration and mixed-protocol SQL fixtures pass locally; production is unchanged.
4. Complete canonical contract/artifact import, setup manifest, examples and docs.
5. Provision dedicated staging after cost approval; run real lifecycle, integration,
   privacy, concurrency, recovery and capacity gates from the approved plan.
6. Publish aligned candidate/stable artifacts, then lift beta restrictions only
   after gates pass. Maintain legacy immutable artifacts and consent behavior.

No new live migrations, registry publication, or public-access changes have been made.

Staging discovery: on 2026-09-13, Supabase lists only stager and vibelint in
organization bjfwobosembpvfrlrhmo. The new-project tool quoted USD 0/month.
The founder approved creation, but Supabase rejected it because an organization
admin already has two active free projects. Nothing was created, paused or upgraded.
A quote is not proof of capacity for
10-million-event load testing. Native Java/Gradle/Swift tools were not available
on the workstation PATH during this pass.

Private backend verification also passes the PostgreSQL-engine migration/replay/
privacy/cohort suite with mixed v1/v2 events and preserved property defaults.
Native automatic/refusal tests have been added but not executed on native runtimes.
