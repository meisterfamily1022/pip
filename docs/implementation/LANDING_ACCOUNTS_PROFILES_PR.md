# PR: Landing page, parent accounts, and child profiles

- Branch: `feature/playmap-landing-accounts-child-profiles`
- Base: `feature/ai-assisted-toy-entry` @ `2f5884c`
- Head: `2a3fc13`
- 13 commits, 90 files, +9,773 / −145

**Ready for human review. Not ready for release** — nothing has run on a device,
and two items need external configuration. Details below.

---

## What this adds

A public landing page, optional parent accounts, a household container, and
multiple child profiles. Twelve new screens and nine new API routes.

**The local-first promise is unchanged.** Pip still works with no account and no
internet connection, and toy photos still never leave the device. An account is
opt-in and exists only so backup, recovery, and multi-device use become possible
later.

### Screens

| Group | Screens |
|---|---|
| Public | `/` landing (web), `/privacy` |
| Auth | sign-up, verify-email, family-space, sign-in, forgot-password |
| Onboarding | start-choice, ready |
| Parent | account, children, edit-child |

### API routes

`/v1/auth/{sign-up, sign-in, verify, session, password-reset, reauthenticate,
account}`, `/v1/household`, `/v1/early-access`.

All inside the existing Expo Router server (`web.output: "server"`), following
the established `src/server/ai/**` pattern. **No new backend package.**

### Features

- Optional parent accounts: sign up, confirm email, sign in, recover password,
  change email, export data, delete account
- Household container owning rooms, storage spots, toys, and profiles
- Multiple child profiles with avatar, accent colour, broad age band, per-child
  choice count, and reading-support mode; add, edit, pause, reorder, delete
- Guest mode — a visitor plays without leaving permanent child data
- Per-child toy visibility: Everyone / Selected children / Parent only /
  Temporarily unavailable
- Sample toy library, clearly labelled and removable in one action
- Landing page with a truthful early-access CTA

---

## Security and privacy

| Area | Implementation |
|---|---|
| Passwords | scrypt, per-account salt, self-describing parameters so the work factor can rise later. Never logged. |
| Comparisons | `timingSafeEqual` throughout. |
| Session tokens | `expo-secure-store` on device; **memory-only on web**, never `localStorage`. |
| Revocation | Session is loaded on every request, so revoking takes effect immediately rather than at token expiry. |
| Enumeration | Sign-up, sign-in, reset, and email change all refuse to disclose whether an address is registered. Sign-in spends a decoy scrypt comparison so response *timing* does not leak it either. |
| Authorisation | Household membership re-derived server-side. A client-supplied household id is never trusted. |
| Toy visibility | Enforced in the SQL query, not the interface. Tests call the repository directly — the exact bypass a stale screen represents. |
| Logging | Audited every `console.*` in `src/server`, `src/features`, `src/services`. None carries a credential, token, code, address, or image path. |
| Export | Contains no password, hash, token, PIN, or code. Photos referenced by path, not embedded. |

### Two security fixes found during the final audit

1. **Parent PIN was stored in plaintext `localStorage` on web.** A `__DEV__`
   guard existed in V1 (`5e77e52`) and was dropped incidentally in a redesign
   commit (`21c5ae4`). That mattered little when web was a development target,
   but `web.output` is now `server` and the app ships publicly beside the
   landing page. Now held in memory on web, matching the session token. Trade: a
   browser reload forgets it. Child Mode's lock is a soft guard, not a security
   boundary.
2. **Dead `/privacy` link on the public landing page.** Now a real route,
   labelled a draft pending legal review, drawing its claims from the same
   module the landing page uses so the two cannot drift.

### Four ways of removing something, deliberately distinct

| Action | Where | What it removes |
|---|---|---|
| Sign out | Account | The session. Nothing deleted. |
| Delete a child profile | Children | That profile and its history. Never toys. |
| Reset Pip | Settings | This device only. Not the account. |
| Delete account | Account | The account only. Not the device's library. |

Verified by inspection: local reset never touches the account or session, and
account deletion never touches local data. Account deletion additionally
requires a **recent password confirmation**, not merely a valid session, and
revokes every session on every device.

---

## Migrations

Three new versions, **9 through 11**. All additive except one index swap that
drops and recreates an *index*, never a row.

| Version | Adds |
|---|---|
| 9 | `households`, `deleted_records` tombstones, `toy_child_visibility`; `household_id` on five tables with backfill; child profile preference columns; `toys.availability_scope`; Guest-safe active-session index |
| 10 | `is_sample` on rooms, storage spots, toys |
| 11 | `sync_operations` for durable, restart-safe import state |

