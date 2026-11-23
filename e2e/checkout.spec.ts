// A real OpenFields payment through the merchant integration: the checkout page hosts CardCom's
// iframes, the backend creates the LowProfile, the card is typed into the CardNumber/CVV iframes and
// charged with doTransaction.
//
// Money safety: every order the page creates is tracked, and afterEach refunds each one that ended up
// paid - also when an assertion failed half-way. (In dev, React StrictMode mounts the checkout twice,
// so one page load creates TWO orders; only one of them is attached to the iframes.)
import { test, expect, type Page } from '@playwright/test';
import { loadEnvironment } from '../scripts/env.mjs';
import dotenv from 'dotenv';
import fs from 'node:fs';

const env = loadEnvironment(process.env.CARDCOM_ENV);
const raw = dotenv.parse(fs.readFileSync(env.file));
const card = {
  number: raw.TEST_CARD_NUMBER,
  month: (raw.TEST_CARD_EXPIRY_MONTH ?? '').padStart(2, '0'),
  year: (raw.TEST_CARD_EXPIRY_YEAR ?? '').slice(-2),
  cvv: raw.TEST_CARD_CVV,
  ownerId: raw.TEST_CARD_OWNER_ID ?? '',
};

type Session = { orderId: string; lowProfileCode: string; amount: number };
type Order = { status: string; transactionId: number | null };

async function cardcom<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${env.host}/api/v11${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ TerminalNumber: env.terminalNumber, ApiName: env.apiName, ApiPassword: env.apiPassword, ...body }),
  });
  if (!res.ok) throw new Error(`${path} HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** The backend's own verification of an order (GetLpResult behind it). */
async function verify(orderId: string): Promise<Order> {
  const res = await fetch(`${env.serverUrl}/api/checkout/verify/${orderId}`);
  return (await res.json()) as Order;
}

let sessions: Session[] = [];
const refunded = new Set<number>();

test.beforeEach(async ({ page }) => {
  sessions = [];
  page.on('response', async (r) => {
    if (r.url().endsWith('/api/checkout/low-profile') && r.request().method() === 'POST' && r.ok()) {
      sessions.push((await r.json()) as Session);
    }
  });
});

test.afterEach(async () => {
  for (const s of sessions) {
    const order = await verify(s.orderId);
    if (order.status === 'paid' && order.transactionId && !refunded.has(order.transactionId)) {
      const refund = await cardcom<{ ResponseCode: number; Description?: string }>('/Transactions/RefundByTransactionId', {
        TransactionId: order.transactionId,
      });
      if (refund.ResponseCode !== 0) {
        throw new Error(`REFUND FAILED - transaction ${order.transactionId} on terminal ${env.terminalNumber} is still charged: ${refund.Description}`);
      }
      refunded.add(order.transactionId);
      console.log(`cleanup: refunded transaction ${order.transactionId}`);
    }
  }
});

/** Opens the checkout and waits until the master iframe answered `ready` (the Pay button enables). */
async function openCheckout(page: Page, lang = 'en') {
  await page.goto(`/?lang=${lang}`);
  await expect(page.getByTestId('pay-button')).toBeEnabled({ timeout: 30_000 });
  expect(sessions.length, 'backend created a LowProfile').toBeGreaterThan(0);
}

test('the checkout shows which CardCom environment it charges', async ({ page }) => {
  await openCheckout(page);
  const badge = page.getByTestId('cardcom-environment');
  await expect(badge).toContainText(env.name);
  await expect(badge).toContainText(new URL(env.host).host);
  await expect(badge).toContainText(String(env.terminalNumber));
});

test('the CardCom iframes load from the configured host', async ({ page }) => {
  await openCheckout(page);
  for (const name of ['CardComCardNumber', 'CardComCvv', 'CardComMasterFrame']) {
    const src = await page.locator(`iframe[name="${name}"]`).getAttribute('src');
    expect(src, name).toMatch(new RegExp(`^${env.host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/api/OpenFields/`, 'i'));
  }
  await expect(page.frameLocator('iframe[name="CardComCardNumber"]').locator('input').first()).toBeVisible();
  await expect(page.frameLocator('iframe[name="CardComCvv"]').locator('input').first()).toBeVisible();
});

for (const lang of ['en', 'he']) {
test(`a card payment is approved, confirmed by GetLpResult, and refunded (${lang})`, async ({ page }) => {
  test.skip(!card.number, `no TEST_CARD_NUMBER in ${env.file}`);

  await openCheckout(page, lang);

  const field = (en: string, he: string) => page.getByLabel(lang === 'he' ? he : en, { exact: true });
  await field('Full name', 'שם מלא').fill('OpenFields Tester');
  await field('Email', 'דוא״ל').fill('openfields-tester@example.com');
  await field('Phone', 'טלפון').fill('0500000000');
  if (card.ownerId) await field('ID number (optional)', 'תעודת זהות (לא חובה)').fill(card.ownerId);

  await page.frameLocator('iframe[name="CardComCardNumber"]').locator('input').first().fill(card.number);
  await page.locator('input[autocomplete="cc-exp-month"]').fill(card.month);
  await page.locator('input[autocomplete="cc-exp-year"]').fill(card.year);
  await page.frameLocator('iframe[name="CardComCvv"]').locator('input').first().fill(card.cvv);

  await page.getByTestId('pay-button').click();
  await expect(page.getByText(lang === 'he' ? 'התשלום בוצע בהצלחה' : 'Payment successful')).toBeVisible({ timeout: 60_000 });

  // The merchant backend's own verification (GetLpResult) must agree with the page: exactly one of
  // the orders the page created is paid.
  const orders = await Promise.all(sessions.map((s) => verify(s.orderId)));
  const paid = orders.filter((o) => o.status === 'paid');
  expect(paid, `backend verify (GetLpResult) of ${sessions.length} order(s)`).toHaveLength(1);
  expect(paid[0].transactionId, 'transaction id').toBeTruthy();
  // The refund itself happens (and is asserted) in afterEach.
});
}
