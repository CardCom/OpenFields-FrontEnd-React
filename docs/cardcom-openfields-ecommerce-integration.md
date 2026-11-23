# CardCom OpenFields — E-commerce Integration Guide

## Intro
- You are an autonomous agent integrating the **CardCom OpenFields** payment feature into an existing e-commerce website.
- OpenFields lets the merchant host and fully style their own checkout form while CardCom supplies secure, cross-origin iframes for the sensitive card fields (card number + CVV). The merchant page never touches raw card data, so PCI scope stays with CardCom.
- This file is the **main guide**: it covers the server side (LowProfile creation, webhook, result verification, refund), the full front-end flow (card, Apple Pay, Google Pay, Bit), button design/sizing rules, and Apple Pay domain registration. Read it first; five companion files go deeper where noted:
  - [cardcom-integration-lowprofile-create.md](cardcom-integration-lowprofile-create.md) - more `LowProfile/Create` fields
  - [cardcom-integration-webhook.md](cardcom-integration-webhook.md) - the webhook and validating the result with `GetLpResult`
  - [cardcom-integration-void.md](cardcom-integration-void.md) - void / refund (`Documents/CancelDoc`, `RefundByTransactionId`)
  - [cardcom-integration-documents.md](cardcom-integration-documents.md) - creating invoices / receipts
  - [cardcom-integration-suspended-deal.md](cardcom-integration-suspended-deal.md) - J5: authorize now, capture later
