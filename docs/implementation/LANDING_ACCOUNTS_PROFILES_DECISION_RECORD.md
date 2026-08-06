# Landing Page, Accounts, and Child Profiles — Implementation Decision Record

Prompt 0 output for `PLAYMAP_LANDING_ACCOUNTS_CHILD_PROFILES_PROMPT_PACK.md`.

- Branch: `feature/playmap-landing-accounts-child-profiles`
- Base: `feature/ai-assisted-toy-entry` @ `2f5884c`
- Date: 2026-08-06
- Schema mode: OPEN

---

## 1. Audited current state

### Application shape

Expo SDK 57 / React Native 0.86 / React 19 / TypeScript strict, Expo Router with typed routes, `web.output: "server"`. SQLite via `expo-sqlite`, secrets via `expo-secure-store`.

`web.output` is already `server`, so Expo Router API routes are live: `src/app/v1/toy-analysis+api.ts` and `src/app/v1/installations+api.ts`. **The repository already ships a server runtime.** This is the single most important audit finding for account work — no new backend package is required.

### Existing server layer

`src/server/ai/` contains a complete, tested service layer: provider abstraction with a mock implementation, quota accounting, durable usage controls, installation-token issuance and verification, and typed request/response contracts. It demonstrates the established pattern for server work: thin `+api.ts` route, logic in `src/server/**`, contract types shared with the client.

There is **no user authentication**. The only credential concept is a per-installation token (`src/services/installation-credential.ts`) authorising a device to the AI proxy. It is device identity, not account identity, and must not be overloaded into one.

### Landing / public web

None. `public/` holds only brand images. No marketing surface, no metadata, no `robots.txt`/sitemap. `src/app/+html.tsx` exists as the web shell.

### Child profiles

Partially present, minimal. `child_profiles` table plus `src/repositories/child-profiles-repository.ts` exposing list/get/create/update and `getActiveChildProfile`. Profiles carry **a name only** — no avatar, accent colour, age range, choice count, or reading-support mode. `src/app/(parent)/parent/select-child.tsx` exists.

Missing against the brief: per-child choice count, reading mode, avatar/colour, toy-to-child visibility, per-child sessions/history, reorder/hide/delete, Child Mode "Who's playing?" entry, and Guest.

### Data model

Local SQLite at schema version 8. Canonical tables: `rooms`, `storage_spots`, `toys`, `toy_categories`, `play_sessions`, `settings`, `toy_setup_drafts`, `child_profiles`. Migrations are versioned and restart-safe via `PRAGMA user_version`.

`play_sessions` originally had a partial unique index enforcing **one** active session globally.

> **Correction (Prompt 2).** The Prompt 0 audit recorded this as still outstanding. It was already fixed: migration **version 8** (`ensureMultiChildSessions`) drops `active_play_session` and creates `active_play_session_per_child` plus `active_play_session_per_toy`, and backfills `play_sessions.child_id`. The audit read the version 1 schema and missed the later replacement. Prompt 2's remaining session work was therefore only Guest support, not the per-child swap.

Settings is a single row (`id = 1`) holding `choice_limit` and `cleanup_required` — currently device-wide, must become per-child.

### Canonical services to extend (not duplicate)

| Concern | Canonical path |
|---|---|
| DB access | `src/database/client.ts` |
| Rooms / spots | `src/repositories/rooms-repository.ts`, `src/features/locations/location-service.ts` |
| Toys | `src/repositories/toys-repository.ts`, `src/features/toys/toy-service.ts` |
| Sessions / cleanup | `src/repositories/play-sessions-repository.ts`, `src/features/child/cleanup-service.ts` |
| Recommendations | `src/features/child/recommendation-service.ts` |
| Settings | `src/features/settings/settings-service.ts` |
| Child profiles | `src/repositories/child-profiles-repository.ts` |
| Routing guards | `src/startup/route-access.ts`, `src/startup/startup-routing.ts` |
| Theme | `src/theme/playmap-theme.ts` |
| Brand | `src/brand/pip-brand.ts` |
| Server | `src/server/**` + `src/app/**/*+api.ts` |

### Baseline checks (clean)

```
npx tsc --noEmit     clean
npx jest --runInBand 26 suites, 167 tests, all passing
```

Recorded so any later failure is attributable to this branch.

---

## 2. Material conflict: the product is now "Pip", not "PlayMap"

Two commits before this work (`bdb9b9b`, 2026-08-06) the product was rebranded. `app.json` `name` is `"Pip"`. `src/brand/pip-brand.ts` is the canonical brand module (`name: 'Pip'`, tagline "Less deciding. More playing."). All generated assets are `pip-*`. `docs/PIP_REBRAND_COMPATIBILITY.md` and `docs/PIP_VISUAL_SYSTEM.md` document the change.

The brief is written entirely around "PlayMap" and mandates roughly fifteen user-facing strings containing the literal word, including "Create your PlayMap", "What should we call your PlayMap?", "Your PlayMap is ready", and "Create a PlayMap for your whole family".

**Decision — follow the repository's brand, not the brief's literal strings.** The brief's actual *rule* is "use the current approved logo and name already present in the repository; do not redraw, approximate, recolor, or replace it." The repository's approved brand is Pip. Honouring the rule therefore means rendering Pip. The brief's "PlayMap" occurrences are read as stale examples predating the rebrand.

