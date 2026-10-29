declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: { ondismiss?: () => void };
}

export interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

let scriptPromise: Promise<void> | null = null;

function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Could not load the Razorpay checkout script'));
      document.body.appendChild(script);
    });
  }
  return scriptPromise;
}

interface OpenRazorpayCheckoutInput {
  keyId: string;
  orderId: string;
  amountMinor: number;
  currency: string;
  customerName: string;
  customerEmail: string;
}

/** Opens the real Razorpay Checkout modal. Only used when live/test API keys are configured. */
export function openRazorpayCheckout(input: OpenRazorpayCheckoutInput): Promise<RazorpaySuccessResponse> {
  return loadRazorpayScript().then(
    () =>
      new Promise<RazorpaySuccessResponse>((resolve, reject) => {
        if (!window.Razorpay) {
          reject(new Error('Razorpay checkout did not load'));
          return;
        }
        const instance = new window.Razorpay({
          key: input.keyId,
          amount: input.amountMinor,
          currency: input.currency,
          order_id: input.orderId,
          name: 'Sharmiance Publication House',
          description: 'Book order',
          prefill: { name: input.customerName, email: input.customerEmail },
          theme: { color: '#0e5c56' },
          handler: (response) => resolve(response),
          modal: { ondismiss: () => reject(new Error('Payment was cancelled')) },
        });
        instance.open();
      }),
  );
}
