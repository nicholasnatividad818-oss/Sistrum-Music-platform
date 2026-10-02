export const AI_PROVIDER_IDS = ['chatgpt', 'openai', 'gemini'] as const;

export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

export interface AiProviderInfo {
  id: AiProviderId;
  label: string;
  model: string;
  env: 'OPENAI_API_KEY' | 'GEMINI_API_KEY';
}

export const AI_PROVIDERS: readonly AiProviderInfo[] = [
  { id: 'chatgpt', label: 'ChatGPT', model: 'chat-latest', env: 'OPENAI_API_KEY' },
  { id: 'openai', label: 'OpenAI', model: 'gpt-6-luna', env: 'OPENAI_API_KEY' },
  { id: 'gemini', label: 'Gemini', model: 'gemini-3.8-flash', env: 'GEMINI_API_KEY' },
];

const PLACEHOLDER_KEYS = new Set([
  'my_gemini_api_key',
  'my_openai_api_key',
  'my_api_key',
  'your_api_key',
  'your_openai_api_key',
  'your_gemini_api_key',
  'changeme',
]);

export function isAiProviderId(value: unknown): value is AiProviderId {
  return typeof value === 'string' && (AI_PROVIDER_IDS as readonly string[]).includes(value);
}

export function providerInfo(id: AiProviderId): AiProviderInfo {
  const info = AI_PROVIDERS.find((provider) => provider.id === id);
  if (!info) throw new Error(`Unknown AI provider: ${id}`);
  return info;
}

/** A key counts as connected only when it is set and is not an example placeholder. */
export function readApiKey(envName: string): string | null {
  const raw = process.env[envName];
  if (!raw) return null;
  const value = raw.trim().replace(/^["']|["']$/g, '');
  if (!value || PLACEHOLDER_KEYS.has(value.toLowerCase())) return null;
  return value;
}

export interface AiProviderStatus extends AiProviderInfo {
  configured: boolean;
}

export function listProviderStatus(): AiProviderStatus[] {
  return AI_PROVIDERS.map((provider) => ({
    ...provider,
    configured: readApiKey(provider.env) !== null,
  }));
}
