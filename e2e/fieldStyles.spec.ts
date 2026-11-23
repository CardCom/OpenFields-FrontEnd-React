// The merchant's CSS and placeholders reach the CardNumber / CVV iframes even when an iframe loads
// late. Regression for the OpenFields race (2026-11-16): the master frame posted setStyles once, on
// init; a field iframe that was not listening yet never got it and stayed an unstyled browser input.
// Fixed by the 'fieldFrameReady' handshake (field announces, master re-sends).
// No payment is made here.
import { test, expect, type Page } from '@playwright/test';

/** What the merchant's setStyles changed inside a field iframe. */
async function fieldState(page: Page, name: string) {
  // While the delayed script blocks parsing there is no <body> yet - report "not yet" and let the poll retry.
  return page.frame({ name })!.evaluate(() =>
    document.body
      ? {
          merchantCss: !!document.getElementById('cardcom-user-css') || document.head.querySelectorAll('style').length > 0,
          placeholder: document.querySelector('input')?.placeholder ?? '',
          bodyMargin: getComputedStyle(document.body).margin,
        }
      : { merchantCss: false, placeholder: '(document still loading)', bodyMargin: '' },
  );
}

for (const [script, delayMs] of [
  ['CardNumber.js', 0],
  ['CardNumber.js', 2500],
  ['CVV.js', 2500],
] as const) {
  test(`fields are styled when ${script} loads ${delayMs}ms late`, async ({ page }) => {
    await page.route(new RegExp(script.replace('.', '\\.'), 'i'), async (route) => {
      await new Promise((r) => setTimeout(r, delayMs));
      await route.continue();
    });
    await page.goto('/?lang=en');
    await expect(page.getByTestId('pay-button')).toBeEnabled({ timeout: 30_000 });

    // The styles may arrive after the iframe announces itself - poll.
    await expect.poll(() => fieldState(page, 'CardComCardNumber'), { timeout: 15_000 }).toEqual({
      merchantCss: true,
      placeholder: 'Card number',
      bodyMargin: '0px',
    });
    await expect.poll(() => fieldState(page, 'CardComCvv'), { timeout: 15_000 }).toEqual({
      merchantCss: true,
      placeholder: 'CVV',
      bodyMargin: '0px',
    });
  });
}
