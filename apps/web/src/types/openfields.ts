// Wire types for the CardCom OpenFields postMessage protocol.
// Field/action names match CardCom's actual wire format exactly, including the
// literal "HandleEror" spelling — that is the real value CardCom sends; do not "fix" it.

import type { LanguageCode } from '../i18n/languages';

export interface GooglePayButtonConfig {
  buttonColor?: 'default' | 'black' | 'white';
  buttonType?: 'book' | 'buy' | 'checkout' | 'donate' | 'order' | 'pay' | 'plain' | 'subscribe';
  buttonSizeMode?: 'fill' | 'static';
  buttonRadius?: number;
  buttonLocale?: string;
}

export interface ApplePayButtonConfig {
  type?:
    | 'plain'
    | 'continue'
    | 'add-money'
    | 'book'
    | 'buy'
    | 'check-out'
    | 'contribute'
    | 'donate'
    | 'order'
    | 'pay'
    | 'reload'
    | 'rent'
    | 'set-up'
    | 'subscribe'
    | 'support'
    | 'tip'
    | 'top-up';
  buttonstyle?: 'black' | 'white' | 'white-outline';
  locale?: string;
  radius?: number;
}

export interface InitPayload {
  apiName: string;
  terminalNumber: string;
  lowProfileCode: string;
  language: LanguageCode;
  screenWidth: string;
  screenHeight: string;
  screenColorDepth: string;
  cardFieldCSS?: string;
  cvvFieldCSS?: string;
  reCaptchaFieldCSS?: string;
  placeholder?: string;
  cvvPlaceholder?: string;
  googlePayButton?: GooglePayButtonConfig;
  applePayButton?: ApplePayButtonConfig;
}

export interface DoTransactionPayload {
  expirationMonth: string;
  expirationYear: string;
  numberOfPayments?: number;
  cardOwnerName: string;
  cardOwnerEmail?: string;
  cardOwnerPhone?: string;
  cardOwnerId?: string;
  city?: string;
  address?: string;
  zipCode?: string;
}

export interface CardOwnerDetails {
  CardOwnerName?: string;
  CardOwnerEmail?: string;
  CardOwnerPhone?: string;
}

// ---- Outbound (our page -> master frame) ----
export type OpenFieldsOutboundMessage =
  | ({ action: 'init' } & InitPayload)
  | ({ action: 'doTransaction' } & DoTransactionPayload)
  | { action: 'setCardOwnerDetails'; data: CardOwnerDetails }
  | { action: 'validateCardNumber' }
  | { action: 'validateCvv' }
  | { action: 'addCardNumberFieldClass' | 'removeCardNumberFieldClass'; className: string }
  | { action: 'addCvvFieldClass' | 'removeCvvFieldClass'; className: string };

// ---- Inbound (master frame -> our page) ----
export interface HandleSubmitData {
  IsSuccess?: boolean;
  ResponseCode: number;
  Description?: string;
  redirectUrl?: string;
  [key: string]: unknown;
}

export type OpenFieldsInboundMessage =
  | { action: 'ready' }
  | { action: 'initialized'; isApplePayAvailable: boolean; isGooglePayAvailable: boolean }
  | { action: 'handleValidations'; field: 'cardNumber' | 'cvv' | 'reCaptcha'; isValid: boolean }
  | { action: 'HandleSubmit'; data: HandleSubmitData }
  | {
      action: 'HandleEror';
      isError: true;
      message: string | string[];
      ResponseCode: number;
      redirectUrl?: string;
      isDeveloperError?: boolean;
    }
  | { action: 'status'; [key: string]: unknown }
  | { action: 'NEXT_PRESSED' };

export function isOpenFieldsMessage(data: unknown): data is OpenFieldsInboundMessage {
  return typeof data === 'object' && data !== null && typeof (data as { action?: unknown }).action === 'string';
}
