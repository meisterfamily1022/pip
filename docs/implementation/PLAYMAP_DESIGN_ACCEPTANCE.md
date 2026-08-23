# PlayMap Design Acceptance

Date: 2026-08-05  
Evidence: `/Users/sarahmeister/.codex/visualizations/2026/08/06/019fd489-78fd-7c33-9239-4a3cc21ad566/playmap-prompt-6`

This acceptance pass used the web build from the authoritative main checkout. Representative phone (390 px), tablet (768 px), and desktop web (1280 px) widths were inspected. No iOS simulator, Android emulator, or physical device was available, so native safe-area, keyboard, Dynamic Type, VoiceOver/TalkBack, permission-sheet, camera, and status-bar acceptance remains explicitly unverified.

| Screen / route | States and sizes checked | Findings and repairs | Remaining limitation |
| --- | --- | --- | --- |
| Onboarding welcome | Initial, CTA; phone/tablet/desktop | Desktop CTA was excessively wide and the hero lacked a focal point. Constrained shared footer content and added a token-based pastel toy-block illustration; corrected a clipped-block regression in the second pass. | Native safe areas and large text unverified. |
| Parent PIN setup | Empty, validation error, filled; desktop | Error remains inline, value is preserved, progress and hierarchy are clear. | Native secure-entry keyboard unverified. |
| Child profile setup | Empty, valid; desktop | Single-task hierarchy and back/continue controls accepted. | Native keyboard overlap unverified. |
| First location setup | Empty, helper/example, valid; desktop | Converted raw-looking helper copy to secondary text and prevented a phantom error row. | Native keyboard overlap unverified. |
| Parent Home | No/one active checkout, recovery confirmation; phone/tablet/desktop | Active child/toy/location and recovery action are prominent; cards wrap without horizontal overflow. | Confirmation rendered with web semantics, not a native alert. |
| Child selector | Multiple profiles; desktop | Removed duplicate Parent Mode and chooser headings; retained one clear page title and large child targets. | Screen-reader traversal needs device confirmation. |
| Toy Library | Empty/populated, search, filters, active marker; phone/tablet/desktop | Search, filter, empty-state CTA, thumbnails, badges, and add action accepted. Filter sheet scrolls within its bounded viewport. | Native modal focus trap unverified. |
| Add Toy / bulk review | Empty manual entry, queued, incomplete, saved, disabled save, camera unavailable; phone/tablet/desktop | Bulk counters, per-item validation, thumbnails, retry/remove controls, and partial-save state are visible. Moved manual camera feedback next to the action that produced it instead of above a long batch. | Native camera/library/compression behavior unverified. |
| Edit Toy | Populated and photo-less; desktop | Existing selections, thumbnail removal, save, and destructive section remain distinct. | Native picker cancellation unverified. |
| Locations | Populated, room without storage, navigation; phone/desktop | Room/storage hierarchy, empty child state, and add controls accepted. | Native list/safe-area behavior unverified. |
| Add/Edit room | Empty, valid, dependent-record conflict; desktop | Specific labels, validation, and conflict messaging accepted. | Native keyboard behavior unverified. |
| Add/Edit storage | Empty, valid, dependent-record conflict; desktop | Disabled Room textbox looked editable. Replaced it with a shared read-only value primitive with an accessibility label and no textbox semantics. | Native screen-reader announcement unverified. |
| Settings | Multiple profiles, select/add/rename, PIN change, reset confirmation; phone/desktop | Child management, security, and reset are visually separated; destructive reset is confirmation-gated. | Native authentication persistence unverified. |
| Child Home | Normal and active-toy shortcut; phone/desktop | Greeting, choice hierarchy, and parent-return affordance accepted. | Large Dynamic Type unverified. |
| Categories | All play types; phone/tablet/desktop | Phone uses one low-demand column; tablet/desktop use a balanced grid with large targets and no overflow. | Native reduced-motion setting unverified. |
| Suggestions | Results and refresh; phone/tablet/desktop | Photo-led cards, locations, play actions, and refresh affordance accepted. | Live native image decode/performance unverified. |
| Toy detail | Photo-less, available, checkout conflict copy covered by tests; phone/desktop | Primary checkout action and location context accepted. | Race conflict is primarily a repository/test state because normal UI excludes active toys. |
| Current toy | Active toy; phone/desktop | Large empty desktop panel diluted focus. Centered the active card and constrained it to a readable width. | Native restart rendering unverified. |
| Cleanup | Steps, success path; phone/desktop | One decision per screen, large actions, and clear progress accepted. | Haptics/native navigation unverified. |
| Parent return | Empty PIN, wrong PIN, success; desktop | Inline error preserves entry; parent route guard and return action accepted. | Native secure storage unverified. |
| Permission state | Web camera unavailable with library alternative; phone/desktop | Specific platform limitation and recovery path sit adjacent to the triggering control. Permanent native denial has settings guidance in tested logic. | Actual OS permission dialogs/settings deep link unverified. |
| Confirmation states | Checkout cleanup, archive/hide/delete/reset and dependency conflicts; desktop plus tests | Specific confirmations and recovery/cancel paths are distinct from ordinary actions. | Native alert layout unverified. |
| Fallback/error/loading | Unknown route; startup error/retry and loading semantics covered by tests | Unknown route has branded recovery; startup retry clears stale error/loading state. | Loading transitions are too brief for stable screenshot capture. |

