import { AiConfigError, completeChat } from '../../server/ai/complete';
import { AiProviderId, isAiProviderId, providerInfo } from '../../server/ai/keys';
import { tooManyRequests } from '../../server/ai/rateLimit';
import { isAuthFailure, requireUser } from '../../server/auth/requireUser';

const MAX_MESSAGE_LENGTH = 2000;
const MAX_OUTPUT_TOKENS = 500;

const SYSTEM_INSTRUCTIONS = `You are Sistrum AI, a music and catalog assistant for Sistrum — a dark-themed music platform with NRN Catalog integration.

You help users with:
- song metadata (title, artist, ISRC, BPM, key, genre, cover)
- release planning and checklists
- track descriptions and bios
- tags and genre suggestions
- catalog organization and health
- songwriting and lyric ideas
- production and mixing suggestions (EQ, arrangement, sonic character)

Rules:
- Be concise, helpful, and encouraging. Use the Sistrum dark/orange vibe subtly.
- You do NOT have tools to directly modify the catalog, releases, or Sistrum tracks unless the user explicitly triggers an app action. Do not claim you modified data.
- Never expose API keys, secrets, ownership splits, publishing splits, master percentages, or emails beyond what the user provided.
- If asked about Sistrum ↔ NRN Catalog bridge, explain it links a Sistrum track to an external NRN Catalog track via catalogTrackId/isrc/catalogSyncedAt and is safe/disconnectable via Unlink.
- If unsure, say so and suggest next steps.`;

function safeLog(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const redacted = message
    .replace(/sk-[a-zA-Z0-9_-]+/g, '[redacted]')
    .replace(/AIza[0-9A-Za-z_-]+/g, '[redacted]')
    .slice(0, 300);
  console.error('api/ai/chat error', redacted);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireUser(req);
  if (isAuthFailure(auth)) {
    return res.status(auth.status).json({ error: auth.error });
  }
  if (tooManyRequests(auth.auth.user.id)) {
    return res.status(429).json({ error: 'Too many AI requests. Wait a minute and try again.' });
  }

  try {

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const message: string | undefined = body?.message;
    const history: Array<{ role: 'user' | 'assistant'; content: string }> | undefined = body?.history;
    const requestedProvider: unknown = body?.provider;
    const provider: AiProviderId = isAiProviderId(requestedProvider) ? requestedProvider : 'openai';

    if (requestedProvider !== undefined && !isAiProviderId(requestedProvider)) {
      return res.status(400).json({ error: 'Unknown provider. Use chatgpt, openai, or gemini.' });
    }
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)` });
    }
    if (history && !Array.isArray(history)) {
      return res.status(400).json({ error: 'Invalid history' });
    }

    const safeHistory = Array.isArray(history)
      ? history.slice(-10).map((turn) => ({
          role: turn.role === 'assistant' ? 'assistant' as const : 'user' as const,
          content: String(turn.content).slice(0, MAX_MESSAGE_LENGTH),
        }))
      : [];

    const quota = await auth.auth.client.rpc('consume_ai_call');
    if (quota.error) {
      const missing = quota.error.code === 'PGRST202' || /consume_ai_call/i.test(quota.error.message || '');
      return res.status(missing ? 503 : 500).json({
        error: missing
          ? 'Run supabase/003_usage_and_billing.sql before using the assistant.'
          : 'Could not check AI quota',
      });
    }
    if (!quota.data?.allowed) {
      return res.status(402).json({
        error: 'Monthly AI limit reached. Upgrade to Sistrum Pro for more calls.',
        plan: quota.data?.plan,
        used: quota.data?.used,
        cap: quota.data?.cap,
      });
    }

    let result: { reply: string; provider: AiProviderId; model?: string };
    try {
      result = await completeChat({
        provider,
        instructions: SYSTEM_INSTRUCTIONS,
        history: safeHistory,
        message: message.trim(),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      });
    } catch (err) {
      await auth.auth.client.rpc('release_ai_call');
      throw err;
    }

    return res.status(200).json({
      reply: result.reply,
      provider: result.provider,
      model: result.model || providerInfo(provider).model,
    });
  } catch (err: any) {
    if (err instanceof AiConfigError) {
      return res.status(500).json({ error: err.message });
    }
    if (err instanceof SyntaxError) {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
    const status = err?.status || err?.statusCode;
    if (status === 429) {
      return res.status(429).json({ error: 'AI rate limited — please try again in a moment.' });
    }
    if (status === 401 || status === 403) {
      return res.status(500).json({ error: 'AI authentication failed' });
    }
    safeLog(err);
    return res.status(500).json({ error: 'AI request failed' });
  }
}
