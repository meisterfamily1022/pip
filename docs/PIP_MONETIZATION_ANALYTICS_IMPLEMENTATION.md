# Pip free-launch analytics implementation record

## Prompt 0 — baseline and architecture map

- Branch: `codex/monetization`; initial worktree clean.
- Model routing: host cannot switch the primary model at prompt boundaries; active Codex model retained. No subagents used.
- Schema mode: `ADDITIVE_ALLOWED`. Supabase migration files are canonical for cloud identity; Expo SQLite remains canonical for toys, rooms, child profiles, settings, and play sessions.
- Authentication/household boundary: a Supabase authenticated user (`auth.users.id`) is the current household owner identity. `public.profiles.id` is the existing one-to-one owner record. Analytics records therefore use `household_id = auth.uid()` without introducing a second household system.
- Consent placement: parent Settings/Privacy, visible only to a restored signed-in adult session. New users have no consent row and are treated as declined. Guest/sample/local-only use never displays a cloud consent control and never transmits telemetry.
- Telemetry: an allowlisted TypeScript contract is shared by the client and Expo API route. The API delegates persistence to a Supabase RPC so authorization, consent, idempotency, rate limiting, and schema checks remain server-side. A bounded in-memory client queue is best-effort and never participates in core mutations.
- Installation identity: the existing encrypted installation credential service supplies a rotating pseudonym. The server stores only a one-way hash scoped to the household.
- Coarse geography: explicit optional country and region fields are used; no IP/geolocation dependency is introduced. Values are constrained, optional, and cleared with analytics deletion.
- Entitlements: a single server-authoritative `household_entitlements` record defaults to `free`; `plus` and `admin_test` are modeled, but launch config hard-disables and hides Plus. No billing adapter implementation or dependency exists.
- Staff authorization: Supabase JWT `app_metadata.pip_admin = true`, additionally checked in security-definer reporting RPCs. Bootstrap/deactivation is performed with the Supabase Admin API/service-role environment outside the client; the client cannot write this claim.
- Reporting: staff-only Expo routes call aggregate-only Supabase RPCs. RPCs authorize first, suppress demographic/geographic cells below 10 distinct households, cap date ranges, and write access audits.
- Retention: raw events expire after 13 months through a repository-native SQL function suitable for scheduled or manual invocation. Analytics deletion removes raw/report-only household data and invalidates derived rollups.
- Tests: Jest covers contracts/services/UI routing; SQL migration contract tests verify RLS, authorization, suppression, retention, and deletion. Expo Doctor and static web export are available; native bundle validation uses `expo export --platform ios` when no simulator is available.

### Baseline evidence (2026-08-11)

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test -- --runInBand`: 38 suites / 389 tests passed.
- `npx expo-doctor`: 20/20 checks passed.
- `npx expo export --platform web --output-dir dist-web`: passed.

### Scope reconciliation

The design adds cloud analytics only for consenting authenticated adults and preserves all local-first records. It intentionally chooses optional user-entered coarse geography because the current backend has no privacy-reviewed IP-region service. Reporting never returns raw events or identifiers. Pricing constants, payment providers, paywalls, upgrade actions, advertising, Supporter, exact location, child identifiers, free text, and child-specific analytics remain out of scope.

## Prompt completion record

| Prompt | Result | Commit |
| --- | --- | --- |
| 0 Baseline/map | Canonical architecture mapped; static export configuration failure fixed | `cb0e184` |
| 1 Privacy/consent | Versioned strict taxonomy, accurate copy, signed-in-parent controls, guest exclusion | `150f498` |
| 2 Foundation | Additive Supabase models/RLS/RPC ingestion, bounded transport, dormant entitlements | `eef9456` |
| 3 Instrumentation/profile | Minimal value events, optional bands/geography, free-launch notice | `157a7bc` |
| 4 Reporting | Admin-claim aggregate RPC, server suppression, audited view/export, CSV UI | `47b5ebc` |
| 5 Rights/retention/gates | Serialized opt-out/deletion, 13-month retention operation, free gate regression | `339d8a0` |
| 6 QA/handoff | Operations/event/report/deploy docs, 30-day pseudonym rotation, queue opt-out fix, full QA | final prompt commit |

### Final QA evidence

- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `npm test -- --runInBand`: 44 suites / 406 tests passed before final QA corrections; affected analytics and landing tests rerun after corrections.
- `npx expo-doctor`: 20/20 passed.
- `npx expo export --platform web --output-dir dist-web`: passed; 41 static routes and three API routes exported.
- `npx expo export --platform ios --output-dir dist-ios`: passed; Hermes iOS production bundle exported.
- Browser QA at `http://localhost:8091`: privacy page rendered complete optional-analytics disclosures; an unauthenticated direct request for `/parent/staff-insights` redirected to `/sign-in`; corrected adult-choice/local-data copy rendered; browser console had zero errors.
- Database validation: migration contract tests confirm additive-only SQL, RLS, consent gating, admin claim enforcement, small-cell suppression, serialized deletion/opt-out, and 13-month retention. Applying migrations to a live hosted project was intentionally not attempted without production credentials.

Native interaction was validated through the iOS production bundle and the existing component/service regression suite. A signed-in end-to-end Supabase session, live admin claim, and simulator UI session require deployment credentials/runtime and are covered by the deployment checklist rather than fabricated locally.
