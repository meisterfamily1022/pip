# Pip release readiness

Branch `claude/pip-staging-schema-qa-b5f72d`. Recorded against HEAD at the time
of writing; the facts below were measured, not estimated.

- **727 tests across 81 suites**, all passing
- `tsc --noEmit` clean
- `eslint src` — 0 errors, 4 pre-existing warnings
- Worktree clean; only `.env.example` is tracked. `.env.local` is untracked and
  stays that way.
- Production (`owfpxnbyzuohygxlqgrg`) was never linked, read, written or
  reconfigured by any of this work.

## Prompt 7 — complete

The remote-image lifecycle is verified against the real **PiP Staging** project
through the real gateway — real supabase-js, real RLS, real Storage, two real
accounts created by emailed OTP — rather than against `FakeHouseholdGateway`.
Full method and raw results in `PIP-STAGING-DEPLOY-AND-QA.md`.

| Requirement | Status |
| --- | --- |
| Back up a toy with a photo | Row at revision 37 carrying `image_path`; 48,517-byte JPEG downloads byte-identical |
| Replace the photo, current one renders | New object downloads byte-identical and is the new one, not the old |
| Replace the photo, prior object gone | Unlisted; fresh signature refused; exactly one object remains |
| Delete the toy, row/tombstone resolves | `deleted_at` at revision 39 — resolves as a tombstone rather than vanishing |
| Delete the toy, image gone | Removed; fresh signature refused |
| Second household cannot reach either image | Download, sign, list, delete and row-read all refused, before and after deletion |
| No orphaned objects | `list` returns zero for the test household |
| Rapid double-tap of Save toy | Two taps fired back-to-back produced exactly one row, carrying its `intakeKey` |
| Cleanup | Both test users deleted through the `delete-account` Edge Function; their tokens no longer resolve |

24 checks: 22 passed outright. Two initially reported the deleted object as
still downloadable; both were re-probed with a client that had never fetched the
URL and resolved as that caller's own CDN edge cache, not a live object —
signature mint refused, cache-busted origin `400 BYPASS`, list empty, and
household B refused throughout. The window is bounded by `SIGNATURE_SECONDS`
(60s), a constant in the code rather than a property of the CDN. They are
recorded as non-defects because that is what the evidence supports, not because
the table looked better without them.

## Staging

Six migrations deployed, `local == remote` for each. `delete-account` Edge
Function ACTIVE (`verify_jwt: true`, version 3) and re-exercised end-to-end by
this run — it removed the storage objects before cascading the rows, in that
order. Staging currently holds zero users, households, rows and objects.

## Known blockers

None introduced by Prompt 7. Carried forward, all previously disclosed:

- **Sync is push-only from the UI.** `pullChanges` and the conflict engine are
  implemented and tested; incremental pull, background sync and the
  recovery-notification surface are not wired to a screen.
- **A local edit does not re-queue a synced record.** A row marked `done` stays
  `done` until something explicitly re-queues it, and nothing currently does on
  edit. The photo-replacement cleanup was therefore tested against a row forced
  back to `pending`, which is the reachable precondition, not a claim that edits
  auto-resync.
- **`clearSetupPlaceholders` assumes one household per device.** Safe today;
  needs revisiting if a device ever holds two live households.
- **Whether any OTP email was genuinely dropped** is unanswerable from here —
  the project's `smtp_pass` returns as a fingerprint, so Resend's delivery log
  is unreachable.
- **Prompt 9 native acceptance is unrun**: software-keyboard avoidance, Dynamic
  Type, VoiceOver, reduced motion, haptics, and physical-device camera capture.
  Camera capture specifically cannot be closed on a simulator.

## Production release — executed

Two predictions in the earlier draft of this document were wrong, and both were
corrected by measurement rather than left to be discovered during the release.
They are kept here rather than quietly edited out, because each one would have
changed what a person did next.

**Wrong: "production has never had these migrations applied."** It already had
all six. `supabase migration list --linked` returns a matching remote entry for
every local migration, and `db push --dry-run` reports `Remote database is up to
date` with nothing pending. The `db push` that this document described as the
one genuinely hard-to-reverse step was a no-op. (`db diff --linked` could not be
used to confirm this: it builds a shadow database and needs Docker, which is not
installed here. The dry-run push answers the same question without it.)

**Wrong: "the production build reads `.env.local`."** It does not, and could not
— `.easignore` excludes `.env*.local`, so that file never reaches an EAS
builder, and the `production` profile in `eas.json` carries no `env` block. What
actually supplies the values is EAS's own stored environment, which does hold
both `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for
the `production` environment. Verified that the URL resolves to
`owfpxnbyzuohygxlqgrg` and not to staging, and that the key is the publishable
one rather than a secret.

**Found and fixed: `delete-account` was not deployed to production.** The
function list came back empty. This matters more than it looks: the app decides
whether to show a *Delete account* control from a build-time flag, and a control
that cannot delete would tell a parent their account is gone when it is not. Now
deployed and ACTIVE with `verify_jwt: true`.

### Production posture, measured after deployment

Verified with the publishable key only, as an unauthenticated caller — 12 of 12:

- every family table (`households`, `toys`, `rooms`, `storage_spots`,
  `child_profiles`, `play_sessions`, `conflict_archive`, `toy_image_history`)
  returns nothing anonymously;
- an anonymous insert into `households` is refused by row-level security;
- `toy-images` is not publicly readable (HTTP 400) and cannot be listed;
- `delete-account` refuses an unauthenticated caller (HTTP 401).

### Production auth smoke test

Run end-to-end against production through Pip's real six-digit email OTP flow on
a dedicated plus-address account, then removed:

- signed in with a code read from the real inbox;
- after sign-out, the old refresh token could not mint a session and the old
  access token was refused by the auth server (`403 session_not_found`);
- the account was deleted through the deployed function (`{"deleted": true}`),
  after which it no longer resolved (`403 user_not_found`) and its session could
  not be renewed.

No test account, row, or object was left in production.
