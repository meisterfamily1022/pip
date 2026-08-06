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

## 8a. Prompt 3 outcomes — authentication

Built inside the existing Expo Router server as planned, following the
`src/server/ai/**` shape (repository interfaces + in-memory development
storage + a thin `+api.ts` route per operation).

- `src/server/auth/credentials.ts` — scrypt password hashing (N=16384) with a
  per-account salt and self-describing parameters, so the work factor can rise
  later without invalidating stored hashes. Every comparison is
  `timingSafeEqual`. Session tokens are HMAC-signed and carry a session id that
  is loaded on each request, so revocation takes effect immediately.
- `src/server/auth/auth-service.ts` — sign up, verify, resend, sign in, sign
  out, restore, password reset, re-authentication, email change, and household
  authorisation.
- `src/server/auth/errors.ts` — one normalised body for every failure.
- `src/services/auth-session-storage.ts` — token in `expo-secure-store` on
  device. On web there is no keystore, so the token is memory-only rather than
  in `localStorage`, where any script could read it. It therefore does not
  survive a browser reload; that is a deliberate trade.

**Anti-enumeration is structural, not cosmetic.** Sign-up with an existing
address returns the identical success shape and sends no second code. Sign-in
spends a decoy scrypt comparison when no account matches, so response timing
does not distinguish an unknown address from a wrong password. Password reset
and email change always report success. Tests assert each of these.

**Email delivery remains the one external dependency.** `MailSender` is
implemented and fully tested; `ConsoleMailSender` logs only that a message was
queued, deliberately omitting the address, code, and reset token, because logs
get pasted into issues and a logged code is a working credential. Configuring a
provider is a deployment step, recorded in `.env.example`.

Apple and Google sign-in are read from configuration and reported through
`availableProviders()`. With no client id set, both are false and the UI must
not render the buttons.

Removed `src/types/node-crypto.d.ts`: it was a hand-written shim that shadowed
`@types/node` and lacked `scrypt`. Prompt 2 added `"node"` to the tsconfig
`types` array, so the real declarations are now available.

## 8b. Prompt 4 outcomes — public landing page

Lives at the web root. `src/app/index.tsx` now serves two audiences: on web it
renders `LandingPage`, on native it stays app startup. One route, no redirect,
so the marketing page is the server-rendered document a crawler receives.

The route guard gained an explicit `isPublic` input rather than deriving public
status from the route group alone, because the web root is the landing page
while the native root is startup. The layout knows the platform; `route-guards`
stays pure and fully tested.

**Claims are data, not prose.** `src/features/landing/landing-copy.ts` holds
every public claim, and each feature carries an `available` flag. The page
renders only available features, so it cannot advertise something the build
does not do. Multiple child profiles, per-child settings and Guest mode are
present in that list but flagged unavailable; the prompts that ship them flip
the flag. Tests assert the unshipped three are not rendered.

Other claims locked down by test: no "PlayMap" anywhere in user-facing copy, no
download or sign-in offer in the nav or calls to action, no present-tense
backup or sync claim, no legal-compliance claims.

Copy was rewritten rather than find-and-replaced. The brief's "Create a PlayMap
for your whole family" does not survive the rename, so it reads "Set up Pip for
your whole family…".

The CTA is backed by a real endpoint (`/v1/early-access`) with consent, a
honeypot, validation, and duplicate-tolerant registration that stores only an
address and a timestamp. Re-registering returns the same success, so the
endpoint cannot be used to test whether an address is on the list.

Verified by exporting the web build: the root document contains the headline
and CTA as server-rendered HTML, with zero occurrences of the legacy name.

## 8c. Prompt 5 outcomes — sign-up, verification, family space

Three screens in a new `(auth)` route group: `sign-up`, `verify-email`,
`family-space`.

**The account is opt-in, not a gate.** The existing onboarding is local-first —
PIN, child nickname, first location — and none of it now requires an account.
The welcome screen offers "Create an account" beside copy explaining that Pip
works on this device without one. This follows the brief's own principle that
an account must earn itself through backup, recovery, or sharing; forcing it
into local setup would have contradicted that and broken the "do not block
evaluation" rule.

Flow: sign up → confirm the address (a session is issued on success, so the
parent is not asked to sign in again) → name the household. Household naming
comes after verification because renaming needs a session, and renaming is
idempotent, so a retry settles on the same value.

