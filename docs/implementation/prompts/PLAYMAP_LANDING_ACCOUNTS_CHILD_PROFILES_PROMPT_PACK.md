# PlayMap Landing Page, Accounts, and Child Profiles — Autonomous Prompt Pack

## Controller Inputs

```txt
Loop controller: docs/implementation/prompts/GENERIC_PROMPT_LOOP_CONTROLLER.md
Plan document: docs/implementation/prompts/PLAYMAP_LANDING_ACCOUNTS_CHILD_PROFILES_BRIEF.md
Prompt document: docs/implementation/prompts/PLAYMAP_LANDING_ACCOUNTS_CHILD_PROFILES_PROMPT_PACK.md
Expected branch: create or reuse feature/playmap-landing-accounts-child-profiles; do not interrupt unrelated user work on another branch
Schema mode: OPEN
Allowed scope: public landing page; parent authentication and account lifecycle; household/family space; optional local-only/sample entry; existing-local-library migration; multiple child profiles; per-child preferences, visibility, sessions, and Child Mode entry; required APIs/services/data model/tests/docs
Out of scope: rewards; points; diagnoses; behavior scoring; child accounts; sophisticated sibling recommendation blending; unrelated product redesigns
Canonical models/services: discover from the repository in Prompt 0; extend existing canonical paths and do not create parallel stores
Max files per prompt: 30, excluding generated files, migrations, snapshots, and necessary route files
```

## Authority Override for This Pack

This section is more specific than generic loop-controller stop language and controls this implementation.

You are the implementation decision-maker. Do not ask the human to select architecture, auth provider, page structure, naming, UI details, components, dependencies, test strategy, migration mechanics, or routine product behavior. Inspect the repository and authoritative documentation, compare the viable choices, select the best fit, record the decision briefly, implement it, and continue.

Treat ambiguity as an investigation task, not a reason to stop. Treat failing tests as a repair loop, not a reason to stop. Treat ordinary additive schema work as implementation, not a gate. Treat unrelated dirty work as something to preserve and work around, not an automatic stop.

You may create focused commits after each completed prompt if repository policy permits. Never push, open a pull request, deploy, publish, purchase, accept legal terms, or mutate live production unless the starting instruction explicitly authorizes it.

### Hard stops are limited to

- A proposed operation would irreversibly delete or corrupt existing user or production data.
- A database reset, destructive migration, unprovable destructive backfill, or live manual data alteration is genuinely required.
- Completing the remaining work requires unavailable secrets, identity verification, payment, legal acceptance, or third-party administrator action. Finish everything else first.
- No safe, reversible implementation exists for a material privacy or security issue.
- Repository state makes it impossible to preserve overlapping uncommitted user changes after trying safe isolation.

Do not stop merely because:

- The repository differs from this brief.
- A technology or provider choice is not named.
- Tests fail.
- Typecheck, lint, or build fails.
- A dependency is missing.
- An additive migration is needed.
- More than one reasonable implementation exists.
- External deployment credentials are absent.
- A mock, existing bug, or incomplete screen is discovered.
- The work is larger than initially expected.

For those cases, investigate, decide, implement, repair, document, and continue. If an external credential prevents live verification, implement a testable adapter, configuration validation, `.env.example` entries without secrets, and exact final setup instructions.

## Global Execution Loop

For every prompt:

1. Re-read the active sections of the brief and inspect the current implementation.
2. State the active scope and likely touched files.
3. Re-check branch and dirty state; preserve all unrelated work.
4. Implement the smallest coherent production slice that completes the prompt.
5. Run targeted tests and relevant static checks.
6. Inspect the changed UI at phone, tablet, and desktop widths when applicable. Use screenshots or the project’s available browser/device tooling.
7. Review security, privacy, accessibility, offline behavior, and failure recovery for the changed paths.
8. Fix every in-scope defect found, then rerun the affected checks.
9. Repeat review → test → fix until no known in-scope failures remain or a narrowly defined true hard stop is reached.
10. Record decisions and evidence in the loop-controller completion format, then continue automatically.

Never substitute a written recommendation for implementation when repository access permits implementation.

---

# Prompt 0 — Repository, Architecture, and Product-State Audit

Do not modify product behavior until this audit is complete. Documentation updates and the working branch are allowed.

1. Read all repository instructions, the loop controller, this prompt pack, and the full brief.
2. Inspect the repository structure, package manifests, Expo/React Native configuration, router, persistence, API/backend code, auth, environment handling, deployment configuration, tests, design tokens, existing logo/assets, and relevant product docs.
3. Establish the real current state of:
   - Landing/public-web surfaces.
   - Release status and valid CTA destinations.
   - Account/authentication infrastructure.
   - Local database/schema and migrations.
   - Canonical room, storage, toy, category, settings, and play-session models/services.
   - Bulk upload and camera flows.
   - Parent PIN and Child Mode.
   - Existing child/profile concepts.
   - Network/offline behavior.
   - Tests, CI, preview, and build commands.
