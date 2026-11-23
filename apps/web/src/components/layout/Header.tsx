import { config } from '../../config';
import { language, switchLanguage, t } from '../../i18n';
import { LANGUAGES, type LanguageCode } from '../../i18n/languages';

export function Header() {
  const isProduction = new URL(config.cardcomHost).hostname === 'secure.cardcom.solutions';
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 shrink-0 rounded-lg bg-brand-900" />
          <span className="text-lg font-semibold tracking-tight text-slate-900">CardCom OpenFields</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            data-testid="cardcom-environment"
            dir="ltr"
            title={`${config.cardcomHost} - terminal ${config.terminalNumber}`}
            className={`hidden rounded-full px-3 py-1 text-xs font-medium sm:inline-block ${
              isProduction ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {config.environment || 'unknown'} · {new URL(config.cardcomHost).host} · {config.terminalNumber}
          </span>
          <label className="sr-only" htmlFor="language">
            {t('language')}
          </label>
          <select
            id="language"
            data-testid="language-picker"
            value={language.code}
            onChange={(e) => switchLanguage(e.target.value as LanguageCode)}
            className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code} lang={l.code}>
                {l.nativeName}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
}
