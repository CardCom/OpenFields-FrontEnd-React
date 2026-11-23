// LowProfile languages (CardCom LowProfileLoad.getDirection). Anything else falls back to Hebrew,
// CardCom's default.
export const LANGUAGES = ['he', 'en', 'ar', 'ru', 'es', 'de', 'fr'];

export function resolveLanguage(value) {
  const code = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return LANGUAGES.includes(code) ? code : 'he';
}
