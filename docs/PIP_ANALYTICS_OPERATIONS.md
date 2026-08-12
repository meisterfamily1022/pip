# Pip analytics, reporting, and free-launch operations

## Data contract

Consent version is `1`; absent consent means off. Only a signed-in adult household owner can opt in. Guest, sample, unauthenticated, and local-only sessions do not see analytics controls and do not send events. Opt-out is serialized with ingestion and clears the bounded device queue. Raw events expire after 13 months. `delete_my_analytics()` turns consent off, deletes raw events, installation hashes, and optional reporting profile fields, and records completion; it does not touch the account or any SQLite family data.

Installation pseudonyms are random, rotate every 30 days, and are SHA-256 hashed by the server. Geography is never inferred from IP: the only persisted geography is an optional uppercase ISO-style `country_code` and optional coarse `region_code` typed by a parent. No IP, GPS, city, postal code, or location history is stored.

## Event dictionary

Every payload includes only `appVersion` (letters/numbers/dot/underscore/hyphen, maximum 32) and `platform` (`ios`, `android`, or `web`) unless listed below. The server strips these metadata fields into columns. Example: `{"name":"toy_added","payload":{"appVersion":"1.0.0","platform":"ios"}}`.

| Event | Meaning | Additional payload |
| --- | --- | --- |
| `account_created` | Authenticated account created | none |
| `onboarding_started` / `onboarding_completed` | Adult began/completed onboarding | none |
| `consent_decided` | Adult made analytics choice | `granted: boolean`, `consentVersion: positive integer` |
| `first_room`, `first_storage_spot`, `first_toy`, `first_photo`, `first_category`, `first_child_profile`, `first_play_session`, `first_cleanup` | First-value milestones | none |
| `session_started`, `session_completed` | Play lifecycle | none |
| `toy_added`, `toy_edited` | Library mutations | none |
| `search_used`, `filter_used` | Controls used; never the query/value | none |
| `child_mode_entered`, `cleanup_completed` | Child-mode lifecycle | none |
| `library_scale` | Coarse library size | `toys`, `rooms`, `storageSpots`, `categories`: `0`, `1`, `2`, `3`, `4-9`, `10-24`, `25-49`, or `50+` |
| `recoverable_error` | Classified reliability event | allowlisted `feature`; uppercase stable `errorCode`; no message/stack |
| `feature_gate_encountered` | Dormant future gate signal | allowlisted future feature key |

Unknown events and keys are rejected. Prohibited keys include names, search terms, images, free text, addresses, city/postal/GPS/IP, birthdays, diagnosis/school/therapy details, email, messages, and stack traces.

## Reports and denominators

All dates are inclusive UTC dates and custom ranges are capped at 367 days. Reporting is a security-definer RPC that checks `auth.jwt().app_metadata.pip_admin == true` before returning any data and audits each view/export.

- Funnel: distinct households with each event during the selected range. `toy_added` is the first-toy measure when no explicit first marker exists. Conversion denominator is the distinct `account_created` households in the range.
- D1/D7/D30 retention: signup-week cohorts; denominator is distinct households with `account_created` in that UTC week, numerator is those households active on exactly signup date + 1/7/30 days. A household is active when it emits any consented product event that day.
- DAU/WAU/MAU: distinct active households in the trailing 1/7/30 days ending on the report end date. Stickiness is DAU/MAU (and WAU/MAU where presented); zero MAU yields no percentage.
- Play/cleanup rate: `cleanup_completed` count divided by `session_started` count; zero sessions yields no rate.
- Demographic/geographic cells: distinct households. Any cell with fewer than 10 is replaced server-side with `value=null`, `households=null`, `suppressed=true`, rendered as `Insufficient data` in UI and CSV.
- Health rate: classified recoverable-error events divided by total events for the range; never raw messages/stacks.
- Entitlement readiness: household counts by `free`, `plus`, `admin_test`, plus future feature-gate encounters. It contains no revenue or purchase data.

CSV contains aggregate section/metric/value/count/suppression columns only. It never contains raw events, account IDs, installation hashes, child data, or free text.

## Deployment checklist

1. Deploy application code with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Static/local-only builds safely use an inert client when absent; authenticated cloud features then fail closed.
2. Apply Supabase migrations in filename order: `20260811000000_profiles.sql`, `20260812000000_analytics_entitlements.sql`, `20260812010000_staff_analytics_reporting.sql`, `20260812020000_analytics_data_rights.sql`. Do not reset or modify production rows manually.
3. Validate RLS and RPC grants with authenticated owner, ordinary-user, and admin JWTs. Existing auth users are additively backfilled to `free`; no consent or history is fabricated.
4. Bootstrap an administrator with the Supabase Admin API/service-role in a controlled operator environment by merging `{"pip_admin":true}` into that user's `app_metadata`. Never place the service-role key in Expo configuration. Deactivate immediately by removing the claim or setting it false, then revoke existing sessions if immediate cutoff is required.
5. Invoke `select public.enforce_telemetry_retention();` daily using Supabase Cron if available, or the existing operations scheduler. It is idempotent and no-op safe. Only the database owner/service role can execute it.
6. Complete App Store privacy disclosures for optional product interaction, coarse location selected by the user, app diagnostics, account identifier, retention, and deletion. Confirm the disclosures against the shipped build; this repository does not claim App Store Connect was updated.
7. Keep `product_configuration.plus_launch` exactly `{"enabled":false,"visible":false}` for launch. Future activation requires a separately reviewed monetization release, billing/IAP implementation, updated privacy/store disclosures, finalized benefits/prices, and server plus UI changes. Changing this row alone is intentionally insufficient to create billing.

## Product readout cadence

- Week 1: consent rate, onboarding completion, first-toy/session/cleanup funnel, errors by app version, and suppressed/unknown geography coverage.
- Week 4: DAU/WAU/MAU, cleanup rate, library bands, first complete signup-week D1 cohorts, and platform/version health.
- Week 8: compare signup-week D1/D7 cohorts, activation drop-offs, engagement bands, and only unsuppressed coarse demographic differences.
- Week 12: early D30 cohorts, stickiness trend, feature-gate readiness signals (normally zero while hidden), and whether data quality warrants any later Plus discovery research.

Never interpret suppressed cells as zero and never use household bands or geography to target individual families.

