# AI-Assisted Toy Entry Open Decisions

None of the following should be decided implicitly during implementation.

| Decision | Recommendation / options | Decision owner and gate |
| --- | --- | --- |
| Ship AI in beta? | Recommended: closed, opt-in beta only after backend, privacy, and cap gates. Alternative: defer entirely until accounts/cloud work. | Product owner before Stage 7. |
| Beta allowance | Recommended: 10 successful scans plus one idempotent retry policy. | Product + finance before beta. |
| Free trial allowance | Recommended: 3 successful one-time scans; no recurring free scans initially. | Product + finance before public launch. |
| Paid monthly allowance | Recommended starting point: 15 setup scans and 15/month, subject to beta cost. | Product + finance after Stage 7. |
| Anonymous token vs account | Beta: opaque anonymous installation token. Public paid launch: account required for AI only; manual app stays account-free. | Product + privacy/security before Stage 1 and public launch. |
| Backend host and region | Choose a managed host with regional controls, secret manager, rate limiting, encrypted temporary storage, logs, deletion lifecycle, and DPA. | Engineering + legal/security before Stage 1. |
| AI provider and model | Select after evaluating image quality, structured-output reliability, current pricing, retention/training terms, regional availability, DPA, and safety controls. | Product + engineering + legal before Stage 2. |
| Image processing limits | Proposed: JPEG/PNG only, 5 MiB client target / 8 MiB edge cap, longest edge 1600 px. Validate on real devices and provider quality. | Engineering + product before Stage 1. |
| Data retention | Proposed: transient image immediate deletion/15-minute maximum; result cache 24 hours; redacted ledger 30 days. | Legal/privacy + product before beta. |
| Cached results | Recommended: cache same normalized image within account/install scope for 24 hours; never auto-apply. Decide whether cache is enabled in beta and document it. | Privacy + product before Stage 3. |
| Existing AI-oriented local schema | Decide whether to reuse, simplify, or migrate existing draft/metadata/enhancement fields. V1.1 must not generate images. | Engineering before Stage 4. |
| Add Toy vs Edit Toy scope | Recommended: Add Toy only in first beta; consider Edit Toy after evidence. | Product before Stage 4. |
| Subscription timing | Recommended: no purchases during beta; introduce paid access only after measured Stage 7 approval. | Product + finance before Stage 8. |
| Final pricing | Proposed starting reference: $2.99/month or $24.99/year, but approve only after commission, AI, hosting, storage, support, and refund modeling. | Product + finance before Stage 8. |
| Annual founder pricing | Decide whether AI allowance is included, for how long, whether it can change prospectively, and whether future cloud backup is excluded until built. | Product + legal + finance before public pricing. |
| App Store disclosures | Complete using actual provider/hosting/identity behavior at submission time; do not rely on this planning document alone. | Owner + legal before distribution. |
| Support and deletion contact | Name support channel and response/deletion process. | Owner before beta. |
| Global spend cap | Set beta and public monthly caps, 80% alert, daily emergency cap, and who can approve an override. | Owner + finance before provider traffic. |

## Decisions that must remain true regardless of choices

- AI assistance is optional and manual entry works without internet, account, payment, or AI.
- A parent explicitly initiates image analysis and explicitly saves any toy.
- The original parent photo remains the child-facing image; no replacement image is generated.
- No provider key is distributed in the mobile app.
- The service sends the minimum image-only payload and excludes child/profile, PIN, location, and household fields.
- Outputs stay within the V1.1 allowlist and avoid medical, safety, developmental, therapeutic, diagnostic, identity, preference, age, pricing, and unverified brand claims.
