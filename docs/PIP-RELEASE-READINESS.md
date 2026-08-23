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

## Release sequence

Run in order, reading the output of each before starting the next.

```bash
git checkout main && git merge --no-ff claude/pip-staging-schema-qa-b5f72d
```
```bash
npx tsc --noEmit && npx eslint src --ext .ts,.tsx && npx jest
```
```bash
npx supabase link --project-ref owfpxnbyzuohygxlqgrg && npx supabase db diff --linked
```
```bash
npx supabase db push --linked && npx supabase functions deploy delete-account --project-ref owfpxnbyzuohygxlqgrg
```
```bash
npx eas build --platform ios --profile production
```
```bash
npx eas submit --platform ios --latest
```

Two things to check before running those, both of which are easier to prevent
than to undo:

1. **Production has never had these migrations applied.** Read the `db diff`
   output before the `db push`. It is the only genuinely hard-to-reverse step
   in this sequence.
2. **The production build reads `.env.local`, and the main checkout's copy
   points at production.** This worktree's copy points at staging and must not
   travel with the build. Confirm which project the file names before building.
