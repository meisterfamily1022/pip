# PiP Staging: deployment, app integration, and live QA

Branch `claude/pip-staging-schema-qa-b5f72d`. Project **PiP Staging**, ref
`jghynqqzqgdzcyhgfhsw`. Production (`owfpxnbyzuohygxlqgrg`) was never linked,
read, written, or reconfigured.

## Where the earlier work went

Nothing was lost, overwritten, or misreported. The sync service, image
pipeline, remote gateway, CAS protocol, restore orchestration and the ~587-test
suite are all committed on **`claude/pip-completion-prompt-pack-663f83`**, in
its own worktree at `.claude/worktrees/pip-completion-prompt-pack-663f83`, 13
commits ahead of `main` and clean.

This branch was cut from `main`, which does not contain those 13 commits.
Working only from what `main` held, an earlier pass in this session concluded
that backup and restore "did not exist" and rebuilt two pieces of them. That
conclusion was true of this branch and wrong about the project — sibling
branches were never checked before concluding a feature was absent.

The two lineages are now merged (`83741c4`). Everywhere they overlapped the
prompt-pack implementation was kept and the duplicate dropped:

| Overlap | Kept | Why |
| --- | --- | --- |
| household-scoped uniqueness | their migrations 17–18 | also covers rollback when a rebuild fails partway |
| `delete-account` function | theirs | resolves households by `owner_id`, cleans `toy-images` — the real schema |
| photo bucket | their `toy-images` | the duplicate `toy-photos` bucket was removed from staging |
| household-scope tests | their `room-household-scope.test.ts` | strictly wider than the duplicate block, which was deleted |

### Test counts

| Ref | Test files | Tests |
| --- | --- | --- |
| `main` | 58 | 480 |
| this branch before the merge | 59 | 490 |
| `claude/pip-completion-prompt-pack-663f83` | 72 | 599 |
| this branch now | 76 | 647 |

480 → 490 was `main` plus ten tests written here. 599 was the other lineage.
Neither number was ever a reduction of the other; they are different ancestors.

No coverage was silently removed. Every `*.test.ts(x)` present on `main` and on
the prompt-pack branch is still present here — verified by set difference, both
empty. One deliberate deletion: the ten-test `household-scoped uniqueness` block
written here was dropped in favour of `room-household-scope.test.ts`, which
covers the same two defects plus partial-rebuild rollback. That is why the merged
total is 647 rather than 599 + 10 + later work.

## Deployed to staging

