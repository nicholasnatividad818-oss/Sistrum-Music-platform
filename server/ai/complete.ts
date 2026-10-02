import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { AiProviderId, providerInfo, readApiKey } from './keys';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export class AiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiConfigError';
  }
}

function requireKey(provider: AiProviderId): string {
  const info = providerInfo(provider);
  const key = readApiKey(info.env);
  if (!key) {
    throw new AiConfigError(`${info.label} is not connected. Set ${info.env} on the server.`);
  }
  return key;
}

function textFromResponses(response: { output_text?: string; output?: unknown }): string {
  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }
  let text = '';
  if (Array.isArray(response.output)) {
    for (const item of response.output) {
      if (!item || typeof item !== 'object') continue;
      const record = item as { type?: string; content?: unknown };
      if (record.type !== 'message' || !Array.isArray(record.content)) continue;
      for (const part of record.content) {
        if (!part || typeof part !== 'object') continue;
        const piece = part as { type?: string; text?: string };
        if (piece.type === 'output_text' && piece.text) text += piece.text;
      }
    }
  }
  return text.trim();
}

async function completeWithChatGpt(args: {
  apiKey: string;
  instructions: string;
  history: ChatTurn[];
  message: string;
  maxOutputTokens: number;
}): Promise<string> {
  const client = new OpenAI({ apiKey: args.apiKey });
  const completion = await client.chat.completions.create({
    model: providerInfo('chatgpt').model,
    messages: [
      { role: 'system', content: args.instructions },
      ...args.history.map((turn) => ({ role: turn.role, content: turn.content })),
      { role: 'user', content: args.message },
    ],
    max_completion_tokens: args.maxOutputTokens,
  });
  const content = completion.choices[0]?.message?.content;
  return typeof content === 'string' ? content.trim() : '';
}

async function completeWithOpenAi(args: {
  apiKey: string;
  instructions: string;
  history: ChatTurn[];
  message: string;
  maxOutputTokens: number;
}): Promise<string> {
  const client = new OpenAI({ apiKey: args.apiKey });
  // Luna reasons by default. "none" keeps the output budget for the answer.
  const response = await client.responses.create({
    model: providerInfo('openai').model,
    instructions: args.instructions,
    input: [
      ...args.history.map((turn) => ({ role: turn.role, content: turn.content })),
      { role: 'user' as const, content: args.message },
    ],
    max_output_tokens: args.maxOutputTokens,
    reasoning: { effort: 'none' },
  });
  return textFromResponses(response);
}

async function completeWithGemini(args: {
  apiKey: string;
  instructions: string;
  history: ChatTurn[];
  message: string;
  maxOutputTokens: number;
}): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: args.apiKey });
  const transcript = [
    ...args.history.map((turn) => `${turn.role === 'assistant' ? 'Assistant' : 'User'}: ${turn.content}`),
    `User: ${args.message}`,
  ].join('\n\n');

  const interaction = await ai.interactions.create({
    model: providerInfo('gemini').model,
    system_instruction: args.instructions,
    store: false,
    generation_config: { max_output_tokens: args.maxOutputTokens },
    input: transcript,
  });

  return interaction.output_text?.trim() || '';
}

export async function completeChat(args: {
  provider: AiProviderId;
  instructions: string;
  history: ChatTurn[];
  message: string;
  maxOutputTokens: number;
}): Promise<{ reply: string; provider: AiProviderId; model: string }> {
  const info = providerInfo(args.provider);
  const apiKey = requireKey(args.provider);
  const call = {
    apiKey,
    instructions: args.instructions,
    history: args.history,
    message: args.message,
    maxOutputTokens: args.maxOutputTokens,
  };

  let reply = '';
  if (args.provider === 'chatgpt') reply = await completeWithChatGpt(call);
  else if (args.provider === 'openai') reply = await completeWithOpenAi(call);
  else reply = await completeWithGemini(call);

  return {
    reply: reply || 'Sorry, I could not generate a response.',
    provider: info.id,
    model: info.model,
  };
}
