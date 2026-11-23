# AGENTS.md - CardCom OpenFields

Instructions for AI coding agents (Claude Code, Codex, Cursor, Copilot, ...).

## If you are integrating CardCom OpenFields into a store

Read **[docs/cardcom-openfields-ecommerce-integration.md](docs/cardcom-openfields-ecommerce-integration.md)**
first and follow it. It is the main integration guide: server side (LowProfile/Create,
webhook, GetLpResult, refund), the front end (card, Apple Pay, Google Pay, Bit), the button
design rules and Apple Pay domain registration. It ends with a checklist of deliverables.
Its five companions in `docs/` go deeper - read each when you implement that part:

- [docs/cardcom-integration-lowprofile-create.md](docs/cardcom-integration-lowprofile-create.md) - full `LowProfile/Create` request/response, order fields
- [docs/cardcom-integration-webhook.md](docs/cardcom-integration-webhook.md) - webhook payload, response codes, fields to save
- [docs/cardcom-integration-void.md](docs/cardcom-integration-void.md) - void / refund (`Documents/CancelDoc`, `RefundByTransactionId`)
- [docs/cardcom-integration-documents.md](docs/cardcom-integration-documents.md) - creating invoices / receipts
- [docs/cardcom-integration-suspended-deal.md](docs/cardcom-integration-suspended-deal.md) - J5: authorize now, capture later

This repository is a working **reference implementation** of that guide. Use it to check details, then
adapt the patterns to the store's own stack. Don't copy the demo backend as is: it keeps orders in
memory and has no auth.

### Rules you must not break

1. **Credentials stay on the server.** `ApiName` and `ApiPassword` never reach the browser, logs or the repository
   (`ApiName` alone can call `LowProfile/Create` and `GetLpResult`). Don't send `apiName` in `init`.
2. **Every CardCom iframe has `allow="payment"`** (master, card number, CVV, Apple Pay, Google Pay).
3. **The master iframe is required** in every flow; its `name` **and** `id` must be exactly `CardComMasterFrame`.
   The other names must be exact too: `CardComCardNumber`, `CardComCvv`, `CardComApplePay`, `CardComGooglePay`.
4. **Load CardCom's 3DS script on the checkout page:** `<script src="https://secure.cardcom.solutions/External/OpenFields/3DS.js"></script>`.
   Without it, card payments on a 3DS terminal never complete.
5. **Create a fresh LowProfile for every checkout visit** and after the current one is closed (paid, final decline 99999,
   expired / revoked). A retry after an error the payer can fix reuses it.
6. **An order is paid only after the server verifies it** with `LowProfile/GetLpResult` (`ResponseCode == 0`).
   Only `paid` is final: a `failed` order can still become `paid` by a later webhook for the same LowProfile.
   In the browser only `HandleSubmit` is success - `HandleEror` with `ResponseCode: 0` is a decline.
   A browser message (`HandleSubmit`) is never proof of payment. Make the webhook idempotent.
7. **Apple Pay, Google Pay and Bit buttons are the same size and shape.**
8. **Log `ResponseCode` + `Description`** of every failed CardCom call; show the payer a friendly message.
9. **Develop on a test terminal.** Before the real integration the merchant contacts CardCom support and
   requests a test company with a test terminal. If the user has no test credentials yet, stop and tell them
   to request them - never experiment on a live terminal: every approved payment is a real charge.
10. **Don't build the hosted-page flow** (redirect to CardCom's page, or the whole CardCom page in an
   iframe). It is a different integration and out of scope here.
11. **Deferred capture (J5) is `CreateTokenOnly` + `JValidateType: 5`** - never `ChargeAndCreateToken`, which charges
   immediately (capturing later would charge twice).
12. **Check `event.origin`** of every message and post to the master frame with target origin
   `https://secure.cardcom.solutions`, not `'*'`.

If the store has no backend or no persistent orders table, stop and tell the user: OpenFields requires both.

### Where each part is implemented here

| Topic | Files |
|---|---|
| Calls to the CardCom API (server only), incl. refund | `server/src/cardcomClient.js` (refund has no route - the e2e specs call it) |
| LowProfile/Create (returns `lowProfileCode` + `UrlToBit` to the page) | `server/src/routes/createLowProfile.js` |
| Result rules (0 paid, 5119 pending, 5117/5118 cancelled/expired, else failed; only `paid` is final) | `server/src/applyLpResult.js` |
| Verifying a result with GetLpResult (success-redirect page) | `server/src/routes/verify.js` |
| Webhook receiver (always answers 200) | `server/src/routes/webhook.js` |
| postMessage protocol with the master iframe (`ready` → `init` → `doTransaction` → result) | `apps/web/src/lib/openFieldsClient.ts`, `apps/web/src/hooks/useOpenFields.ts` |
| `HandleEror`: fixable errors stay on the form, a closed LowProfile (99999) ends the attempt | `apps/web/src/hooks/useOpenFields.ts`, `apps/web/src/components/checkout/CheckoutPage.tsx` |
| 3D Secure: loading `3DS.js`; master iframe `id` | `apps/web/src/main.tsx`, `apps/web/src/components/checkout/CardFieldsFrame.tsx` |
| Card number + CVV iframes and their CSS | `apps/web/src/components/checkout/CardFieldsFrame.tsx`, `apps/web/src/styles/iframeFieldCss.ts` |
| Apple Pay / Google Pay iframes, revealed on `initialized` | `apps/web/src/components/checkout/ApplePayFrame.tsx`, `GooglePayFrame.tsx`, `WalletButtonRow.tsx` |
| Bit button (redirect to `UrlToBit`) | `apps/web/src/components/checkout/BitButton.tsx` |
| Languages (LowProfile `Language`, iframe `?language=`, `init`) | `apps/web/src/i18n/`, `server/src/languages.js` |
| Message types | `apps/web/src/types/openfields.ts`, `apps/web/src/types/api.ts` |

API reference: https://secure.cardcom.solutions/swagger/index.html?url=/swagger/v11/swagger.json

## If you are working on this repository

- Setup, environments and commands are in [README.md](README.md). Configuration is one `.env.<name>` file per
  CardCom environment, read only by `scripts/env.mjs`.
- Never commit a `.env.<name>` file or put real credentials or card numbers in code. Only `.env.example`, with
  placeholder values, is committed.
- After a change, run the e2e specs on all three devices: `npm test -- --env=<name>`.
  They pay with real charges and refund every paid order in `afterEach`.
- When you change behaviour the guide describes, update `docs/cardcom-openfields-ecommerce-integration.md` too.
