import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

export interface AuthedUser {
  user: User;
  token: string;
  client: SupabaseClient;
}

export function supabaseServerEnv(): { url: string; key: string } | null {
  const url = process.env.SISTRUM_SUPABASE_URL?.trim();
  const key = process.env.SISTRUM_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;
  return { url, key };
}

export type AuthResult = { ok: true; auth: AuthedUser } | { ok: false; status: number; error: string };

export function isAuthFailure(result: AuthResult): result is { ok: false; status: number; error: string } {
  return result.ok === false;
}

export async function requireUser(req: { headers?: Record<string, string | string[] | undefined> }): Promise<AuthResult> {
  const env = supabaseServerEnv();
  if (!env) {
    return { ok: false, status: 500, error: 'Server misconfigured' };
  }

  const header = req.headers?.authorization || req.headers?.Authorization;
  const authHeader = Array.isArray(header) ? header[0] : header;
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return { ok: false, status: 401, error: 'Missing authorization' };
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return { ok: false, status: 401, error: 'Missing authorization' };
  }

  const client = createClient(env.url, env.key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) {
    return { ok: false, status: 401, error: 'Invalid token' };
  }
  return { ok: true, auth: { user: data.user, token, client } };
}
