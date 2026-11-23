# CardCom integration - Void / refund

> Part of the OpenFields docs. Main guide: [cardcom-openfields-ecommerce-integration.md](cardcom-openfields-ecommerce-integration.md).

## Goal
- Let the merchant void (cancel) or refund a deal from the store's admin, fully or partially, and reverse its document.

## Prerequisites
- Basic integration and the webhook are done ([cardcom-integration-webhook.md](cardcom-integration-webhook.md)), so the order has `transactionId` and - if a document was created - `documentType` + `documentNumber`.
- Permissions (ask CardCom support if missing; changes can take a few minutes to apply):
  - `CancelDoc` needs the refund permission of the API user → otherwise **9006** (HTTP 401).
  - `RefundByTransactionId` needs the API cancel-deal permission on the deal's terminal → otherwise **671**, and **9001** (HTTP 401) without access to that terminal. A user that passes `CancelDoc` can still get 671 here.

## Endpoints
- `POST https://secure.cardcom.solutions/api/v11/Documents/CancelDoc` - **full** cancellation of a document; for a receipt-type document paid by card, the card is refunded too.
- `POST https://secure.cardcom.solutions/api/v11/Transactions/RefundByTransactionId` - full or partial refund of the card deal. **Creates no document.**
- A link to the new credit document: `Documents/CreateDocumentUrl` - see [cardcom-integration-documents.md](cardcom-integration-documents.md#a-link-to-a-document).

## Which call to use

| Situation | Call |
|---|---|
| Full refund, the order has a **receipt-type** document (`TaxInvoiceAndReceipt`, `Receipt`, `ReceiptForTaxInvoice`, `DonationReceipt`, `OrderConfirmation`) | `Documents/CancelDoc` - refunds the card and creates the credit document |
| Full refund, the order has only a `TaxInvoice` | `Documents/CancelDoc` (credit invoice - no card refund) **and** `Transactions/RefundByTransactionId` (the card) |
| No document, full or partial refund | `Transactions/RefundByTransactionId` |
| Has a document, **partial** refund | `RefundByTransactionId` with `PartialSum`, then a credit document for that amount (`Documents/CreateDocument`, see [cardcom-integration-documents.md](cardcom-integration-documents.md)) or let the merchant do it in CardCom's back office |
| An uncaptured J5 hold | see [cardcom-integration-suspended-deal.md](cardcom-integration-suspended-deal.md) - neither call applies |

**Don't mix the two calls on the same card deal.** After any `RefundByTransactionId` (even partial), `CancelDoc` fails with **5111**. After `CancelDoc`, `RefundByTransactionId` fails with 5111 - and with `AllowMultipleRefunds: true` it **refunds the card again**. Don't.

## Store changes
Add to the orders table: `refundTransactionId`, `refundedAmount`, optional `refundDate`, and - for `CancelDoc` - `creditDocumentType` + `creditDocumentNumber`.

## Documents/CancelDoc

Cancels the whole document - no partial amounts. If the document is a receipt-type document (see the table above) paid by card, the card is **fully** refunded (cancelled or refunded by the same rule as `RefundByTransactionId`, below) and the matching credit document is created. A `TaxInvoice` gets a credit invoice and no card refund.

**Request**
```json
{
  "ApiName": "MyApiName",
  "ApiPassword": "MyApiPassword",
  "DocumentNumber": 1234,
  "DocumentType": 1,
  "IsCancelEmailSend": false,
  "IsSendSMS": false,
  "IsCreditCardCancelOnly": false
}
```
- **`DocumentType` is a number.** The webhook / `GetLpResult` return it as a **name** (e.g. `TaxInvoiceAndReceipt` = 1) - convert it with the table in [cardcom-integration-documents.md](cardcom-integration-documents.md#document-types). Sending the name fails (the document is not found).
- `IsCancelEmailSend`: **`true` means do NOT email** the credit document. `false` (default): the credit document is emailed to the customer when the original document was sent by email.
- `IsSendSMS`: send the credit document by SMS.
- `IsCreditCardCancelOnly`: **leave `false`.** If `true` and the document was paid by card, nothing is cancelled and you get 12345.

**Response**
```json
{
  "ResponseCode": 0,
  "Description": "string",
  "NewDocumentNumber": 1235,
  "NewDocumentType": 2,
  "AccountID": 54321
}
```
- Save `NewDocumentNumber` + `NewDocumentType` (a number - `Documents/CreateDocumentUrl` accepts it as is). On success `Description` is a Hebrew sentence - don't parse it.
- `CancelDoc` returns **no refund transaction id**.
- **A non-zero code can come back after the card was already refunded** (the refund succeeded, saving the credit document failed - see `Description`). Don't retry `CancelDoc` and don't call `RefundByTransactionId`; have the merchant check the deal in CardCom's back office.

**Codes**

| Code | HTTP | Meaning |
|---|---|---|
| 0 | 200 | Cancelled |
| 54321 | 200 | Already cancelled - the response carries the existing credit document |
| 5111 | 200 | The card deal was already refunded / cancelled (e.g. by `RefundByTransactionId`) |
| 5114 | 200 | The document has more than one card deal, or no stored card deal - cancel it in the back office |
| 12345 | 200 | `IsCreditCardCancelOnly: true` on a document paid by card - nothing done |
| 55555 | 200 | The document includes cheques - cancel it in the back office |
| 999 | 200 | The receipt has automatic invoices - cancel it in the back office |
| 9006 | 401 | No permission to refund |
| 97999 | 400 | Document not found (check `DocumentNumber` and the **numeric** `DocumentType`) |
| 9999 | 400 | This document type cannot be cancelled (e.g. it is already a credit document) |
| 6325 | 400 | Empty or invalid JSON body |

A wrong `ApiName` / `ApiPassword` gives HTTP 401; a server error gives HTTP 500. Other codes (the card refund's own codes, e.g. 9000, 671, 9001, or the acquirer's) are possible - always log `ResponseCode` + `Description`.

## Transactions/RefundByTransactionId

**Request**
```json
{
  "ApiName": "MyApiName",
  "ApiPassword": "MyApiPassword",
  "TransactionId": 123456789,
  "PartialSum": 50.00,
  "CancelOnly": false,
  "AllowMultipleRefunds": false
}
```
- `TransactionId` - the saved `TranzactionInfo.TranzactionId`.
- `PartialSum` - only for a partial refund. Omit it (or send `0`) for a full refund.
- Cancel or refund: if the deal is not deposited yet, the full amount is requested and the deal was made **today or yesterday** (calendar date), the original transaction is **cancelled**. Otherwise a **refund** transaction is made. (Bit and other wallet-provider deals are always refunded through their provider.)
- `CancelOnly: true` - fail with **5125** instead of refunding when the deal is already deposited or the amount is partial. (A full refund of an undeposited deal from 2+ days ago is still made as a refund.) Default `false`.
- `AllowMultipleRefunds` - default `false` blocks **any** second refund on the same deal (5111). Send `true` **only for the 2nd, 3rd, ... partial refund**. Never send it after a full refund or a `CancelDoc`: in that case CardCom does not stop another refund.
- Not needed: `TerminalNumber`, `SapakMutav`, `ExternalDealId`, `ExternalMerchantId`.

**Response**
```json
{
  "ResponseCode": 0,
  "Description": "string",
  "NewTranzactionId": 123456790
}
```

**Codes**

| Code | Meaning |
|---|---|
| 0 | Refunded / cancelled |
| 5111 | Already refunded or cancelled (for another **partial** refund send `AllowMultipleRefunds: true`) |
| 5122 | The partial refunds would exceed the original amount (earlier partial refunds are counted) |
| 5168 | Full refund requested after a partial refund - send the remaining amount as `PartialSum` |
| 5125 | `CancelOnly: true` but the deal can only be refunded |
| 610 | The transaction is not a charge |
| 9000 | Deal not found, not approved, or not of your company (an uncaptured J5 hold also gives 9000) |
| 5114 / 5115 | The card details of the deal are not stored |
| 671 | No permission to refund on the deal's terminal |
| 9001 (HTTP 401) | No access to the deal's terminal |

A wrong `ApiName` / `ApiPassword` gives HTTP 401; a server error gives HTTP 500 (plain string body). The acquirer can also decline the refund with its own code - always log `ResponseCode` + `Description`.

## After every call
- `ResponseCode == 0` → success.
- Full refund / cancel → order status `cancelled` (or the store's equivalent). Partial refund → keep the order status; follow the store's rules.
- Save `NewTranzactionId` (`RefundByTransactionId`) as `refundTransactionId`, the amount as `refundedAmount` (add up partial refunds), and for `CancelDoc` the new document number/type.
- Log every failure (`ResponseCode` + `Description`) and show the admin the result - success in green, failure in red.
