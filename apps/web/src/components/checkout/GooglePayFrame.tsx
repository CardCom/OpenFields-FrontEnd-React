import type { RefObject } from 'react';
import { config } from '../../config';
import { language } from '../../i18n';

interface GooglePayFrameProps {
  frameRef: RefObject<HTMLIFrameElement>;
  visible: boolean;
}

// Always mounted (even when hidden) — same rationale as ApplePayFrame.
export function GooglePayFrame({ frameRef, visible }: GooglePayFrameProps) {
  return (
    <iframe
      ref={frameRef}
      name="CardComGooglePay"
      src={`${config.openFieldsBaseUrl}/GooglePay?terminalNumber=${config.terminalNumber}&language=${language.code}`}
      allow="payment"
      title="Google Pay"
      style={{ display: visible ? 'block' : 'none', width: 240, height: 48, border: 'none' }}
    />
  );
}
