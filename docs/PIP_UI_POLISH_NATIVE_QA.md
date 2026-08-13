# Pip UI polish — native QA record

Date: 2026-08-13

Branch: `codex/pip-ui-polish`

## Release-like execution

- Xcode 26.6, iOS 26.5 simulator runtime, iPhone 17e.
- Release configuration, arm64 simulator target, Hermes bundle embedded by the
  React Native build phase.
- Metro was not running.
- The final runnable build used normal simulator ad-hoc signing. A deliberately
  unsigned compile succeeded, but SecureStore correctly rejected it because an
  unsigned app has no application identifier entitlement; it was not used for
  journey results.
- Fresh state was created by erasing the dedicated iPhone 17e simulator and
  reinstalling the app.

## Journey coverage

The signed build launched from fresh state and the welcome → parent PIN handoff
was exercised in the native app. Launch and relaunch both restored the expected
setup route. The first native screenshot exposed a clipped welcome footnote on
the narrow device; the footnote was moved into scrollable content and the
release build was rerun.

The remaining requested states are covered by the repository's deterministic
database/service/component checks, including setup and resume, children and
per-child choices, recommendation eligibility and refresh, partial location
metadata, missing images, active sessions, all cleanup transitions and persisted
steps, help/parent override, wrong/right PIN behavior, and migration/relaunch
state. The checked-in Maestro release flow was updated to the polished welcome
and child-profile labels so the full native sequence remains replayable where
the Maestro CLI is installed.

Automated gesture replay beyond the initial handoff was not available on this
host because the Maestro CLI is not installed. No production fixture, debug
route, bypass, or overlay was added to compensate.

## Repairs from this pass

- Kept the welcome's secondary action and reassurance reachable on a narrow
  iPhone by moving the reassurance out of the sticky action footer.
- Made the grown-up cleanup confirmation handle a toy with no saved location as
  a complete sentence instead of composing an instruction fragment.
- Updated the release onboarding Maestro assertions to current product copy.

## Physical-device remainder

VoiceOver speech cadence, real camera/photo-library permission presentation,
hardware keyboard interactions, and final touch/contrast judgment still require
a physical iPhone. These do not require a repository change identified by this
pass.
