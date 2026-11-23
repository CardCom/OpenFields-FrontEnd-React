// The page language comes from the URL (?lang=he|en|ar|ru|es|de|fr), else the browser's language
// when CardCom supports it, else Hebrew. Changing it reloads the page: the LowProfile's Language is
// fixed when it is created, and the iframes take the language in their URL.
import { DEFAULT_LANGUAGE, getLanguage, isLanguageCode, type Language, type LanguageCode } from './languages';
import { MESSAGES, type MessageKey } from './messages';

function detect(): LanguageCode {
  const fromUrl = new URLSearchParams(window.location.search).get('lang')?.toLowerCase();
  if (isLanguageCode(fromUrl)) return fromUrl;
  const fromBrowser = navigator.language?.slice(0, 2).toLowerCase();
  if (isLanguageCode(fromBrowser)) return fromBrowser;
  return DEFAULT_LANGUAGE;
}

export const language: Language = getLanguage(detect());

/** Sets <html lang/dir> and the document title; call once before rendering. */
export function applyDocumentLanguage() {
  document.documentElement.lang = language.code;
  document.documentElement.dir = language.dir;
  document.title = t('pageTitle');
}

export function t(key: MessageKey, vars: Record<string, string | number> = {}): string {
  const text = MESSAGES[language.code][key] ?? MESSAGES.en[key];
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}

export function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(language.locale, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** Reloads the page in another language, keeping the rest of the URL. */
export function switchLanguage(code: LanguageCode) {
  const url = new URL(window.location.href);
  url.searchParams.set('lang', code);
  window.location.assign(url.toString());
}
