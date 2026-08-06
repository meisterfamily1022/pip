# PlayMap Landing Page, Accounts, and Child Profiles — Agent Brief

## 1. Purpose

This document is the product and implementation source of truth for adding:

- A public PlayMap landing page.
- A complete parent sign-up, sign-in, verification, and recovery flow.
- Optional account use where product architecture permits it.
- A family/household container.
- Multiple optional child profiles.
- Per-child Child Mode preferences and independent play state.
- Safe migration of the existing single-device, local-first PlayMap experience.

The implementation must be production-oriented. Static mockups, disconnected screens, fake persistence, or demo-only authentication do not satisfy this plan.

## 2. Product Summary

PlayMap is a visual toy-library app for families, especially children who experience decision overwhelm or benefit from predictable routines. Parents photograph toys, record where each toy belongs, and maintain a shared household toy library. Children use a low-demand visual flow to choose a toy, play, and see where it belongs during cleanup before choosing another.

The product must reduce cognitive demand. It must not turn ordinary childhood play into behavior tracking, advertising data, competition, or a clinical record.

## 3. Existing Product Context

The current product is an Expo/React Native application with TypeScript, SQLite/local persistence, Expo Router, Jest, and existing parent and child experiences. The agent must verify the repository rather than assuming every historical detail still applies.

Existing or previously specified capabilities include:

- Rooms and storage spots.
- Toy inventory with photos.
- Single and bulk image intake.
- In-app camera and photo-library intake.
- Search, filters, categories, hiding, and archiving.
- Parent Mode protected by a PIN.
- Child Mode with a small number of visual toy choices.
- Active play sessions and cleanup confirmation.
- Local-first behavior and restart persistence.

The new work must preserve working existing behavior unless this plan explicitly changes it.

## 4. Brand and Experience Direction

Use the current PlayMap name, logo, and blue wordmark already approved and present in the repository or supplied assets. Do not redraw, approximate, recolor, or replace the logo.

Visual direction:

- Warm cream base.
- Light pastel blush, peach, sage, mint, yellow, lavender, and restrained blue.
- Rounded, tactile cards and controls.
- Gentle illustration or environmental motifs.
- Calm, child-friendly, low-demand composition.
- High legibility and accessible contrast despite the pastel palette.
- Montserrat only if it is already the approved or installed product font; otherwise preserve the current canonical typography.

Avoid:

- Generic AI gradients, glowing orbs, glassmorphism, and floating phone mockups.
- Corporate SaaS dashboard styling.
- Dense feature grids and excessive badges.
- Primary-color toy-store styling.
- Dark forest-green styling.
- Decorative elements that compete with the primary action.

## 5. Product Principles

1. **Parent account first, child privacy always.** Children do not create accounts or credentials.
2. **One household library, multiple child experiences.** Toys, rooms, storage locations, and photos belong to the household, not to an individual child by default.
3. **Profiles are optional.** A parent may skip child setup, use Guest, or add profiles later.
4. **Accounts must provide a real benefit.** Backup, synchronization, recovery, or household sharing justify an account. Do not force an account solely for convention.
5. **Do not block evaluation.** Sample/demo exploration and an appropriate local-only path should remain available unless the audited architecture proves that doing so would be unsafe or incoherent.
6. **Collect the minimum data.** Do not request a diagnosis, exact birthday, legal name, address, school, therapy details, or behavior data.
7. **No silent data loss.** Existing local libraries must be preserved and explicitly associated with a household when an account is created.
8. **Accessibility is product behavior.** Large targets, screen-reader labels, predictable focus, reduced motion, contrast, and understandable error recovery are required.

## 6. Public Landing Page

### 6.1 Goal

Explain PlayMap quickly, show the real product, establish trust, and route the visitor to the correct current conversion action.

The agent must determine the actual release state from repository configuration and documentation. The primary CTA must point to the real available destination:

- App Store/download if live.
- TestFlight/beta invitation if configured.
- Early-access registration if not yet downloadable.
- Web sign-up only if a functioning web product exists.

Do not ship a dead or misleading CTA.

### 6.2 Navigation

