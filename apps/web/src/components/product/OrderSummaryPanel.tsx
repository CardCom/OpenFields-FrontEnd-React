import { formatAmount, t } from '../../i18n';

interface OrderSummaryPanelProps {
  amount: number;
  currency: string;
}

export function OrderSummaryPanel({ amount, currency }: OrderSummaryPanelProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">{t('orderSummary')}</h2>
      <div className="mt-4 flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <p className="font-medium text-slate-900">{t('product')}</p>
          <p className="text-sm text-slate-500">{t('quantity', { n: 1 })}</p>
        </div>
        <p className="font-medium text-slate-900">{formatAmount(amount, currency)}</p>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-base font-semibold text-slate-900">{t('total')}</p>
        <p className="text-xl font-semibold text-brand-900">{formatAmount(amount, currency)}</p>
      </div>
      <p className="mt-6 text-xs leading-relaxed text-slate-400">{t('demoNote')}</p>
    </div>
  );
}
