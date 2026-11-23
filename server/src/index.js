/**
 * DEMO ONLY — example backend for the CardCom OpenFields demo payment page.
 *
 * This is NOT production-ready:
 *  - orders live in an in-memory Map (ordersStore.js) — lost on restart, not shared across instances
 *  - no authentication, no rate limiting, minimal request validation
 *  - no real database / persistence layer
 *
 * A production integration must replace this with a real backend that persists orders
 * (ideally reusing the merchant's existing orders table, per the CardCom OpenFields
 * integration guides in the repo root), stores credentials as real secrets, and hardens
 * the public webhook endpoint against abuse.
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import createLowProfileRoute from './routes/createLowProfile.js';
import verifyRoute from './routes/verify.js';
import webhookRoute from './routes/webhook.js';

const fastify = Fastify({ logger: true });

await fastify.register(cors, { origin: [config.frontendUrl], methods: ['GET', 'POST'] });
await fastify.register(createLowProfileRoute);
await fastify.register(verifyRoute);
await fastify.register(webhookRoute);

fastify.get('/health', async () => ({ ok: true }));

fastify.listen({ port: config.port, host: '0.0.0.0' }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});