4. Run baseline typecheck, lint, targeted/full tests as appropriate, Expo Doctor or equivalent, and a web/native build smoke test where feasible. Record pre-existing failures precisely.
5. Identify current uncommitted changes and preserve them. Do not discard, overwrite, or reformat unrelated work.
6. Decide the target architecture. Reuse canonical infrastructure. If none exists, select a production-capable solution compatible with Expo, existing deployment, local-first behavior, secure session storage, and household-scoped synchronization. Do not create parallel auth or data sources.
7. Decide whether the landing page belongs inside the existing Expo web app, an existing web package, or a focused new package in the same repository. Favor the least operational complexity that still provides strong SEO, accessibility, performance, and deployment behavior.
8. Define the migration/sync strategy for existing local data, idempotency, conflicts, deletions, and offline writes.
9. Create or update a concise implementation decision record inside the repository. Include:
   - Audited current state.
   - Chosen architecture and why.
   - Canonical models/services.
   - Data migration and rollback strategy.
   - Security/privacy boundaries.
   - CTA/release-state decision.
   - Exact validation commands.
10. Convert any architectural uncertainty into explicit, reversible assumptions and continue. Stop only under the narrow hard-stop rules above.

Exit criteria:

- The agent can name the canonical paths it will extend.
- The target auth/data/landing architecture is chosen.
- The migration path preserves existing local data.
- Baseline failures are distinguished from new failures.
- The remaining prompts can be executed without asking the human routine questions.

---

# Prompt 1 — Foundations, Tokens, Routes, and Shared Primitives

Implement the shared foundation required by all later prompts.

1. Reconcile the current PlayMap design system with the brief. Reuse the approved logo asset and existing canonical tokens.
2. Add or refine shared accessible primitives needed for:
   - Public navigation and CTA buttons.
   - Auth fields, password reveal, validation, notices, and error summaries.
   - Step/progress presentation.
   - Avatar and color selection.
   - Empty/loading/offline/error states.
   - Confirmation dialogs.
3. Establish the route groups and guards for public, unauthenticated, authenticated parent, onboarding, and Child Mode surfaces.
4. Prevent redirect loops and blank screens during session restoration or offline startup.
5. Add stable analytics/event hooks only if a canonical privacy-respecting analytics system already exists. Do not introduce child-targeted tracking or a new analytics vendor solely for this work.
6. Add accessibility coverage for labels, focus, dynamic text, keyboard use, and reduced motion.
7. Add unit/component tests for shared state and routing behavior.
8. Run the global execution loop until clean.

Exit criteria:

- Later screens can use one consistent, accessible component system.
- Public/auth/onboarding/parent/child routing has deterministic guards.
- The current brand is preserved.

---

# Prompt 2 — Production Data Model and Safe Migrations

Implement the canonical data foundation selected in Prompt 0.

1. Add or extend the minimum models needed for parent accounts, household/family space, child profiles, toy-to-child visibility, and per-child/shared-ready sessions.
2. Scope all household data consistently. Add foreign keys, indexes, uniqueness constraints, and invariants appropriate to the actual database technology.
3. Preserve current identifiers and existing records wherever feasible.
4. Map existing hidden/archive/unavailable behavior into one coherent availability model. Do not leave contradictory sources of truth.
5. Make the session design support one child, Guest, and future multiple participants without requiring the polished Play Together flow now.
6. Implement a versioned and restart-safe local migration. If remote sync exists or is added, implement an idempotent local-to-household import intent/result flow that cannot duplicate records on retry.
7. Implement safe deletion/tombstone/conflict semantics appropriate to the chosen architecture. Do not apply blind destructive last-write-wins behavior.
8. Add migration, integrity, idempotency, retry, rollback/compatibility, and cross-household isolation tests.
9. Generate clients/artifacts required by the repository and update all schema copies.
10. Run the global execution loop until clean.

No human approval is needed for additive tables, nullable fields, indexes, join tables, safe defaults, generated clients, or provable backfills. Stop only before a destructive or unprovable data operation.

Exit criteria:

- Existing libraries open after migration without data loss.
- Household and profile scope is enforced in the data layer.
- Re-running migration/import produces no duplicates.
- One child’s active session cannot overwrite another’s.

---

# Prompt 3 — Authentication, Session Security, and Account Services

