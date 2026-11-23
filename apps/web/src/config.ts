// Filled by scripts/dev.mjs from the root .env.<environment> file - never set these by hand.
const cardcomHost = (import.meta.env.VITE_CARDCOM_HOST || '').replace(/\/+$/, '');
if (!cardcomHost) {
  throw new Error('VITE_CARDCOM_HOST is not set - start the app with `npm run dev -- --env=<name>` from the repo root.');
}

export const config = {
  environment: import.meta.env.VITE_CARDCOM_ENV || '',
  cardcomHost,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  openFieldsBaseUrl: `${cardcomHost}/api/OpenFields`,
  // Every inbound postMessage is checked against this origin before it's trusted.
  cardcomOrigin: new URL(cardcomHost).origin,
  apiName: import.meta.env.VITE_API_NAME || '',
  terminalNumber: import.meta.env.VITE_TERMINAL_NUMBER || '',
};
