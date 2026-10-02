import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { verifyWebhook } from '../_shared/labelgrid.ts';
Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const secret = Deno.env.get('LABELGRID_WEBHOOK_SECRET');
  if (!secret) return new Response('Webhook not configured', { status: 503 });
  const raw = await req.text();
  if (raw.length > 1048576) return new Response('Too large', { status: 413 });
  let payload;
  try { payload = await verifyWebhook(raw, req.headers.get('X-Webhook-Signature') || '', secret); }
  catch { return new Response('Invalid delivery', { status: 401 }); }
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
  // Store notifications as an inbox, not authoritative release state. Refresh from API.
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const id = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  const { error } = await admin.from('labelgrid_events').upsert({ id, event: payload.event, payload }, { onConflict: 'id', ignoreDuplicates: true });
  return new Response(error ? 'Storage unavailable' : 'ok', { status: error ? 503 : 200 });
});
