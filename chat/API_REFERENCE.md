# Chat API Reference

Base path: `/v1/chat/completions`

## POST /v1/chat/completions

Request body:
- `message`: `string`, required.
- `model`: `string`, required.
- `tier`: `"free"` or `"paid"`, required.
- `userId`: `string`, optional; required for paid tier non-BYOK requests.
- `provider`: `string`, optional; used for BYOK routing.
- `paymentMode`: `"platform" | "byok"`, optional; defaults to `"platform"` when `tier` is `"paid"`.
- `userApiKey`: `string`, optional; used when `paymentMode` is `"byok"`.
- `history`: `Array<{role: "user"|"assistant"|"system", content: string}>`, optional.

Response: Server-Sent Events (`text/event-stream`). Each event carries a JSON object with a `delta` field on progression and a final `data: [DONE]` marker.

### Public model IDs

The frontend must use public aliases. The router translates aliases to provider models internally and never forwards aliases as model IDs.

- `ael-1`: routed via Ael → `qwen3.7-max`, `qwen3.7-plus`, then NVIDIA NIM fallback.
- `ael-1-pro`: routed via Ael → `qwen3.8-max-preview`. Experimental.

### Error envelope

- 400: `{ error: string, status: 400 }`
- 402: `{ error: string, status: 402 }`
- 500: `{ error: string, status: 500 }`
- 502: `{ error: string, status: 502 }`

When `headersSent` is true, errors are sent as SSE error events instead of JSON.

### Notes

- Provider fallback order is controlled by the backend route table only.
- Clients must not switch providers mid-request.