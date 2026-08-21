# PiP Staging deployment and live QA

Project: **PiP Staging**, ref `jghynqqzqgdzcyhgfhsw` (us-west-2).
Run on 2026-08-21 UTC. Production (`owfpxnbyzuohygxlqgrg`) was not touched:
nothing in this run read or wrote it, and its configuration is unchanged.

## What was deployed

| Item | Result |
| --- | --- |
| `20260811000000_profiles.sql` | applied |
| `20260812000000_analytics_entitlements.sql` | applied |
| `20260812010000_staff_analytics_reporting.sql` | applied |
| `20260812020000_analytics_data_rights.sql` | applied |
| `20260820000000_toy_photo_storage.sql` (new) | applied |
| `delete-account` Edge Function (new) | deployed, ACTIVE, `verify_jwt: true` |

Staging held no migrations at all before this run — all five rows in
`supabase_migrations.schema_migrations` were created here.

## Verified against the live project

Every check below was run against staging through the Management API or the
public REST/Storage/Functions endpoints, not against a local copy.

- **Schema.** All five migrations recorded. Nine tables in `public`.
- **RLS.** Enabled on all nine. `profiles` has owner-only select and update;
  `analytics_consents`, `analytics_profiles` and `household_entitlements` have
  owner-scoped policies. `telemetry_events`, `analytics_installations`,
  `analytics_deletion_audits`, `staff_report_audits` and `product_configuration`
  carry no policies, so they are deny-all to `anon` and `authenticated` and are
  reachable only through the `security definer` functions. That is the intended
  shape, confirmed rather than assumed.
- **Bucket.** `toy-photos`, private, 10 MB limit, MIME allow-list of
  jpeg/png/webp/heic/heif, with four owner-scoped policies on `storage.objects`
  keyed on the first path segment.
- **Function.** Rejects an unauthenticated call at the gateway (401) and a
  non-POST method in the handler (405).
- **Triggers.** Creating a user produced its `profiles` row and a `free`
  `household_entitlements` row.

## Live QA

Three real accounts were created on staging, driven through the public API with
the publishable key — the same endpoints the app calls. All three were deleted
at the end; staging now holds zero users, zero profiles and zero objects.

**Email OTP through Resend SMTP.** Seven messages were sent from
`no-reply@mail.piptoys.app` and six arrived in a real inbox. Sign-up and sign-in
were both completed end to end using the six-digit code read out of the
delivered email, not a code obtained out of band.

- sign-up: code from the delivered email → `/auth/v1/verify` → confirmed user,
  access and refresh tokens issued.
- sign-in for a returning account: same, on a separate account.
- reusing a consumed code, and a wrong code, both return
  `Token has expired or is invalid` — the response `authError` maps to
  `OTP_INVALID_OR_EXPIRED`, so that mapping is now confirmed against the live
  service rather than inferred.
- the 60-second per-address send limit returned `over_email_send_rate_limit`,
  which `authError` maps to `RATE_LIMITED`.

**Sign out, then into a second account.** Sign-out returned 204 and the old
access token was rejected with 403 immediately afterwards. A second account was
then signed in and its session issued normally.

**Image upload, download, deletion, and isolation.**

- upload 200; download 200 and byte-identical to the file uploaded.
- anonymous download refused.
- upload under another account's prefix refused by RLS.
- `text/plain` refused by the bucket's MIME allow-list (415).
- the second account could not download, list or delete the first account's
  photo, and saw only its own row through PostgREST.
- owner delete returned 200 and removed the row from `storage.objects`.

**Account deletion.** The deployed function deleted the caller's account and its
two photos in one call (`{"deleted":true,"removedPhotos":2}`). Afterwards the
account's token was rejected by the auth API (403 `user_not_found`) and by the
function itself (401); its photo returned `NoSuchKey`; and `auth.users`,
`profiles` and `household_entitlements` were all empty of it while the other
account was untouched.

## Defects found and fixed during the run

1. **OTP length did not match the app.** Staging issued eight-digit codes while
   the app's confirm screen accepts exactly six (`maxLength={6}`), so a real
   parent could not have entered the code at all. Staging's `mailer_otp_length`
   was set to 6. **Production almost certainly has the same mismatch and should
   be checked** — it was deliberately not inspected here.
2. **The email carried a link, not a code.** Staging was on the stock
   confirmation template, which sends `{{ .ConfirmationURL }}`. The app never
   reads a link; it asks for a typed code. The confirmation and magic-link
   templates were replaced with ones that render `{{ .Token }}`. Note the auth
   service took several minutes to pick the new templates up, while
   `mailer_otp_length` propagated immediately.

## Defects found and not fixed

3. **A deleted photo stays downloadable from the CDN.** After a successful
   delete the row is gone from `storage.objects`, but a subsequent fetch
   returned the file with `cf-cache-status: HIT`. Anyone who fetched a photo
   before it was deleted can keep fetching it until the edge copy expires. This
   also weakens account deletion. When photo upload is built, set a short or
   absent `cacheControl` on upload rather than relying on the default.
4. **A deleted account's JWT is still structurally accepted.** PostgREST
   answered `200 []` rather than 401 for a token belonging to a deleted user,
   because the token stays cryptographically valid until it expires. Nothing
   leaked, since RLS matched no rows, but a table with a permissive policy would
   leak for up to the token lifetime.
5. **One message in seven was silently dropped.** A sign-up mail that GoTrue
   recorded as sent (`confirmation_sent_at` was written, so SMTP accepted it)
   never arrived; a retry ninety seconds later arrived in two seconds. Worth
   watching in the Resend dashboard before relying on first-attempt delivery.

## Not tested, because it does not exist yet

The brief asked for QA of backup and restore. There is no backup or restore in
this codebase, and no "skip collision" fallback to remove. `src/features/sync/`
implements eligibility, a durable per-record import queue, tombstones and a
conflict policy, but states plainly that no remote transport ships yet, and the
landing copy is tested to never claim otherwise. Photo upload and download were
exercised directly against the bucket for the same reason: the app stores photos
as local `file://` URIs and has no upload path.

Account deletion is likewise not reachable from the app —
`deleteAccount()` in `src/features/auth/auth-client.ts` still throws
`UNSUPPORTED`. The Edge Function it needs now exists and is verified, so wiring
that call up is the remaining work.
