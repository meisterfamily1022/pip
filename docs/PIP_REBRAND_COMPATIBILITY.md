# Pip rebrand compatibility inventory

PlayMap was renamed to Pip for customers. This inventory records the disposition of legacy naming so a future cleanup does not break installed apps, build tooling, links, or historical evidence.

## 1. Customer-facing names changed to Pip

- Expo and iOS display names, camera/photo permission explanations, web title, and web description.
- Onboarding, startup, recovery, not-found, Child Mode suggestion, photo-intake feedback, Settings privacy/reset copy, and destructive confirmation labels.
- Active customer, support, privacy, App Store, release, device-test, product-scope, asset, and AI product documentation.
- Tests that assert customer-facing labels or metadata.

The primary tagline, “Less deciding. More playing.”, is used in onboarding and web metadata. The supporting line, “Less mess. More play.”, is limited to the Settings data/cleanup context.

## 2. Internal identifiers safe to rename later

- Source filenames and symbols such as `playmap-theme`, `playmap-ui`, `reset-playmap`, `playmapTheme`, `resetPlayMapData`, and `ResetPlayMapResult` are internal implementation details. They are intentionally unchanged in this customer-facing pass to avoid unrelated import churn.

## 3. Persisted or externally significant identifiers retained

- npm package name and lockfile package identity: `playmap-mobile`.
- Expo project slug and generated development URL prefix: `playmap-mobile` / `exp+playmap-mobile`.
- URI scheme: `playmapmobile`.
- iOS bundle identifier: `com.meister23.playmapmobile`.
- EAS project ID.
- SQLite filename: `playmap-v1.db`; schema and migration identifiers remain unchanged.
- Secure/persisted keys: `playmap.parent-pin`, `playmap.child-mode-locked`, `playmap.ai.installation-credential.v1`, and `__playmapAiInstallationCredential`.
- Server/deployment contracts: `PLAYMAP_INSTALLATION_SIGNING_SECRET`, `__playmapDurableAiState`, API paths, payloads, and test fixtures for those contracts.
- Existing iOS Xcode project, target, product, scheme, CocoaPods target/support paths, source folder, bridging header, and entitlement filenames named `PlayMap`.
- Historical evidence paths under `.codex/visualizations`.

## 4. Items requiring backward-compatible migration

None are required for the visible rename. Renaming any item in section 3 requires a separately designed dual-read/dual-write or alias migration and release validation before removal of its legacy value.

## 5. Obsolete or historical references retained

- Redesign prompt packs, execution logs, dated audits/checklists, and their filenames retain PlayMap where they describe historical work or link to exact legacy filenames and evidence paths.
- Native project names remain build identifiers, not customer-visible labels; `CFBundleDisplayName` is Pip.

## Verification boundary

Web export can verify generated web metadata and visible web copy. iOS display name and permission prompts require a rebuilt native app; Android display name and permission prompts likewise require a rebuilt Android app. Existing-device data continuity must be tested on an upgraded native install before release.
