import { config } from './config.js';

async function callCardcom(path, body) {
  const response = await fetch(`${config.cardcomBaseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`CardCom ${path} responded with HTTP ${response.status}`);
  }

  const data = await response.json();

  if (data.ResponseCode !== 0) {
    const error = new Error(data.Description || `CardCom ${path} failed`);
    error.responseCode = data.ResponseCode;
    error.cardcomResponse = data;
    throw error;
  }

  return data;
}

export function createLowProfile(order) {
  return callCardcom('/LowProfile/Create', {
    TerminalNumber: config.terminalNumber,
    ApiName: config.apiName,
    Operation: 'ChargeOnly',
    ReturnValue: order.id,
    Amount: order.amount,
    SuccessRedirectUrl: `${config.frontendUrl}/result?orderId=${order.id}&status=success&lang=${order.language}`,
    FailedRedirectUrl: `${config.frontendUrl}/result?orderId=${order.id}&status=failed&lang=${order.language}`,
    CancelRedirectUrl: `${config.frontendUrl}/result?orderId=${order.id}&status=cancelled&lang=${order.language}`,
    WebHookUrl: `${config.publicBaseUrl}/webhook/cardcom`,
    ProductName: order.productName,
    // CardCom's own texts (3DS page, decline messages, Description) follow the deal's language.
    Language: order.language,
    ISOCoinId: order.isoCoinId,
    UIDefinition: {
      IsCardOwnerPhoneRequired: true,
      IsCardOwnerEmailRequired: true,
    },
    AdvancedDefinition: {
      JValidateType: 1,
      MaxNumOfPayments: 1,
      MinNumOfPayments: 1,
      ISOCoinName: order.currency,
      ThreeDSecureState: 'enabled',
      IsExternal: false,
      ApiPassword: config.apiPassword,
    },
    Document: {
      DocumentTypeToCreate: 'Auto',
      Name: 'OpenFields Demo Customer',
      Email: 'demo-customer@example.com',
      IsSendByEmail: false,
      Products: [{ Description: order.productName, UnitCost: order.amount, Quantity: 1 }],
    },
  });
}

export function getLpResult(lowProfileId) {
  return callCardcom('/LowProfile/GetLpResult', {
    TerminalNumber: config.terminalNumber,
    ApiName: config.apiName,
    ApiPassword: config.apiPassword,
    LowProfileId: lowProfileId,
  });
}

// v11 contract: the field is TransactionId (not TranzactionId) and a partial refund goes in
// PartialSum - omit it to refund the whole deal. The old field names are ignored and the call
// answers 9000 "Deal Not Found".
export function refundByTransactionId(transactionId, partialSum) {
  return callCardcom('/Transactions/RefundByTransactionId', {
    ApiName: config.apiName,
    ApiPassword: config.apiPassword,
    TransactionId: transactionId,
    ...(partialSum ? { PartialSum: partialSum } : {}),
  });
}
