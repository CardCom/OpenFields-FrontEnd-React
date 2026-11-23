import { DEFAULT_ENV, loadEnvironment } from '../../scripts/env.mjs';

// Settings come from ONE file at the repo root, .env.<environment> (see .env.example), chosen by
// CARDCOM_ENV (default prod, or the name in .cardcom-env). `npm run dev` (scripts/dev.mjs) resolves it and passes the values
// in; started on its own (`npm run dev -w server`) the server reads the file itself.
const fromFile = process.env.CARDCOM_HOST ? null : loadEnvironment();

const env = (key, fileValue) => process.env[key] ?? (fromFile ? String(fileValue) : undefined);

const host = env('CARDCOM_HOST', fromFile?.host).replace(/\/+$/, '');
const port = Number(env('PORT', fromFile?.serverPort)) || 8000;

export const config = {
  environment: env('CARDCOM_ENV', fromFile?.name) || DEFAULT_ENV,
  cardcomHost: host,
  cardcomBaseUrl: `${host}/api/v11`,
  terminalNumber: Number(env('TERMINAL_NUMBER', fromFile?.terminalNumber)),
  apiName: env('API_NAME', fromFile?.apiName),
  // Some CardCom API users are provisioned without a password for LowProfile/Create; GetLpResult
  // and refunds need it.
  apiPassword: env('API_PASSWORD', fromFile?.apiPassword) || '',
  port,
  frontendUrl: env('FRONTEND_URL', fromFile?.frontendUrl) || 'https://localhost:5173',
  publicBaseUrl: env('PUBLIC_BASE_URL', fromFile?.publicBaseUrl) || 'https://example.com',
};

// The single product this tester sells. AMOUNT in the environment file (default 1 ILS) - keep it
// small: every successful payment is a real charge on that environment's terminal.
export const demoProduct = {
  name: 'CardCom OpenFields Tester',
  amount: Number(env('AMOUNT', fromFile?.amount)) || 1,
  currency: 'ILS',
  isoCoinId: 1,
};