- A working **reference implementation** of everything in this guide lives in the same repository (https://github.com/CardCom/OpenFields-FrontEnd-React): a React checkout (`apps/web`) and a Node/Fastify backend (`server`). Use it to check details; adapt the patterns to the store's own stack rather than copying the demo backend (it keeps orders in memory and has no auth).

## Goal
- Add a "pay by card / Apple Pay / Google Pay / Bit" checkout to an existing store, charging customers through CardCom using the **OpenFields** feature only.

## Scope
- **In scope:** OpenFields embedded secure-field iframes (card number, CVV, master orchestrator), the Apple Pay and Google Pay wallet iframes, and the Bit redirect button.
- **Out of scope (do NOT build):** the CardCom *hosted* LowProfile page shown either by full redirect **or** by embedding the whole CardCom page inside an iframe. That "hosted-page-in-an-iframe" mode is a different integration and is explicitly excluded here. In this guide the only iframes you embed are the OpenFields secure-field/wallet iframes described below — never the whole hosted page.

---

## Terminology

- **CardCom** — the payment gateway.
- **OpenFields** — the feature this guide implements. Several CardCom iframes are embedded into *your* checkout form and styled to look coherent, while card data stays inside CardCom's cross-origin iframes (PCI-safe).
- **LowProfile ("LP")** — a one-time payment session created by CardCom via `LowProfile/Create`. In OpenFields you use its `LowProfileId` as the `lowProfileCode` that initializes the front-end iframes. (It also returns the Bit handoff URL — see Bit.)
- **Master frame** — the hidden `CardComMasterFrame` iframe. It orchestrates everything and is **required in every scenario**. Your page talks to it exclusively via `postMessage`.
- **Token** — a PCI-compliant credit-card token created and stored by CardCom for deferred / recurring charges.
- **J5** — authorizes (holds) an amount without charging; you capture the final amount later (e.g. weighted items). In OpenFields: `Operation: CreateTokenOnly` + `AdvancedDefinition.JValidateType: 5`.
- **Wallet** — Apple Pay or Google Pay. Each renders its native button **inside its own visible CardCom iframe**.
- **Bit** — an Israeli mobile payment app. In OpenFields, Bit is **not** an iframe; it is a merchant-rendered button that redirects to a CardCom-supplied `UrlToBit` (see the Bit section).

---

## Prerequisites
- **A CardCom test company with a test terminal.** Before starting the integration, the merchant contacts **CardCom support and requests a test company with a test terminal** - it comes with an API user. Build and test everything there, and switch to the real terminal only when the integration works. Never experiment on a live terminal: every approved payment is a real charge. (If the user has no test credentials yet, stop and tell them to request them.)
- An existing e-commerce store with a backend and a persistent orders table (or equivalent).
- CardCom credentials: `TerminalNumber` (int), `ApiName` (string), `ApiPassword` (string). Store these as **server-side secrets** — never expose `ApiName` / `ApiPassword` to the browser.
- If there is no existing online store with a backend + orders table, **stop** and tell the user that CardCom's OpenFields integration requires one.

### The `allow="payment"` rule — read this first
**Every CardCom payment iframe you embed MUST carry the `allow="payment"` attribute** - the master frame, the card-number iframe, the CVV iframe, and both wallet iframes (Apple Pay / Google Pay). On the wallet iframes it is essential: without it the browser's Permissions Policy blocks the Payment Request / wallet APIs and wallet payments silently fail. On the others it is harmless - keep it for consistency.

```html
<iframe ... allow="payment"></iframe>
```

> Note: this is `allow="payment"` (singular). It is required on the OpenFields iframes themselves. (The plural `allow="payments"` you may see elsewhere belongs to the out-of-scope hosted-page-in-iframe mode.)

---

## Architecture

```
Your checkout page
├── CardComMasterFrame   (REQUIRED, hidden — orchestrates every flow via postMessage)
├── CardComCardNumber    (required for card payments — secure card-number input)
├── CardComCvv           (required for card payments — secure CVV input)
├── CardComGooglePay     (optional, visible — renders the Google Pay button + runs its sheet)
├── CardComApplePay      (optional, visible — renders the Apple Pay button + runs its sheet)
└── Bit button           (optional — NOT an iframe; your own button that redirects to UrlToBit)
```

- The card-number and CVV iframes are cross-origin; your page cannot read them. They report back through the master frame.
- Wallet buttons render **inside** their iframes because Apple Pay only starts a session from a genuine user gesture that happens **in the frame that calls it** — so the button cannot live on your page and trigger the sheet remotely.
- Bit is the exception: it is a plain button/link on your page that navigates the browser to CardCom's `UrlToBit`.
- **3DS** runs on your page, through CardCom's `3DS.js` script - see *3D Secure* in Part 2. Without it, card payments on a 3DS terminal never finish.
- All OpenFields iframes must load from the same CardCom host, and their `name`s must be exact - the master frame reaches the card/CVV iframes through `window.parent.frames[...]`.

### API endpoints
- Base URL: `https://secure.cardcom.solutions/api/v11`
- Swagger: `https://secure.cardcom.solutions/swagger/index.html?url=/swagger/v11/swagger.json`
- Create LowProfile: `POST /LowProfile/Create`
- Get LP result (verify): `POST /LowProfile/GetLpResult`
- Refund / void: `POST /Documents/CancelDoc`, `POST /Transactions/RefundByTransactionId`
- Capture a J5 deal: `POST /Transactions/Transaction`
- Documents: `POST /Documents/CreateDocument`, `POST /Documents/CreateDocumentUrl`

### OpenFields iframe endpoints (front-end `src`)
| Frame | `src` |
|---|---|
| Master | `https://secure.cardcom.solutions/api/OpenFields/Master` |
| Card number | `https://secure.cardcom.solutions/api/OpenFields/CardNumber` |
| CVV | `https://secure.cardcom.solutions/api/OpenFields/CVV` |
| Google Pay | `https://secure.cardcom.solutions/api/OpenFields/GooglePay?terminalNumber=YOUR_TERMINAL_NUMBER` |
| Apple Pay | `https://secure.cardcom.solutions/api/OpenFields/ApplePay?terminalNumber=YOUR_TERMINAL_NUMBER` |

**Language of the iframes:** add `language=<code>` to every iframe `src` (e.g. `.../OpenFields/CardNumber?language=en`, `.../GooglePay?terminalNumber=1000&language=en`). The iframes load before `init`, so this is how they know the page language: it sets the iframe's `<html lang>`, `<title>` and the field's `aria-label` (screen readers). Supported: `he` (default), `en`, `ar`, `ru`, `fr`, `it`, `es`, `de`, `pt`, `nl`, `sv`; unknown values fall back to Hebrew. Also accepted in iframe URLs: `iw` (= he), `sp` (= es), `gr` (= de) - but in `LowProfile/Create` use `he`, not `iw`. The `<title>` is localized on the card-number and CVV iframes. Card number and CVV are numeric and stay left-to-right in every language. Use the same language in `LowProfile/Create` (`Language`) and in the iframe URLs. `init.language` is different - see the `init` table in the appendix.

### Global success rule (every CardCom API response)
- `ResponseCode == 0` → success.
- Otherwise → error; surface a friendly message and **always log `Description` + `ResponseCode`** for debugging.
- Exceptions: in `GetLpResult` / the webhook `5119` means "no final result yet" and `5117` / `5118` mean the payment page can no longer be paid (see 1.3). Nested objects (`TranzactionInfo`, `DocumentInfo`) carry their own `ResponseCode` - payment success is decided by the top-level one.
- This rule is for the **API**. In the browser only `HandleSubmit` means success - `HandleEror` can carry `ResponseCode: 0` (see §2.1 *Result*).

---

## Data model — extend your orders table

Add these columns to your orders table (or equivalent). Index `lowProfileId` — you look orders up by it from the webhook.

| Column | Type | Purpose |
|---|---|---|
| `lowProfileId` | Guid/string | Returned by `LowProfile/Create`. Lookup key for the webhook. |
| `operation` | string | `ChargeOnly` \| `ChargeAndCreateToken` \| `CreateTokenOnly` (J5) |
| `transactionId` | number | `TranzactionInfo.TranzactionId` — needed to refund/void. |
| `token` | object/json | `TokenInfo` — needed to capture a J5 or charge again. |
| `documentType` + `documentNumber` | string + number | The document created (`DocumentInfo`) — needed to cancel it. |
| `status` | string | e.g. `pending` \| `paid` \| `authorized` (J5) \| `failed` \| `cancelled` \| `expired` \| `refunded`. |

---

# PART 1 — Server side

Keep all credentials server-side. Implement:
1. `cardcomCreateLowProfile(order)` — creates the payment session.
2. `cardcomGetLpResult(lowProfileId)` — verifies a result.
3. `cardcomWebhookReceiver(request)` — **public** endpoint CardCom calls after payment.
4. Admin actions: refund / void, and (J5 flow) capture.

### 1.1 Create LowProfile
`POST https://secure.cardcom.solutions/api/v11/LowProfile/Create`

Create a **fresh** LowProfile for every checkout visit (page load, or coming back to checkout), and when the current one is closed (`HandleSubmit`, `HandleEror` 99999, an expired / revoked / already-paid LowProfile). A retry after an error the payer can fix reuses it. In OpenFields you hand the returned `LowProfileId` to the front end as `lowProfileCode` - it must exist before `init`.

**Operations:**
- `ChargeOnly` — charge now (this guide's default).
- `ChargeAndCreateToken` — charge now **and** store a token for future charges. It always charges immediately; `JValidateType` is ignored.
- `CreateTokenOnly` — store a token without charging. With `AdvancedDefinition.JValidateType: 5` this is the **J5 deferred-capture flow**: the card is authorized (held) for `Amount`, and you capture later with `Transactions/Transaction` (1.4). With `JValidateType: 2` (or omitted) the card is only checked. No document is created at this stage.
- Token operations need the terminal's tokens permission (error 651). Bit is offered only with `ChargeOnly`.

**Request:**
```json
{
  "TerminalNumber": 1000,
  "ApiName": "MyApiName",
  "Operation": "ChargeOnly",
  "ReturnValue": "ORDER_123456",
  "Amount": 150.50,
  "SuccessRedirectUrl": "https://www.mysite.com/success",
  "FailedRedirectUrl": "https://www.mysite.com/failed",
  "WebHookUrl": "https://www.mysite.com/api/cardcom/webhook",
  "ProductName": "Order 123456",
  "Language": "he",
  "ISOCoinId": 1,
  "UIDefinition": {
    "CardOwnerNameValue": "John Doe",
    "CardOwnerPhoneValue": "0501234567",
    "CardOwnerEmailValue": "john@example.com",
    "CardOwnerIdValue": "123456789"
  },
  "AdvancedDefinition": {
    "MaxNumOfPayments": 1
  },
  "Document": {
    "DocumentTypeToCreate": "Auto",
    "Name": "John Doe",
    "TaxId": "123456789",
    "Email": "john@example.com",
    "IsSendByEmail": true,
    "Products": [
      { "Description": "Product 1", "UnitCost": 150.50, "Quantity": 1 }
    ]
  }
}
```
- `ReturnValue` = your order id (up to 250 chars) — it comes back on the webhook so you can find the order.
- `WebHookUrl` — your public webhook (1.3). Send it on **every** create. Must be a public `http(s)` URL: `localhost` / private addresses fail with **5170** (use a tunnel in development).
- `SuccessRedirectUrl` / `FailedRedirectUrl` — where the payer goes after the payment (`HandleSubmit` / `HandleEror` carry them as `redirectUrl`).
- `AdvancedDefinition.MaxNumOfPayments` — installments the payer may choose; `numberOfPayments` in `doTransaction` must be within the range.
- No `ApiPassword` in Create.
- `Document` — optional; creates the invoice/receipt when the payment succeeds, if the terminal has the documents module (otherwise it is only displayed). **Σ `UnitCost × Quantity` must equal `Amount`** (`UnitCost` includes VAT) - a difference above 0.10 → 5045. Details: [cardcom-integration-documents.md](cardcom-integration-documents.md).
- Every other field (`Language`, currency, `UIDefinition`, 3DS state, custom fields, UTM...): [cardcom-integration-lowprofile-create.md](cardcom-integration-lowprofile-create.md).

**Response** — this is all Create returns:
```json
{
  "ResponseCode": 0,
  "Description": "OK",
  "LowProfileId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "Url": "https://secure.cardcom.solutions/EA/LPC6/1000/3fa85f64-5717-4562-b3fc-2c963f66afa6?t=24",
  "UrlToBit": "https://secure.cardcom.solutions/api/LPC5/BitV3?TerminalNumber=1000&LowProfileCode=3fa85f64-...",
  "UrlToPayPal": ""
}
```
- Check `ResponseCode == 0` before using anything else. On an error `Url` is still filled (it points to an error page) - don't use it.
- `Url` is CardCom's hosted page — **not used in OpenFields**.
- `UrlToBit` is filled only when Bit is enabled on the terminal **and** `Operation` is `ChargeOnly`; otherwise it is an empty string — hide the Bit button.
- Bad `ApiName` → HTTP 401 `{ ResponseCode, Description }`. Some failures return HTTP 400 with a plain string body — handle non-200 answers.

Then, before answering the browser:
1. Save `LowProfileId` + `Operation` on the order (status `pending`).
2. Return to the front end **only** `LowProfileId` (used as `lowProfileCode`) and, if you offer Bit, `UrlToBit`.
3. **Never** return `ApiPassword` to the browser.

### 1.2 Verify a result — `GetLpResult`
`POST https://secure.cardcom.solutions/api/v11/LowProfile/GetLpResult`
```json
{ "TerminalNumber": 1000, "ApiName": "MyApiName", "LowProfileId": "3fa85f64-5717-4562-b3fc-2c963f66afa6" }
```
Returns the payment result: `ResponseCode`, `ReturnValue`, `Operation`, `TranzactionInfo`, `TokenInfo`, `DocumentInfo`, `UIValues`. It is the **source of truth** — never mark an order paid because of a browser message (`HandleSubmit`) or a webhook body. Call it from the webhook and also from your success-redirect page.

### 1.3 Webhook receiver (public)
Create `POST /api/cardcom/webhook`. When a payment ends (success, or a final failure - and on some errors the payer can still fix) CardCom POSTs JSON to it (same shape as `GetLpResult`). The webhook has **no signature**, may arrive more than once, and an error answer (4xx/5xx) to the first delivery is **not** retried - so verify, be idempotent, and don't rely on it alone.

Flow:
1. Read `LowProfileId` and `ReturnValue` (your order id) from the body.
2. Find the order. Not found or already `paid` → return 200.
3. Call `GetLpResult` and use only its answer.
4. Top-level `ResponseCode`: `0` → `paid` (J5: `authorized`); `5119` → still pending, leave it; `5117` / `5118` → cancelled / expired; anything else → `failed`. Only `paid` is final - a `failed` order can still become `paid` by a later webhook for the same LowProfile.
5. On success save `TranzactionInfo.TranzactionId`, `DocumentInfo.DocumentType` + `DocumentNumber` (if `DocumentInfo.ResponseCode == 0`) and `TokenInfo` (token operations).
6. Return 200.

Delivery and retries, the full payload, every code and field: [cardcom-integration-webhook.md](cardcom-integration-webhook.md).

### 1.4 Capture a J5 deal (deferred capture, optional)
For orders created with `CreateTokenOnly` + `JValidateType: 5`. When the merchant finalizes the order, `POST /Transactions/Transaction` with `TerminalNumber`, `ApiName`, the final `Amount`, `Token` (= `TokenInfo.Token`), `CardExpirationMMYY` (= `TokenInfo.CardMonth` 2 digits + last 2 digits of `TokenInfo.CardYear`), `Advanced.ApprovalNumber` (= `TokenInfo.TokenApprovalNumber`), `Advanced.ApiPassword`, and an optional `Document`. Full example: [cardcom-integration-suspended-deal.md](cardcom-integration-suspended-deal.md).

### 1.5 Refund / void
- Full refund of an order with a receipt-type CardCom document → `POST /Documents/CancelDoc` (refunds the card and creates the credit document). A `TaxInvoice` alone needs `CancelDoc` **and** a card refund.
- Otherwise, or a partial refund → `POST /Transactions/RefundByTransactionId` with `ApiName`, `ApiPassword`, `TransactionId` (+ `PartialSum`).

Both: `ResponseCode == 0` is success. Which call when, every field and code: [cardcom-integration-void.md](cardcom-integration-void.md).

---

# PART 2 — Front end

All front-end communication is `postMessage` to/from `CardComMasterFrame`. **Security:** post with target origin `'https://secure.cardcom.solutions'` (not `'*'`), and ignore incoming messages whose `event.origin` isn't `'https://secure.cardcom.solutions'`. Every outbound message except `ready` also carries `lowProfileCode` (except the `HandleEror` for an `init` without one) - ignore messages for another session.

The lifecycle:
1. Register your `message` listener **before** the master iframe loads (`ready` is sent only once - important in SPAs). Then embed the iframes (all with `allow="payment"`) and load `3DS.js`.
2. Wait for the master frame's `ready` message (if your page may have missed it, send `getStatus` and treat `status.masterReady` as ready). To switch to a new `lowProfileCode`, reload the master iframe and send `init` on its new `ready` - re-sending `init` keeps the attempt counter and the previous cardholder details.
3. Send `init` (with the `lowProfileCode` from your server, CSS, placeholders, and wallet button designs).
4. Handle `initialized` (a LowProfile with this code exists; reveal available wallets), `handleValidations`, `HandleSubmit`, `HandleEror`. A malformed or unknown `lowProfileCode` gives `HandleEror` 400 after about 4 seconds instead of `initialized`. An expired, revoked or already-paid LowProfile still gives `initialized` - its 400 comes on payment.
5. On card submit → `doTransaction`. Wallets submit themselves when the user clicks the native button. Bit redirects.

### 2.1 Scenario A — Credit card

**Embed (note `allow="payment"` on all three):**
```html
<form id="paymentForm">
  <div class="field-wrapper" id="cardNumberWrapper">
    <label>Card Number</label>
    <iframe name="CardComCardNumber" id="CardComCardNumber"
      src="https://secure.cardcom.solutions/api/OpenFields/CardNumber"
      allow="payment"
      style="width:100%; height:50px; border:1px solid #ccc; border-radius:4px"></iframe>
    <span class="error-msg" id="cardNumberError" style="display:none">Invalid card number</span>
  </div>

  <div class="field-wrapper">
    <label>Expiry</label>
    <input id="expirationMonth" placeholder="MM" maxlength="2" />
    <input id="expirationYear"  placeholder="YY" maxlength="2" />
  </div>

  <div class="field-wrapper" id="cvvWrapper">
    <label>CVV</label>
    <iframe name="CardComCvv" id="CardComCvv"
      src="https://secure.cardcom.solutions/api/OpenFields/CVV"
      allow="payment"
      style="width:100px; height:50px; border:1px solid #ccc; border-radius:4px"></iframe>
    <span class="error-msg" id="cvvError" style="display:none">Invalid CVV</span>
  </div>

  <input id="cardOwnerName"  placeholder="Full name" />
  <input id="cardOwnerEmail" placeholder="Email" type="email" />
  <input id="cardOwnerPhone" placeholder="Phone" type="tel" />
  <input id="cardOwnerId"    placeholder="ID number" />

  <button type="submit" id="payBtn">Pay</button>
</form>

<!-- Hidden orchestrator — REQUIRED. Keep allow="payment" and id="CardComMasterFrame" (3DS.js finds it by id). -->
<iframe name="CardComMasterFrame" id="CardComMasterFrame"
  src="https://secure.cardcom.solutions/api/OpenFields/Master"
  allow="payment"
  style="display:none"></iframe>

<!-- 3D Secure helper — REQUIRED for card payments (and Google Pay) on 3DS terminals -->
<script src="https://secure.cardcom.solutions/External/OpenFields/3DS.js"></script>
```
> The `name` attribute must match exactly — the master frame reaches siblings via `window.parent.frames["CardComCardNumber"]`.
> Expiry month/year are **your** inputs (not iframes).

**Initialize (wait for `ready`, then `init`):**
```js
const CARDCOM = 'https://secure.cardcom.solutions';
const masterFrame = document.getElementById('CardComMasterFrame').contentWindow;

window.addEventListener('message', function onReady(event) {
  if (event.origin !== CARDCOM || event.data?.action !== 'ready') return;
  window.removeEventListener('message', onReady);

  masterFrame.postMessage({
    action: 'init',
    lowProfileCode: 'LP_ID_FROM_YOUR_SERVER',   // = LowProfileId from LowProfile/Create
    language: 'he',                              // 'he' | 'en' - language of messages made in the browser
    screenWidth: screen.width.toString(),
    screenHeight: screen.height.toString(),
    screenColorDepth: screen.colorDepth.toString(),

    // CSS injected into the card-number iframe (<head>). Target #cardNumber / .cardNumber
    cardFieldCSS: `.cardNumber { width:100%; height:44px; font-size:16px; padding:0 12px;
      border:none; outline:none; background:transparent; box-sizing:border-box; }
      .cardNumber.input-error { border-bottom:2px solid #e53e3e; }`,
    // CSS injected into the CVV iframe. Target #cvvField / .cvvField
    cvvFieldCSS: `.cvvField { width:100%; height:44px; font-size:16px; padding:0 12px;
      border:none; outline:none; background:transparent; box-sizing:border-box; }
      .cvvField.input-error { border-bottom:2px solid #e53e3e; }`,
    placeholder: 'Card number',
    cvvPlaceholder: 'CVV',
  }, CARDCOM);
});
```
> **Injected CSS** is appended to the iframe `<head>` as is (a later `init` with CSS replaces it; one without CSS keeps it). Plain CSS only - don't use `url()` or `@import`: loading external resources inside the secure fields is not supported.

**Validation feedback:**
```js
window.addEventListener('message', (event) => {
  if (event.origin !== CARDCOM || event.data?.action !== 'handleValidations') return;
  // also fires on its own when a field loses focus
  const { field, isValid } = event.data;
  if (field === 'cardNumber') {
    document.getElementById('cardNumberWrapper').classList.toggle('field-error', !isValid);
    document.getElementById('cardNumberError').style.display = isValid ? 'none' : 'block';
    masterFrame.postMessage({ action: isValid ? 'removeCardNumberFieldClass' : 'addCardNumberFieldClass', className: 'input-error' }, CARDCOM);
  }
  if (field === 'cvv') {
    document.getElementById('cvvWrapper').classList.toggle('field-error', !isValid);
    document.getElementById('cvvError').style.display = isValid ? 'none' : 'block';
    masterFrame.postMessage({ action: isValid ? 'removeCvvFieldClass' : 'addCvvFieldClass', className: 'input-error' }, CARDCOM);
  }
});
```

**Submit:**
```js
document.getElementById('payBtn').addEventListener('click', (e) => {
  e.preventDefault();
  masterFrame.postMessage({ action: 'validateCardNumber' }, CARDCOM);
  masterFrame.postMessage({ action: 'validateCvv' }, CARDCOM);
  masterFrame.postMessage({
    action: 'doTransaction',
    expirationMonth: document.getElementById('expirationMonth').value,  // '05' - always send (even '')
    expirationYear:  document.getElementById('expirationYear').value,   // '27' or '2027' - always send
    numberOfPayments: 1,          // within the LowProfile's Min/MaxNumOfPayments
    cardOwnerName:  document.getElementById('cardOwnerName').value,
    cardOwnerEmail: document.getElementById('cardOwnerEmail').value,    // 3DS terminals: email or phone required
    cardOwnerPhone: document.getElementById('cardOwnerPhone').value,    // (here or in UIDefinition)
    cardOwnerId:    document.getElementById('cardOwnerId').value,
    city: '', address: '', zipCode: '',
  }, CARDCOM);
});
```
The master frame reads card number + CVV from the child iframes and charges the card. On a 3DS terminal it first asks your page to run the 3DS steps - handled by `3DS.js` (see *3D Secure* below).

**3D Secure** - on terminals with 3DS, the master frame sends `StartDeviceFingerPrint` and, if the issuer asks, `CardHolderChallenge` to **your page**. CardCom's script handles both: it runs the device fingerprint, shows the bank's challenge in a full-screen iframe and forwards the results back to the master frame.
- Load `<script src="https://secure.cardcom.solutions/External/OpenFields/3DS.js"></script>` on the checkout page (once).
- The master iframe must have `id="CardComMasterFrame"`.
- Send `cardOwnerEmail` or `cardOwnerPhone` in `doTransaction` (required with 3DS).
- Without the script (or your own handling of `StartDeviceFingerPrint`, `CardHolderChallenge` and `GetScreenValues`), 3DS payments never complete. Google Pay can also step up to 3DS through the same messages.
- Results: `HandleEror` with 333 = 3DS failed, was declined or could not run; 408 = the device fingerprint timed out and CardCom's 3DS server could not be reached to continue (safe to retry).
- Your page's Content-Security-Policy must allow `https://secure.cardcom.solutions` in `script-src`, `frame-src` and `connect-src`, plus `frame-src https:` and `form-action https:` for the bank's 3DS pages.
- If 3DS never returns, the master frame never answers - consider a timeout on your side.

