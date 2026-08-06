# Landing, Accounts, and Child Profiles — Final QA Report

Prompt 11 output. Branch `feature/playmap-landing-accounts-child-profiles`.
Date 2026-08-06.

## Verdict

**Ready for human review, not for release.** Every prompt in the pack is
implemented, every automated check passes, and the two outstanding items are
external configuration rather than defects. Nothing has been run on a device or
simulator; see Limitations.

## Checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx expo lint` | clean |
| `npx jest --runInBand` | 37 suites, 371 tests, all passing |
| `npx expo export --platform web` | succeeds; 10 API routes, all screens |
| `npx expo-doctor` | 19/20 |

Baseline at Prompt 0 was 26 suites / 167 tests. This branch adds 11 suites and
204 tests.

The single Expo Doctor failure is **CocoaPods not installed on this machine** —
host tooling, not a repository problem, and not fixable from here.

## Defects found and fixed

### 1. Dead privacy link on the public landing page (P1)

The footer linked to `/privacy`, which did not exist. The brief requires privacy
links to resolve to a real page or a clearly labelled placeholder; a 404 on a
public marketing page is worse than no link.

Fixed by building `/privacy` as a real route. It draws its claims from
`landing-copy.ts`, the same module the landing page uses, so the two cannot
drift. It is labelled a draft pending review and makes no legal claim.

Footer links now live in `landingFooterLinks`, and a test asserts every target
has a route file behind it. **The test was verified to fail when the route is
deleted**, so it is not passing vacuously.

### 2. Parent PIN stored in plaintext `localStorage` on web (P2)

`pin-storage.ts` wrote the four-digit parent PIN to `window.localStorage` on
web, readable by any script on the page.

History shows a `__DEV__` guard was added in `5e77e52` and removed in `21c5ae4`,
a redesign commit — incidental, not a deliberate security decision. It mattered
little while web was a development target, but `web.output` is now `server` and
the app is served publicly beside the landing page.

Fixed by holding the PIN in memory on web, matching how the account session
token is already handled. Trade: a browser reload forgets it. Child Mode's lock
is a soft guard, not a security boundary, and the native app is the shipping
product.

### 3. Five Expo SDK patch mismatches

`expo`, `expo-file-system`, `expo-image-picker`, `expo-router`, `expo-symbols`
were behind. Fixed with `npx expo install --fix`; all checks re-run clean.

## Security review

| Area | Finding |
|---|---|
| Password storage | scrypt, per-account salt, self-describing parameters. Never logged. |
| Comparisons | `timingSafeEqual` throughout. |
| Session tokens | Secure store on device; memory-only on web, never `localStorage`. |
| Revocation | Session loaded on every request, so revocation is immediate. |
| Account enumeration | Sign-up, sign-in, reset, and email change all refuse to disclose. Sign-in spends a decoy scrypt comparison so timing does not leak either. Tested. |
| Cross-household access | Membership re-derived server-side; a client-supplied household id is never trusted. Tested. |
| Toy visibility | Enforced in the query. Tests call the repository directly — the exact bypass a stale screen represents. |
| Sensitive logging | Audited every `console.*` in `src/server`, `src/features`, `src/services`. None carries a credential, token, code, address, or image path. |
| Deletion authorisation | Requires recent password confirmation, not merely a session. Revokes all sessions. Tested. |
| Export contents | No password, hash, token, PIN, or code. Tested. |
| Open redirects | Two `Linking.openURL` calls, both to fixed internal paths from a typed constant. |

## Accessibility review

Swept every file containing `<Pressable>` or `<TextInput>` under `src/app`,
`src/components`, `src/features`: **every Pressable carries an
`accessibilityRole`, and every TextInput carries a label** (the one exception is
the landing honeypot, which is deliberately hidden from assistive technology).

Beyond that: error summaries announce, consent is never pre-checked, paused
profiles are labelled in words rather than by colour, avatars differ by shape
and motif as well as colour, and reorder controls carry distinct spoken labels
naming the child.

## Landing claim validation

Every claim is data in `landing-copy.ts` with an `available` flag, and only
available features render. All twelve are now true. Enforced by test:

- no "PlayMap" in user-facing copy
- no download offer (there is no App Store listing)
- **no present-tense backup or sync claim** — still correct, since sync has no
  transport
- "toy photos stay on your device" — still literally true
- no COPPA, GDPR, HIPAA, or SOC 2 claim

## Limitations

1. **Nothing has run on a device or simulator.** All verification is static:
   typecheck, lint, unit and integration tests against real SQLite, and a web
   export. Visual layout, responsive behaviour at real breakpoints, camera and
   photo-picker flows, and keyboard behaviour are **unverified**. This is the
   largest gap and the first thing a human should do.
2. **Email delivery is unconfigured**, so confirmation and reset cannot be
   exercised end to end by a real person.
3. **Backup and sync have no remote transport**, so multi-device behaviour
   cannot be exercised at all.
4. Tests use in-memory server storage. A durable implementation is still needed
   before production.

## Before release

- [ ] Run the app on a device and walk each flow
- [ ] Configure a mail provider
- [ ] Set `PIP_SESSION_SECRET` and `PIP_ONE_TIME_SECRET`
- [ ] Replace in-memory server storage with a durable implementation
- [ ] Legal review of `/privacy`, currently a labelled draft
- [ ] Install CocoaPods to clear the last Expo Doctor check
- [ ] Decide the fate of `claude/playmap-redesign-subagents-7748b2`, a parallel
      redesign branch that overlaps this line of work