Implement production-capable parent authentication using the architecture chosen in Prompt 0.

1. Implement app-owned auth services/adapters for create account, sign in, sign out, verification, resend, password recovery/reset, session restoration, email change where supported, and recent re-authentication for sensitive actions.
2. Store tokens/secrets in secure platform storage. Never log credentials, tokens, codes, child data, or image URLs.
3. Implement household membership authorization at the server/service boundary for every protected read and write.
4. Add rate-limit/error normalization and enumeration-resistant recovery copy.
5. Implement deterministic behavior for offline startup, expired sessions, revoked sessions, partial provider outages, and retry.
6. Support configured Apple/Google sign-in if available. If provider credentials are absent, complete the guarded integration and hide nonfunctional buttons. Do not block the rest of the work.
7. Add environment validation and secret-free examples.
8. Add service and route tests including cross-household access denial, expired tokens, revoked sessions, replay/idempotency where relevant, and offline recovery.
9. Run the global execution loop until clean.

Exit criteria:

- Parent auth works end to end in the available environment.
- Protected data cannot be accessed by changing a household or child ID.
- The UI can distinguish loading, signed out, expired, offline, and authenticated states.

---

# Prompt 4 — Public Landing Page

Build the complete public landing page defined in the brief.

1. Use the current approved PlayMap logo and brand assets. Do not generate or approximate a replacement.
2. Implement the header, hero, problem, how-it-works, real-family stories, verified feature preview, privacy section, final CTA, and footer/legal navigation.
3. Use authentic product imagery/screens from the repository. If screenshots must be generated, run the product with representative non-sensitive fixture data and capture them. Do not show impossible UI or fake features.
4. Connect CTAs to the release destination verified in Prompt 0. If early access is the only real option, implement the functional existing signup destination or the production-capable form/API selected in Prompt 0 with consent, validation, spam resistance, success, duplicate, and failure handling.
5. Add real Sign In navigation only if it leads somewhere meaningful.
6. Add correct metadata, social preview, icon links, canonical URL when known, and structured data where appropriate.
7. Optimize images, prevent layout shift, and preserve good loading performance.
8. Verify semantics, keyboard navigation, focus, contrast, reduced motion, and responsive layouts at representative phone, tablet, laptop, and wide-desktop sizes.
9. Add tests for navigation, CTA destination, form behavior if present, and core accessibility semantics.
10. Run the global execution loop until clean.

Exit criteria:

- There are no dead CTAs or misleading release claims.
- The page looks unmistakably like PlayMap, not a generic AI/SaaS template.
- The page works and remains legible across target sizes and input methods.

---

# Prompt 5 — Parent Sign-Up, Verification, and Family Creation

Implement the first half of onboarding as real connected flows.

1. Build Create Your PlayMap with parent first name, email, password when applicable, provider methods that are actually configured, password requirements, Terms and Privacy consent, and accessible validation.
2. Implement email verification using the selected provider’s secure canonical mechanism. Include resend, expiration, invalid-code/link, change-email, and success behavior.
3. Build family-space creation with a friendly suggested name and editable neutral alternatives.
4. Ensure retries do not create duplicate households, memberships, or partially orphaned accounts.
5. Resume correctly after app termination, browser refresh, offline interruption, verification link return, or partial completion.
6. Never collect child details during parent account creation.
7. Add integration tests for success, validation, duplicate email, provider error, interruption/resume, idempotent household creation, and accessibility.
8. Inspect and fix keyboard avoidance, autofill, password-manager behavior, focus order, dynamic text, and narrow-screen layout.
9. Run the global execution loop until clean.

Exit criteria:

- A new parent can create, verify, and enter a household without duplicate state.
- Interrupted onboarding resumes at the correct durable step.

---

# Prompt 6 — Multiple Child Profiles and Parent Management

Implement optional child profiles and their Parent Mode management.

1. Build the onboarding Who Will Use PlayMap step with nickname, built-in avatar, accent color, optional broad age range, choice count 1/3/5, and reading-support mode.
2. Support Add Another Child, Continue, and Skip for Now.
3. Add the Children section in Parent Settings with add, edit, reorder, hide/unhide, delete, toy-access management, preferences, and play-history controls supported by the canonical data model.
4. Do not collect exact birthdays, diagnoses, schools, therapy details, legal names, or child credentials.
5. Implement child deletion semantics so household toys, rooms, photos, categories, and storage locations are preserved. Require explicit confirmation and perform the selected delete/anonymize behavior for linked history.
6. Prevent duplicate profiles and inconsistent ordering during rapid taps, retry, offline queue replay, or restart.
7. Do not encode profile identity or state by color alone.
8. Add data/service/component/integration tests for multiple profiles, edit, reorder, hide, delete, history behavior, offline/retry, and household isolation.
9. Run the global execution loop until clean.