## Second-pass result

The repaired screens were revisited after reload at desktop width, then representative routes were crawled again at phone and tablet widths. No clipping or horizontal overflow was observed. Browser warning inspection found only Metro disconnect warnings corresponding to intentional clean server restarts; no application render, invalid DOM/SVG, style, or runtime errors were captured.

## Native acceptance pass — iOS Simulator

Date: 2026-08-21
Device: iPhone 17 Pro, iOS 26.5 (simulator `E7216BF1-6663-47C6-9DC2-D2651722D275`), debug dev client on Metro from this branch.

The original pass above ran on the web build and, correctly, refused to claim
native acceptance. A simulator is now available, so the native-only column of
that table was re-checked directly. This section records what was checked on
device; the web table above is unchanged.

| Native item the table left open | Result |
| --- | --- |
| Safe areas, Dynamic Island, home indicator | Checked on Parent Home, Library, Add toys, Settings, Children, Add/Edit child, bulk review. Content clears the Dynamic Island; the sticky footer CTA and tab bar clear the home indicator. No clipping or horizontal overflow. |
| OS camera permission sheet | Real sheet shown, with the app's own purpose string: "Pip lets you take toy photos for your local toy library." The app shows adjacent progress text while the sheet is up. |
| Permanent camera denial and recovery | Denying produces "The camera is switched off" with numbered recovery steps, an "Open iPhone Settings" action, and "Choose from Photos instead". |
| Settings deep link | Opens iOS Settings with a "◀ Pip" return affordance. Observed landing on the Settings root rather than the Pip pane on a simulator whose app pane did not yet exist; not investigated further. |
| Native confirmation layout | The delete-profile confirmation renders as an in-app modal, not a UIAlert, with both actions reachable and the destructive action distinct. |
| Photo-led surfaces | Parent Home hero photo, Library card thumbnail, and the bulk review photo slot all render at native scale without distortion. |
| Native text entry | See the finding below. |

### Found and fixed on device

Typing a nickname with repeated spaces stored the name verbatim, so the
children list rendered a gap wide enough to read as two separate names. Names
are now stored collapsed on add and rename (`9fd493e`), which also keeps the
stored name consistent with the rule the uniqueness index uses.

`RoundedTextInput` now defaults to no autocorrect, no spellcheck, and word
capitalisation, since every field it backs holds a name a family chose.

### Still not claimed

- **iOS "." shortcut.** Two spaces becomes a period. This is a system keyboard
  setting with no per-field UIKit trait, so the app does not suppress it.
  "Sam. Smith" therefore remains a different name from "Sam Smith" — correct,
  but worth knowing.
- **Software keyboard avoidance.** The simulator was driven by hardware
  keyboard, so the software keyboard never covered a field. Keyboard overlap on
  the name, PIN, room, and toy fields remains unverified.
- **VoiceOver, Dynamic Type, reduced motion, haptics.** Not exercised; the
  accessibility props are covered by component tests only.
- **Physical device.** Simulator only. Camera capture itself cannot be
  exercised without hardware.
