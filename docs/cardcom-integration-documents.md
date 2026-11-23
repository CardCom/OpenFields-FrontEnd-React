# CardCom integration - Creating documents (invoices / receipts)

> Part of the OpenFields docs. Main guide: [cardcom-openfields-ecommerce-integration.md](cardcom-openfields-ecommerce-integration.md).

## Goal
- Have CardCom create the accounting document (tax invoice + receipt, receipt, ...) for a payment, and give the customer a link to it.

## Three ways to create a document

| When | How |
|---|---|
| Normal payment (`ChargeOnly` / `ChargeAndCreateToken`) | Send a `Document` object in `LowProfile/Create` - the document is created when the payment succeeds. **Recommended.** |
| Capturing a deferred (J5) deal | Send a `Document` object in `Transactions/Transaction` when you capture ([cardcom-integration-suspended-deal.md](cardcom-integration-suspended-deal.md)). |
| Separately - a deal that had no document, or a credit document after a partial refund | `Documents/CreateDocument` |

Requirements:
- The terminal needs CardCom's **documents module**. Without it the document details are only shown on the payment page and **no document is created** - except `DocumentTypeToCreate: "OrderConfirmation"`, which is created without the module.
- `CreateTokenOnly` (including the J5 flow) never creates a document at `LowProfile/Create` - a `Document` sent with it is only shown on the payment page. Create the document when you capture.

## 1. Document in LowProfile/Create

```json
"Document": {
  "DocumentTypeToCreate": "Auto",
  "Name": "John Doe",
  "TaxId": "123456789",
  "Email": "john@example.com",
  "IsSendByEmail": true,
  "AddressLine1": "Rothschild 123",
  "AddressLine2": "Entrance B, 2nd floor",
  "City": "Tel Aviv",
  "Mobile": "0544554455",
  "Phone": "039640557",
  "Language": "he",
  "DepartmentId": 1,
  "IsVatFree": false,
  "IsAllowEditDocument": false,
  "IsShowOnlyDocument": false,
  "Products": [
    { "Description": "Product 1", "UnitCost": 100.00, "Quantity": 1 },
    { "Description": "Product 2", "UnitCost": 25.25, "Quantity": 2 }
  ]
}
```
With this document, `Amount` in `LowProfile/Create` must be `150.50`.

