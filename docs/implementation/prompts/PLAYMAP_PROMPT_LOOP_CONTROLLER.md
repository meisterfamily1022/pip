# PlayMap Prompt Loop Controller

Use this controller with `PLAYMAP_REDESIGN_IMPLEMENTATION_BRIEF.md` and
`PLAYMAP_REDESIGN_PROMPTS.md`.

## Required startup instruction

Read this controller first, then read the named brief and prompt pack. Execute
the prompts in numerical order. The prompt pack is the implementation authority;
this file controls execution, model routing, verification, and stopping behavior.

## Required inputs

- Plan: `PLAYMAP_REDESIGN_IMPLEMENTATION_BRIEF.md`
- Prompt pack: `PLAYMAP_REDESIGN_PROMPTS.md`
- Expected branch: the branch stated in the prompt pack or supplied by the human
- Schema mode: the mode stated in the prompt pack; for this project use `ADDITIVE_ALLOWED`
- Allowed scope: PlayMap redesign, native media intake, bulk intake, multi-child checkout, reliability, accessibility, and QA
- Out of scope: cloud sync, accounts, payments, AI recognition, App Store release work, database reset, destructive migrations, and unrelated dependency upgrades

If a required input is missing and cannot be inferred safely, stop for human
review before editing.

## Model routing

Each prompt has a `Model` field. Before starting a prompt, switch to that model
in Codex if model switching is available. Do not use one model for the entire
pack merely because the previous prompt used it.

Recommended routing:

| Prompt type | Preferred model | Fallback | Reason |
| --- | --- | --- | --- |
| Baseline, architecture, data integrity, native/runtime diagnosis, multi-child state, final QA | `Sol` | strongest available reasoning model | repository-wide reasoning and failure analysis |
| Navigation, UI implementation, visual acceptance, accessibility, interaction polish | `Terra` | strongest available coding model | broad UI implementation and product polish |
| Testability/startup repair | `Sol` | strongest available reasoning model | module-resolution and runtime diagnosis |

If the named model is unavailable, use the listed fallback and record the
fallback in the prompt summary. Never silently claim that a requested model was
used. If no suitable model is available, stop rather than switching randomly.

Model changes are allowed only at prompt boundaries. Do not change models in the
middle of a prompt unless the current model fails or the human explicitly asks.

## Startup and dirty-worktree rules

1. Read this controller, the brief, and the prompt pack.
2. Confirm the active branch and current dirty state.
3. Preserve unrelated user changes; never reset, clean, checkout, or discard them.
4. Identify the exact files likely to change before editing.
5. Confirm the active prompt's model and scope.
6. Inspect existing implementation before proposing replacements.

## Per-prompt loop

For every prompt, in order:

1. Announce the selected model and active scope in 3–6 bullets.
2. Re-check branch and dirty state.
3. Implement only the active prompt.
4. Review the result against the brief and prompt acceptance criteria.
5. Add focused regression tests for changed behavior.
6. Run targeted tests, then typecheck/lint/build checks where applicable.
7. Run the prompt's required manual or visual checks when available.
8. Fix discovered issues and repeat the relevant checks.
9. Produce the required stop summary.
10. Continue automatically only when the prompt gate is clean and no hard stop applies.

Do not skip, merge, invent, or reorder prompts. A prompt is not complete merely
because the code compiles.

## Verification policy

The final two passes must each run, as applicable:

```text
npm test
npx tsc --noEmit
npx expo lint
npx expo-doctor
git diff --check
```

Run the full suite after each prompt when practical; otherwise run targeted
checks and explain what was deferred. Do not claim camera, native photo access,
native persistence, or device performance was verified unless it was actually
tested on a simulator or physical device. Distinguish web, simulator, device,
and static verification in every report.

## Hard stops

Stop for human review if:

- a prompt conflicts with the brief or another locked product rule;
- a migration would delete, reset, or irreversibly alter existing data;
- the canonical toy/session source of truth is unclear;
- a test fails and the cause is not clearly isolated and safely fixable;
- native behavior is being claimed without native verification;
- unrelated dirty work would be overwritten;
- implementation requires cloud services, credentials, live data, or release work;
- the prompt would expand beyond the allowed scope.

## Required prompt summary

At each gate, report:

- prompt number and name;
- model actually used and any fallback;
- files changed;
- behavior/data-contract changes;
- tests and checks run with exact results;
- manual/device/web verification and limitations;
- remaining risks or blockers;
- whether the next prompt may begin.