Resumability: the address awaiting confirmation is persisted, so closing the
app mid-sign-up returns to the code screen rather than an empty form. It is
only an address, never a credential, but it still goes to secure storage on
device.

**The verification screen states plainly that email delivery is not switched on
in this build.** A parent would otherwise sit waiting for a code that cannot
arrive. That notice is removed when a provider is configured.

Nothing in account creation asks about a child, and a test asserts the field
list contains nothing matching child, birthday, age, school, or diagnosis.

Added `renameHousehold` to the auth service and a `/v1/household` route. The
household id is read from the request but re-checked against the session's
memberships, so supplying another household's id is rejected — covered by test.

## 8d. Prompt 6 outcomes — child profiles and parent management

`src/features/children/child-profile-service.ts` plus two screens:
`/parent/children` (list, pause, reorder, delete, add) and `/parent/edit-child`
(nickname, avatar, accent colour, broad age band, choice count, reading
support).

**The rule that shapes the service: a profile owns preferences and play
history, never inventory.** Deleting a profile removes its play sessions and
nothing else — toys, rooms, storage spots and photos are household property.
`play_sessions.child_id` is RESTRICT, so history has to go first anyway, and
that is also the privacy-respecting choice since history is the only part that
is about the child rather than the household. Tests assert toys, rooms and
spots all survive a deletion, and that a sibling's history is untouched.

Deleting the active profile clears `settings.active_child_id`, so Child Mode
asks who is playing rather than opening a profile that no longer exists.

Duplicate prevention compares names case-insensitively with collapsed
whitespace, so a double tap or a replayed offline queue cannot produce two
profiles a parent cannot tell apart. Reordering writes in one transaction and
ignores ids outside the household, and omitted profiles keep their position
rather than being dropped from the ordering.

Paused profiles are labelled in words ("Paused — not shown in Child Mode"), not
by colour, per the accessibility requirement.

Nothing collects a birthday, legal name, school, or diagnosis. The optional age
field is a broad band and is documented on screen as affecting wording only.

Landing claims `profiles` and `per-child` flipped to `available: true`, since
they are now real; `guest` stays false until Guest reaches Child Mode. The
landing test was updated to match — that mechanism working as designed.

Onboarding's child step became "Who will use Pip?" with avatar, colour and
reading support, and a "Skip for now" action, since profiles are optional.

## 8e. Prompt 7 outcomes — setup choice, sample mode, local-only path

Finishing setup now lands on `/start-choice` rather than Parent Home, offering
the brief's four options. Every one reaches a working destination, including
"I'll set it up later", which goes to Parent Home rather than a dead end.

**Sample toys are flagged, not faked.** Migration 10 adds `is_sample` to rooms,
storage spots and toys. A flag rather than a separate household, so sample toys
appear in the real library where a parent can actually try the product, while
staying removable in one action.

Three properties, each tested against real SQLite:

- *Unmistakable*: every seeded row is named with a visible "Sample" prefix.
- *Isolated*: removal deletes only flagged rows, so a test proves the family's
  own room, spot and toy survive untouched.
- *Idempotent*: seeding twice adds nothing, so a double tap or a retry after a
  dropped connection cannot produce two sample sets.

Removal clears play sessions referencing a sample toy first, because
`play_sessions.toy_id` is RESTRICT; a test would fail on the foreign key
otherwise. Samples can be re-seeded after removal, and removing nothing is
harmless.

Settings grows a "Sample toys" card, shown only when samples exist, stating the
count and that removing them leaves the parent's own toys untouched.

`/ready` is the completion screen with the brief's three actions. It reports
whether the library currently holds real toys or only samples, so a parent is
never unsure what they are looking at. Its counts are reassurance rather than a
gate: a failure to read them does not block leaving the screen.

## 9. Branch note

`claude/playmap-redesign-subagents-7748b2` holds an independent redesign built from the same base (`78f3910`) in a separate worktree. `feature/ai-assisted-toy-entry` contains its own, further-developed redesign plus the AI toy-entry work and the Pip rebrand. The two lines overlap substantially and are not merged. This work builds on `feature/ai-assisted-toy-entry` as the more advanced line. The other branch is left untouched; reconciling or retiring it is a separate decision.
