import { getOrder } from '../ordersStore.js';
import { getLpResult } from '../cardcomClient.js';
import { applyLpResult } from '../applyLpResult.js';

export default async function verifyRoute(fastify) {
  fastify.get('/api/checkout/verify/:orderId', async (request, reply) => {
    const order = getOrder(request.params.orderId);
    if (!order) {
      reply.code(404);
      return { error: 'Order not found' };
    }

    // GetLpResult is the source of truth — used here as a fallback for flows that
    // leave the page entirely (Bit) and land back on the result page via redirect.
    // Not only `pending`: a `failed` order can still become `paid` (only `paid` is final).
    if (order.status !== 'paid' && order.lowProfileId) {
      try {
        applyLpResult(order, await getLpResult(order.lowProfileId));
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
