import { config } from '../../config';
import type { UseOpenFieldsResult } from '../../hooks/useOpenFields';
import { useFocusedIframe } from '../../hooks/useFocusedIframe';
import { language, t } from '../../i18n';
import { fieldBoxClass, fieldClass, labelClass } from '../../styles/fieldClasses';

interface CardFieldsFrameProps {
  openFields: UseOpenFieldsResult;
  expiration: { month: string; year: string };
  onExpirationChange: (value: { month: string; year: string }) => void;
}

const digitsOnly = (value: string) => value.replace(/\D/g, '').slice(0, 2);

export function CardFieldsFrame({ openFields, expiration, onExpirationChange }: CardFieldsFrameProps) {
  const { masterFrameRef, cardNumberFrameRef, cvvFrameRef, cardValid, cvvValid } = openFields;
  const focusedFrame = useFocusedIframe();

  return (
    <div className="mt-4 space-y-4">
      <div>
        <span className={labelClass}>{t('cardNumber')}</span>
        {/* The wrapper draws the border and the focus ring around the borderless iframe. */}
        <div className={fieldBoxClass(cardValid === false, focusedFrame === 'CardComCardNumber')}>
          <iframe
            ref={cardNumberFrameRef}
            name="CardComCardNumber"
            src={`${config.openFieldsBaseUrl}/CardNumber?language=${language.code}`}
            allow="payment"
            title={t('cardNumber')}
            scrolling="no"
            className="block h-full w-full border-0"
          />
        </div>
        {cardValid === false && <p className="mt-1 text-xs text-rose-600">{t('invalidCard')}</p>}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className={labelClass}>{t('month')}</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="cc-exp-month"
            dir="ltr"
            maxLength={2}
            placeholder={t('monthPlaceholder')}
            value={expiration.month}
            onChange={(e) => onExpirationChange({ ...expiration, month: digitsOnly(e.target.value) })}
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>{t('year')}</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="cc-exp-year"
            dir="ltr"
            maxLength={2}
            placeholder={t('yearPlaceholder')}
            value={expiration.year}
            onChange={(e) => onExpirationChange({ ...expiration, year: digitsOnly(e.target.value) })}
            className={fieldClass}
          />
        </label>
        <div>
          <span className={labelClass}>{t('cvv')}</span>
          <div className={fieldBoxClass(cvvValid === false, focusedFrame === 'CardComCvv')}>
            <iframe
              ref={cvvFrameRef}
              name="CardComCvv"
              src={`${config.openFieldsBaseUrl}/CVV?language=${language.code}`}
              allow="payment"
              title={t('cvv')}
              scrolling="no"
              className="block h-full w-full border-0"
            />
          </div>
        </div>
      </div>
      {cvvValid === false && <p className="text-xs text-rose-600">{t('invalidCvv')}</p>}

      {/* Hidden orchestrator — required in every scenario. Keep allow="payment". */}
      <iframe
        ref={masterFrameRef}
        name="CardComMasterFrame"
        id="CardComMasterFrame" // 3DS.js finds the master frame by this id
        src={`${config.openFieldsBaseUrl}/Master?language=${language.code}`}
        allow="payment"
        title="CardCom secure payment orchestrator"
        style={{ display: 'none' }}
      />
    </div>
  );
}
