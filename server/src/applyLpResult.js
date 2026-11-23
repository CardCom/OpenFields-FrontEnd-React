import { markPaid, markFailed, markClosed } from './ordersStore.js';

/**
 * Applies a verified LowProfile/GetLpResult answer to the order - the rules of the integration guide
 * (docs/cardcom-integration-webhook.md, step 4). Only `paid` is final: a `failed` order can still
 * become `paid`, because some errors let the payer fix the input and pay again on the same page.
 */
export function applyLpResult(order, result) {
  switch (result.ResponseCode) {
    case 0:
      return markPaid(order.id, result.TranzactionInfo?.TranzactionId ?? null);
    case 5119: // still pending - the payer can still pay or retry on the page
      return order;
    case 5117: // the payment page was revoked
      return markClosed(order.id, 'cancelled', result.Description);
    case 5118: // older than 24 h and not paid
      return markClosed(order.id, 'expired', result.Description);
    default:
      return markFailed(order.id, result.Description);
  }
}