- Current PlayMap logo.
- How It Works.
- For Families.
- Safety & Privacy.
- Sign In, only when web sign-in has a meaningful destination.
- Primary CTA: Get PlayMap, Join Early Access, or the verified equivalent.

Mobile navigation must be usable by keyboard, screen reader, and touch.

### 6.3 Hero

Headline:

> Less searching. Less overwhelm. More time to play.

Supporting copy:

> PlayMap gives families a simple visual library of the toys they already own—so children can choose what to play with, parents can find where it belongs, and cleanup becomes part of the routine.

Primary CTA: use the verified conversion action.

Secondary CTA:

> See How It Works

The visual should use authentic in-product screens or repo assets showing child choices, a toy location, cleanup guidance, and the parent library. Do not invent capabilities that are not implemented.

### 6.4 Core Sections

#### The problem

Heading:

> Finding a toy shouldn’t create more work than playing with it.

Explain:

- Toys disappear into bins and closets.
- Too many choices can overwhelm children.
- Parents become the household search engine.
- Cleanup instructions can be too abstract.

#### How it works

1. Photograph one toy or add several photos.
2. Connect each toy to its room, shelf, basket, or bin.
3. Offer a small, manageable set of visual choices.
4. Show where the current toy belongs before the next selection.

#### Designed for real families

- For children who need fewer choices.
- For homes where toys migrate.
- For routines that need less friction.
- For families with multiple children using one shared library.

Required family copy:

> Create a PlayMap for your whole family. Each child can have their own visual profile, choice settings, and play history while sharing one household toy library.

#### Feature preview

Only include verified or implemented features. The intended set is:

- Visual toy library.
- Bulk photo upload.
- In-app camera.
- Rooms and storage locations.
- Child Mode.
- Multiple child profiles.
- Per-child choice settings.
- Guest mode.
- Parent PIN protection.
- Cleanup guidance.
- Hidden and archived toys.
- Personalized toy suggestions.

#### Privacy

Heading:

> Your child’s play does not need to become advertising data.

Explain in plain language:

- Parent-controlled experience.
- No public child profiles.
- No social feed.
- No targeted advertising.
- Clear photo and data controls.
- Account deletion and data export.

Every privacy statement must match actual implementation. Do not claim that photos never leave the device if backup or synchronization uploads them.

#### Final CTA

> Give every toy a home—and every child an easier way to choose.

Use the same verified conversion destination as the hero.

### 6.5 Landing Page Quality

- Responsive from small phones through wide desktop displays.
- Semantic headings and landmarks.
- Keyboard navigation and visible focus.
- Meaningful alt text.
- No layout shift caused by unsized images.
- Reasonable performance and optimized assets.
- Metadata, social preview, favicon/app icon, canonical URL where known, and basic structured data where appropriate.
- Privacy and terms links must resolve to real pages or clearly labeled reviewed placeholders that do not make invented legal claims.

## 7. Account Strategy

The preferred product model is:

- Public landing page: no account.
- Product/sample exploration: no account where feasible.
- Single-device use: local-only option where feasible.
- Backup, sync, recovery, family sharing, or multiple devices: account required.

The agent must audit the actual system and select the lowest-risk architecture consistent with this product model. Reuse existing authentication, database, API, and deployment infrastructure if present. Do not add a second auth system or parallel canonical store.

If no backend exists, choose a maintainable production-capable approach that works with Expo and the repository’s deployment model. Keep provider-specific logic behind app-owned services so the product is not unnecessarily coupled to UI code. Implement the complete local development path and document only the external credential/deployment steps that truly cannot be performed from the repo.

## 8. Parent Account Flows

### 8.1 Create Account

Heading:

> Create your PlayMap

Required fields:

- Parent first name.
- Email.
- Password when using email authentication.

Supported methods should reuse what the chosen/authenticated platform reliably supports. Intended options:

- Continue with Apple.
- Continue with Google.
- Email and password.

Do not expose nonfunctional social-auth buttons. If provider configuration is unavailable, build the guarded integration and hide it until configured.

Require affirmative acceptance of linked Terms of Service and Privacy Policy. Never pre-check consent.

### 8.2 Verify Email

- Six-digit code or secure verification-link flow based on the selected canonical auth provider.
- Resend with rate-limit feedback.
- Change email.
- Clear success, expiration, and invalid-code recovery.
- Skip redundant verification when the trusted social provider already verifies email.

