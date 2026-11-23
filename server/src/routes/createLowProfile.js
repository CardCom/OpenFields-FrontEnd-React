import { createOrder, attachLowProfile } from '../ordersStore.js';
import { createLowProfile as createCardcomLowProfile } from '../cardcomClient.js';
import { demoProduct } from '../config.js';
import { resolveLanguage } from '../languages.js';

export default async function createLowProfileRoute(fastify) {
  fastify.post('/api/checkout/low-profile', async (request, reply) => {
    // A fresh LowProfile is created on every call — required so a browser-back /
    // retry never reuses an already-consumed LowProfile.
    const language = resolveLanguage(request.body?.language);
    const order = createOrder({
      amount: demoProduct.amount,
      currency: demoProduct.currency,
      isoCoinId: demoProduct.isoCoinId,
      productName: demoProduct.name,
      language,
    });

    try {
      const cardcomResponse = await createCardcomLowProfile(order);
      attachLowProfile(order.id, cardcomResponse.LowProfileId);

      // Only what the browser needs — never the API password or full transaction internals.
      return {
        orderId: order.id,
        lowProfileCode: cardcomResponse.LowProfileId,
        bitUrl: cardcomResponse.UrlToBit || null,
        amount: order.amount,
        currency: order.currency,
        productName: order.productName,
      };
    } catch (error) {
      fastify.log.error({ err: error, responseCode: error.responseCode }, 'LowProfile/Create failed');
      reply.code(502);
      return { error: 'Failed to create payment session' };
    }
  });
}
