# CardCom integration - LowProfile/Create reference

> Part of the OpenFields docs. Main guide: [cardcom-openfields-ecommerce-integration.md](cardcom-openfields-ecommerce-integration.md) - read it first; it has the whole flow (server + OpenFields front end).
> This file is the detailed reference for `LowProfile/Create`: operations, every commonly used field, and the response.
> Swagger: https://secure.cardcom.solutions/swagger/index.html?url=/swagger/v11/swagger.json
> Develop on a **test terminal**: contact CardCom support and request a test company with a test terminal before the real integration.

## Operations

| `Operation` | What it does | Document at Create | Bit |
|---|---|---|---|
| `ChargeOnly` (default) | Charges the card | yes | yes |
| `ChargeAndCreateToken` | Charges the card **and** stores a token for future charges. Always charges now - `JValidateType` is ignored | yes | no |
| `CreateTokenOnly` | Stores a token without charging. `AdvancedDefinition.JValidateType: 5` = **J5** (authorize `Amount`, capture later); `2` or omitted = card check only | no - a `Document` sent here is only displayed | no |

Token operations need the terminal's tokens permission (651). "Document at Create" also needs the terminal's documents module - without it the document is only displayed (no error). Other values (`SuspendedDeal`, `Do3DSAndSubmit`) are not used with OpenFields.

## Request

`POST https://secure.cardcom.solutions/api/v11/LowProfile/Create`

```json
{
  "TerminalNumber": 1000,
  "ApiName": "MyApiName",
  "Operation": "ChargeOnly",
  "ReturnValue": "ORDER_123456",
  "Amount": 150.50,
  "SuccessRedirectUrl": "https://www.mysite.com/success",
  "FailedRedirectUrl": "https://www.mysite.com/failed",
  "CancelRedirectUrl": "https://www.mysite.com/cancel",
  "WebHookUrl": "https://www.mysite.com/api/cardcom/webhook",
  "ProductName": "Order 123456",
  "Language": "he",
  "ISOCoinId": 1,
  "UIDefinition": {
    "CardOwnerNameValue": "John Doe",
    "CardOwnerPhoneValue": "0501234567",
    "CardOwnerEmailValue": "john@example.com",
    "CardOwnerIdValue": "123456789",
    "IsHideCardOwnerName": false,
    "IsHideCardOwnerIdentityNumber": false,
    "IsHideCVV": false,
    "IsHideCardOwnerPhone": false,
    "IsHideCardOwnerEmail": false,
    "IsCardOwnerPhoneRequired": true,
    "IsCardOwnerEmailRequired": true,
    "CustomFields": [
      { "Id": 1, "Value": "CustomValue1" },
      { "Id": 2, "Value": "CustomValue2" }
    ]
  },
  "AdvancedDefinition": {
    "MaxNumOfPayments": 12,
    "MinNumOfPayments": 1,
    "SelectedNumOfPayments": 1,
    "CreditType": 1,
    "IsAVSEnable": false
  },
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
    "Products": [
      { "Description": "Product 1", "UnitCost": 150.50, "Quantity": 1 }
    ]
  },
  "UTM": {
    "Source": "google",
    "Medium": "cpc",
    "Campaign": "summer_sale",
    "Content": "banner_ad",
    "Term": "payment_gateway"
  }
}
```