Exit criteria:

- Profiles are optional and manageable later.
- Multiple profiles persist independently.
- Deleting a profile never deletes shared household inventory.

---

# Prompt 7 — Setup Choice, Guided Setup, Sample Mode, and Local-Only Path

Implement onboarding completion without forcing full household setup.

1. Build How Would You Like to Start with:
   - Add our first toys.
   - Explore with sample toys.
   - Upload photos in bulk.
   - I’ll set it up later.
2. Connect guided setup to the canonical room, storage, camera/photo, toy confirmation, and Child Mode preview flows. Reuse existing implementation rather than cloning it.
3. Make sample data unmistakably sample content, isolated from real household records, resettable, and incapable of contaminating sync or analytics.
4. Preserve an appropriate local-only entry path if selected in Prompt 0. Make the backup/sync tradeoff clear without coercive copy.
5. Implement the Your PlayMap Is Ready completion screen and all three actions.
6. Resume correctly after interruption and avoid duplicated rooms, storage spots, or toys during retries.
7. Ensure skip leads to a functional Parent Home with helpful empty states.
8. Add end-to-end or high-value integration tests for each start path and interruption/retry cases.
9. Run the global execution loop until clean.

Exit criteria:

- Every setup choice reaches a usable destination.
- No path forces unnecessary configuration.
- Existing capture, bulk intake, and location behavior remain canonical.

---

# Prompt 8 — Child Mode Profile Selection and Independent Play State

Implement the multi-child Child Mode experience.

1. When profiles exist, show Who’s Playing? with large accessible cards and Guest.
2. When no profiles exist, use the brief’s simplest safe Guest/default entry without forcing Parent Mode setup.
3. Apply the selected profile’s choice count and reading-support mode to Child Mode.
4. Scope recent toys, dismissed suggestions, recommendation history, current session, and cleanup state to the selected profile or Guest context.
5. Enforce toy availability for Everyone, Selected Children, Parent Only, and Temporarily Unavailable in the canonical recommendation/query service, not only in UI filtering.
6. Preserve archive/hidden behavior and exclude toys already unavailable under existing session rules.
7. Prevent one profile’s session or cleanup from overwriting another’s. Define and test the behavior when a physical toy is already active in another child’s session.
8. Keep Parent Mode PIN protection intact and verify all escape/back/restart paths.
9. Ensure the data model remains compatible with future shared sessions. Implement Play Together only if it is low-risk and already naturally supported; do not delay the required V1 for it.
10. Add service, recommendation, component, navigation, restart, and concurrency regression tests.
11. Run the global execution loop until clean.

Exit criteria:

- Each profile gets the correct choices and independent active state.
- Guest works without creating hidden permanent child data.
- Access rules cannot be bypassed through stale UI or direct service calls.

---

# Prompt 9 — Existing Local Library Connection, Sync, and Conflict Recovery

Complete the transition from the existing local-first product to the selected account model.

1. Implement the chosen flow for keeping a library local or connecting/importing it to a household.
2. Make import durable, idempotent, resumable, and observable to the parent without exposing technical internals.
3. Preserve toy photos, rooms, storage locations, categories, settings, hidden/archive state, and session/history data to the extent supported by current canonical data.
4. Implement deterministic multi-device conflict handling where sync is in scope. Treat deletion, moved toys, edited locations, photos, and active sessions deliberately.
5. Add pending-sync, offline, retry, partial-success, conflict, and recovered states.
6. Do not claim backup or sync on the landing page or UI until this path genuinely works.
7. Add tests for first import, interrupted import, repeated import, partial upload, retry, conflicting edits, deletion, offline changes, and no-data-loss recovery.
8. Run the global execution loop until clean.

Exit criteria:

- Existing users can adopt accounts without losing or duplicating their library.
- Sync claims match actual behavior.
- Failures are recoverable without database surgery.

---

# Prompt 10 — Sign-In, Recovery, Account Settings, Export, and Deletion

Finish the parent account lifecycle.

1. Build sign-in and forgot/reset-password flows with accessible validation and enumeration-resistant messaging.
2. Implement signed-out, expired-session, revoked-session, offline, and provider-outage recovery.
3. Add parent account settings for verified email change where supported, sign out, data export, local-data controls, and delete account.
4. Make the distinctions among sign out, remove local device data, delete child profile, and delete account unmistakable.
5. Require recent authentication and explicit confirmation for account deletion.
6. Implement export in a usable, documented format containing the parent’s household data and excluding secrets/internal tokens.
7. Implement or accurately document the canonical server-side deletion lifecycle, including photos, retained operational records if legally necessary, and visible pending/completed/error states. Do not invent legal retention requirements.
8. Ensure sign out does not silently destroy unsynced local data.
9. Add integration/security tests for recovery, export authorization, cross-household denial, re-authentication, deletion, retry, and unsynced-data protection.
10. Run the global execution loop until clean.

