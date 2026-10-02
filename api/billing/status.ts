import { isAuthFailure, requireUser } from '../../server/auth/requireUser';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireUser(req);
  if (isAuthFailure(auth)) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const { data, error } = await auth.auth.client.rpc('billing_status');
  if (error) {
    const missing = error.code === 'PGRST202' || /billing_status/i.test(error.message || '');
    return res.status(missing ? 503 : 500).json({
      error: missing
        ? 'Run supabase/003_usage_and_billing.sql in the Supabase SQL editor.'
        : 'Could not load plan',
    });
  }

  return res.status(200).json(data);
}
