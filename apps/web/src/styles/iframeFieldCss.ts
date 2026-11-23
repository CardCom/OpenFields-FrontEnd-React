// CSS sent to CardCom's CardNumber / CVV iframes in `init` (cardFieldCSS / cvvFieldCSS). The iframe
// appends it as a <style> AFTER its own stylesheet, so these rules win at equal specificity; the
// !important flags guard against CardCom changing its defaults.
//
// What the iframe documents look like (CardCom4/External/OpenFields):
//   CardNumber: <body> <i id="cc-icon" class="credit-card [visa|mastercard|amex|diners]"> <input class="cardNumber" type="tel">
//   CVV:        <body> <input class="cvvField" type="tel">
// The browser's default 8px body margin makes a full-height input overflow the iframe (the scrollbar
// arrows), and CardCom positions the brand icon with fixed offsets - both are reset here.
//
// Allowed: plain CSS. Forbidden by CardCom: url(), @import, expression(), <script>.
// Keep the values in sync with the parent page's fields (CardFieldsFrame.tsx `fieldClass`):
// 48px tall, 16px text (smaller text makes iOS zoom in on focus), 12px side padding, slate colors.

const documentReset = `
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    height: 100% !important;
    overflow: hidden !important;
    background: transparent !important;
  }
  body {
    position: relative !important;
    display: flex !important;
    align-items: center !important;
    justify-content: flex-start !important;
  }
`;

const fieldBase = `
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  margin: 0 !important;
  padding: 0 12px !important;
  border: 0 !important;
  outline: none !important;
  box-shadow: none !important;
  background: transparent !important;
  box-sizing: border-box !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  font-size: 16px !important;
  line-height: normal !important;
  letter-spacing: normal !important;
  color: #0f172a !important;
  caret-color: #0f766e;
  -webkit-appearance: none;
  -moz-appearance: textfield;
  appearance: none;
`;

const placeholder = (selector: string) => `
  ${selector}::placeholder { color: #94a3b8; opacity: 1; }
`;

// The fields are type="tel" (no spinners), but suppress them anyway in case CardCom ever switches
// to type="number".
const noSpinButtons = (selector: string) => `
  ${selector}::-webkit-outer-spin-button,
  ${selector}::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
`;

// Autofill paints a yellow/blue background inside the iframe - keep it white.
const noAutofillTint = (selector: string) => `
  ${selector}:-webkit-autofill {
    -webkit-box-shadow: 0 0 0 1000px #ffffff inset !important;
    -webkit-text-fill-color: #0f172a !important;
  }
`;

export const cardFieldCss = `
  ${documentReset}
  #cc-icon {
    position: absolute !important;
    left: 12px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 32px !important;
    height: 22px !important;
    padding: 0 !important;
    margin: 0 !important;
    background-size: contain !important;
    background-position: center !important;
    background-repeat: no-repeat !important;
    pointer-events: none;
  }
  .cardNumber { ${fieldBase} padding-left: 56px !important; font-variant-numeric: tabular-nums; }
  ${placeholder('.cardNumber')}
  ${noSpinButtons('.cardNumber')}
  ${noAutofillTint('.cardNumber')}
`;

export const cvvFieldCss = `
  ${documentReset}
  .cvvField { ${fieldBase} font-variant-numeric: tabular-nums; }
  ${placeholder('.cvvField')}
  ${noSpinButtons('.cvvField')}
  ${noAutofillTint('.cvvField')}
`;
