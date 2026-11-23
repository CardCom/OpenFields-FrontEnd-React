// Language support, for every LowProfile language:
//  - the page: <html lang/dir> (RTL for Hebrew and Arabic), translated texts;
//  - the deal: LowProfile/Create gets the language (CardCom's own texts follow it);
//  - the OpenFields iframes (screen readers): <html lang>, a localized <title> and a localized
//    aria-label on the input - the iframe has no visible label of its own. The card number and CVV
//    are numeric and always left-to-right, so the iframes set no dir.
// No payment is made here.
import { test, expect, type Page } from '@playwright/test';

const LANGUAGES = [
  { code: 'he', dir: 'rtl', payWithCard: 'תשלום בכרטיס אשראי', cardLabel: 'מספר כרטיס אשראי', cvvLabel: 'קוד אבטחה (CVV)' },
  { code: 'en', dir: 'ltr', payWithCard: 'Pay with card', cardLabel: 'Card number', cvvLabel: 'Security code (CVV)' },
  { code: 'ar', dir: 'rtl', payWithCard: 'الدفع بالبطاقة', cardLabel: 'رقم البطاقة', cvvLabel: 'رمز الأمان (CVV)' },
  { code: 'ru', dir: 'ltr', payWithCard: 'Оплата картой', cardLabel: 'Номер карты', cvvLabel: 'Код безопасности (CVV)' },
  { code: 'es', dir: 'ltr', payWithCard: 'Pagar con tarjeta', cardLabel: 'Número de tarjeta', cvvLabel: 'Código de seguridad (CVV)' },
  { code: 'de', dir: 'ltr', payWithCard: 'Mit Karte bezahlen', cardLabel: 'Kartennummer', cvvLabel: 'Sicherheitscode (CVV)' },
  { code: 'fr', dir: 'ltr', payWithCard: 'Payer par carte', cardLabel: 'Numéro de carte', cvvLabel: 'Code de sécurité (CVV)' },
] as const;

async function open(page: Page, code: string) {
  const created = page.waitForRequest((r) => r.url().endsWith('/api/checkout/low-profile') && r.method() === 'POST');
  await page.goto(`/?lang=${code}`);
  const request = await created;
  await expect(page.getByTestId('pay-button')).toBeEnabled({ timeout: 30_000 });
  return request.postDataJSON() as { language?: string };
}

/** <html> attributes, <title> and the input's aria-label inside an OpenFields iframe. */
async function iframeA11y(page: Page, name: string) {
  const frame = page.frame({ name });
  expect(frame, `iframe ${name}`).toBeTruthy();
  return frame!.evaluate(() => ({
    lang: document.documentElement.getAttribute('lang'),
    dir: document.documentElement.getAttribute('dir'),
    title: document.title,
    ariaLabel: document.querySelector('input')?.getAttribute('aria-label') ?? null,
  }));
}

for (const l of LANGUAGES) {
  test(`${l.code}: page direction, texts, deal language and iframe accessibility`, async ({ page }) => {
    const body = await open(page, l.code);

    // The page
    await expect(page.locator('html')).toHaveAttribute('lang', l.code);
    await expect(page.locator('html')).toHaveAttribute('dir', l.dir);
    await expect(page.getByRole('heading', { name: l.payWithCard })).toBeVisible();
    await expect(page.getByTestId('language-picker')).toHaveValue(l.code);

    // The deal: the backend got the language for LowProfile/Create
    expect(body.language, 'language sent to the backend').toBe(l.code);

    // The iframes: requested in the language...
    for (const name of ['CardComCardNumber', 'CardComCvv', 'CardComMasterFrame', 'CardComGooglePay', 'CardComApplePay']) {
      const src = await page.locator(`iframe[name="${name}"]`).getAttribute('src');
      expect(new URL(src!).searchParams.get('language'), `${name} ?language=`).toBe(l.code);
    }

    // ...and what a screen reader gets from them
    const cardFrame = await iframeA11y(page, 'CardComCardNumber');
    const cvvFrame = await iframeA11y(page, 'CardComCvv');
    expect.soft(cardFrame.lang, 'card number iframe <html lang>').toBe(l.code);
    expect.soft(cardFrame.ariaLabel, 'card number input aria-label').toBe(l.cardLabel);
    expect.soft(cardFrame.title, 'card number iframe <title>').toBe(l.cardLabel);
    expect.soft(cvvFrame.lang, 'CVV iframe <html lang>').toBe(l.code);
    expect.soft(cvvFrame.ariaLabel, 'CVV input aria-label').toBe(l.cvvLabel);
    expect.soft(cvvFrame.title, 'CVV iframe <title>').toBe(l.cvvLabel);
    // Numeric fields stay left-to-right: no dir="rtl" inside the iframes, in any language.
    expect.soft(cardFrame.dir, 'card number iframe dir').not.toBe('rtl');
    expect.soft(cvvFrame.dir, 'CVV iframe dir').not.toBe('rtl');
  });
}

test('switching the language reloads the checkout in that language', async ({ page }) => {
  await open(page, 'en');
  const created = page.waitForRequest((r) => r.url().endsWith('/api/checkout/low-profile') && r.method() === 'POST');
  await page.getByTestId('language-picker').selectOption('ar');
  expect((await created).postDataJSON().language).toBe('ar');
  await expect(page).toHaveURL(/[?&]lang=ar/);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByTestId('pay-button')).toBeEnabled({ timeout: 30_000 });
});
