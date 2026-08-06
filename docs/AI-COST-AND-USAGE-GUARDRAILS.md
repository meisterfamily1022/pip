# AI Cost and Usage Guardrails

## Goal

AI toy analysis is a limited assist, not a metered prerequisite for Pip. Manual entry stays free and unlimited. The service must target average AI cost below $0.50 per active paid household per month, warn at $1.00, and stop at $2.00 per household per month unless an owner explicitly approves more. A configurable global monthly cap is authoritative and fails closed to manual entry.

All figures below are product limits, not a promise of exact model cost. Set actual counts only after beta measurement against the selected provider, model, image preparation, platform commission, hosting, support, and refund cost.

## Recommended starting allowances

| Tier / phase | Initial allowance | Monthly allowance | Retry rule |
| --- | ---: | ---: | --- |
| Free trial | 3 successful analyses, once per installation/account | 0 | One retry for a timed-out or safely retryable server failure, tied to the original idempotency key. |
| Closed beta | 10 successful analyses | 10 per calendar month | Same as trial; owner may change remotely while honoring disclosed beta terms. |
| Pip Plus (proposed) | 15 successful analyses at paid activation | 15 per calendar month | Same retry rule; no paid overage in V1.1. |
| Heavy-user exception | None automatic | None automatic | Show manual-entry fallback and an owner-approved waitlist/upgrade contact, not an open-ended overage. |

The paid starting allowance is intentionally conservative: at the $2 household hard ceiling, it requires a fully loaded cost of no more than about $0.13 per successful analysis. If observed costs exceed that, lower the allowance, use stronger image processing, or defer paid launch. Do not silently turn “monthly” into unlimited.

## What counts

| Event | Count against scan allowance? | Reason |
| --- | --- | --- |
| Valid successful analysis | Yes, once | Provider cost was incurred. |
| Cached identical image result within cache TTL | No | No new provider request. |
| Network failure before the backend receives request | No | No provider work. |
| Invalid image / unsupported format / oversize rejected before provider | No | Do not charge for a validation failure. |
| Rate-limited at edge | No | Do not charge for abuse protection. |
| Provider request that fails, refuses, times out after submission, or returns invalid schema | Yes, once | Provider work/cost may have occurred; do not charge again for its bound retry. |
| Parent cancellation before provider submission | No | No analysis occurred. |
| Parent cancellation after provider submission | Yes, once | Request may have consumed provider capacity. |
| Same idempotency key or in-flight duplicate | No additional count | Return original/pending outcome. |

Maintain separate counters for `allowance_used`, `provider_attempts`, `pre_provider_rejections`, and `cached_hits`. This allows customer support and cost analysis without framing a failed provider response as a second charged request.

## Controls

### Client controls

- Disable Suggest Details while a request is in flight; use an idempotency key per parent action.
- Reject obviously unsupported MIME types and client-known oversize files before upload, but never trust client checks alone.
- Fingerprint the processed upload bytes with a cryptographic SHA-256 hash. Keep the fingerprint local only as long as needed to avoid a repeat upload and send a keyed server-side fingerprint for deduplication; do not use raw image bytes as an identifier in logs.
- Cache a valid result for the same normalized image fingerprint for 24 hours, scoped to the installation/account and schema/model version. A changed photo always requires a new review. Never auto-apply a cached result.

### Backend controls

- Enforce a small request-size limit at the CDN/edge and again in application code; accept only JPEG and PNG after file-signature validation, not extension alone.
- Normalize, rotate, remove EXIF metadata where practical, and resize/compress to an owner-configurable maximum (initial proposal: longest edge 1600 px, JPEG quality calibrated by beta) before provider submission.
- Limit one active request and 3 starts per 10 minutes per installation/account; apply IP/device reputation limits as a secondary abuse signal, not as identity.
- Deduplicate concurrent matching fingerprints and reuse a completed cache result only within its TTL and scope.
- Limit retry chains to one server-managed retry; use exponential backoff and do not retry provider refusals or schema violations automatically.
- Enforce tier allowance transactionally before provider work, reserve one unit, settle it idempotently, and release only for confirmed pre-provider rejection.
- Maintain a per-installation/account cost ledger and a global provider-spend ledger. At 80% of the global monthly cap, alert the owner; at 100%, stop new analyses with manual fallback. Set a lower emergency daily cap and per-minute circuit breaker for provider pricing/error spikes.
- Restrict provider model/version through server configuration. A model price change or cost anomaly triggers circuit-breaker review before increasing traffic.

## Identity, recreation, and abuse

Anonymous tokens cannot provide reliable restore behavior or durable cost control: reinstalls and device resets can obtain a fresh allowance. During beta, bind a random installation credential to keychain/secure storage, rate-limit on multiple signals, and accept that abuse control is imperfect. Do not collect child or household content to make the token durable.

For public launch, accounts are required for paid AI usage and allowance restoration. Use authenticated account IDs for quotas; retain an installation token as a device-abuse signal only. Detect unusual account creation or token churn server-side and apply low trial limits, cooldowns, and owner review rather than blocking ordinary manual Pip use.

## Pricing stress test

The proposed $2.99/month or $24.99/year Plus price can support this limited feature only if usage stays measured and cloud backup is not treated as already included operationally.

- After an assumed 15–30% storefront commission, $2.99 yields roughly $2.09–$2.54 before tax, hosting, support, refunds, and AI. An annual $24.99 plan yields about $17.49–$21.24 annually before those costs.
- The $0.50 AI target leaves room for a lightweight backend, support, refunds, and margin at monthly pricing, but a $2.00 household ceiling would consume most of the post-commission monthly revenue before any other costs.
- The annual tier is more exposed to heavy early usage and future cloud-storage cost. It should include only the measured allowance and no promise of unlimited AI. Founder pricing needs a defined duration and explicit inclusion/exclusion of future cloud storage.
- Do not sell Plus or promise cloud synchronization until hosting, retention, restore, and support costs are modeled. If beta shows a high heavy-user tail, lower limits or introduce an explicit prepaid pack only after legal/store policy review; avoid surprise per-scan charges.

## Metrics and owner review

Collect only aggregated operational measurements necessary for cost control: active analyzers, requests, valid results, failures by safe code, cache hit rate, bytes after normalization, latency, cost estimate, allowance state, model version, and request ID. Do not log images, file names, EXIF, prompts containing user data, toy names, or raw provider output.

Review weekly in beta: p50/p95 cost and latency, cost by active household, duplicate rate, failure rate, abuse signals, and manual-fallback completion. Review pricing only after at least one full billing-cycle equivalent of stable beta data.