Rules:
- **Σ `UnitCost × Quantity` over `Products` must equal `Amount`** (difference over 0.10 → error 5045).
- `UnitCost` is the unit price **including VAT**. `Quantity` defaults to 1. For a fractional quantity also send `TotalLineCost`.
- Send `Name` and at least one product with a `Description` (no products → 5047; `Name` and `Description` themselves are not checked at `LowProfile/Create`).
- `Name`, `TaxId`, `Email`, address and phone fields: up to 50 characters.
- `DocumentTypeToCreate`: `Auto` (default - the type set in the merchant's CardCom settings), or a type such as `TaxInvoiceAndReceipt`, `Receipt`, `OrderConfirmation`. Full list in Swagger.
- `TaxId`: the customer's business number or ID number (for the tax authority).
- `IsSendByEmail` (default `true`, unless the terminal's payment-page settings say otherwise): email the document to `Email`.
- `Language`: the document's language, `he` (default) or `en`.
- `IsVatFree`: `true` if all products are VAT-free (there is also `Products[].IsVatFree` per product).
- `IsShowOnlyDocument: true`: only **shows** the document details on the payment page - **no document is created**. Default `false`.
- `IsAllowEditDocument`: let the payer edit the document details on the page. Default `false`.
- `DepartmentId`: a number (0-9999) from the merchant's CardCom admin, for reports. Optional.
- Optional per product: `ProductID`, `TotalLineCost`, `IsVatFree`.

After the payment, the webhook / `GetLpResult` returns `DocumentInfo` - the document exists only if `DocumentInfo.ResponseCode == 0`. Save `DocumentType` + `DocumentNumber`; the link is `TranzactionInfo.DocumentUrl` ([cardcom-integration-webhook.md](cardcom-integration-webhook.md)).

## 2. Document in Transactions/Transaction (J5 capture)

The same fields as above, except:
- the language field is spelled **`Languge`** (sic), not `Language`;
- `IsAllowEditDocument` and `IsShowOnlyDocument` don't exist;
- **`IsSendSMS` defaults to `true`** - send `false` if you don't want an SMS;
- `Products` are required, each with a `Description` (error 9998 otherwise).

The response returns `DocumentNumber`, `DocumentType` (a name, e.g. `"TaxInvoiceAndReceipt"`) and `DocumentUrl`. If the customer's details changed since the LowProfile was created, update them here.

## 3. Documents/CreateDocument

`POST https://secure.cardcom.solutions/api/v11/Documents/CreateDocument`

```json
{
  "ApiName": "MyApiName",
  "ApiPassword": "MyApiPassword",
  "Document": {
    "DocumentTypeToCreate": "TaxInvoiceAndReceipt",
    "Name": "John Doe",
    "TaxId": "123456789",
    "Email": "john@example.com",
    "IsSendByEmail": true,
    "Languge": "he",
    "ISOCoinID": 1,
    "Products": [
      { "Description": "Product 1", "UnitCost": 150.50, "Quantity": 1 }
    ]
  },
  "DealNumbers": [ { "DealNumber": 123456789 } ],
  "IsSendSMS": false
}
```
- `DocumentTypeToCreate` - omitted means `Auto`.
- Needs the documents module (otherwise 601), except order confirmations and demands for payment. `Products` are required.
- `DealNumbers` attaches the card deal (`TranzactionInfo.TranzactionId`) as the payment of the document. Deals not found in your company are silently ignored.
- A repeat call with the same first `DealNumber` and document type (within 6 months) returns the first document instead of creating another. This does **not** protect against a document that `LowProfile/Create` or `Transactions/Transaction` already created for the deal - check `DocumentInfo` first.
- Language field is `Languge` (sic); currency is `ISOCoinID` (1 = ILS, 2 = USD) or `ISOCoinName`.
- For a credit document after a partial refund use a refund type (e.g. `TaxInvoiceAndReceiptRefund`) with the refund's `NewTranzactionId` in `DealNumbers`. Confirm this on a test terminal before going live.

**Response**
```json
{
  "ResponseCode": 0,
  "Description": "string",
  "DocumentType": "TaxInvoiceAndReceipt",
  "DocumentNumber": 1234,
  "AccountId": 54321,
  "DocumentUrl": "https://...",
  "ForeignAccountNumber": null,
  "SiteUniqueId": null
}
```

## A link to a document

`POST https://secure.cardcom.solutions/api/v11/Documents/CreateDocumentUrl` returns a link for any document - e.g. one created earlier, or the credit document of a `CancelDoc`.

**Request** - all fields required:
```json
{
  "ApiName": "MyApiName",
  "ApiPassword": "MyApiPassword",
  "DocumentType": "TaxInvoiceAndReceiptRefund",
  "DocumentNumber": 1235
}
```
`DocumentType` accepts the request name (table below) or the number - e.g. CancelDoc's `NewDocumentType`. When the type came from a response, pass its **number** (response and request names differ for 101/102). `Auto` / `0` is rejected.

**Response**
```json
{
  "ResponseCode": 0,
  "Description": "string",
  "DocUrl": "https://..."
}
```
Errors: HTTP 400 (`Auto` / missing type) or 404 (document not found) whose body is a bare JSON string (e.g. `"Could not find document 1235"`), not an object; HTTP 401 and 500 return `{ ResponseCode, Description }`.


## Document types

`DocumentType` in responses is a **name**; `Documents/CancelDoc` needs the **number**:

| Name | Number | Credit (refund) type | Number |
|---|---|---|---|
| `TaxInvoiceAndReceipt` | 1 | `TaxInvoiceAndReceiptRefund` | 2 |
| `Receipt` | 3 | `ReceiptRefund` | 4 |
| `TaxInvoice` | 305 | `TaxInvoiceRefund` | 330 |
| `ReceiptForTaxInvoice` | 400 | `ReceiptForTaxInvoiceRefund` | 410 |
| `DonationReceipt` | 405 | `DonationReceiptRefund` | 406 |
| `OrderConfirmation` (in responses: `SiteCustomerOrder`) | 101 | `OrderConfirmationRefund` (in responses: `SiteCustomerOrderRefund`) | 102 |
