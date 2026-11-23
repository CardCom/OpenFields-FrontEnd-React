export interface CreateLowProfileResponse {
  orderId: string;
  lowProfileCode: string;
  bitUrl: string | null;
  amount: number;
  currency: string;
  productName: string;
}

export interface OrderStatusResponse {
  orderId: string;
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'expired';
  amount: number;
  currency: string;
  productName: string;
  transactionId?: number | null;
}
