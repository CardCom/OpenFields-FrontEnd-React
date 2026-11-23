import type { RefObject } from 'react';
import { config } from '../../config';
import { language } from '../../i18n';

interface ApplePayFrameProps {
  frameRef: RefObject<HTMLIFrameElement>;
  visible: boolean;
}

// Always mounted (even when hidden) — the master frame reaches this iframe by
// name as soon as init() runs, and it needs to exist to report availability back.
export function ApplePayFrame({ frameRef, visible }: ApplePayFrameProps) {
  return (
    <iframe
      ref={frameRef}
      name="CardComApplePay"
      src={`${config.openFieldsBaseUrl}/ApplePay?terminalNumber=${config.terminalNumber}&language=${language.code}`}
      allow="payment"
      title="Apple Pay"
      style={{ display: visible ? 'block' : 'none', width: 240, height: 48, border: 'none' }}
    />
  );
}