### 8.3 Family Space

Heading:

> What should we call your PlayMap?

Create one household/family container owned by the parent. Suggest a friendly default based on the parent’s first name, but allow neutral names such as Our PlayMap, The Playroom, or Home.

### 8.4 Optional Child Profiles

Heading:

> Who will use PlayMap?

Supporting copy:

> Create a simple profile so PlayMap can give each child the right number of choices and remember their play preferences.

Fields and settings:

- Display name or nickname.
- Avatar from a safe built-in set.
- Avatar accent color.
- Optional broad age range, never exact birthdate.
- Choice count: 1, 3, or 5.
- Reading support: pictures only; pictures and words; pictures, words, and spoken labels.

Actions:

- Add Another Child.
- Continue.
- Skip for Now.

### 8.5 Choose How to Begin

Heading:

> How would you like to start?

Options:

- Add our first toys.
- Explore with sample toys.
- Upload photos in bulk.
- I’ll set it up later.

Skipping must lead to a usable Parent Home, not a dead end.

### 8.6 Guided Setup

For parents who choose setup:

1. Add a room.
2. Add a storage location.
3. Photograph or upload the first toy.
4. Confirm toy details.
5. Preview the correct child or Guest experience in Child Mode.

Completion heading:

> Your PlayMap is ready

Completion copy:

> You added your first toy. Keep building the library now, or let your child explore whenever you’re ready.

Actions:

- Go to Parent Home.
- Add Another Toy.
- Preview Child Mode.

### 8.7 Sign-In and Recovery

Implement:

- Sign in.
- Forgot password.
- Password reset.
- Session restoration.
- Session expiration recovery.
- Sign out.
- Verified email change where supported.
- Offline-aware behavior.
- Actionable errors that do not reveal whether an unrelated email address has an account.

### 8.8 Account Data Controls

Implement parent-accessible:

- Export family data in a usable format.
- Delete account with clear confirmation, recent re-authentication where appropriate, and documented deletion semantics.
- Sign out without deleting local data accidentally.
- Clear distinction between deleting a child profile, removing a device’s local data, and deleting the entire account.

## 9. Multiple Child Profiles

### 9.1 Child Mode Entry

When Child Mode opens and profiles exist, show:

> Who’s playing?

Each child gets a large card with avatar, nickname, and optional color accent. No child credentials and no PIN are required. Include Guest.

Play Together may be implemented if the existing session model supports it safely. It is not required as a polished V1 user flow, but the session architecture must not prevent future shared sessions.

### 9.2 Per-Child State

Each profile must independently support:

- Choice count.
- Favorite categories or equivalent preferences if favorites exist.
- Recently played toys.
- Dismissed suggestions.
- Current active play session.
- Cleanup progress.
- Picture/text/audio presentation mode.
- Toy visibility.
- Recommendation history needed by the current algorithm.
- Optional calm-mode settings only if calm mode already exists or can be added without speculative clinical behavior.

One child’s selection, cleanup, history, or current session must not overwrite another’s.

### 9.3 Toy Availability

Toys belong to the household library. Parent-managed availability states:

- Everyone.
- Selected children.
- Parent only.
- Temporarily unavailable.

Preserve existing hidden/archive semantics and map them deliberately rather than creating contradictory flags.

### 9.4 Parent Settings

Add a Children area that supports:

- Add profile.
- Edit profile.
- Reorder profiles.
- Temporarily hide profile.
- Delete profile.
- Manage toy access.
- Adjust Child Mode preferences.
- View or clear that profile’s play history where history exists.

Deleting a child profile must never delete household toys, rooms, photos, or storage locations. Profile-linked play history should be deleted or anonymized according to the implemented privacy model after an explicit confirmation.

### 9.5 V1 Boundaries

Required:

- Multiple optional profiles.
- Nickname and avatar.
- Per-child choice count.
- Per-child active session and relevant history.
- Toy visibility by child.
- Profile selection on Child Mode entry.
- Guest mode.

Not required for this implementation:

