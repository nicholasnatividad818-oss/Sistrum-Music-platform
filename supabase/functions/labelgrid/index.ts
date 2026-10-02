import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { labelgridRequest, resolveOperation } from '../_shared/labelgrid.ts';
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
  const jwt = req.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!jwt) return json({ error: 'Sign in required' }, 401);
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) return json({ error: 'Sign in required' }, 401);
  // This token represents one label account. Never grant it to every signed-in artist.
  const allowed = (Deno.env.get('LABELGRID_OPERATOR_IDS') || '').split(',').map(x => x.trim()).filter(Boolean);
  if (!allowed.includes(data.user.id)) return json({ error: 'LabelGrid operator access required' }, 403);
  const token = Deno.env.get('LABELGRID_API_TOKEN');
  if (!token) return json({ error: 'LabelGrid is not connected yet' }, 503);
  const base = Deno.env.get('LABELGRID_API_BASE') || 'https://api.labelgrid.com/api/public';
  let submissionId: string | undefined;
  try {
    const raw = await req.text();
    if (raw.length > 262144) return json({ error: 'Request too large' }, 413);
    const input = JSON.parse(raw);
    if (input.action === 'events') {
      const result = await admin.from('labelgrid_events').select('id,event,payload,received_at').order('received_at', { ascending: false }).limit(50);
      return result.error ? json({ error: 'Event store unavailable' }, 503) : json({ data: result.data });
    }
    const { method, path, body, query } = input;
    if (!resolveOperation(method, path)) return json({ error: 'Unsupported operation' }, 400);
    if (/\/distribute$/.test(path)) {
      if (input.confirm !== true) return json({ error: 'Confirm distribution submission' }, 400);
      // A durable unique row prevents simultaneous and ambiguous repeat submissions.
      const releaseId = path.split('/')[2];
      const lock = await admin.from('labelgrid_submissions').insert({ release_id: releaseId, operator_id: data.user.id }).select('id').single();
      if (lock.error) return json({ error: 'Submission already attempted or store unavailable. Reconcile in LabelGrid before unlocking.' }, 409);
      submissionId = lock.data.id;
      const validation = await labelgridRequest(base, token, 'POST', `/releases/${releaseId}/validate`);
      if (validation.status !== 200 || (validation.data as { result?: string }).result !== 'OK') {
        await admin.from('labelgrid_submissions').delete().eq('id', submissionId);
        return json({ error: 'Release did not pass validation', validation: validation.data }, 422);
      }
    }
    const result = await labelgridRequest(base, token, method, path, body, query);
    if (submissionId) await admin.from('labelgrid_submissions').update({ status: result.status < 300 ? 'submitted' : 'reconcile', response: result.data }).eq('id', submissionId);
    return json(result, result.status >= 400 ? result.status : 200);
  } catch {
    return json({ error: submissionId ? 'Submission outcome unknown. Check LabelGrid before retrying.' : 'Request failed. For writes, check LabelGrid before retrying.' }, 502);
  }
});
