# AI Durable Usage Controls

Stage 2 adds the control-plane boundary required before a paid provider is introduced. It does not call OpenAI or any other paid provider.

## Installation credentials

`POST /v1/installations` creates an opaque random installation record and returns a versioned, server-signed credential. The token contains only the installation ID, credential version, and issued-at timestamp. It contains no household, child, toy, image, or PIN data. The signing secret is server-only (`PLAYMAP_INSTALLATION_SIGNING_SECRET`); missing configuration fails outside test mode. Verification checks format, signature, version, and age, and revoked records are rejected.

The mobile client requests a credential only when AI is first used. Native builds store it in Expo SecureStore; web development uses an isolated in-memory fallback. Clearing a credential is supported. Manual entry does not depend on credential issuance.

## Development persistence and production boundary

`LocalDevelopmentStorage` is a repository-backed adapter with durable-shaped records and a process-global development store. It survives service reinitialization in the same local server process and is intentionally not described as production durable storage. Expo SQLite is the app’s local database, not a server ledger; server-side local disk/persistent SQLite guarantees depend on the host and are not assumed here.

Before production, replace the adapter implementations behind the same interfaces with a hosted PostgreSQL database, managed serverless database, or durable key-value store. The final provider, region, host, account system, and secret manager remain open decisions and are not provisioned by this stage. The missing historical `AI-BACKEND-SKELETON.md` reference was not available in this repository.

## Quota, idempotency, and cache

Beta allows 10 successful analyses per installation, with monthly counters retained separately. Invalid requests, rejected images, unavailable/timeout providers, malformed provider responses, and cancellation before invocation do not consume successful allowance. A successful mock analysis consumes exactly one. Attempts are represented by usage events separately from successful usage.

Idempotency stores request ID, installation ID, SHA-256 fingerprint, status, safe error/response metadata, timestamps, and expiry; it never stores raw image bytes. Reusing the same ID with a different fingerprint is rejected. In-flight duplicates share the local promise, and completed duplicates return the original result. Structured results are cached for 30 days, installation-scoped, and cache hits do not consume allowance.

## Global controls and accounting

The repository-backed budget contains enabled state, emergency disable, maintenance text, image-byte limit, monthly successful-analysis limit, and monthly estimated-cost cap. Development defaults are enabled, 8 MiB maximum image, 1,000 successful analyses/month, and $10/month. Checks happen before provider invocation.

Costs use integer microdollars (`estimatedInputCostMicros`, `estimatedOutputCostMicros`, `estimatedTotalCostMicros`, and `actualCostMicros`), never floating-point dollars. The mock provider has zero actual cost and a configurable estimated cost for guardrail tests.

Usage events contain only event ID, request ID, installation ID, event type, provider identifier, cached/success flags, safe error code, estimated cost, and timestamp. An administrative summary service can aggregate installations, successes, failures, cache hits, quota/global rejections, estimated monthly cost, and enabled state; it is not exposed as a public route.

## Limitations before production

There is no cloud database, provider API key, image upload store, hosted rate limiter, alerting integration, account authentication, subscription, or deletion job in this stage. Hosted persistence must provide atomic reservations/settlement, concurrent idempotency, expiry cleanup, encryption, access control, regional/retention policy, and auditability before real provider traffic is enabled.