- Sophisticated collaborative sibling recommendations.
- Turn-taking systems.
- Rewards, points, streaks, or leaderboards.
- Developmental or diagnostic profiles.
- Behavior scoring or sibling comparison.
- Child email accounts or cloud invitations.

## 10. Data and Migration Requirements

The agent must derive exact models from the repository. The target concepts are:

- Parent user/account.
- Household/family space.
- Household membership/role if multi-adult sharing is supported now or anticipated by the existing architecture.
- Child profile.
- Toy-to-child visibility/access relation.
- Play session associated with one child, Guest, or future multiple participants.
- Ownership/scope of rooms, storage spots, toys, photos, categories, and settings by household.
- Sync metadata only if the chosen architecture requires it.

Migration rules:

- Preserve all existing local records and identifiers where feasible.
- On first account connection, offer to keep the existing library local or attach/import it into the new household, consistent with available product paths.
- Import must be idempotent and restart-safe.
- Never duplicate toys or sessions on retry.
- Keep a durable migration/import state if remote sync is implemented.
- Define deterministic conflict handling for two devices. Prefer explicit versioning, updated timestamps, tombstones for deletions, or the repository’s existing mechanism.
- Never use last-write-wins blindly for destructive conflicts involving photos, toys, rooms, or active sessions.
- Add indexes and integrity constraints for household scope and active-session invariants.
- Do not reset a local or remote database.

## 11. Privacy and Security Requirements

- Enforce household authorization at the data/service boundary, not only in navigation.
- Never trust a household or child ID supplied by the client without membership validation.
- Store secrets in secure platform storage, not general async/local storage.
- Do not log passwords, tokens, verification codes, child names, image URLs, or raw profile payloads.
- Use rate limiting and abuse-resistant recovery behavior where the backend supports it.
- Make photo upload/storage behavior explicit.
- Ensure exports and deletion are authorized and scoped.
- Cover cross-household access attempts in tests.
- Do not invent claims of COPPA, GDPR, HIPAA, SOC 2, or other legal compliance. Implement privacy-supporting controls and identify counsel-review items separately.

## 12. Accessibility Requirements

- Minimum touch-target sizing appropriate to iOS, Android, and web.
- Screen-reader labels and roles for all controls, avatar choices, progress, errors, and image actions.
- Do not encode child identity or availability by color alone.
- Respect reduced-motion preferences.
- Support dynamic text without clipping critical controls.
- Visible keyboard focus on web.
- Sensible focus movement after validation errors, dialogs, and step transitions.
- Plain-language errors and recovery actions.

## 13. Definition of Done

The work is complete only when:

- The public landing page is responsive, branded, accessible, and connected to a real conversion destination.
- Parent registration, verification, family creation, optional profiles, setup choice, and completion work end to end.
- Sign-in, sign-out, recovery, session restoration, and account data controls work against the canonical implementation.
- Existing local data is preserved and migration/import behavior is tested.
- Multiple child profiles function independently.
- Child Mode profile selection and Guest mode work.
- Toy access rules are enforced in recommendations and not merely hidden in UI.
- Existing Parent Mode, toy intake, locations, sessions, and cleanup behavior still work.
- Loading, empty, offline, expired-session, partial-failure, and retry states are implemented.
- Targeted unit/integration tests pass.
- Full available typecheck, lint, tests, builds, and platform checks pass or every unrelated pre-existing failure is documented with evidence.
- Mobile, tablet, and desktop/web responsive QA has been completed for every changed surface.
- Documentation and environment examples are current and contain no secrets.

## 14. Agent Decision Authority

The implementing agent owns routine product, architecture, UI, copy, dependency, test, and refactoring decisions within this plan. It must inspect evidence, choose the strongest option, record the decision, implement it, test it, and continue.

The agent must not ask the human to choose among ordinary alternatives. It may stop only when proceeding would require:

- Destructive or irreversible loss of existing data.
- A database reset, dropped production data, or an unprovable destructive backfill.
- Direct live-production mutation that is not already explicitly authorized.
- Credentials, payment, legal acceptance, identity verification, or third-party administrative access unavailable to the agent.
- A material privacy or security decision with no safe reversible implementation.

When blocked only by an external credential or deployment step, the agent must finish all code, tests, configuration templates, and documentation that can be completed safely before stopping.
