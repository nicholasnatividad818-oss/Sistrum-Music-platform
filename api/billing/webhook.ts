import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import { supabaseAdmin } from '../../server/billing/admin';
import { stripeClient } from '../../server/billing/stripeClient';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function rawBody(req: any): Promise<string> {
  if (typeof req.rawBody === 'string') return req.rawBody;
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function dbStatus(status: string, deleted: boolean): string {
  if (deleted) return 'canceled';
  if (status === 'active' || status === 'trialing' || status === 'past_due' || status === 'incomplete') {
    return status;
  }
  return 'canceled';
}

function periodEnd(subscription: Stripe.Subscription): string | null {
  const legacy = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end;
  const fromItem = (subscription.items?.data?.[0] as { current_period_end?: number } | undefined)?.current_period_end;
  const seconds = legacy || fromItem;
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

async function upsertEntitlement(
  admin: SupabaseClient,
  input: {
    userId: string;
    plan: 'free' | 'pro';
    status: string;
    customerId?: string | null;
    subscriptionId?: string | null;
    periodEnd?: string | null;
  },
) {
  const { error } = await admin.from('entitlements').upsert(
    {
      user_id: input.userId,
      plan: input.plan,
      status: input.status,
      stripe_customer_id: input.customerId || null,
      stripe_subscription_id: input.subscriptionId || null,
      current_period_end: input.periodEnd || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) throw new Error(error.message);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = stripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const admin = supabaseAdmin();
  if (!stripe || !secret || !admin) {
    return res.status(503).json({ error: 'Billing webhook is not configured' });
  }

  const signature = req.headers?.['stripe-signature'];
  if (!signature || Array.isArray(signature)) {
    return res.status(400).json({ error: 'Missing Stripe signature' });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await rawBody(req), signature, secret);
  } catch (err) {
    console.error('stripe signature', err instanceof Error ? err.message : 'invalid');
    return res.status(400).json({ error: 'Invalid Stripe signature' });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id || session.client_reference_id;
      if (!userId || session.mode !== 'subscription') {
        return res.status(200).json({ received: true });
      }
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
      let end: string | null = null;
      let status = 'active';
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        status = subscription.status;
        end = periodEnd(subscription);
      }
      const storedStatus = dbStatus(status, false);
      const pro = storedStatus === 'active' || storedStatus === 'trialing';
      await upsertEntitlement(admin, {
        userId,
        plan: pro ? 'pro' : 'free',
        status: storedStatus,
        customerId,
        subscriptionId,
        periodEnd: end,
      });
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.user_id;
      if (!userId) {
        return res.status(200).json({ received: true });
      }
      const deleted = event.type === 'customer.subscription.deleted';
      const storedStatus = dbStatus(subscription.status, deleted);
      const pro = storedStatus === 'active' || storedStatus === 'trialing';
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
      await upsertEntitlement(admin, {
        userId,
        plan: pro ? 'pro' : 'free',
        status: storedStatus,
        customerId,
        subscriptionId: subscription.id,
        periodEnd: periodEnd(subscription),
      });
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('stripe webhook', err instanceof Error ? err.message : 'error');
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
}