Exit criteria:

- The full account lifecycle is functional and recoverable.
- Destructive actions are explicit and correctly scoped.
- Export and deletion are authorized and tested.

---

# Prompt 11 — Full-System QA, Security, Accessibility, and Release Readiness

Conduct an autonomous final audit. Do not merely report defects; fix every in-scope defect and rerun the affected validation.

1. Run all available unit, integration, route/service, component, migration, and end-to-end tests.
2. Run repository-wide typecheck, lint, formatting check, Expo Doctor/equivalent, web build, native configuration checks, and any existing CI-equivalent commands.
3. Test fresh install, existing-data upgrade, signed-out local use, new account, verification, multiple children, each onboarding path, Child Mode, concurrent sessions, sign out/in, recovery, export, deletion, offline/retry, and app restart.
4. Crawl every changed route and interactive control. Look for broken navigation, dead buttons, clipped content, keyboard obstruction, stale state, infinite loading, duplicate submission, unhandled promise rejection, and inaccessible dialogs.
5. Inspect at representative small phone, large phone, tablet, laptop, and wide desktop sizes. Test portrait and landscape where the product supports them.
6. Perform a targeted security review for auth bypass, insecure token storage, household/child ID tampering, cross-household access, unvalidated uploads, sensitive logging, open redirects, recovery enumeration, and deletion/export authorization.
7. Perform an accessibility review for semantics, screen-reader names, focus order, contrast, dynamic type, reduced motion, keyboard-only use, error association, and target sizes.
8. Validate every landing-page feature/privacy claim against the final product. Remove or rewrite claims that are not yet true.
9. Review performance for startup, landing assets, large toy libraries, many child profiles, bulk photos, and recommendation queries. Fix material regressions.
10. Update README/setup/environment/migration/release documentation with exact commands and remaining external configuration steps. Never include secrets.
11. Repeat audit → fix → rerun until:
    - All new and affected tests pass.
    - All in-scope static/build checks pass.
    - No known P0/P1/P2 defect remains in the implemented scope.
    - Any unrelated pre-existing failure is documented with command output and evidence that this branch did not cause it.
12. Produce the loop controller’s final report with:
    - Decisions made.
    - All files and migrations.
    - Commands and results.
    - Automated and manual QA evidence.
    - Security/privacy/accessibility findings and fixes.
    - External configuration still required.
    - Known low-severity limitations.
    - Exact branch/commit state.
    - Whether the branch is ready for human review.

Do not push, deploy, publish, or open a PR unless separately authorized.

---

# One-Time Starting Instruction

All three documents are committed under `docs/implementation/prompts/`. Give the implementing agent this message:

```txt
Read these files in full and treat them as the execution contract:

1. docs/implementation/prompts/GENERIC_PROMPT_LOOP_CONTROLLER.md
2. docs/implementation/prompts/PLAYMAP_LANDING_ACCOUNTS_CHILD_PROFILES_BRIEF.md
3. docs/implementation/prompts/PLAYMAP_LANDING_ACCOUNTS_CHILD_PROFILES_PROMPT_PACK.md

Expected branch: feature/playmap-landing-accounts-child-profiles. If that branch already exists and is appropriate, reuse it. Otherwise create it safely without discarding or overwriting any existing work.

Schema mode: OPEN.

Execute Prompts 0 through 11 in order. You own all routine product, UI, architecture, dependency, schema, migration, testing, and implementation decisions. Investigate and decide instead of asking me. Run the review-test-fix loop after every prompt and continue automatically.

The Authority Override in the prompt pack narrows the generic controller’s hard stops. Stop only for destructive or irreversible data loss, a genuinely required destructive production-data operation, unavailable credentials/payment/legal or administrator action after all local work is complete, a material privacy/security problem with no safe reversible solution, or an unavoidable collision with uncommitted user work.

Do not stop for additive schema changes, unclear implementation choices, missing dependencies, ordinary test failures, pre-existing bugs, missing deployment credentials, or the discovery that the repository differs from the plan. Resolve those autonomously and continue.

Do not push, deploy, publish, purchase, accept legal terms, or open a pull request unless I separately authorize it. Complete the branch and return the final loop-controller report.
```
