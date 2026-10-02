import Stripe from 'stripe';

export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key || key.toLowerCase().startsWith('sk_test_your') || key.toLowerCase().startsWith('your_')) {
    return null;
  }
  return new Stripe(key);
}

export function proPriceId(): string | null {
  const price = process.env.STRIPE_PRICE_PRO?.trim();
  if (!price || price.toLowerCase().startsWith('price_your')) return null;
  return price;
}
