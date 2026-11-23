import { getOrder } from '../ordersStore.js';
import { getLpResult } from '../cardcomClient.js';
import { applyLpResult } from '../applyLpResult.js';

// Public endpoint - CardCom POSTs here when a payment ends (success, a final failure, and some errors the
// payer can still fix). The body has no signature, so it is only used to find the order; the result comes
// from GetLpResult. Always answer 200: CardCom does not retry an error answer to its first delivery, so
// failures are logged and left to the success-redirect page / a reconciliation job (routes/verify.js).
export default async function webhookRoute(fastify) {
  fastify.post('/webhook/cardcom', async (request) => {
    const { ReturnValue: orderId, LowProfileId: lowProfileId } = request.body || {};

    const order = orderId ? getOrder(orderId) : undefined;
    if (!order) {
      fastify.log.warn({ orderId }, 'Webhook for a missing or unknown order - ignored');
      return { ok: true };
    }
    if (order.status === 'paid') {
      return { ok: true }; // only `paid` is final - a repeated webhook is a no-op
    }
    if (lowProfileId && order.lowProfileId && lowProfileId !== order.lowProfileId) {
      fastify.log.warn({ orderId, lowProfileId }, 'Webhook LowProfileId does not match the order - ignored');
      return { ok: true };
    }

    try {
      const result = await getLpResult(order.lowProfileId);
      if (result.ReturnValue && result.ReturnValue !== order.id) {
        fastify.log.warn({ orderId, returnValue: result.ReturnValue }, 'GetLpResult ReturnValue does not match the order');
        return { ok: true };
      }
      const updated = applyLpResult(order, result);
      fastify.log.info({ orderId, status: updated?.status, responseCode: result.ResponseCode }, 'Order updated from GetLpResult');
    } catch (error) {
      fastify.log.error({ err: error, orderId }, 'GetLpResult failed during webhook handling - left for verify / reconciliation');
    }
    return { ok: true };
  });
}
