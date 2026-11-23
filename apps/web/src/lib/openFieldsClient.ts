import {
  isOpenFieldsMessage,
  type CardOwnerDetails,
  type DoTransactionPayload,
  type HandleSubmitData,
  type InitPayload,
  type OpenFieldsOutboundMessage,
} from '../types/openfields';

interface SubmitErrorPayload {
  message: string | string[];
  responseCode: number;
  redirectUrl?: string;
  isDeveloperError?: boolean;
}

interface EventMap {
  ready: undefined;
  initialized: { isApplePayAvailable: boolean; isGooglePayAvailable: boolean };
  validation: { field: 'cardNumber' | 'cvv' | 'reCaptcha'; isValid: boolean };
  submitResult: HandleSubmitData;
  submitError: SubmitErrorPayload;
}

type Listener<K extends keyof EventMap> = (payload: EventMap[K]) => void;

/**
 * Owns the postMessage wire protocol with CardCom's OpenFields master iframe.
 * This is the only place in the app that speaks postMessage directly — every
 * component goes through the useOpenFields hook, which wraps this class.
 */
export class OpenFieldsClient {
  // Stored loosely (vs. a mapped type) to sidestep TS's inability to prove a
  // generic K write is sound here; the public on()/emit() signatures stay typed.
  private listeners: Partial<Record<keyof EventMap, Set<(payload: unknown) => void>>> = {};

  constructor(
    private getMasterWindow: () => Window | null,
    private cardcomOrigin: string,
  ) {
    window.addEventListener('message', this.handleMessage);
  }

  private handleMessage = (event: MessageEvent) => {
    // Only trust messages that actually come from CardCom's master frame.
    if (event.origin !== this.cardcomOrigin) return;
    const masterWindow = this.getMasterWindow();
    if (!masterWindow || event.source !== masterWindow) return;
    if (!isOpenFieldsMessage(event.data)) return;

    const message = event.data;
    switch (message.action) {
      case 'ready':
        this.emit('ready', undefined);
        break;
      case 'initialized':
        this.emit('initialized', {
          isApplePayAvailable: message.isApplePayAvailable,
          isGooglePayAvailable: message.isGooglePayAvailable,
        });
        break;
      case 'handleValidations': {
        this.emit('validation', { field: message.field, isValid: message.isValid });
        if (message.field === 'cardNumber') {
          this.post({
            action: message.isValid ? 'removeCardNumberFieldClass' : 'addCardNumberFieldClass',
            className: 'input-error',
          });
        }
        if (message.field === 'cvv') {
          this.post({
            action: message.isValid ? 'removeCvvFieldClass' : 'addCvvFieldClass',
            className: 'input-error',
          });
        }
        break;
      }
      case 'HandleSubmit':
        this.emit('submitResult', message.data);
        break;
      case 'HandleEror':
        this.emit('submitError', {
          message: message.message,
          responseCode: message.ResponseCode,
          redirectUrl: message.redirectUrl,
          isDeveloperError: message.isDeveloperError,
        });
        break;
      default:
        break;
    }
  };

  destroy() {
    window.removeEventListener('message', this.handleMessage);
    this.listeners = {};
  }

  on<K extends keyof EventMap>(event: K, listener: Listener<K>): () => void {
    let set = this.listeners[event];
    if (!set) {
      set = new Set();
      this.listeners[event] = set;
    }
    const loose = listener as unknown as (payload: unknown) => void;
    set.add(loose);
    return () => set?.delete(loose);
  }

  private emit<K extends keyof EventMap>(event: K, payload: EventMap[K]) {
    this.listeners[event]?.forEach((listener) => listener(payload));
  }

  private post(message: OpenFieldsOutboundMessage) {
    this.getMasterWindow()?.postMessage(message, this.cardcomOrigin);
  }

  init(payload: InitPayload) {
    this.post({ action: 'init', ...payload });
  }

  validateCardNumber() {
    this.post({ action: 'validateCardNumber' });
  }

  validateCvv() {
    this.post({ action: 'validateCvv' });
  }

  setCardOwnerDetails(data: CardOwnerDetails) {
    this.post({ action: 'setCardOwnerDetails', data });
  }

  doTransaction(fields: DoTransactionPayload) {
    this.validateCardNumber();
    this.validateCvv();
    this.post({ action: 'doTransaction', ...fields });
  }
}