Implementation consequence: **no brand string is hard-coded.** All product-name copy resolves through `pipBrand`, so the entire decision is reversible by editing one module. Copy is otherwise kept verbatim from the brief.

**This decision is flagged for human confirmation** because it governs a public marketing page. It is recorded as a reversible assumption, not treated as settled fact.

## 3. Conflict: V1-SCOPE.md forbids this work

`docs/V1-SCOPE.md` lists as excluded from V1: user accounts, cloud backup, family sharing, multiple child profiles. It also states "The app must not include a backend in Version 1."

The brief supersedes it for this effort. `V1-SCOPE.md` will be amended to mark those items as moved into a post-V1 scope rather than silently contradicted, so the two documents do not disagree in the repository.

---

## 4. Target architecture

### Accounts

Build auth **inside the existing Expo Router server**, following the `src/server/ai/` pattern. Rejected alternatives: a separate backend package (operational cost, second deploy target) and a hosted auth SDK wired directly into components (couples UI to a vendor; the brief forbids provider-specific logic in UI).

- `src/server/auth/**` — password hashing, session issuance/rotation/revocation, verification and reset tokens, rate limiting, membership authorisation.
- `src/app/v1/auth/*+api.ts` — thin routes.
- `src/services/auth-session.ts` — client adapter storing tokens in `expo-secure-store`, never `AsyncStorage`.
- Every protected read and write re-derives household membership **server-side** from the session. Client-supplied household or child IDs are never trusted.
- Apple/Google sign-in behind a config flag, hidden when unconfigured, per the brief.

Email delivery requires an external provider credential that is not present. A `MailSender` interface with a logging development implementation lets verification and reset be fully implemented and tested locally; only the production credential remains a deployment step.

### Landing page

A route group inside the existing Expo web app (`src/app/(public)/`), not a new package. `web.output: "server"` already provides SSR for SEO, the brand assets and theme are already here, and it avoids a second deploy target.

### Data and migration

Purely additive, versions 9+. Existing rows keep their identifiers. Strategy:

1. Additive tables: `parent_accounts`, `households`, `household_members`, `auth_sessions`, `toy_child_visibility`.
2. Additive nullable columns: `household_id` on canonical tables; per-child preference columns on `child_profiles`; `child_profile_id` on `play_sessions`.
3. Backfill a single local household from existing rows — provable from existing data, no invention.
4. Replace the global active-session unique index with one scoped per child profile. This is the one non-additive change; it drops and recreates an **index**, never data.
5. Local-only remains fully supported. An account is required only for backup, sync, recovery, or sharing, matching the brief's account strategy.

No sync claim will appear in the UI or on the landing page until sync genuinely works (Prompt 9).

### Availability model

`toys.is_available` (hidden) and `toys.is_archived` exist. These map onto the brief's four states as: Everyone (available), Selected Children (available + `toy_child_visibility` rows), Parent Only / Temporarily Unavailable (`is_available = 0`, distinguished by a new reason column). Enforcement lives in `recommendation-service`, not UI filtering.

---

## 5. Security and privacy boundaries

- Tokens and session secrets in `expo-secure-store` only.
- Passwords hashed with a memory-hard KDF; never logged.
- No logging of credentials, tokens, verification codes, child names, or image URIs.
- Household membership enforced at the service boundary; cross-household access covered by tests.
- No child credentials, no exact birthdate, no diagnosis, no school, no legal name.
- No compliance claims (COPPA/GDPR/HIPAA/SOC 2). Counsel-review items listed separately.

---

## 6. CTA / release state

`app.json` has an EAS project id and `ios.bundleIdentifier`, and `docs/TESTFLIGHT-CHECKLIST.md` plus `docs/IOS-RELEASE-COMMANDS.md` exist, but there is **no evidence of a live App Store listing**. No public URL is configured.

Decision: the landing CTA is **early access**, backed by a real endpoint in this repository (`src/app/v1/early-access+api.ts`) with consent, validation, duplicate handling, and spam resistance. No App Store or TestFlight link is shipped until a verified public URL exists. No dead CTA.

`Sign In` appears in navigation only once web sign-in has a working destination (Prompt 10).

---

## 7. Validation commands

```
npx tsc --noEmit
npx expo lint
npx jest --runInBand
npx expo export --platform web
```

---

## 8. Reversible assumptions

1. Product name renders as **Pip** via `pipBrand`; reversible in one module. *Flagged for confirmation.*
2. CTA is early access until a verified public download URL exists.
3. Auth is first-party inside the existing Expo server rather than a hosted vendor.
4. Email delivery is interface-backed; production credential is a deployment step.
5. One household per account for now; the membership table admits multi-adult sharing later without migration.

## 9. Branch note

`claude/playmap-redesign-subagents-7748b2` holds an independent redesign built from the same base (`78f3910`) in a separate worktree. `feature/ai-assisted-toy-entry` contains its own, further-developed redesign plus the AI toy-entry work and the Pip rebrand. The two lines overlap substantially and are not merged. This work builds on `feature/ai-assisted-toy-entry` as the more advanced line. The other branch is left untouched; reconciling or retiring it is a separate decision.
