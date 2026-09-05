# Protocol 1

Use HTTPS. Browser collection uses `POST /api/analytics/v1/collect` with `{key,events}` and the registered Origin. Mobile collection includes the registered `context.app_id`; these identifiers are abuse controls, not authentication. Server delivery uses `/api/analytics/v1/server-events` with a secret Bearer credential and `{events}`.

Each event has `protocol:1`, a stable UUID `event_id`, event `name`, `kind` (`page`, `screen`, `custom`, `identify`, `session`), ISO-8601 `occurred_at`, opaque `anonymous_id`, `consent:true`, scalar `properties` and `traits`, and `context.sdk`/`context.sdk_version`. Optional fields: `user_id`, `account_id`, `session_id`, `outcome_id`, `identity_token`. `fr_identify` and `fr_session` are reserved control events. No nested user properties; at most 30 fields per map, strings at most 500 characters.

Maximum 50 events and 65,536 UTF-8 bytes per batch, 8,192 bytes per event. Acceptable occurrence times are within the preceding seven days and at most five minutes into the future. Generate the event ID before queue persistence and never change it on retry. Capture the identity on each event when it occurs.

HTTP 200 returns `{results:[{event_id,status,reason?}]}`. Status is `accepted`, `duplicate`, or `rejected`. Remove only explicitly acknowledged/rejected IDs. Retain all other events. `accepted` means durable inbox acceptance. Retry temporary network failures, 429, and 5xx with exponential backoff and Retry-After. Stop retrying invalid payloads/keys/consent denial. A per-event `quota_exceeded` is a permanent rejection of that delivery, not an invitation to backfill next month. There are no automatic overage charges or sampling.

The collector derives project, property, environment, source trust, and receipt time from the credential. They are not client-controlled envelope fields. Server outcomes take precedence over corresponding client outcomes with the same operation ID. Keep delivery deduplication separate from business-outcome deduplication.

`GET /api/analytics/v1/config?key=...` returns only public protocol and collection configuration. `/api/analytics/v1/link` accepts consented `{consent:true,key,anonymousId,destinationPropertyId}` to mint an opaque handoff, or `{consent:true,key,anonymousId,token}` to consume one. Public keys cannot query reports or issue trusted server outcomes.
