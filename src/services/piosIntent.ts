import { PIOSConsentPolicy, PIOSIntent, PIOSIntentScope, PIOSIntentSource } from '../types';

const INTENT_STORAGE_KEY = 'sistrum_pios_intents';
const POLICY_STORAGE_KEY = 'sistrum_pios_policy';

const DEFAULT_POLICY: PIOSConsentPolicy = {
  allowDirectIntents: true,
  allowCircleIntents: false,
  requireExplicitSend: true,
  retainRawInput: false
};

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function getPIOSPolicy(): PIOSConsentPolicy {
  return safeParse(localStorage.getItem(POLICY_STORAGE_KEY), DEFAULT_POLICY);
}

export function savePIOSPolicy(policy: PIOSConsentPolicy) {
  localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(policy));
}

export function listPIOSIntents(): PIOSIntent[] {
  return safeParse<PIOSIntent[]>(localStorage.getItem(INTENT_STORAGE_KEY), []);
}

function persistIntent(intent: PIOSIntent): PIOSIntent {
  const current = listPIOSIntents();
  const next = [intent, ...current.filter((item) => item.id !== intent.id)].slice(0, 100);
  localStorage.setItem(INTENT_STORAGE_KEY, JSON.stringify(next));
  return intent;
}

export function createPIOSIntent(input: {
  senderId: string;
  recipientId?: string;
  scope: PIOSIntentScope;
  source?: PIOSIntentSource;
  rawInput: string;
  semanticPayload?: string;
  confidence?: number;
}): PIOSIntent {
  const policy = getPIOSPolicy();
  const clean = input.rawInput.trim();

  const blocked =
    !clean ||
    (input.scope === 'direct' && !policy.allowDirectIntents) ||
    (input.scope === 'circle' && !policy.allowCircleIntents);

  return persistIntent({
    id: `intent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    senderId: input.senderId,
    recipientId: input.recipientId,
    scope: input.scope,
    source: input.source ?? 'text',
    rawInput: policy.retainRawInput ? clean : undefined,
    semanticPayload: (input.semanticPayload ?? clean).trim(),
    confidence: Math.max(0, Math.min(1, input.confidence ?? 1)),
    status: blocked ? 'blocked' : 'ready',
    requiresExplicitSend: policy.requireExplicitSend,
    createdAt: new Date().toISOString()
  });
}

export async function sendPIOSIntent(intent: PIOSIntent): Promise<PIOSIntent> {
  if (intent.status === 'blocked') {
    throw new Error('This intent is blocked by the current consent policy.');
  }

  if (!intent.semanticPayload.trim()) {
    throw new Error('Cannot send an empty intent.');
  }

  // Transport adapter placeholder. Today this stays local; later this can be
  // replaced by Supabase Realtime/WebSocket or a device-to-device encrypted channel.
  await Promise.resolve();

  return persistIntent({
    ...intent,
    status: 'sent',
    sentAt: new Date().toISOString()
  });
}

export function clearPIOSIntents() {
  localStorage.removeItem(INTENT_STORAGE_KEY);
}
