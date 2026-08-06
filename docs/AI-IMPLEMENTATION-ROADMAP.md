# AI-Assisted Toy Entry Implementation Roadmap

This roadmap is intentionally staged. No stage authorizes dependency upgrades, API keys in the app, automatic saves, generated images, subscriptions, or production rollout without the preceding acceptance and owner decisions.

## Stage 1 — Backend skeleton and strict request/response schema

- Areas: new backend repository/service, API route, runtime schema package/service, contract fixtures, threat model, CI secret scanning.
- Acceptance: authenticated request reaches a Pip endpoint; it accepts one bounded image; a mock response is independently validated to the V1.1 allowlist; no provider integration exists yet.
- Tests: valid contract, missing/extra fields, invalid JSON, unsupported category/cleanup, text limits, file signature/type/size, idempotency.
- Security review: public API surface, auth/token design, secret storage, log redaction, schema projection.
- Cost review: request-size/max-dimension defaults and global cap configuration exist before provider traffic.
- Commit boundary: `Add AI analysis API contract and validation`.

## Stage 2 — Provider integration behind a mockable service

- Areas: backend provider adapter interface, selected provider implementation, mock adapter, timeout/error mapper, fixed task/schema configuration.
- Acceptance: the adapter can be replaced in tests; only normalized image and fixed server task go to the provider; raw output never reaches the app.
- Tests: provider success, refusal, timeout, network error, invalid structured output, provider schema drift, safe error mapping.
- Security review: server-only key, least-privilege access, no payload/image logging, provider retention and DPA terms reviewed.
- Cost review: model/version pinned, per-request estimate recorded, circuit breaker and provider timeout set.
- Commit boundary: `Integrate guarded AI toy analysis provider`.

## Stage 3 — Usage metering and spend limits

- Areas: backend quota ledger, cache/fingerprint service, rate limiter, global budget configuration, operator alerts/dashboard.
- Acceptance: tier allowance, duplicate cache, idempotency, per-user/install limits, warning threshold, $2 household ceiling, and global cap are enforced transactionally.
- Tests: successful analysis, provider failure accounting, invalid image no-charge, retry idempotency, duplicate request/cache, rapid tap/rate limit, exhausted allowance, global-cap behavior, account/token recreation controls.
- Security review: quota authorization isolation, keyed fingerprint handling, cache retention/deletion, abuse controls.
- Cost review: validate projected paid usage remains below $0.50 average and test the global stop switch.
- Commit boundary: `Add AI usage and spend guardrails`.

## Stage 4 — Add Toy Suggest Details UI

- Areas: `src/components/toy-form.tsx`, Add Toy route, form-state hook/service, typed API client, accessibility strings, feature flag/configuration. Do not change the existing Save Toy service contract without a separate review.
- Acceptance: photo selection enables an explicit secondary Suggest Details action; manual fields remain available; suggestions are labeled and individually editable/removable; no AI result saves a toy.
- Tests: initial disabled state, explicit request only, high/medium/low confidence presentation, preserve manual fields, image replacement clears suggestions, all suggested fields editable, no automatic database save.
- Security review: client sends no child/profile/location/form text; no key or privileged config in app bundle; secure credential storage as applicable.
- Cost review: UI double-tap prevention, cancellation behavior, request-size preflight, cache indication without exposing cost details.
- Commit boundary: `Add optional AI suggestions to Add Toy`.

## Stage 5 — Failure states and manual fallback

- Areas: client request state machine, error copy, offline detection/advisory, cancellation, recovery tests.
- Acceptance: every specified failure returns to normal entry with selected image and form data intact; no provider message leaks; parent can save manually after every outcome.
- Tests: unavailable, offline, timeout, cancellation, oversize, unsupported type, multiple toys, unclear image, refusal, invalid response, rate limit, allowance exhaustion, stale response, navigation/replacement during request.
- Security review: safe error mapping and no sensitive content in client telemetry/logs.
- Cost review: retries bound to idempotency key; cancelled/failed accounting matches the guardrails document.
- Commit boundary: `Harden AI toy-entry fallback states`.

## Stage 6 — Privacy documentation and disclosures

- Areas: privacy policy, support page, in-app notice, App Store privacy answers, data retention policy, processor register, release checklist.
- Acceptance: disclosures accurately match the shipped architecture, provider, identity method, retention, and pricing/allowance rules; owner/legal approval is recorded.
- Tests: copy review against real requests/logs, support-path validation, App Store submission metadata review.
- Security review: privacy impact assessment, data flow diagram, deletion and incident runbook tabletop review.
- Cost review: policies do not promise unlimited use or unspecified cloud service.
- Commit boundary: `Document AI privacy and support disclosures`.

## Stage 7 — Beta testing and cost measurement

- Areas: feature flag/allowlist, redacted metrics, beta feedback process, operational runbook.
- Acceptance: closed beta remains opt-in; global cap and kill switch work; measured per-household cost, latency, error, cache, and abuse data are reviewed over a meaningful period; manual flow remains healthy.
- Tests: end-to-end beta environment, provider outage drill, global-cap drill, permission/photo edge cases on supported devices, accessibility review.
- Security review: production-like secret/config access review, log sample audit, retention job verification.
- Cost review: compare observed p50/p95/maximum cost with $0.50 target, $1 warning, and $2 hard ceiling; approve/reject paid assumptions.
- Commit boundary: `Prepare AI toy entry beta operations`.

## Stage 8 — Paid-tier integration after measured validation

- Areas: account system, entitlement provider, purchase/restoration flow, backend account authorization, pricing/support/legal copy.
- Acceptance: only begins after Stage 7 owner sign-off. Paid allowance is restored securely by account; no unlimited claim; failed purchase/restoration never blocks manual entry.
- Tests: entitlement changes, restore, renewal/expiration, allowance reset, family/household policy, refund/revocation, server-side verification, app-store sandbox.
- Security review: purchase-token verification on server, account takeover protections, entitlement audit trail, privacy update.
- Cost review: commission, hosting, storage, support, refunds, heavy-user distributions, annual founder pricing, and explicit $2 cap all remain viable.
- Commit boundary: `Add measured Pip Plus AI entitlements`.

## Release gates

Do not advance to a user-facing beta until Stages 1–6 pass. Do not advance to paid access until Stage 7 demonstrates the limits and price are viable. At every release, run typecheck, lint, unit/integration tests, Expo diagnostics, secret scan, and a manual verification that analysis success never creates or updates a toy without the existing save action.
