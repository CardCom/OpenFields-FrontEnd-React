# CardCom integration - Webhook and result validation

> Part of the OpenFields docs. Main guide: [cardcom-openfields-ecommerce-integration.md](cardcom-openfields-ecommerce-integration.md).

## Goal
- Receive CardCom's webhook after a payment, **verify** the result with `LowProfile/GetLpResult`, and update the order.
- Save what you need later to void/refund the deal, cancel its document, or capture a deferred (J5) deal.

## Prerequisites
- An existing store with a backend and an orders table.
- `LowProfile/Create` implemented, with `WebHookUrl` sent on every create.

## Endpoints
- Your endpoint: `POST /api/cardcom/webhook` (public). Pass its URL in `LowProfile/Create` → `WebHookUrl`.
- Verify: `POST https://secure.cardcom.solutions/api/v11/LowProfile/GetLpResult`

## How CardCom sends the webhook
- `POST` to your `WebHookUrl` with a **JSON** body (`Content-Type: application/json`, UTF-8) - the same object `GetLpResult` returns (see below).
- **No signature or secret.** Anyone can POST to your endpoint, so never act on the body itself: always verify with `GetLpResult`.
- Sent **once, synchronously**, before the customer is redirected, with a **10 second** timeout. Answer HTTP 200 fast and do slow work afterwards.
- When it is sent:
  - on **success**;
  - on a **final failure** (a decline the payer can't retry, or the payer ran out of tries);
  - on some errors **the payer can still fix on the same page** (e.g. `50019`, ID number required) - so a failure webhook is **not always final**: the same LowProfile can still be paid, and then a success webhook follows;
  - **not** on a card decline the payer can retry - the page simply stays pending;
  - if the terminal has CardCom's *always notify* option: also for an **abandoned** page after its timeout, carrying the last failed attempt or a pending code.
- **Any HTTP answer to the first call counts as delivered** - a 4xx/5xx is **not** retried. Retries happen only when the first call fails at network level or times out: about +1 min, +2 min, +2 min, +16 min, +1 h, +12 h, +12 h (7 retries). During retries a non-2xx answer is retried, and 403/404 stops them. Give the exact final URL (no redirects).
  So don't rely on the webhook alone: also call `GetLpResult` from your success-redirect page, and from a reconciliation job for orders still pending.
- Duplicates are possible - make the handler **idempotent**.
- `WebHookUrl` must be a public `http(s)` URL. `localhost` and private addresses are rejected by `LowProfile/Create` with **5170** - use a tunnel (e.g. ngrok) in development.

## Flow
1. Parse `LowProfileId` and `ReturnValue` (your order id) from the body. Don't trust anything else in it.
2. Find the order (by `LowProfileId`, or by `ReturnValue`). Not found, or already `paid` → return HTTP 200 and stop. **Only `paid` is irreversible**: never move a paid order back, but a `failed` order may still become `paid` (see *When it is sent*).
3. Call `GetLpResult` with your `TerminalNumber`, `ApiName` and the `LowProfileId`. **From here on use only its response.** Check that `LowProfileId`, `TerminalNumber` and `ReturnValue` match the order, and that `TranzactionInfo.Amount` + `CoinId` match it (they differ only if your terminal adds a card commission or converts the currency to ILS).
4. Decide by the **top-level** `ResponseCode` of `GetLpResult`:

   | `ResponseCode` | Meaning | Order status |
   |---|---|---|
   | `0` | Success - for every operation, **J5 included** | `paid` (J5 / `CreateTokenOnly`: `authorized`, waiting for capture) |
   | `5119` | Still pending - the payer can still pay or retry on the page | leave `pending`; `PendingReason` tells you why (e.g. the last attempt was declined) |
   | `5117` | The payment page was revoked | `cancelled` |
   | `5118` | The payment page is older than 24 h and was not paid | `expired` |
   | anything else | Failed | `failed` - store and log `ResponseCode` + `Description`. A later `0` for the same LowProfile turns it into `paid`. |

   Nested objects have their own `ResponseCode`s - payment success is decided by the **top-level** one only.
   For `CreateTokenOnly` (J2 / J5) a declined card is reported as `5119` / `5117` / `5118`, with the decline in `PendingReason`.
   For a J5 hold, `TranzactionInfo.ResponseCode` is `701` and `TranzactionInfo.JParameter` is `"5"`. That is normal, not an error.
5. On success save on the order - you need these later:

   | Save | From | Used for |
   |---|---|---|
   | `transactionId` | `TranzactionInfo.TranzactionId` | refund / void ([cardcom-integration-void.md](cardcom-integration-void.md)) |
   | `documentType` + `documentNumber` | `DocumentInfo.DocumentType` + `DocumentInfo.DocumentNumber`, only if `DocumentInfo.ResponseCode == 0` | cancel the document; document URL |
   | `token` | the whole `TokenInfo` object (`CreateTokenOnly` / `ChargeAndCreateToken`) | capture a J5 ([cardcom-integration-suspended-deal.md](cardcom-integration-suspended-deal.md)) or charge again |

6. Document link for the customer: `TranzactionInfo.DocumentUrl`. (`DocumentInfo.DocumentUrl` and `UTM` are filled only in the first webhook delivery - they are `null` in `GetLpResult` and in retries.) You can also create a link any time with `Documents/CreateDocumentUrl` ([cardcom-integration-documents.md](cardcom-integration-documents.md)).
7. Return HTTP 200.

## GetLpResult

**Request** - `ApiName` only, no password:
```json
{
  "TerminalNumber": 1000,
  "ApiName": "MyApiName",
  "LowProfileId": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```

Other outcomes:
- `ResponseCode` `5096` (HTTP 200) - no such `LowProfileId` **on that terminal** (a wrong `TerminalNumber` gives this too).
- HTTP 401 `{ "ResponseCode", "Description" }` - wrong `ApiName`.
- HTTP 400 with `ResponseCode` `6325` - empty or invalid JSON body.

**Response** - also the webhook body (example of a successful `ChargeOnly` with a document):
```json
{
  "ResponseCode": 0,
  "Description": "string",
  "TerminalNumber": 1000,
  "LowProfileId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "TranzactionId": 123456789,
  "ReturnValue": "ORDER_123456",
  "Operation": "ChargeOnly",
  "AccountId": 54321,
  "UIValues": {
    "CardOwnerEmail": "john@example.com",
    "CardOwnerName": "John Doe",
    "CardOwnerPhone": "0501234567",
    "CardOwnerIdentityNumber": "123456789",
    "NumOfPayments": 1,
    "CardYear": 2028,
    "CardMonth": 12,
    "IsAbroadCard": false,
    "CustomFields": [ { "Id": 1, "Value": "string" } ]
  },
  "DocumentInfo": {
    "ResponseCode": 0,
    "Description": "string",
    "DocumentType": "TaxInvoiceAndReceipt",
    "DocumentNumber": 1234,
    "AccountId": 54321,
    "ForeignAccountNumber": "string",
    "SiteUniqueId": "string",
    "DocumentUrl": null
  },
  "TokenInfo": null,
  "SuspendedInfo": null,
  "TranzactionInfo": {
    "ResponseCode": 0,
    "Description": "string",
    "TranzactionId": 123456789,
    "TerminalNumber": 1000,
    "Amount": 150.50,
    "CoinId": 1,
    "CouponNumber": "string",
    "CreateDate": "2026-01-15T14:30:00",
    "Last4CardDigits": 1234,
    "Last4CardDigitsString": "1234",
    "FirstCardDigits": 458012,
    "JParameter": "4",
    "CardMonth": 12,
    "CardYear": 28,
    "ApprovalNumber": "string",
    "FirstPaymentAmount": 0,
    "ConstPaymentAmount": 0,
    "NumberOfPayments": 1,
    "CardInfo": "Israeli",
    "CardOwnerName": "John Doe",
    "CardOwnerPhone": "0501234567",
    "CardOwnerEmail": "john@example.com",
    "CardOwnerIdentityNumber": "123456789",
    "Token": null,
    "CardName": "string",
    "SapakMutav": "string",
    "Uid": "string",
    "ConcentrationNumber": "string",
    "DocumentNumber": 1234,
    "DocumentType": "TaxInvoiceAndReceipt",
    "DocumentUrl": "https://...",
    "Rrn": "string",
    "Brand": "Visa",
    "Acquire": "Isracard",
    "Issuer": "CAL",
    "PaymentType": "Standard",
    "CardNumberEntryMode": "Internet",
    "DealType": "Debit",
    "IsRefund": false,
    "IsAbroadCard": false,
    "AccountId": 54321,
    "IssuerAuthCodeDescription": "string",
    "CustomFields": [ { "Id": 1, "Value": "string" } ]
  },
  "PendingReason": null,
  "ExternalPaymentVector": "NoneOrUnknown",
  "Country": "string",
  "UTM": { "Source": "string", "Medium": "string", "Campaign": "string", "Content": "string", "Term": "string" },
  "IssuerAuthCodeDescription": "string"
}
```

For a token operation `TokenInfo` looks like:
```json
"TokenInfo": {
  "Token": "a1b2c3d4-e5f6-4789-0123-456789abcdef",
  "TokenExDate": "20290101",
  "CardYear": 2028,
  "CardMonth": 12,
  "TokenApprovalNumber": "string",
  "CardOwnerIdentityNumber": "123456789"
}
```

### Key fields

| Field | Description |
|---|---|
| `ResponseCode` | Top-level result - see the table in *Flow*. |
| `Operation` | String: `ChargeOnly` / `ChargeAndCreateToken` / `CreateTokenOnly` / `SuspendedDeal`; `null` for other page types. |
| `UIValues` | What the cardholder entered on the page. Always present. `CardYear` is **4 digits**. |
| `TranzactionInfo` | Present when the page has a recorded result (success, or a final failure); `null` while pending - see `PendingReason`. `Amount` is in currency units (150.50), not agorot. `CardYear` here is **2 digits**. |
| `TokenInfo` | Present only when a token was created (successful `ChargeAndCreateToken` / `CreateTokenOnly`). `CardYear` is **4 digits**. `TokenExDate` (yyyyMMdd) is the first day after the card expires. To capture a J5 use `TokenApprovalNumber`. |
| `DocumentInfo` | Present when a document was attempted. The document exists only if its own `ResponseCode == 0` (otherwise `DocumentType` is `"Error"`). `DocumentType` is a **name** - convert it to a number for `Documents/CancelDoc` (table in [cardcom-integration-documents.md](cardcom-integration-documents.md#document-types)). |
| `SuspendedInfo` | Only for `Operation = SuspendedDeal` (`SuspendedDealId`). |
| `PendingReason` | Only with 5117/5118/5119, in `GetLpResult` (not in the first webhook delivery): the newest failed attempt (`ResponseCode`, `Description`, `TranzactionId`), or `null`. Explains *why* nothing completed - don't fail the order because of it. |
| `UTM` | The `UTM` you sent to `LowProfile/Create` - only in the first webhook delivery. |
| `CustomFields` | `[{ "Id": 1-25, "Value": "..." }]`; only non-empty fields are included. |

Enum fields (`DocumentType`, `Operation`, `CardInfo`, `Brand`, `Acquire`, `Issuer`, `PaymentType`, `CardNumberEntryMode`, `DealType`, `ExternalPaymentVector`) are normally strings; a value CardCom has no name for comes as a number - accept both.