**Result (shared by every scenario):**
```js
window.addEventListener('message', (event) => {
  if (event.origin !== CARDCOM) return;
  switch (event.data?.action) {
    case 'HandleSubmit':
      // Payment accepted client-side. The order is paid only after your server verifies it (GetLpResult).
      if (event.data.data?.redirectUrl) window.location.href = event.data.data.redirectUrl;
      break;
    case 'HandleEror':
      // Show the message and let the payer fix it / try again (message may be a string or an array).
      // Most errors carry redirectUrl (your FailedRedirectUrl) - use it only to end the attempt.
      console.error('Payment error:', event.data.message, 'Code:', event.data.ResponseCode);
      showError(event.data.message);
      break;
  }
});
```
`HandleEror.ResponseCode` - the browser never gets the bank's decline code:

| Code | Meaning | What to do |
|---|---|---|
| `0` | Card declined - **not success** | Show `message`; the payer may try again on the same LowProfile |
| `400` | Rejected before charging. Either input the payer can fix (missing name / expiry, email or phone on a 3DS terminal, expired or invalid card, card not supported for 3DS), or the LowProfile can't be used (not found, expired, too many attempts, already paid, terminal disabled, `numberOfPayments` out of range) | Show `message`; for the second kind create a new LowProfile |
| `99999` | Declined and the LowProfile is closed | Create a new LowProfile |
| `7001` | Google Pay token could not be processed | Show `message` |
| `404` | Card / CVV iframes missing or not loaded yet | Fix the page |
| `333` | 3DS failed, was declined or could not run | Show `message` |
| `408` | 3DS fingerprint timed out and could not continue | Retry |
| `500` | Network error, or a wallet failure with no code | Retry |
| missing | CardCom server error | Retry later |

