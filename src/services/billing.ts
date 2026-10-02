import { supabase } from '../lib/supabase';

export interface BillingStatus {
  authenticated: boolean;
  plan: 'free' | 'pro';
  status: string;
  trackCount: number;
  audioBytes: number;
  trackCap: number;
  byteCap: number;
  fileCap: number;
  aiUsed: number;
  aiCap: number;
  currentPeriodEnd: string | null;
}

async function authHeader(): Promise<Record<string, string>> {
  if (!supabase) return {};
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function fetchBillingStatus(): Promise<BillingStatus | null> {
  const headers = await authHeader();
  if (!headers.Authorization) return null;
  const res = await fetch('/api/billing/status', { headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || 'Could not load plan');
  }
  return (await res.json()) as BillingStatus;
}

export async function startProCheckout(): Promise<string> {
  const headers = await authHeader();
  if (!headers.Authorization) {
    throw new Error('Sign in before upgrading.');
  }
  const res = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: '{}',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || typeof body?.url !== 'string') {
    throw new Error(body?.error || 'Could not start checkout');
  }
  return body.url;
}
