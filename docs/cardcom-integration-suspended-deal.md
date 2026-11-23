# CardCom integration - J5: authorize now, capture later (deferred deal)

> Part of the OpenFields docs. Main guide: [cardcom-openfields-ecommerce-integration.md](cardcom-openfields-ecommerce-integration.md).

## Goal
- Authorize (hold) an amount on the customer's card at checkout, and charge it later when the merchant finalizes the order.
- Allow the final amount to change - e.g. weighted products.

## Prerequisites
- Basic integration and the webhook are done ([cardcom-integration-webhook.md](cardcom-integration-webhook.md)).
- The terminal has the tokens permission for payment pages (otherwise `LowProfile/Create` returns 651).

## 1. LowProfile/Create
When the merchant enables "deferred payment", create the LowProfile with:
- `Operation`: **`CreateTokenOnly`**
- `AdvancedDefinition.JValidateType`: **`5`** (J5 - authorize `Amount`)
- No `Document` - with `CreateTokenOnly` it would only be displayed, never created. Create the document at capture (step 3).
- All other fields as usual.

> **Don't use `ChargeAndCreateToken` for this.** It charges the card immediately and ignores `JValidateType` - capturing later would charge the customer a second time.

Bit is not offered with `CreateTokenOnly` (`UrlToBit` is empty).

## 2. Webhook
The customer pays as usual. Verify with `GetLpResult` as in [cardcom-integration-webhook.md](cardcom-integration-webhook.md):
- Success is top-level **`ResponseCode == 0`**. (`TranzactionInfo.ResponseCode` is `701` and `TranzactionInfo.JParameter` is `"5"` for a J5 hold - that is normal.)
- Mark the order `authorized` (waiting for capture), not `paid`.
- Save the whole `TokenInfo` object. You need `Token`, `CardMonth`, `CardYear` and `TokenApprovalNumber` to capture; `CardOwnerIdentityNumber` may also be needed, depending on the terminal.
- For the capture use `TokenInfo.TokenApprovalNumber` (for a J5 it holds the same value as `TranzactionInfo.ApprovalNumber`).

## 3. Capture - Transactions/Transaction
The admin sets the final amount and triggers the capture. `POST https://secure.cardcom.solutions/api/v11/Transactions/Transaction`. The answer is synchronous - no webhook.

Map the saved `TokenInfo`:
- `Token` ← `TokenInfo.Token`
- `CardExpirationMMYY` ← `TokenInfo.CardMonth` zero-padded to 2 digits + the **last 2 digits** of `TokenInfo.CardYear` (`CardYear` is 4 digits). E.g. month `3`, year `2028` → `"0328"`. A value that isn't 4 digits (a 3-digit one is left-padded) fails with 1000.
- `Advanced.ApprovalNumber` ← `TokenInfo.TokenApprovalNumber`

**Request**
```json
{
  "TerminalNumber": 1000,
  "ApiName": "MyApiName",
  "Amount": 142.30,
  "Token": "a1b2c3d4-e5f6-4789-0123-456789abcdef",
  "CardExpirationMMYY": "0328",
  "ExternalUniqTranId": "ORDER_123456-capture",
  "ExternalUniqUniqTranIdResponse": true,
  "NumOfPayments": 1,
  "ISOCoinId": 1,
  "CardOwnerInformation": {
    "FullName": "John Doe",
    "IdentityNumber": "123456789",
    "Phone": "0501234567",
    "CardOwnerEmail": "john@example.com"
  },
  "Advanced": {
    "ApiPassword": "MyApiPassword",
    "ApprovalNumber": "<TokenInfo.TokenApprovalNumber>"
  },
  "Document": {
    "DocumentTypeToCreate": "Auto",
    "Name": "John Doe",
    "TaxId": "123456789",
    "Email": "john@example.com",
    "IsSendByEmail": true,
    "IsSendSMS": false,
    "Languge": "he",
    "Products": [
      { "Description": "Cheese 0.85 kg", "UnitCost": 142.30, "Quantity": 1 }
    ]
  }
}
```
- `TerminalNumber`, `ApiName`, `Amount` are required. `ApiPassword` goes **inside `Advanced`**.
- `ExternalUniqTranId` - a unique id for this capture (e.g. order id + `-capture`). A retry with the same id **never charges twice**:
  - with a `Document` (as in this example), or with `ExternalUniqUniqTranIdResponse: false`, the retry returns **608** - treat it as "already captured" and read the result with `POST /Transactions/GetTransactionByExternalUniqTran`;
  - without a `Document` and with `ExternalUniqUniqTranIdResponse: true`, the retry returns the original transaction.
  The id is remembered only for approved captures, per terminal, for 6 months - a declined capture can be retried with the same id.
- Don't send `CVV2`, `CardNumber`, `FirstPayment`, `ConstPayment`, `MTI`, `JValidateType`, `SapakMutav` or `ExternalMerchantId` for a capture.
- `Amount` may differ from the authorized amount (weighted products). Whether a higher amount is approved is up to the card issuer - test with your terminal before relying on it.
- `Document` is optional. Note the differences from the `LowProfile/Create` document: language is **`Languge`** (sic), **`IsSendSMS` defaults to `true`**, and every product needs a `Description` (9998 otherwise). Σ `UnitCost × Quantity` should equal `Amount`. See [cardcom-integration-documents.md](cardcom-integration-documents.md).

**Response**
```json
{
  "ResponseCode": 0,
  "Description": "string",
  "TranzactionId": 123456790,
  "TerminalNumber": 1000,
  "Amount": 142.30,
  "CoinId": 1,
  "ApprovalNumber": "string",
  "JParameter": "4",
  "Last4CardDigitsString": "1234",
  "CardMonth": 3,
  "CardYear": 28,
  "NumberOfPayments": 1,
  "Token": "a1b2c3d4-e5f6-4789-0123-456789abcdef",
  "DocumentNumber": 1234,
  "DocumentType": "TaxInvoiceAndReceipt",
  "DocumentUrl": "https://...",
  "AccountId": 54321,
  "IsRefund": false
}
```
(Same fields as `TranzactionInfo` in the webhook.)
- `ResponseCode == 0` → captured. Mark the order `paid`.
- Save the new **`TranzactionId`** - refunds use this one, not the J5's.
- Save `DocumentType` + `DocumentNumber` (to cancel the document) and give the customer `DocumentUrl`.

## Refunds and releasing the hold
- **After capture:** refund / void the **capture's** `TranzactionId` (or `CancelDoc` its document) - see [cardcom-integration-void.md](cardcom-integration-void.md).
- **Before capture:** `RefundByTransactionId` on the J5 itself returns 9000 - there is nothing charged to refund. If the order is cancelled, don't capture. When the hold is released depends on the card issuer; to release it earlier, contact CardCom support.