`isDeveloperError: true` is sent only when `init` had no `lowProfileCode`. While a card payment is in progress, another `doTransaction` is ignored.

### 2.2 Scenario B — Apple Pay & Google Pay (wallet iframes)

No card-number/CVV iframes needed. Each wallet renders its **native** button inside its own visible iframe and runs the sheet there. There is **no** trigger message — the user clicks the real button inside the iframe.

**Embed (keep hidden until availability is confirmed; `allow="payment"` required):**
```html
<iframe name="CardComApplePay" id="CardComApplePay"
  src="https://secure.cardcom.solutions/api/OpenFields/ApplePay?terminalNumber=YOUR_TERMINAL_NUMBER"
  allow="payment" style="display:none; width:240px; height:48px; border:none"></iframe>

<iframe name="CardComGooglePay" id="CardComGooglePay"
  src="https://secure.cardcom.solutions/api/OpenFields/GooglePay?terminalNumber=YOUR_TERMINAL_NUMBER"
  allow="payment" style="display:none; width:240px; height:48px; border:none"></iframe>

<iframe name="CardComMasterFrame" id="CardComMasterFrame"
  src="https://secure.cardcom.solutions/api/OpenFields/Master"
  allow="payment" style="display:none"></iframe>
<script src="https://secure.cardcom.solutions/External/OpenFields/3DS.js"></script>
```
> Both wallet iframes handle a terminal without that method enabled, or a device that can't pay: `initialized` fires with `isApplePayAvailable: false` / `isGooglePayAvailable: false`. Safe to include both unconditionally and reveal by availability.
> When a wallet is unavailable, `initialized` also carries `applePayUnavailable` / `googlePayUnavailable` = `{ reason, message, domain? }`. Log it for the developer; never show it to the payer.
>
> | `reason` | Meaning | Fix |
> |---|---|---|
> | `notEnabled` | Wallet not enabled for the `terminalNumber` in the iframe URL | Check the terminal number; ask CardCom support to enable the wallet |
> | `domainNotRegistered` | Apple Pay: the page's domain (`domain`) isn't registered | See *Apple Pay domain registration* below |
> | `deviceNotSupported` | The browser/device can't pay with this wallet | Nothing — expected |
> | `sdkLoadFailed` | Google Pay: `pay.js` failed to load, or `isReadyToPay` failed, inside the CardCom iframe | Usually network or an ad/privacy blocker. Not caused by your page's CSP |
> | `serverError` | CardCom failed to build the wallet page | Retry; contact support if it persists |
> | `unknown` | An older wallet iframe reported no reason | — |

