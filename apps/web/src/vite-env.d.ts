/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CARDCOM_ENV: string;
  readonly VITE_CARDCOM_HOST: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_NAME: string;
  readonly VITE_TERMINAL_NUMBER: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
