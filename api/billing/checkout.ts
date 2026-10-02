import { isAuthFailure, requireUser } from '../../server/auth/requireUser';
import { proPriceId, stripeClient } from '../../server/billing/stripeClient';

function appOrigin(req: any): string {
  const header = req.headers?.origin || req.headers?.Origin;
  const origin = Array.isArray(header) ? header[0] : header;
  if (typeof origin === 'string' && /^https?:\/\//.test(origin)) return origin.replace(/\/$/, '');
  const configured = process.env.APP_URL?.trim().replace(/\/$/, '');
  if (configured && !configured.toLowerCase().startsWith('my_')) return configured;
  return 'http://127.0.0.1:3000';
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = stripeClient();
  const price = proPriceId();
  if (!stripe || !price) {
    return res.status(503).json({
      error: 'Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_PRO.',
    });
  }

  const auth = await requireUser(req);
  if (isAuthFailure(auth)) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const { data: status, error } = await auth.auth.client.rpc('billing_status');
  if (error || !status?.authenticated) {
    return res.status(503).json({
      error: 'Run supabase/003_usage_and_billing.sql before opening checkout.',
    });
  }

  const origin = appOrigin(req);
  const customerId = typeof status.stripeCustomerId === 'string' ? status.stripeCustomerId : undefined;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      client_reference_id: auth.auth.user.id,
      customer: customerId,
      customer_email: customerId ? undefined : auth.auth.user.email || undefined,
      metadata: { user_id: auth.auth.user.id },
      subscription_data: { metadata: { user_id: auth.auth.user.id } },
      success_url: `${origin}/?billing=success`,
      cancel_url: `${origin}/?billing=cancel`,
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return res.status(500).json({ error: 'Stripe did not return a checkout URL' });
    }
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('checkout failed', err instanceof Error ? err.message : 'error');
    return res.status(500).json({ error: 'Could not start checkout' });
  }
}
