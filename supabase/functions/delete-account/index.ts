import { corsHeaders } from 'jsr:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Account service is unavailable' }), {
      status: 503,
      headers: jsonHeaders,
    });
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const token = authorization.slice('Bearer '.length);
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const userId = userData.user.id;
  for (const bucket of ['audio', 'cover-art'] as const) {
    const { data: files, error: listError } = await admin.storage.from(bucket).list(userId, {
      limit: 100,
    });
    if (listError) {
      console.error('Unable to list account files', { bucket, userId, message: listError.message });
      return new Response(JSON.stringify({ error: 'Unable to remove account files' }), {
        status: 500,
        headers: jsonHeaders,
      });
    }
    if (files?.length) {
      const { error: removeError } = await admin.storage
        .from(bucket)
        .remove(files.map((file) => `${userId}/${file.name}`));
      if (removeError) {
        console.error('Unable to remove account files', { bucket, userId, message: removeError.message });
        return new Response(JSON.stringify({ error: 'Unable to remove account files' }), {
          status: 500,
          headers: jsonHeaders,
        });
      }
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error('Unable to delete account', { userId, message: deleteError.message });
    return new Response(JSON.stringify({ error: 'Unable to delete account' }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  return new Response(JSON.stringify({ deleted: true }), {
    status: 200,
    headers: jsonHeaders,
  });
});
