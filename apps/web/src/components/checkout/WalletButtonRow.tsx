import type { UseOpenFieldsResult } from '../../hooks/useOpenFields';
import { ApplePayFrame } from './ApplePayFrame';
import { GooglePayFrame } from './GooglePayFrame';
import { BitButton } from './BitButton';
import { t } from '../../i18n';

interface WalletButtonRowProps {
  openFields: UseOpenFieldsResult;
  bitUrl: string | null;
}

// All three buttons render at an identical 240x48 size with the same corner radius —
// an explicit CardCom/Apple/Google brand requirement, not just a style preference.
// The Apple/Google iframes stay mounted at all times (just hidden via CSS) so the
// master frame can keep reaching them by name; only the "none available" note is
// conditional.
export function WalletButtonRow({ openFields, bitUrl }: WalletButtonRowProps) {
  const { isApplePayAvailable, isGooglePayAvailable, walletsChecked, applePayFrameRef, googlePayFrameRef } =
    openFields;

  const noneAvailable = walletsChecked && !isApplePayAvailable && !isGooglePayAvailable && !bitUrl;

  return (
    <div>
      <div className="flex flex-wrap justify-center gap-3">
        <ApplePayFrame frameRef={applePayFrameRef} visible={isApplePayAvailable} />
        <GooglePayFrame frameRef={googlePayFrameRef} visible={isGooglePayAvailable} />
        <BitButton bitUrl={bitUrl} />
      </div>
      {noneAvailable && (
        <p className="mt-3 text-center text-sm text-slate-500">
          {t('noWallets')}
        </p>
      )}
    </div>
  );
}