Existing rows keep their identifiers. Hidden toys map to `parent_only`, so what
the flag already meant is preserved. The device-wide choice limit becomes each
existing child's own setting, so nobody's Child Mode changes shape on upgrade.

Migrations are exercised against **real SQLite** via Node's built-in
`node:sqlite`, not a hand-written fake, so constraints, backfills, and index
behaviour are verified rather than assumed.

---

## Test results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx expo lint` | clean |
| `npx jest --runInBand` | **37 suites, 371 tests, all passing** |
| `npx expo export --platform web` | succeeds |
| `npx expo-doctor` | 19/20 |

Baseline at branch start was 26 suites / 167 tests. This branch adds 11 suites
and 204 tests.

**The one Doctor failure is CocoaPods missing from this machine** — verified by
`which pod` returning nothing. `ios/` is gitignored. Host tooling, not a
repository problem.

---

## Known limitations

1. **Nothing has run on a device or simulator.** All verification is static:
   typecheck, lint, tests against real SQLite, and a web export. **Visual layout
   at real breakpoints, camera and photo-picker flows, and keyboard behaviour
   are unverified.** This is the largest gap.
2. **Email delivery is unconfigured.** Confirmation and password reset are
   implemented and tested against the `MailSender` interface, but nothing can be
   delivered. The affected screens say so plainly rather than leaving a parent
   waiting for a message that cannot arrive.
3. **Backup and sync have no remote transport.** The conflict policy,
   eligibility checks, tombstones, and durable import state are built and tested
   (`src/features/sync/**`), but there is no durable server-side store, so
   nothing leaves the device. **The landing page therefore makes no backup or
   sync claim, and a test enforces that.**
4. **Server storage is in-memory.** `LocalDevelopmentAuthStorage` is for
   development and tests. A durable implementation is required before
   production; the repository interfaces exist so it slots in without touching
   the service layer.

---

## Required deployment configuration

- `PIP_SESSION_SECRET` and `PIP_ONE_TIME_SECRET` — **required in production**;
  the server refuses to start without them
- A mail provider credential, plus a `MailSender` implementation
- A durable server-side store replacing `LocalDevelopmentAuthStorage`
- Optional: `PIP_APPLE_SIGN_IN_CLIENT_ID`, `PIP_GOOGLE_SIGN_IN_CLIENT_ID`.
  Buttons stay hidden while unset, so Pip never offers a method that cannot
  complete

See `.env.example`. Every key there is blank; no secret is committed.

---

## Device QA still needed

- [ ] Each onboarding path: add first toys, bulk upload, sample toys, set up later
- [ ] Camera and photo-picker on a real device, including a denied permission
- [ ] Child Mode with one profile, several profiles, and Guest
- [ ] Two children with simultaneous active toys
- [ ] Sign up → confirm → name household, and interrupting mid-flow
- [ ] Sign out, reset, profile deletion, account deletion — confirm each removes
      only what it says
- [ ] Export, then open the file
- [ ] Layout on small phone, large phone, and tablet, portrait and landscape
- [ ] Dynamic type at large sizes
- [ ] Airplane mode during sign-in and during startup

---

## Overlapping branch — no action taken

`claude/playmap-redesign-subagents-7748b2` is a **parallel redesign** that
diverges at `78f3910`, older than this branch's base. It touches 51 files and
overlaps this branch on at least ten, including `src/app/index.tsx`,
`(parent)/parent/home.tsx`, `(parent)/parent/settings.tsx`, and several
onboarding and child screens.

Both branches contain a redesign of the same screens, done independently. They
have **not** been merged or reconciled, and this PR does not touch that branch.

Recommendation: decide which redesign line is canonical before merging either.
Merging both without reconciliation would produce substantial conflicts in the
core screens. **Not merged or deleted — flagged only, as instructed.**

---

## Reviewing this branch

Commits map one-to-one onto the prompt pack, so the history is readable in
order. Suggested entry points:

- `docs/implementation/LANDING_ACCOUNTS_PROFILES_DECISION_RECORD.md` — every
  architectural decision and why, including two corrections to earlier findings
- `docs/implementation/LANDING_ACCOUNTS_PROFILES_QA_REPORT.md` — final audit
- `src/features/landing/landing-copy.ts` — every public claim, with
  availability flags and tests enforcing honesty
- `src/server/auth/auth-service.ts` — the account service
- `src/database/migrations.ts` — versions 9 to 11
