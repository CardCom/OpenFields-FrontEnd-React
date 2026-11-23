import { useEffect, useState } from 'react';
import { createLowProfile } from '../../lib/api';
import { formatAmount, t } from '../../i18n';
import { useOpenFields } from '../../hooks/useOpenFields';
import type { CreateLowProfileResponse } from '../../types/api';
import { OrderSummaryPanel } from '../product/OrderSummaryPanel';
import { LoadingOverlay } from '../status/LoadingOverlay';
import { SuccessScreen } from '../status/SuccessScreen';
import { ErrorScreen } from '../status/ErrorScreen';
import { BillingDetailsForm, type BillingDetails } from './BillingDetailsForm';
import { CardFieldsFrame } from './CardFieldsFrame';
import { WalletButtonRow } from './WalletButtonRow';

export function CheckoutPage() {
  const [session, setSession] = useState<CreateLowProfileResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [billing, setBilling] = useState<BillingDetails>({ name: '', email: '', phone: '', id: '' });
  const [expiration, setExpiration] = useState({ month: '', year: '' });

  useEffect(() => {
    createLowProfile()
      .then(setSession)
      .catch((err: Error) => setLoadError(err.message));
  }, []);

  const openFields = useOpenFields(session?.lowProfileCode ?? null);

  useEffect(() => {
    if (openFields.status === 'connecting') return;
    openFields.setCardOwnerDetails({
      CardOwnerName: billing.name,
      CardOwnerEmail: billing.email,
      CardOwnerPhone: billing.phone,
    });
    // Push billing details to the wallet sheets whenever they change, once the
    // master frame is ready to receive them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openFields.status, billing.name, billing.email, billing.phone]);

  if (loadError) {
    return <ErrorScreen message={loadError} onRetry={() => window.location.reload()} />;
  }

  if (!session) {
    return <LoadingOverlay label={t('preparing')} />;
  }

  if (openFields.status === 'success') {
    return <SuccessScreen result={openFields.result} />;
  }

  if (openFields.status === 'error') {
    return (
      <ErrorScreen
        message={openFields.error?.message ?? t('paymentNotCompleted')}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_360px]">
      <div className="order-2 space-y-6 md:order-1">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">{t('payWithWallet')}</h2>
          <WalletButtonRow openFields={openFields} bitUrl={session.bitUrl} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">{t('payWithCard')}</h2>
          <BillingDetailsForm value={billing} onChange={setBilling} />
          <CardFieldsFrame openFields={openFields} expiration={expiration} onExpirationChange={setExpiration} />
          <button
            type="button"
            data-testid="pay-button"
            disabled={openFields.status !== 'ready' && openFields.status !== 'submitting'}
            onClick={() =>
              openFields.submit({
                expirationMonth: expiration.month,
                expirationYear: expiration.year,
                numberOfPayments: 1,
                cardOwnerName: billing.name,
                cardOwnerEmail: billing.email,
                cardOwnerPhone: billing.phone,
                cardOwnerId: billing.id,
              })
            }
            className="mt-6 w-full rounded-xl bg-brand-900 px-4 py-3 font-medium text-white transition hover:bg-brand-800 disabled:opacity-50"
          >
            {openFields.status === 'submitting' ? t('processing') : t('pay', { amount: formatAmount(session.amount, session.currency) })}
          </button>
        </div>
      </div>

      <div className="order-1 md:order-2">
        <OrderSummaryPanel amount={session.amount} currency={session.currency} />
      </div>
    </div>
  );
}
