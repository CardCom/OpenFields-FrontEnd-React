// One environment file per CardCom environment, at the repo root: .env.<name>
// (.env.local, .env.billgold, .env.prod ... - copy .env.example). This module is the only place that
// reads it; the server and the dev launcher both go through loadEnvironment().
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_ENV = 'billgold';

export function availableEnvironments() {
  return fs
    .readdirSync(ROOT)
    .filter((f) => /^\.env\.[\w-]+$/.test(f) && f !== '.env.example')
    .map((f) => f.slice('.env.'.length));
}

/**
 * Reads .env.<name> and returns the resolved settings. Throws with a clear message when the file or
 * a required key is missing.
 */
export function loadEnvironment(name = process.env.CARDCOM_ENV || DEFAULT_ENV) {
  const file = path.join(ROOT, `.env.${name}`);
  if (!fs.existsSync(file)) {
    const known = availableEnvironments();
    throw new Error(
      `No ${path.basename(file)} in ${ROOT}. Copy .env.example to .env.${name} and fill it in.` +
        (known.length ? ` Configured environments: ${known.join(', ')}.` : ''),
    );
  }
  const raw = dotenv.parse(fs.readFileSync(file));
  for (const key of ['CARDCOM_HOST', 'TERMINAL_NUMBER', 'API_NAME']) {
    if (!raw[key]) throw new Error(`${path.basename(file)}: ${key} is required`);
  }

  const host = raw.CARDCOM_HOST.replace(/\/+$/, '');
  const serverPort = Number(raw.SERVER_PORT) || 8000;
  const webPort = Number(raw.WEB_PORT) || 5173;
  return {
    name,
    file,
    host,
    terminalNumber: Number(raw.TERMINAL_NUMBER),
    apiName: raw.API_NAME,
    apiPassword: raw.API_PASSWORD || '',
    serverPort,
    webPort,
    serverUrl: `http://localhost:${serverPort}`,
    frontendUrl: `https://localhost:${webPort}`,
    // Where CardCom posts the webhook. CardCom rejects localhost / internal addresses (SSRF guard,
    // error 5170), so the default is a public placeholder that simply ignores the post. The tester does
    // not depend on the webhook: results come back by postMessage and GetLpResult. Set a tunnel URL to
    // exercise the webhook path.
    publicBaseUrl: (raw.PUBLIC_BASE_URL || 'https://example.com').replace(/\/+$/, ''),
    amount: Number(raw.AMOUNT) || 1,
  };
}

/**
 * Environment variables for the two processes. Only non-secret values get the VITE_ prefix (Vite
 * ships VITE_* to the browser); the API password stays server-side.
 */
export function processEnv(env) {
  return {
    server: {
      CARDCOM_ENV: env.name,
      CARDCOM_HOST: env.host,
      TERMINAL_NUMBER: String(env.terminalNumber),
      API_NAME: env.apiName,
      API_PASSWORD: env.apiPassword,
      PORT: String(env.serverPort),
      FRONTEND_URL: env.frontendUrl,
      PUBLIC_BASE_URL: env.publicBaseUrl,
      AMOUNT: String(env.amount),
    },
    web: {
      CARDCOM_ENV: env.name,
      WEB_PORT: String(env.webPort),
      VITE_CARDCOM_ENV: env.name,
      VITE_CARDCOM_HOST: env.host,
      // The page calls its own origin (/api/...) and Vite proxies to the backend: an https page
      // calling http://localhost is mixed content, which WebKit (every iPhone browser) blocks.
      VITE_API_BASE_URL: '',
      API_PROXY_TARGET: env.serverUrl,
      VITE_API_NAME: env.apiName,
      VITE_TERMINAL_NUMBER: String(env.terminalNumber),
    },
  };
}