### Fields
- `TerminalNumber`, `ApiName`, `Amount` - required. No `ApiPassword` here (only `AdvancedDefinition.ApiPassword`, and only with `IsRefundDeal: true`).
- `Operation` - see *Operations*. For the J5 flow also send `"AdvancedDefinition": { "JValidateType": 5 }` and no `Document`.
- `ReturnValue` - your order id (up to 250 chars). Comes back on the webhook; also searchable in CardCom's admin.
- `WebHookUrl` - your public webhook. Must be a public `http(s)` URL - `localhost` / private addresses fail with **5170**. Empty = no webhook.
- `SuccessRedirectUrl` / `FailedRedirectUrl` - where the payer goes after paying (in OpenFields they come back as `redirectUrl` in `HandleSubmit` / `HandleEror`). Omitted → the terminal's defaults; if the terminal has none → 5093 / 5094. `CancelRedirectUrl` is optional.
- `Language` - `he` (default), `en`, `ru`, `ar`, `fr`, `it`, `es`, `de`, `pt`, `sv`, `nl`; an unknown value becomes `en` (use `he`, not `iw`).
- `ISOCoinId` - 1 = ILS, 2 = USD, otherwise the ISO 4217 number (or `AdvancedDefinition.ISOCoinName`, e.g. `"ILS"`).
- `UIDefinition.CardOwner*Value` - prefill the cardholder's details when you already have them (better UX; also used for wallets and 3DS). `IsCardOwnerPhoneRequired` / `IsCardOwnerEmailRequired` default to `false` (not required) unless the terminal's settings require them.
- `UIDefinition.CustomFields` - `Id` is a number 1-25.
- `AdvancedDefinition.MaxNumOfPayments` / `MinNumOfPayments` (1-36) - installments the payer may choose; the terminal's settings may lower the maximum. `FirstPayment` / `ConstPayment` are optional; if you send both, also send `SelectedNumOfPayments` (n): `FirstPayment + ConstPayment × (n-1)` must equal `Amount` (5149), and the payer can't change n.
- `AdvancedDefinition.ThreeDSecureState` - `Auto` (default - the terminal's setting) \| `Enabled` \| `Disabled`. Normally omit it.
- `AdvancedDefinition.SapakMutav` - only for marketplace (sub-supplier) terminals.
- `UIDefinition.CSSUrl` - don't send; it needs a special permission (6322) and is not used by OpenFields.
- `UIDefinition.GooglePayBtnDesign` - an object (`ButtonColor`, `ButtonType`, `ButtonLocale`, `ButtonWidth`, `ButtonHeight`), not a string. In OpenFields prefer `googlePayButton` in `init`.
- `Document` - creates the invoice/receipt on success if the terminal has the documents module (otherwise it is only displayed). **Σ `UnitCost × Quantity` must equal `Amount`** (`UnitCost` includes VAT) - a difference above 0.10 → 5045. Full rules: [cardcom-integration-documents.md](cardcom-integration-documents.md).
- `UTM` - optional campaign info; returned only in the first webhook delivery (`null` in `GetLpResult` and in webhook retries).

## Response

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
That is all `LowProfile/Create` returns. `TranzactionInfo`, `TokenInfo`, `DocumentInfo`, `UIValues` come only from `GetLpResult` and the webhook, after the payment.

- Check `ResponseCode == 0` first. On an error `Url` still points to an error page - don't use it.
- Bad `ApiName` (or `IsRefundDeal: true` without `ApiPassword`) → HTTP 401 `{ ResponseCode, Description }`. Empty body → HTTP 400 with 6325. Some failures return HTTP 400 whose body is a plain string (`"<code>, <message>"`).
- `LowProfileId` - save on the order and pass to the front end as `lowProfileCode`.
- `Url` - CardCom's hosted payment page. **Not used with OpenFields.**
- `UrlToBit` - filled only when Bit is enabled on the terminal and `Operation` is `ChargeOnly`; otherwise empty (`""`, or `null` on an error).

## Rules
- Create the LowProfile on your server only - never expose `ApiName` / `ApiPassword` to the browser (`ApiName` alone is enough to call `LowProfile/Create` and `GetLpResult`).
- Create a **new** LowProfile for every checkout visit, and after the current one is closed (paid, revoked, expired, or a final decline). Retrying after an error the payer can fix reuses it. The payment page closes after the terminal's page timeout (at most 24 h; `GetLpResult` reports `5118` after 24 h).
- `ResponseCode == 0` is success for every CardCom API; otherwise log `ResponseCode` + `Description` and show a friendly message.
