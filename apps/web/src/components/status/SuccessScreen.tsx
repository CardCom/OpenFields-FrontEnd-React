import type { HandleSubmitData } from '../../types/openfields';
import { t } from '../../i18n';

export function SuccessScreen({ result }: { result: HandleSubmitData | null }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white">
        ✓
      </div>
      <h2 className="text-lg font-semibold text-emerald-900">{t('paymentSuccessful')}</h2>
      <p className="mt-2 text-sm text-emerald-700">{result?.Description ?? t('paymentApproved')}</p>
    </div>
  );
}
