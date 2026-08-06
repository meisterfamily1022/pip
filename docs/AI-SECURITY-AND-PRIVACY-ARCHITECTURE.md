# AI Security and Privacy Architecture

## Recommended architecture

```text
Pip mobile app
  -> HTTPS, installation/account credential, idempotency key, one processed image
Pip API / edge
  -> authentication, rate limits, type/size validation, metadata removal, resize/compress,
     fingerprint/cache, allowance + global budget checks
Provider adapter (server-only)
  -> provider API key, constrained prompt/schema, timeout and safe error mapping
Pip API
  -> strict schema validation and allowlist projection
Pip mobile app
  -> editable suggestions only; existing Save Toy is the only persistence action
```

No provider API key, provider endpoint secret, or privileged allowance logic may be embedded in the mobile application, Expo public configuration, source maps, or CI logs. The app only calls a Pip-controlled endpoint. Provider credentials reside in a managed server-side secret store with least privilege and rotation procedures.

## Trust boundaries and data minimization

| Boundary | Data allowed | Explicitly excluded |
| --- | --- | --- |
| App to Pip backend | One toy image, schema version, idempotency key, installation/account credential | Child nickname, parent PIN, room/storage names, toy form values, household information, free-text prompt, EXIF/location metadata |
| Backend to provider | Normalized single toy image and fixed server-authored task/schema instruction | User identifiers, device identifiers, raw installation token, names, location data, submitted form data |
| Backend to app | Strict V1.1 allowed suggestion object, safe error code, request ID, allowance state | Raw provider output, provider error text, hidden confidence score, image content |
| Backend logs/metrics | Request ID, timestamps, safe outcome code, byte bucket, model/schema version, aggregate cost and quota events | Raw images, image bytes, image hashes if linkable outside the account scope, EXIF, prompts, tokens, names, credentials, full payloads |

Use TLS in transit and encrypted managed storage/database services at rest. Prefer streaming processing and memory-bound temporary storage. If a temporary object store is necessary, use an opaque key, encryption, least-privilege service access, automatic deletion within 15 minutes, and lifecycle enforcement. Do not permanently store uploaded image data or provider image copies unless the owner explicitly approves a documented exception.

## Backend responsibilities

1. Authenticate a beta installation token or public-launch account; authorize only the current caller's quota/cache scope.
2. Enforce request size, magic-byte type, dimensions/decompression safety limits, and one-image rule.
3. Strip EXIF and unnecessary metadata, normalize orientation, and produce a bounded analysis copy. Preserve the original only on-device for the child-facing toy image.
4. Apply rate limits, idempotency, duplicate detection, and transactional allowance/global-budget checks before provider submission.
5. Submit a fixed task to a provider adapter using a server-only key. The adapter must request structured output and prohibit the excluded claims.
6. Validate the response independently using a strict runtime schema; allowlist values and reject malformed, extra, or unsafe output. Do not trust provider schema adherence alone.
7. Convert all errors to safe public codes, return a request ID, and emit redacted diagnostics. Do not leak provider policy text or internal stack traces.
8. Delete transient images promptly. Retain minimal operational records only for the selected retention period, with deletion jobs and access audit logs.

## Response validation and prompt controls

The backend owns a versioned runtime schema matching `AI-ASSISTED-TOY-ENTRY-SPEC.md`. It should set deterministic/low-variance provider settings where supported, use a fixed server prompt, and require the exact JSON shape. The provider is instructed to return only the allowlisted suggestion fields, to use `null` or warnings when uncertain, and never to make age, safety, medical, therapeutic, developmental, diagnosis, identity, preference, price, brand (unless clearly necessary and identifiable), or play-instruction claims.

If the provider returns unknown fields, unsupported categories, unsupported cleanup values, unbounded text, malformed JSON, or a refusal not mappable to the contract, the backend treats it as an invalid response and returns no suggestions. Never attempt client-side parsing of raw model text.

## Identity options

| Option | Abuse risk | Implementation effort | Privacy | Restore behavior | Family experience | Cost-control reliability |
| --- | --- | --- | --- | --- | --- | --- |
| A. Anonymous installation token | High: reinstall/reset can refresh trial; mitigations are probabilistic | Lowest | Best data minimization; no account profile | Weak; token/device loss loses entitlement | Frictionless | Moderate to weak |
| B. Require account before AI use | Moderate: account abuse remains but is measurable/rate-limited | Medium to high | Requires account/privacy operations | Strong across devices | Adds a setup step only to AI | Strong |
| C. Delay AI until cloud accounts exist | Lowest immediate AI risk because no AI ships | Lowest now, defers all AI work | Keeps V1 local-only promise intact | Not applicable until accounts | No AI benefit in beta | Strong once designed with accounts |

Recommendation for closed beta: **Option A**, with a small 10-scan beta allowance, server-held opaque installation token, quota/rate limits, global cap, and clear notice that beta AI allowance does not restore after reinstall. It enables product learning without making accounts a prerequisite for manual Pip.

Recommendation for public launch: **Option B**, requiring a Pip account for AI-assisted entry and paid allowance. Manual Pip remains account-free. Do not choose Option C as the default launch plan if beta learning is needed; choose it only if the owner decides the privacy/cost burden is not justified.

## Retention, deletion, and incidents

Proposed default retention:

- Transient upload/normalized image: delete immediately after provider completion, with a 15-minute maximum lifecycle fallback.
- Duplicate cache result: 24 hours, scoped to installation/account, schema and model version; store the allowed structured result and a keyed fingerprint, never raw image.
- Quota/cost ledger and redacted request record: 30 days for beta diagnostics and abuse controls, then aggregate or delete. Retention for public launch is an owner/legal decision.
- Security/audit records: minimum necessary period defined by the hosting provider and owner policy; never contain image content or user-entered toy data.

Support a deletion request by deleting retained cache/operational records associated with an account where technically feasible, subject to a disclosed fraud/security retention exception. Define an incident runbook: revoke/rotate credentials, stop provider traffic with the circuit breaker, preserve redacted evidence, assess affected data, and notify users/regulators when required.

## Required privacy and disclosure updates before release

The current local-only statement in `docs/PRIVACY-POLICY-DRAFT.md` will no longer be fully accurate when AI analysis ships. Before any beta distribution, update and owner-review:

- Privacy policy: photo is sent to Pip and a named third-party AI processor only after the parent taps Suggest Details; state purpose, fields returned, retention, deletion, security limitations, optional nature, no provider key in app, and contact/rights process.
- App Store privacy disclosure: report data collection/sharing accurately based on actual backend/provider configuration, including user content (photos) and identifiers if used for account/installation quota. Confirm Apple's current categories with counsel/owner at submission time.
- In-app disclosure: plain-language just-in-time explanation by Suggest Details, link to policy, cancellation behavior, and statement that the photo remains the child's image and suggestions require review before saving.
- Support documentation: availability, supported image types, manual fallback, allowance/reset rules, deletion/support contact, and no medical or safety advice.
- Data-retention statement: temporary image processing, cache and diagnostic retention periods, provider retention/zero-retention terms, and deletion controls.
- Third-party processor disclosure: legal entity, provider role, region/subprocessors as applicable, data processing agreement status, and a versioned list.

No child profile data should be intentionally sent. Because photos can incidentally contain people or household context, the disclosure should ask parents to submit a clear photo of the toy alone where possible; this is guidance, not a technical guarantee.
