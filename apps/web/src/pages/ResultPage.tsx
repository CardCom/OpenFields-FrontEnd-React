import { useEffect, useState } from 'react';
import { verifyOrder } from '../lib/api';
import type { OrderStatusResponse } from '../types/api';
import { LoadingOverlay } from '../components/status/LoadingOverlay';
import { SuccessScreen } from '../components/status/SuccessScreen';
import { ErrorScreen } from '../components/status/ErrorScreen';
import { formatAmount, language, t } from '../i18n';

// Landing page for SuccessRedirectUrl / FailedRedirectUrl / CancelRedirectUrl.
// Needed because Bit leaves the SPA entirely (full-page redirect to the provider),
// so the result can't be learned from a postMessage — it's re-verified server-side.
export function ResultPage() {
  const [order, setOrder] = useState<OrderStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('orderId');
    if (!orderId) {
      setError(t('missingOrder'));
      return;
    }
    verifyOrder(orderId)
      .then(setOrder)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return <ErrorScreen message={error} onRetry={() => (window.location.href = `/?lang=${language.code}`)} />;
  }
  if (!order) {
    return <LoadingOverlay label={t('confirming')} />;
  }
  if (order.status === 'paid') {
    return (
      <SuccessScreen
        result={{ ResponseCode: 0, Description: `${t('product')} — ${formatAmount(order.amount, order.currency)}` }}
      />
    );
  }
  return <ErrorScreen message={t('paymentNotCompleted')} onRetry={() => (window.location.href = `/?lang=${language.code}`)} />;
}