**Init with button designs + reveal on `initialized`:**
```js
window.addEventListener('message', (event) => {
  if (event.origin !== CARDCOM) return;
  if (event.data?.action === 'initialized') {
    // May fire more than once as each wallet reports in — treat as idempotent.
    document.getElementById('CardComApplePay').style.display  = event.data.isApplePayAvailable  ? 'block' : 'none';
    document.getElementById('CardComGooglePay').style.display = event.data.isGooglePayAvailable ? 'block' : 'none';
    // Why a wallet is hidden — for the developer only:
    if (event.data.applePayUnavailable)  console.warn('Apple Pay hidden:',  event.data.applePayUnavailable.reason,  event.data.applePayUnavailable.message);
    if (event.data.googlePayUnavailable) console.warn('Google Pay hidden:', event.data.googlePayUnavailable.reason, event.data.googlePayUnavailable.message);
  }
});

window.addEventListener('message', function onReady(event) {
  if (event.origin !== CARDCOM || event.data?.action !== 'ready') return;
  window.removeEventListener('message', onReady);

  masterFrame.postMessage({
    action: 'init',
    lowProfileCode: 'LP_ID_FROM_YOUR_SERVER',
    language: 'he',
    screenWidth: screen.width.toString(),
    screenHeight: screen.height.toString(),
    screenColorDepth: screen.colorDepth.toString(),

    // Google Pay button design (forwarded to the Google Pay iframe):
    googlePayButton: {
      buttonColor: 'black',   // see color list below
      buttonType:  'buy',     // see type list below (button text)
      buttonSizeMode: 'fill', // 'fill' | 'static'
      buttonRadius: 4,
      buttonLocale: 'en',     // button language — see locale list below (Google Pay has no Hebrew button)
    },
    // Apple Pay button design (forwarded to the Apple Pay iframe):
    applePayButton: {
      type: 'buy',            // see type list below (button text)
      buttonstyle: 'black',   // 'black' | 'white' | 'white-outline'
      locale: 'he-IL',        // button language — see locale list below
      radius: 4,              // -> --apple-pay-button-border-radius (px)
    },
  }, CARDCOM);
});
```

**Cardholder details for wallets:** if you collect name/email/phone elsewhere, push them so they reach the wallet sheets **before** the user pays:
```js
masterFrame.postMessage({
  action: 'setCardOwnerDetails',
  data: { CardOwnerName: 'Jane Doe', CardOwnerEmail: 'jane@example.com', CardOwnerPhone: '0501234567' }
}, CARDCOM);
```
Send all three keys. In the wallet iframes non-empty values overwrite what they hold and empty / missing values are ignored; in the master frame they replace the copy `doTransaction` falls back to. Sent before `initialized`, non-empty `UIDefinition` values from `LowProfile/Create` win; sent after, your values win. Apple Pay uses the name, email and phone from the Apple Pay sheet first.
Results arrive on `HandleSubmit` / `HandleEror` exactly as in Scenario A.

### 2.3 Customizing the wallet button text, color, and language

Both wallets let you change the **button verb** (its text), the **color/style**, and the **language** via the design objects in `init`. All three of Apple Pay, Google Pay, and Bit must end up the **same size** — see the sizing section.

#### Google Pay (`googlePayButton`)
- **`buttonType`** (the button text) — one of:
  `book`, `buy`, `checkout`, `donate`, `order`, `pay`, `plain`, `subscribe`.
  Pick the verb that matches your checkout (e.g. `donate` for donations, `subscribe` for subscriptions, `plain` for the logo only).
- **`buttonColor`** — `default` \| `black` \| `white`. Use dark on light backgrounds, light/white on dark backgrounds.
- **`buttonLocale`** (button language) — one of:
  `en`, `ar`, `bg`, `ca`, `cs`, `da`, `de`, `el`, `es`, `et`, `fi`, `fr`, `hr`, `id`, `it`, `ja`, `ko`, `ms`, `nl`, `no`, `pl`, `pt`, `ru`, `sk`, `sl`, `sr`, `sv`, `th`, `tr`, `uk`, `zh`.
