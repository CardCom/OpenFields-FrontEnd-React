import { useEffect, useRef, useState } from 'react';
import { OpenFieldsClient } from '../lib/openFieldsClient';
import { cardFieldCss, cvvFieldCss } from '../styles/iframeFieldCss';
import { config } from '../config';
import { language, t } from '../i18n';
import type { CardOwnerDetails, DoTransactionPayload, HandleSubmitData } from '../types/openfields';

export type OpenFieldsStatus = 'connecting' | 'ready' | 'submitting' | 'success' | 'error';

export interface SubmitError {
  message: string;
  responseCode: number;
}

/**
 * React adapter over OpenFieldsClient. Owns the five OpenFields iframe refs and
 * exposes plain state + actions — no component below this talks postMessage directly.
 */
export function useOpenFields(lowProfileCode: string | null) {
  const masterFrameRef = useRef<HTMLIFrameElement>(null);
  const cardNumberFrameRef = useRef<HTMLIFrameElement>(null);
  const cvvFrameRef = useRef<HTMLIFrameElement>(null);
  const applePayFrameRef = useRef<HTMLIFrameElement>(null);
  const googlePayFrameRef = useRef<HTMLIFrameElement>(null);
  const clientRef = useRef<OpenFieldsClient | null>(null);

  const [status, setStatus] = useState<OpenFieldsStatus>('connecting');
  const [walletsChecked, setWalletsChecked] = useState(false);
  const [isApplePayAvailable, setIsApplePayAvailable] = useState(false);
  const [isGooglePayAvailable, setIsGooglePayAvailable] = useState(false);
  const [cardValid, setCardValid] = useState<boolean | null>(null);
  const [cvvValid, setCvvValid] = useState<boolean | null>(null);
  const [result, setResult] = useState<HandleSubmitData | null>(null);
  const [error, setError] = useState<SubmitError | null>(null);

  useEffect(() => {
    if (!lowProfileCode) return;

    const client = new OpenFieldsClient(() => masterFrameRef.current?.contentWindow ?? null, config.cardcomOrigin);
    clientRef.current = client;

    const unsubscribers = [
      client.on('ready', () => {
        client.init({
          apiName: config.apiName,
          terminalNumber: config.terminalNumber,
          lowProfileCode,
          language: language.code,
          screenWidth: String(window.screen.width),
          screenHeight: String(window.screen.height),
          screenColorDepth: String(window.screen.colorDepth),
          cardFieldCSS: cardFieldCss,
          cvvFieldCSS: cvvFieldCss,
          placeholder: t('cardNumber'),
          cvvPlaceholder: t('cvv'),
          googlePayButton: {
            buttonType: 'pay',
            buttonColor: 'black',
            buttonSizeMode: 'fill',
            buttonRadius: 12,
            buttonLocale: language.googlePayLocale,
          },
          applePayButton: { type: 'pay', buttonstyle: 'black', locale: language.locale.split('-u-')[0], radius: 12 },
        });
        setStatus('ready');
      }),
      client.on('initialized', ({ isApplePayAvailable, isGooglePayAvailable }) => {
        setIsApplePayAvailable(isApplePayAvailable);
        setIsGooglePayAvailable(isGooglePayAvailable);
        setWalletsChecked(true);
      }),
      client.on('validation', ({ field, isValid }) => {
        if (field === 'cardNumber') setCardValid(isValid);
        if (field === 'cvv') setCvvValid(isValid);
      }),
      client.on('submitResult', (data) => {
        // The card flow can redirect too, not just Bit — honor it if present.
        if (data.redirectUrl) {
          window.location.assign(data.redirectUrl);
          return;
        }
        setResult(data);
        setStatus('success');
      }),
      client.on('submitError', (err) => {
        if (err.redirectUrl) {
          window.location.assign(err.redirectUrl);
          return;
        }
        setError({
          message: Array.isArray(err.message) ? err.message.join(', ') : err.message,
          responseCode: err.responseCode,
        });
        setStatus('error');
      }),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      client.destroy();
      clientRef.current = null;
    };
  }, [lowProfileCode]);

  function submit(fields: DoTransactionPayload) {
    setStatus('submitting');
    clientRef.current?.doTransaction(fields);
  }

  function setCardOwnerDetails(details: CardOwnerDetails) {
    clientRef.current?.setCardOwnerDetails(details);
  }

  return {
    status,
    walletsChecked,
    isApplePayAvailable,
    isGooglePayAvailable,
    cardValid,
    cvvValid,
    result,
    error,
    masterFrameRef,
    cardNumberFrameRef,
    cvvFrameRef,
    applePayFrameRef,
    googlePayFrameRef,
    submit,
    setCardOwnerDetails,
  };
}

export type UseOpenFieldsResult = ReturnType<typeof useOpenFields>;
