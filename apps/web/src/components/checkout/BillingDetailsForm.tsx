import { t } from '../../i18n';
import { fieldClass as inputClass, labelClass } from '../../styles/fieldClasses';

export interface BillingDetails {
  name: string;
  email: string;
  phone: string;
  id: string;
}

interface BillingDetailsFormProps {
  value: BillingDetails;
  onChange: (value: BillingDetails) => void;
}


export function BillingDetailsForm({ value, onChange }: BillingDetailsFormProps) {
  function update<K extends keyof BillingDetails>(key: K, fieldValue: string) {
    onChange({ ...value, [key]: fieldValue });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <label className="block">
        <span className={labelClass}>{t('fullName')}</span>
        <input autoComplete="cc-name" className={inputClass} value={value.name} onChange={(e) => update('name', e.target.value)} />
      </label>
      <label className="block">
        <span className={labelClass}>{t('email')}</span>
        <input
          type="email"
          dir="ltr"
          autoComplete="email"
          className={inputClass}
          value={value.email}
          onChange={(e) => update('email', e.target.value)}
        />
      </label>
      <label className="block">
        <span className={labelClass}>{t('phone')}</span>
        <input type="tel" dir="ltr" autoComplete="tel" className={inputClass} value={value.phone} onChange={(e) => update('phone', e.target.value)} />
      </label>
      <label className="block">
        <span className={labelClass}>{t('idOptional')}</span>
        <input inputMode="numeric" dir="ltr" className={inputClass} value={value.id} onChange={(e) => update('id', e.target.value)} />
      </label>
    </div>
  );
}