- **`buttonSizeMode`** — `fill` (fills the iframe) or `static`. **`buttonRadius`** — corner radius in px.

#### Apple Pay (`applePayButton`)
- **`type`** (the button text) — one of:
  `plain`, `continue`, `add-money`, `book`, `buy`, `check-out`, `contribute`, `donate`, `order`, `pay`, `reload`, `rent`, `set-up`, `subscribe`, `support`, `tip`, `top-up`.
- **`buttonstyle`** (color) — `black` \| `white` \| `white-outline`. Use `black` on light backgrounds; `white` or `white-outline` on dark backgrounds (`white-outline` adds a border so a white button stays visible on white).
- **`locale`** (button language) — one of:
  `en-US`, `ar-AB`, `ca-ES`, `zh-CN`, `zh-HK`, `zh-TW`, `hr-HR`, `cs-CZ`, `da-DK`, `de-DE`, `nl-NL`, `en-AU`, `en-GB`, `fi-FI`, `fr-CA`, `fr-FR`, `el-GR`, `he-IL`, `hi-IN`, `hu-HU`, `id-ID`, `it-IT`, `ja-JP`, `ko-KR`, `ms-MY`, `nb-NO`, `pl-PL`, `pt-BR`, `pt-PT`, `ro-RO`, `ru-RU`, `sk-SK`, `es-MX`, `es-ES`, `sv-SE`, `th-TH`, `tr-TR`, `uk-UA`, `vi-VN`.
- **`radius`** — corner radius in px.

> CardCom passes these values unchanged to Apple / Google, which handle (or ignore) unsupported values. If you omit them: Apple `type: buy`, `buttonstyle: black`, `locale: he-IL`, radius 4px; Google `buttonSizeMode: fill`, and for type/color/locale the values from `LowProfile/Create` → `UIDefinition.GooglePayBtnDesign`, else Google's defaults (`buy`, `default`, the browser's language). Keep the **verb consistent** across wallets (e.g. all `buy`, or all `donate`) so the row reads coherently.

### 2.4 Scenario C — Bit

Bit is **not** an iframe. It is your own button that redirects the browser to CardCom's `UrlToBit`.

**Flow:**
1. Your server calls `LowProfile/Create` (Part 1) with `Operation: ChargeOnly`. When **Bit is enabled on the terminal**, the response's `UrlToBit` is filled (otherwise it is an empty string). Return it to the front end.
2. Render a **Bit button** using CardCom's supplied Bit logo (below), sized to match the Apple/Google buttons.
3. On click, navigate the browser to the URL: `window.location.assign(bitUrl)`.
4. On **mobile**, this opens the **Bit app**; on **desktop**, CardCom's page shows a **QR code** for the customer to scan and approve in the Bit app.
5. After the customer approves, Bit returns via your `SuccessRedirectUrl` / `FailedRedirectUrl`, and you get the **same webhook** as every other flow. Verify with `GetLpResult` and mark the order paid (identical server handling to card/wallet).

