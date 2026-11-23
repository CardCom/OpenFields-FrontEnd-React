import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// HTTPS in dev is required, not cosmetic: the Permissions-Policy "payment" delegation
// (allow="payment" on the OpenFields iframes) and the Payment Request API both need a
// secure top-level context, so Apple/Google Pay availability checks won't behave
// correctly over plain http://localhost.
//
// Uses a self-signed cert (one-time browser click-through warning) rather than
// vite-plugin-mkcert: mkcert needs to install a trusted local CA, which can
// require OS-level elevation and hang in restricted/headless dev environments.
export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    port: Number(process.env.WEB_PORT) || 5173,
    strictPort: true,
    // Same-origin API: the browser never calls the http backend directly (mixed content on WebKit).
    proxy: {
      '/api': process.env.API_PROXY_TARGET || 'http://localhost:8000',
    },
  },
});
