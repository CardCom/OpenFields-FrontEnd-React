import { getOrder, markPaid, markFailed } from '../ordersStore.js';
import { getLpResult } from '../cardcomClient.js';

// Public endpoint — CardCom calls this after every payment attempt, and may retry,
// so every branch here must be idempotent.
export default async function webhookRoute(fastify) {
  fastify.post('/webhook/cardcom', async (request, reply) => {
    const { ReturnValue: orderId, LowProfileId: lowProfileId } = request.body || {};

    if (!orderId) {
      fastify.log.warn({ body: request.body }, 'Webhook payload missing ReturnValue');
      reply.code(400);
      return { error: 'Missing ReturnValue' };
    }

    const order = getOrder(orderId);
    if (!order) {
      fastify.log.warn({ orderId }, 'Webhook received for unknown order');
      reply.code(404);
      return { error: 'Unknown order' };
    }

    if (order.status === 'paid' || order.status === 'failed') {
      return { ok: true }; // already resolved — CardCom retried, no-op
    }

    try {
      // Never trust the webhook body alone — verify against CardCom directly.
      const result = await getLpResult(lowProfileId || order.lowProfileId);
      if (result.ResponseCode === 0 && result.TranzactionInfo?.TranzactionId) {
        markPaid(order.id, result.TranzactionInfo.TranzactionId);
        fastify.log.info({ orderId, transactionId: result.TranzactionInfo.TranzactionId }, 'Order paid');
      } else {
        markFailed(order.id, result.Description);
        fastify.log.warn(
          { orderId, description: result.Description, responseCode: result.ResponseCode },
          'Order failed',
        );
      }
    } catch (error) {
      fastify.log.error({ err: error, orderId }, 'GetLpResult failed during webhook handling');
      reply.code(502);
      return { error: 'Verification failed' };
    }

    return { ok: true };
  });
}
