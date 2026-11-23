import { config } from '../config';
import { language, t } from '../i18n';
import type { CreateLowProfileResponse, OrderStatusResponse } from '../types/api';

export async function createLowProfile(): Promise<CreateLowProfileResponse> {
  // The deal's language is fixed here: CardCom's texts (3DS, declines, Description) follow it.
  const response = await fetch(`${config.apiBaseUrl}/api/checkout/low-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: language.code }),
  });
  if (!response.ok) throw new Error(t('startFailed'));
  return response.json();
}

export async function verifyOrder(orderId: string): Promise<OrderStatusResponse> {
  const response = await fetch(`${config.apiBaseUrl}/api/checkout/verify/${orderId}`);
  if (!response.ok) throw new Error(t('verifyFailed'));
  return response.json();
}
