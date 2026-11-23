# CardCom OpenFields demo server

> ⚠️ **DEMO ONLY.** This backend exists to make the demo checkout runnable end-to-end
> (create a LowProfile, receive the webhook, verify the result). It is **not** a
> production backend: orders live in an in-memory `Map` (lost on restart, not shared
> across instances), there is no authentication, no persistence, and no idempotency
> hardening beyond a basic status check. A real integration must replace this with a
> backend that persists orders in the merchant's existing orders table, per the
> CardCom OpenFields integration guides in the repo root.

## Setup

Settings come from the root `.env.<environment>` file (see the root README). Start it from the
repo root with `npm run dev -- --env=<name>` (server + checkout), or alone with
`CARDCOM_ENV=<name> npm run dev -w server`.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/checkout/low-profile` | Creates a fresh order + CardCom LowProfile. Returns `{ orderId, lowProfileCode, bitUrl, amount, currency, productName }` — never the API password or raw CardCom response. |
| `GET` | `/api/checkout/verify/:orderId` | Calls `LowProfile/GetLpResult` (source of truth) and returns the order's current status. Used by the result page after a redirect-based flow (Bit). |
| `POST` | `/webhook/cardcom` | **Public.** CardCom calls this after every payment attempt. Verifies via `GetLpResult` before trusting the result; idempotent (no-ops if the order is already resolved). |

Every CardCom call follows the global rule: `ResponseCode === 0` is success, anything else is an
error — always logged with `Description` + `ResponseCode`.
