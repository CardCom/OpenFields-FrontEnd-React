// The languages CardCom's LowProfile supports (LowProfileLoad.getDirection / LPC5Wapper): the same
// code goes to LowProfile/Create (`Language`), to every OpenFields iframe URL (`?language=`) and to
// the master frame's `init`. Hebrew and Arabic are right-to-left.

export type LanguageCode = 'he' | 'en' | 'ru' | 'ar' | 'es' | 'de' | 'fr';

export interface Language {
  code: LanguageCode;
  /** The language's own name, for the picker */
  nativeName: string;
  dir: 'rtl' | 'ltr';
  /** BCP 47 locale for number/currency formatting and Apple Pay */
  locale: string;
  /** Google Pay buttonLocale - Google Pay has no Hebrew button, so Hebrew uses English */
  googlePayLocale: string;
}

export const LANGUAGES: readonly Language[] = [
  { code: 'he', nativeName: 'עברית', dir: 'rtl', locale: 'he-IL', googlePayLocale: 'en' },
  { code: 'en', nativeName: 'English', dir: 'ltr', locale: 'en-US', googlePayLocale: 'en' },
  { code: 'ar', nativeName: 'العربية', dir: 'rtl', locale: 'ar-IL-u-nu-latn', googlePayLocale: 'ar' }, // Latin digits, like the card fields
  { code: 'ru', nativeName: 'Русский', dir: 'ltr', locale: 'ru-RU', googlePayLocale: 'ru' },
  { code: 'es', nativeName: 'Español', dir: 'ltr', locale: 'es-ES', googlePayLocale: 'es' },
  { code: 'de', nativeName: 'Deutsch', dir: 'ltr', locale: 'de-DE', googlePayLocale: 'de' },
  { code: 'fr', nativeName: 'Français', dir: 'ltr', locale: 'fr-FR', googlePayLocale: 'fr' },
];

export const DEFAULT_LANGUAGE: LanguageCode = 'he';

export function isLanguageCode(value: string | null | undefined): value is LanguageCode {
  return LANGUAGES.some((l) => l.code === value);
}

export function getLanguage(code: LanguageCode): Language {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}