Six migrations, `local == remote` for every one:
`20260811000000`, `20260812000000`, `20260812010000`, `20260812020000`,
`20260819000000` (household backup schema), `20260821000000` (retires the
duplicate bucket's policies).

`delete-account` Edge Function: ACTIVE, `verify_jwt: true`, version 3.

Two statements in the backup migration could not run as the migration role and
were fixed rather than worked around: `alter table storage.objects enable row
level security` (owned by `supabase_storage_admin` — now asserts instead of
sets, so a project without RLS still fails the deploy loudly), and deleting a
`storage.buckets` row (blocked by a trigger — the bucket goes through the
Storage API, and the migration drops the policies, which is the part that makes
it unreachable).

## App integration

The sync layer had **no callers**: nothing in `src/app` or `src/features`
outside `src/features/sync/` imported the service, the gateway or the image
pipeline. Account & data now has a *Back up your library* card that runs the
real thing. Wiring it up surfaced seven defects that no unit test could have
caught, because every one of them lives in a seam a fake had been standing in
for:

1. **camelCase vs snake_case.** The service names record fields one way and the
   backup schema names columns the other. The gateway spread records straight
   into PostgREST and handed raw rows straight back, so a push sent columns that
   do not exist and a restore read fields that are not there — `Number(undefined)`
   is `NaN`, so every storage spot, toy and play session would have failed its
   insert as an unexplained skip. `record-columns.ts` translates both ways,
   against an allowlist checked against the columns actually deployed.
2. **Play sessions were never queued.** `planLibraryImport` omitted them, so a
   restore brought back the toys and none of the play history the home screen is
   built around.
3. **Photo upload sent nothing.** `fetch(file://).blob()` produces a Blob that
   supabase-js uploads as an empty body. Bytes now come from expo-file-system.
4. **Photo download wrote nothing.** The same Blob problem on the read side, via
   `arrayBuffer()`. `File.downloadFileAsync` writes the response to disk.
5. **Restore was unreachable.** Setup requires a room, a spot and a child before
   Account & data can be opened, and eligibility refused any household that had
   any of them — so on a new iPhone, the one device the feature exists for, the
   answer was always no. It now refuses only a device with toys or play history
   of its own, and offers to replace a setup-created room and child behind an
   explicit confirmation, clearing them only after every photo is already on disk.
6. **A backup never recorded who it belonged to.** `remote_id` was set and
   `owner_account_id` left null, so the sign-out warning told a parent their
   library was not linked immediately after they had backed it up, and account
   deletion's local cleanup — which matches on `owner_account_id` — silently did
   nothing.
7. **A replaced photo went to the wrong table.** `conflict_archive`'s CHECK
   accepts only the two reasons that carry content; a replaced photograph is a
   path and belongs in `toy_image_history`. Sending it to `conflict_archive`
   failed the whole record, so a toy whose photo had been replaced on two devices
   could not be backed up at all.

## What was run on the device

iPhone 17 Pro simulator, iOS 26.5, app built from this branch against staging.

- **Setup from a clean install** — PIN, child, room, spot; one toy added from the
  photo library with a real 2.6 MB photograph.
- **Sign-up by emailed code** — code read out of the real inbox, typed into the
  app's confirm screen. Sign-out, then a second account signed in the same way.
- **Backup** — four records and the photograph, verified in staging: the toy row
  with correct snake_case columns and `{pretend}` categories, and a 2,654,055-byte
  `image/jpeg` in `toy-images` under the household id.
- **Restore onto an emptied device** — the confirmation appeared, the setup room
  and child were replaced, and Playroom / White shelf / Maya / Baby Doll came back
  with the photograph rendering on the home screen as a byte-identical JPEG.
- **Two-account isolation** — signed in as the second parent on a device linked
  to the first, every write was refused by RLS and staging was unchanged. The app
  now says so once, before attempting anything, instead of reporting four
  unexplained failures.
- **Deletion from the UI** — PIN gate refused a wrong PIN with "Your account was
  not deleted" and the account survived. With the right PIN: staging went to zero
  users, zero households, zero rows and **zero storage objects**; the device
  cleared `remote_id`, `owner_account_id`, `household_sync_state`,
  `sync_operations` and `deleted_records`; and the family's toy, room and child
  stayed on the phone.
- **Resend UX** — the new cooldown was exercised live: "A new code is on its way
  to …" and a disabled *Send another code in 36s*.

Staging currently holds zero users, zero households and zero objects.

## Photo deletion and token residual, measured

**Photos.** The CDN keeps serving whichever URL was fetched before an object was
deleted — to the caller that fetched it, never to anyone else, and never to an
anonymous request (both answered `400 / cf-cache BYPASS` throughout). No
`cacheControl` value on upload prevents it: across three trials the stale
response survived deletion twice and was refused once, so it cannot be designed
around. What *is* deterministic:

- a **newly minted** signature is a URL nothing has fetched, so it always reaches
  the origin — and once the row is gone the mint itself fails (`404 NoSuchKey`);
- `list` after deletion returns `[]`;
- a cached signature is refused with `InvalidJWT` the moment it expires, three
  trials of three.

So downloads go through a fresh 60-second signature and uploads set `no-store`.
Sixty seconds is the entire residual window, and it is a number in the code
(`SIGNATURE_SECONDS`) rather than a property of the CDN.

**Tokens.** Deleting a user does not revoke tokens already issued, and "RLS
returns nothing" is not revocation. Measured on the orphaned access token:

| Surface | Result |
| --- | --- |
| `/auth/v1/user` | 403 `user_not_found` |
| `delete-account` | 401 |
| refresh-token grant | 400 `refresh_token_not_found` — the session cannot be renewed |
| PostgREST | **200 `[]`** — accepted, matching nothing |
| Storage list | **200 `[]`** — accepted, matching nothing |

Nothing leaks today because no policy is broader than owner-only, but a future
table with a wider policy would be exposed for the remainder of the token's life.
Staging `jwt_exp` is therefore cut from 3600 to 900, and the auth-server
existence check lives in `supabase/functions/_shared/authenticate-caller.ts` so a
new Edge Function inherits it by import rather than by remembering.

## Email delivery: correcting an earlier conclusion

An earlier version of this document stated that delivery "stopped entirely" at
~05:36 UTC, based on messages no longer appearing in the connected Gmail
mailbox. **That conclusion was wrong.** The account holder confirmed, while the
run was still going, that the codes were arriving. What stopped was the
mailbox connector surfacing new mail — an observation channel, not the mail
service.

Two consequences worth stating plainly, because they change what is and is not
known:

- The "delivery stopped" claim is withdrawn. It described the instrument.
- The earlier intermittent drops — two of roughly nine messages, one of which
  arrived on a retry ninety seconds later — were observed through that same
  channel, so they are no longer solid evidence of a Resend-side problem
  either. They may have been the same indexing gap.

What is still true and independently verified:

- Sender alignment is correct. DKIM at `resend._domainkey.mail.piptoys.app`,
  SPF and the SES feedback MX on Resend's `send.mail.piptoys.app` return-path
  domain, DMARC `p=quarantine` with relaxed alignment at the org domain, so
  both mechanisms align. This was read from DNS, not from a mailbox.
- Every send in this run was accepted by GoTrue and recorded
  (`confirmation_sent_at` / `recovery_sent_at`).
- Codes read from the real inbox completed sign-up and sign-in through the
  app's own confirm screen.

**Open, and needing the Resend dashboard:** whether any message was genuinely
dropped. That cannot be settled from here — the project's `smtp_pass` comes back
from the Management API as a fingerprint rather than the `re_…` key, so Resend's
delivery log, suppression list and quota are unreachable. This is the one item
the QA run cannot close on its own.

A separate, self-inflicted note for anyone repeating this QA: calling
`admin/generate_link` regenerates the account's token and silently invalidates
whatever code was already emailed. Doing that while someone is reading the code
out of their inbox makes a valid code look wrong. Either read the emailed code
or generate one, never both.

The app-side mitigations stand on their own regardless of what the Resend log
says, because they address what a parent experiences when a code does not
arrive: the confirm-code screen counts the 60-second cooldown down instead of
letting the only affordance on screen produce `over_email_send_rate_limit`; a
failed send does not start a cooldown; the confirmation names the address so an
empty inbox is unambiguous; and after three sends the screen stops implying
another press will help and says what to check instead. It names a support
channel only when `EXPO_PUBLIC_PIP_SUPPORT_CONTACT` is set, because this
repository configures none.

## Final UX pass, verified on the device

Two fixes requested after the main run, both confirmed in the app against
staging:

1. **A restored library now reports itself as backed up.** The Account card
   counts the queue rather than trusting a flag — right, because a flag can read
   "backed up" while sixty toys sit unsent — but a restored device has an empty
   queue, so a parent whose library had just come back was told "Everything is
   backed up — 0 records". A restore now records each applied row as `done`;
   every one is demonstrably on the server at the revision just pulled. Verified:
   immediately after restoring, the card reads **"Everything is backed up — 4
   records"**, and a subsequent backup sends nothing rather than resending a
   library nothing changed.
2. **The cooldown covers the first code, not just resends.** The first code is
   requested on the sign-in screen, one screen earlier, so screen-local state
   began at "nothing sent yet" and left the button enabled for the press most
   likely to hit the server's per-address limit. The send is now recorded in
   `otp-send-log` where it is known to have been accepted, and the confirm screen
   reads it on mount. Verified: arriving at the confirm screen after a single
   send shows **"Send another code in 42s"**, disabled. The attempt count is
   persisted alongside it, so the escalating guidance counts every code sent to
   the address rather than only those sent from the mounted screen.

A third defect surfaced while verifying the first two and is fixed with them:
unlinking cleared the queue and the cursor but left `toys.image_synced_fingerprint`
— a claim that a photograph is already in a bucket that no longer holds anything
for this device. The next backup skipped the upload as unchanged and wrote a toy
row with **no `image_path` at all**, so the photo was not stale but silently
absent, and a later restore would have brought the toy back without its picture.
Reproduced against staging before the fix (`image_path: null`, zero storage
objects), and confirmed fixed after (`image_path` set, one object).

Suite after this pass: **659 tests across 77 suites**, tsc clean, eslint 0 errors.

## Still open

- **Whether any email was genuinely dropped** — above. Needs the Resend
  dashboard; not answerable from here.
- **Sync is one-way from the app.** `pullChanges` and the conflict engine are
  implemented and tested, and the UI drives push and a full restore. Incremental
  pull, background sync and the recovery-notification surface are not wired to
  any screen yet.
- **`clearSetupPlaceholders` assumes a single device household.** It deletes the
  household's rooms, spots and children after eligibility has established there
  are no toys and no play. That is safe today; it would need revisiting if a
  device ever holds two live households at once.
- **Photo reads stay servable for up to 60 seconds after deletion.** Bounded by
  `SIGNATURE_SECONDS` and enforced by signature expiry, as measured above. Lower
  the constant to shrink the window; it cannot be driven to zero from the client.

## Prompt 7: live staging regression for remote-image lifecycle

Run against **PiP Staging** (`jghynqqzqgdzcyhgfhsw`) through the real
supabase-js client, real RLS and real Storage — the same calls
`supabase-household-gateway.ts` makes, not `FakeHouseholdGateway`. Two real
accounts, created by emailed OTP: household **A** (`…+pip-p7-a`) and household
**B** (`…+pip-p7-b`). Production (`owfpxnbyzuohygxlqgrg`) was not linked, read,
written or reconfigured.

**24 checks: 22 passed outright, 2 resolved as the already-measured CDN
residual rather than defects — see below. No check failed on its merits.**

| Stage | Proven |
| --- | --- |
| Back up a toy with a photo | household row created; 48,517-byte JPEG uploaded under `<household_id>/`; toy row carries `image_path` + `image_uploaded_at` at revision 37; photo downloads **byte-identical** |
| Replace the photo | replacement uploaded; row re-pointed at the new object; **prior object deleted only after the row was confirmed pushed**; prior object no longer listed; exactly one object remains; current photo downloads byte-identical and is the new one, not the old |
| Delete the toy | `deleted_at` written (revision 39), so the remote row resolves as a tombstone rather than vanishing; the toy's image removed; a freshly minted signature for it is refused `Object not found` |
| Second household | B cannot download, cannot sign, cannot list A's folder, **cannot delete** A's image (it survived B's `remove()` intact), and cannot read A's toy rows — every answer empty or refused, before *and* after deletion |
| Orphans | `list` for the test household returns **zero objects** after the cycle |
| Cleanup | both test users deleted through the `delete-account` Edge Function (`{"deleted": true}`); their tokens no longer resolve |

### The two non-defects, disambiguated rather than waved through

Immediately after deletion, `.download()` still returned bytes **to the same
client instance that had fetched that URL before deletion**. That is the
per-caller CDN edge cache already measured in this document, not a live object.
Proven by re-probing with a client that had never fetched it:

```
fresh signature mint      : REFUSED (Object not found)
fresh-client download     : REFUSED (Object not found)
cache-busted origin probe : 400 BYPASS
list                      : 0 object(s)
```

The object is gone at origin. Household B was refused throughout, so nothing
leaked to anyone else. The window is bounded by `SIGNATURE_SECONDS` (60s) and is
a constant in the code, not a property of the CDN.

### Manual add: real rapid double-tap

Two taps fired back-to-back on **Save toy** in the simulator, no wait between
them. Library reported "Search 2 toys", and the device database held exactly one
new row:

```
1|Prompt7 Toy A|manual-1787405956965-igd5d4namnq
2|DoubleTapProbe|manual-1787443508828-177cgospyls
```

One `DoubleTapProbe` row, carrying the per-screen `intakeKey` the fix
introduced. The protection is at the service/database layer, so it holds
whether or not the button had been disabled in time.