**Bit button (uses the CardCom-supplied logo — inline SVG so it's self-contained):**
```html
<button id="bitBtn" type="button" class="bit-button" aria-label="Pay with Bit"
        style="display:inline-flex; align-items:center; justify-content:center;
               width:240px; height:48px; border:none; border-radius:4px;
               background:#00353b; cursor:pointer; padding:0;">
  <!-- Bit 2024 logo mark -->
  <svg width="28" height="28" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
    <rect width="128" height="128" x="0" y="0" fill="#00353b"/>
    <path fill="#39edf6" d="m 91.607442,84.978197 c -2.577293,4.275772 -6.634926,6.413747 -12.172897,6.413747 -3.564186,0 -6.580077,-0.908687 -9.047493,-2.725887 -2.467415,-1.817199 -4.11248,-4.596548 -4.935012,-8.337871 -2.138512,3.580935 -5.565486,6.306823 -10.281109,8.177484 -4.715623,1.870661 -9.952206,2.805992 -15.709569,2.805992 -14.640402,0 -21.960594,-6.680883 -21.960594,-20.043005 v -29.90433 c 0,-1.122414 0.383824,-2.057763 1.151491,-2.806044 0.822496,-0.801709 1.80948,-1.202574 2.960971,-1.202574 1.15149,0 2.111067,0.400865 2.878717,1.202574 0.822495,0.748281 1.233744,1.68363 1.233744,2.806044 v 15.553417 c 2.906141,-2.886097 6.52512,-4.329235 10.85699,-4.329235 3.399462,0 6.415352,0.801762 9.04731,2.405111 2.686807,1.550063 4.77047,3.714681 6.250992,6.49403 1.535369,2.779173 2.302873,5.932759 2.302873,9.460232 0,2.512213 -0.383752,4.863861 -1.151437,7.055299 -0.767684,2.191261 -1.891788,4.115385 -3.372128,5.772372 4.33169,-1.122361 7.813693,-3.233693 10.445651,-6.33364 2.631959,-3.09995 3.947937,-6.814629 3.947937,-11.144041 v -9.700727 c 0,-1.122538 0.383753,-2.057869 1.151438,-2.806168 0.822532,-0.801587 1.809427,-1.202468 2.961042,-1.202468 1.151438,0 2.110998,0.400881 2.878683,1.202468 0.822532,0.748299 1.233799,1.68363 1.233799,2.806168 v 16.996519 c 0,3.687859 0.603141,6.413747 1.809425,8.177482 1.206284,1.763914 3.098072,2.645782 5.675182,2.645782 2.961043,0 5.236584,-1.015614 6.8268,-3.046663 1.644883,-2.084335 2.467415,-5.050715 2.467415,-8.898963 V 60.285006 h -5.263915 c -1.151617,0 -2.138511,-0.374062 -2.961044,-1.122361 -0.767684,-0.748301 -1.151435,-1.656989 -1.151435,-2.725887 0,-1.0689 0.383751,-1.977588 1.151435,-2.725887 0.822533,-0.748301 1.809427,-1.122362 2.961044,-1.122362 h 5.263915 V 41.444505 c 0,-1.122415 0.383753,-2.057765 1.151436,-2.806046 0.822535,-0.801727 1.809429,-1.20259 2.961044,-1.20259 1.151437,0 2.110998,0.400863 2.878682,1.20259 0.822533,0.748281 1.233795,1.683631 1.233795,2.806046 V 52.588509 H 107.975 c 1.15142,0 2.11097,0.374061 2.87868,1.122362 0.82253,0.748299 1.23378,1.656987 1.23378,2.725887 0,1.068898 -0.41125,1.977586 -1.23378,2.725887 -0.76771,0.748299 -1.72726,1.122361 -2.87868,1.122361 H 97.28262 v 13.228375 c 0,6.574135 1.891604,9.861291 5.67518,9.861291 1.86427,0 3.39965,-0.694837 4.60593,-2.084514 0.65799,-0.748298 1.26112,-1.309391 1.80941,-1.683629 0.54831,-0.427523 1.17896,-0.641375 1.8918,-0.641375 1.15144,0 2.11099,0.374238 2.87869,1.122362 0.76768,0.694837 1.15161,1.603526 1.15161,2.725886 0,1.389676 -0.5758,2.752708 -1.72724,4.088919 -1.15162,1.336211 -2.68682,2.40511 -4.60612,3.206875 -1.9191,0.855047 -3.94792,1.282748 -6.08644,1.282748 -2.52227,0 -4.74296,-0.56127 -6.662072,-1.683632 -1.864274,-1.069074 -3.399644,-2.64578 -4.605926,-4.730115 z M 71.374126,44.891907 c -0.877378,0.855172 -1.946635,1.282766 -3.207767,1.282766 -1.26113,0 -2.330386,-0.427594 -3.207767,-1.282766 -0.877378,-0.855172 -1.315979,-1.87068 -1.315979,-3.046539 0,-1.229322 0.438601,-2.271561 1.315979,-3.126733 0.932229,-0.855173 2.001485,-1.282766 3.207767,-1.282766 1.261132,0 2.330389,0.427593 3.207767,1.282766 0.877199,0.855172 1.315979,1.897411 1.315979,3.126733 0,1.175859 -0.43878,2.191367 -1.315979,3.046539 z M 28.686663,80.247903 c 1.973931,2.084512 4.441529,3.126769 7.402391,3.126769 2.7965,0 5.126886,-1.042257 6.991161,-3.126769 1.864453,-2.08451 2.7965,-4.837041 2.7965,-8.257765 0,-3.367261 -0.95956,-6.119791 -2.878682,-8.257765 -1.919121,-2.137798 -4.304354,-3.206874 -7.155704,-3.206874 -2.851348,0 -5.236583,1.042256 -7.155666,3.126768 -1.919141,2.084512 -2.87872,4.810399 -2.87872,8.177483 0,3.474186 0.959579,6.28018 2.87872,8.418153 z"/>
  </svg>
  <span style="color:#fff; font-size:16px; margin-inline-start:8px;">Pay with Bit</span>
</button>
```
```js
document.getElementById('bitBtn').addEventListener('click', async () => {
  // bitUrl = UrlToBit of the LowProfile your server created for this checkout
  // (or ask your server for a fresh LowProfile here, if the payer may have retried)
  if (!bitUrl) return;                   // Bit not enabled - the button should not be shown at all
  window.location.assign(bitUrl);        // mobile → Bit app; desktop → QR code page
});
```
- Bit's **look** (label language, small vs large variant) is your choice, but its **size/shape must match** the Apple/Google buttons (see below).
- If `UrlToBit` is empty (Bit disabled on the terminal, or `Operation` is not `ChargeOnly`), do not render the Bit button.

---

## Button design & sizing — hard requirement

**All external payment buttons — Apple Pay, Google Pay, and Bit — must be the same size** (same width and height, and the same corner radius/shape). Render them in one row so no method looks more or less prominent than another. This is both a good-UX rule and a brand requirement of Apple and Google.

Practical recipe:
- Choose one canonical size, e.g. `height: 48px; width: 240px` (or `width: 100%` if the buttons stack full-width). Apply the **identical** width/height to all three.
- Use the **same corner radius** everywhere. Pass it as `googlePayButton.buttonRadius`, `applePayButton.radius`, and the CSS `border-radius` on the Bit button. Clamp the radius to at most **half the height** (a full pill) so the native wallet buttons can actually render it.
- Keep at least the required clear space around each button (see Google below); don't crowd them against other elements.

### Apple Pay guidelines
- Follow Apple's Human Interface Guidelines: **https://developer.apple.com/design/human-interface-guidelines/apple-pay/**
- The Apple Pay button must be **at least as prominent as, and no smaller than,** any other payment button on the page.
- Use `black` on light backgrounds; use `white` or `white-outline` on dark/colored backgrounds (`white-outline` keeps a white button visible on white). Maintain adequate clear space around the button and don't distort its proportions.
- Displaying an Apple Pay button on the web additionally requires **domain registration** (next section).

### Google Pay guidelines
- Follow Google's brand guidelines: **https://developers.google.com/pay/api/web/guides/brand-guidelines**
- Maintain a **minimum clear space of 8 dp on all sides** of the button.
- The Google Pay button should be **equal in size to the other payment buttons** it sits next to.
- Keep the button's **proportions consistent** when resizing. Use a dark button on light backgrounds and a light button on dark/colored backgrounds.

### Bit
- Match the exact width/height/radius of the Apple and Google buttons. Use CardCom's supplied Bit logo (inlined above) — don't recolor or redraw it.

---

## Apple Pay domain registration (required for web)

Apple Pay on the web only works from a **registered merchant domain**. Before Apple Pay will appear or complete, the site's domain must be **registered with CardCom's Apple Pay** setup.

- Follow CardCom's official instructions: **https://support.cardcom.solutions/hc/he/articles/4404382218258-%D7%AA%D7%A9%D7%9C%D7%95%D7%9D-%D7%91%D7%90%D7%9E%D7%A6%D7%A2%D7%95%D7%AA-ApplePay-%D7%A8%D7%99%D7%A9%D7%95%D7%9D-%D7%93%D7%95%D7%9E%D7%99%D7%99%D7%9F-%D7%9E%D7%95%D7%9C-APPLE-%D7%91%D7%A9%D7%91%D7%99%D7%9C-IFRAME**
- **Important limitation:** you **cannot** register a free provider-supplied subdomain (e.g. a `*.lovable.app` style subdomain from site builders like Lovable). Apple's domain-registration process does not accept those. The store must be served from a **real domain the merchant controls**; register that domain before going live.
- The domain that counts is the domain of the page that embeds the iframes (e.g. `checkout.example.com`), not `secure.cardcom.solutions`. The match is exact: `www.example.com` and `example.com` are separate registrations. Register every domain you serve checkout from, including staging.
- Steps: serve the domain-association file (https://secure.cardcom.solutions/help/apple/apple-developer-merchantid-domain-association.zip, unzipped) at `https://YOUR_DOMAIN/.well-known/apple-developer-merchantid-domain-association`, then register the domain in the terminal's Apple Pay settings in the CardCom account.
- If Apple Pay never appears on a supported Safari/iOS device, check `applePayUnavailable.reason` in `initialized`: `domainNotRegistered` = register the domain (it names it in `domain`); `notEnabled` = Apple Pay isn't enabled for the terminal — ask CardCom support. (The domain check uses the `Referer` of the iframe request; with `Referrer-Policy: no-referrer` it is skipped and an unregistered domain only fails when the payer taps the button.)

---

## Appendix — full postMessage API

### Inbound (your page → master frame)

**`init`** — initializes the session; must be sent before anything else.
| Field | Type | Required | Description |
|---|---|---|---|
| `lowProfileCode` | string | yes | `LowProfileId` from `LowProfile/Create` |
| `language` | string | no | `'he'` \| `'en'` - language of messages made in the browser. Any other value, or empty with a non-he/en LowProfile, gives Hebrew. Messages from the server follow `LowProfile/Create` `Language` |
| `apiName` | string | no | **Don't send** - `ApiName` must stay on your server. Ignored |
| `terminalNumber` | string | no | Ignored - the terminal comes from the LowProfile |
| `screenWidth`/`screenHeight`/`screenColorDepth` | string | recommended | From `screen.*` (`3DS.js` also supplies them) |
| `cardFieldCSS` | string | no | CSS into the card-number iframe |
| `cvvFieldCSS` | string | no | CSS into the CVV iframe |
| `placeholder` / `cvvPlaceholder` | string | no | Field placeholders |
| `googlePayButton` | object | no | `{ buttonColor, buttonType, buttonSizeMode, buttonRadius, buttonLocale }` — see §2.3 |
| `applePayButton` | object | no | `{ type, buttonstyle, locale, radius }` — see §2.3 |

**`doTransaction`** — submit a card payment (master reads card number + CVV from the child iframes; on 3DS terminals runs 3DS through `3DS.js`).
| Field | Type | Required | Notes |
|---|---|---|---|
| `expirationMonth` / `expirationYear` | string | yes | `'05'`; year `'27'` or `'2027'`. **Always send both keys** - if one is missing the master frame fails without answering |
| `numberOfPayments` | number | no | default `1`; must be within the LowProfile's `Min/MaxNumOfPayments` |
| `cardOwnerName` | string | yes | or `UIDefinition.CardOwnerNameValue` |
| `cardOwnerEmail` | string | no* | 3DS terminals: email **or** phone required (here or in `UIDefinition`) |
| `cardOwnerPhone` | string | no* | see `cardOwnerEmail` |
| `cardOwnerId` | string | no | Israeli ID |
| `city` / `address` / `zipCode` | string | no | |

**`setCardOwnerDetails`** — `{ data: { CardOwnerName, CardOwnerEmail, CardOwnerPhone } }`; propagates to both wallet frames. Send all three keys - details in §2.2.
**`validateCardNumber`** / **`validateCvv`** — trigger validation; result comes back on `handleValidations`.
**`addCardNumberFieldClass`** / **`removeCardNumberFieldClass`** — `{ className }`; toggle a class on the card-number `<input>` for error styling.
**`addCvvFieldClass`** / **`removeCvvFieldClass`** — same for CVV.
**`isApplePayAvailable`** / **`isGooglePayAvailable`** — query cached availability.
**`getStatus`** — returns master + wallet readiness in one `status` message.
**`SetScreenValues`** — `{ screenData: { screenWidth, screenHeight, screenColorDepth } }`; answer to `GetScreenValues` (handled by `3DS.js`; optional, since `init` already carries these values).
**3DS results** — the strings `'ThreeDSecureDeviceFingerprintResult_…'` and `'ThreeDSecureChallengeResult_…'`; posted by `3DS.js`, not by you.

> **No wallet trigger message exists.** Apple Pay / Google Pay buttons render inside their own iframes and the user clicks them directly (Apple requires the gesture inside the frame). Style them via `googlePayButton` / `applePayButton` in `init`, and reveal on `initialized`.

### Outbound (master frame → your page)

Every outbound message except `ready` carries `lowProfileCode` (except the `HandleEror` for an `init` without one).

**`ready`** — `{ action:'ready' }`. Sent **once**, as soon as the master script runs - register your listener before the iframe loads. The trigger for sending `init`.
**`initialized`** — `{ isApplePayAvailable, isGooglePayAvailable, applePayUnavailable?, googlePayUnavailable? }`. First sent when the LowProfile settings load (= a LowProfile with this code exists; it may still be expired or already paid), even with no wallet iframes on the page. May fire more than once; treat as idempotent and reveal/hide wallets by the latest flags. `xxxUnavailable` = `{ reason, message, domain? }` while that wallet is unavailable (reasons in §2.2).
**`handleValidations`** — `{ field: 'cardNumber'|'cvv', isValid }`. Sent after `validateCardNumber`/`validateCvv` and when a field loses focus.
**`HandleSubmit`** — success: `{ data: { IsSuccess, ResponseCode, Description, InternalDealNumber, DocumentNumber, DocumentType, DocumentLink, IsSessionClosed, IsDeveloperError, IsInputError, redirectUrl } }`. Not proof of payment - verify on the server.
**`HandleEror`** — failure: `{ isError:true, message: string|string[], ResponseCode, redirectUrl?, isDeveloperError? }`. Codes in §2.1 *Result* - `ResponseCode: 0` here is a decline, not success.
**`isApplePayAvailable`** / **`isGooglePayAvailable`** — `{ result: boolean, unavailable?: { reason, message, domain? } }` (query response).
**`status`** — `{ masterReady, lpSettingsLoaded, googlePay:{ frameReady, isAvailable, unavailable? }, applePay:{ frameReady, isAvailable, unavailable? } }`.
**`NEXT_PRESSED`** — user pressed Enter / mobile "Next" in a secure field; advance focus to your next field.
**`StartDeviceFingerPrint`**, **`CardHolderChallenge`**, **`GetScreenValues`** *(3DS)* — sent to your page during a 3DS payment (card, and Google Pay step-up). **Handled by `3DS.js`** - load it on the checkout page. Without it 3DS payments never complete.

---

## Implementation checklist (deliverables)
- [ ] Built and tested on a CardCom **test company / test terminal** (requested from CardCom support) before going live.
- [ ] Credentials stored server-side; `ApiPassword` never reaches the browser.
- [ ] `LowProfile/Create`, `GetLpResult`, webhook receiver, refund implemented server-side.
- [ ] A fresh LowProfile per checkout visit and after the current one is closed; `apiName` / `ApiPassword` never sent from the browser.
- [ ] All CardCom iframes carry `allow="payment"`; the master iframe has `name` and `id` `CardComMasterFrame`.
- [ ] `3DS.js` loaded on the checkout page; `doTransaction` sends email or phone.
- [ ] `postMessage` uses target origin `https://secure.cardcom.solutions`; incoming messages are checked by `event.origin`.
- [ ] Card flow: `ready` → `init` → validation → `doTransaction` → result; `HandleEror` shows the message and lets the payer retry.
- [ ] Apple Pay + Google Pay iframes embedded, revealed on `initialized`, buttons styled (type/color/locale) per §2.3.
- [ ] Bit button rendered with the supplied logo, wired to `UrlToBit` redirect; hidden when unavailable.
- [ ] Apple, Google, and Bit buttons rendered at the **same size**.
- [ ] Apple Pay domain registered with CardCom (real domain, not a free subdomain).
- [ ] Order marked paid **only** after `GetLpResult` verification (`ResponseCode == 0`), from the webhook and the success-redirect page; webhook idempotent; pending codes 5117/5118/5119 handled; all errors log `Description` + `ResponseCode`.
- [ ] `transactionId`, `documentType` + `documentNumber` and (token operations) `TokenInfo` saved on the order.
- [ ] Admin can void / refund ([cardcom-integration-void.md](cardcom-integration-void.md)); documents created as needed ([cardcom-integration-documents.md](cardcom-integration-documents.md)).
