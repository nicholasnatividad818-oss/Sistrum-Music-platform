import { supabase, isSupabaseConfigured } from '../supabase';
export async function labelgrid<T = any>(input: { action?: string; method?: string; path?: string; body?: unknown; query?: Record<string, string>; confirm?: boolean }): Promise<T> {
  if (!isSupabaseConfigured) throw new Error('Configure Supabase to connect LabelGrid.');
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) throw new Error('Sign in to access distribution.');
  const { data, error } = await supabase.functions.invoke('labelgrid', { body: input });
  if (error) {
    const response = (error as { context?: Response }).context;
    const detail = response instanceof Response ? await response.json().catch(() => null) : null;
    throw new Error(detail?.error || detail?.data?.message || error.message);
  }
  return data;
}
export const releases = () => labelgrid({ method: 'GET', path: '/releases' });
export const validateRelease = (id: string) => labelgrid({ method: 'POST', path: `/releases/${id}/validate` });
export const submitRelease = (id: string) => labelgrid({ method: 'POST', path: `/releases/${id}/distribute`, confirm: true });
export async function uploadTrackFile(id: string, file: File, type = 'stereo') {
  const response = await labelgrid({ method: 'POST', path: `/tracks/${id}/files/${type}/upload-url`, body: { filename: file.name } });
  const upload = response.data?.data || response.data;
  const target = new URL(upload.upload_url);
  if (target.protocol !== 'https:') throw new Error('Invalid upload URL');
  const result = await fetch(target, { method: 'PUT', body: file });
  if (!result.ok) throw new Error('Audio upload failed; file has not been registered.');
  return labelgrid({ method: 'PUT', path: `/tracks/${id}/files/${type}`, body: { s3_key: upload.key } });
}
