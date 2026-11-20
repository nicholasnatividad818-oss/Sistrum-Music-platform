import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// The reverse proxy must forward /api/soundcloud to the trusted server.
// No SoundCloud secrets or tokens are ever read by this browser component.
export function SoundCloudCatalogPanel({ user }: { user: User | null }) {
  const [connected, setConnected] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const enabled = import.meta.env.VITE_SOUNDCLOUD_INTEGRATION_ENABLED === 'true';

  async function call(path: string, method = 'GET') {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Sign in to Sistrum first');
    const response = await fetch(`/api/soundcloud/${path}`, {
      method,
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'SoundCloud request failed');
    return data;
  }
  useEffect(() => {
    if (!enabled || !user) { setConnected(false); return; }
    let mounted = true;
    call('status').then((data) => { if (mounted) setConnected(Boolean(data.connected)); })
      .catch(() => { if (mounted) setMessage('SoundCloud connection status unavailable'); });
    return () => { mounted = false; };
  }, [enabled, user?.id]);

  if (!enabled || !user) return null;
  async function connect() {
    setWorking(true); setMessage('');
    try {
      const data = await call('authorize', 'POST');
      const target = new URL(data.authorization_url);
      if (target.origin !== 'https://secure.soundcloud.com' || target.pathname !== '/authorize') throw new Error('Invalid authorization URL');
      window.location.assign(target.href);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Authorization failed'); setWorking(false); }
  }
  async function sync() {
    setWorking(true); setMessage('');
    try {
      const result = await call('sync', 'POST');
      setMessage(`Synchronized ${result.synced} SoundCloud metadata records`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Sync failed'); }
    finally { setWorking(false); }
  }
  return <section aria-label="SoundCloud catalog integration" className="mx-auto w-full max-w-6xl px-4 py-3 border-b border-neutral-800 text-sm">
    <div className="flex flex-wrap items-center gap-3">
      <span className="font-semibold">SoundCloud catalog: {connected ? 'Connected' : 'Not connected'}</span>
      <button type="button" disabled={working} onClick={connect} className="rounded border border-neutral-600 px-3 py-2 disabled:opacity-50">{connected ? 'Reconnect' : 'Connect SoundCloud'}</button>
      {connected && <button type="button" disabled={working} onClick={sync} className="rounded bg-orange-600 px-3 py-2 text-white disabled:opacity-50">Sync metadata</button>}
    </div>
    {message && <p role="status" className="mt-2 text-neutral-300">{message}</p>}
  </section>;
}
