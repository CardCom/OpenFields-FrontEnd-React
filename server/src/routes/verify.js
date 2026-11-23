import { getOrder, markPaid, markFailed } from '../ordersStore.js';
import { getLpResult } from '../cardcomClient.js';

export default async function verifyRoute(fastify) {
  fastify.get('/api/checkout/verify/:orderId', async (request, reply) => {
    const order = getOrder(request.params.orderId);
    if (!order) {
      reply.code(404);
      return { error: 'Order not found' };
    }

    // GetLpResult is the source of truth — used here as a fallback for flows that
    // leave the page entirely (Bit) and land back on the result page via redirect.
    if (order.status === 'pending' && order.lowProfileId) {
      try {
        const result = await getLpResult(order.lowProfileId);
        if (result.ResponseCode === 0 && result.TranzactionInfo?.TranzactionId) {
          markPaid(order.id, result.TranzactionInfo.TranzactionId);
        } else if (result.ResponseCode !== 0) {
          markFailed(order.id, result.Description);
        }
      } catch (error) {
        fastify.log.error({ err: error }, 'GetLpResult failed during verify');
      }
    }

    const fresh = getOrder(order.id);
    return {
      orderId: fresh.id,
      status: fresh.status,
      amount: fresh.amount,
      currency: fresh.currency,
      productName: fresh.productName,
      transactionId: fresh.transactionId,
    };
  });
}
