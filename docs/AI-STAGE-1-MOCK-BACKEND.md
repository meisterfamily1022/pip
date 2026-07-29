# AI Stage 1 mock backend

Stage 1 exposes `POST /v1/toy-analysis` through the Expo Router API route at
`src/app/v1/toy-analysis+api.ts`. It is server-only and uses no paid provider,
provider SDK, API key, or external AI service.

The temporary request image representation is structured metadata:

```json
{
  "installationToken": "inst_1234567890abcdef",
  "image": {
    "mediaType": "image/jpeg",
    "byteLength": 1024,
    "mockReference": "clear_toy"
  },
  "requestId": "11111111-1111-4111-8111-111111111111",
  "clientVersion": "1.0.0"
}
```

`mockReference` is a local/test fixture marker. It must be removed before
production and replaced with HTTPS upload handling that verifies JPEG/PNG file
signatures, dimensions, metadata removal, and the documented 8 MiB edge limit.
The local quota adapter allows ten successful or provider-attempted mock scans
per installation and intentionally does not survive a server restart.

Production still needs signed/server-issued installation credentials, durable
quota/idempotency storage, edge limits, rate limiting, transient-image deletion,
and a reviewed provider adapter. No mobile screen imports `src/server/ai`.
