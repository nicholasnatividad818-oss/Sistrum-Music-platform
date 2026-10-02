import { supabase } from '../lib/supabase';

export type AiProviderId = 'chatgpt' | 'openai' | 'gemini';

export interface AssistantHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiProviderStatus {
  id: AiProviderId;
  label: string;
  model: string;
  env: string;
  configured: boolean;
}

export interface AssistantReply {
  reply: string;
  provider: AiProviderId;
  model: string;
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

export async function fetchAiProviders(): Promise<AiProviderStatus[]> {
  const res = await fetch('/api/ai/providers');
  if (!res.ok) {
    throw new Error('Could not load AI connections');
  }
  const data = await res.json();
  return Array.isArray(data?.providers) ? data.providers : [];
}

export async function sendAssistantMessage(
  message: string,
  history: AssistantHistoryItem[] = [],
  provider: AiProviderId = 'openai',
): Promise<AssistantReply> {
  const trimmed = message.trim();
  if (!trimmed) throw new Error('Message is required');
  if (trimmed.length > 2000) throw new Error('Message too long (max 2000 characters)');

  const headers = await authHeader();
  if (!headers.Authorization) {
    throw new Error('Not authenticated — please sign in again.');
  }

  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({ message: trimmed, history, provider }),
  });

  if (res.status === 401) {
    throw new Error('Unauthorized — please sign in again.');
  }
  if (res.status === 402) {
    const body = await res.json().catch(() => ({}));
    const error = new Error(body?.error || 'Monthly AI limit reached. Upgrade to Sistrum Pro for more calls.');
    (error as Error & { upgrade?: boolean }).upgrade = true;
    throw error;
  }
  if (res.status === 429) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || 'Rate limited — please try again shortly.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Assistant failed (${res.status})`);
  }

  const data = await res.json();
  return {
    reply: (data?.reply as string) || '',
    provider:
      data?.provider === 'chatgpt' || data?.provider === 'openai' || data?.provider === 'gemini'
        ? data.provider
        : provider,
    model: typeof data?.model === 'string' ? data.model : '',
  };
}
