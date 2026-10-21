import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MODEL = 'grok-build-0.1';
const ENDPOINT = 'https://api.x.ai/v1/responses';
const PROMPT_LIMIT = 24_000;
const MAX_OUTPUT_TOKENS = 800;
const REQUEST_TIMEOUT_MS = 120_000;

const CRITICAL_FILES = [
  'cloudbuild.yaml',
  'Dockerfile',
  'nginx.conf',
  'vercel.json',
  'public/sw.js',
];

const SYSTEM = `You are a release reviewer for Sistrum, a Vite app served by Nginx on Cloud Run port 8080.
Return only the schema fields. Set decision to "hold" only for a high-severity issue:
- a secret, private key, or bearer token committed or passed into a VITE_ build argument
- /healthz removed, or the listen or deploy port moved off 8080
- a new --allow-unauthenticated or public Cloud Run invoker grant
- an auth, RLS, or service-worker change that exposes private API responses
Style, copy, and behavior already covered by tests are "pass". Mention those as low or medium risks if useful. Do not hold for them.`;

const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['decision', 'summary', 'risks'],
  properties: {
    decision: { type: 'string', enum: ['pass', 'hold'] },
    summary: { type: 'string' },
    risks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'path', 'reason'],
        properties: {
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
          path: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
  },
};

export function redact(text) {
  return String(text)
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[redacted]')
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[redacted]')
    .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, '[redacted]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]');
}

export function truncate(text, limit = PROMPT_LIMIT) {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n\n[truncated]`;
}

export function exitCodeForReview(review) {
  if (review?.decision === 'pass') return 0;
  return 2;
}

export function parseReview(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || (parsed.decision !== 'pass' && parsed.decision !== 'hold')) return null;
  const risks = Array.isArray(parsed.risks) ? parsed.risks : [];
  return {
    decision: parsed.decision,
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    risks: risks.filter((risk) => risk && typeof risk === 'object').map((risk) => ({
      severity: typeof risk.severity === 'string' ? risk.severity : 'low',
      path: typeof risk.path === 'string' ? risk.path : '',
      reason: typeof risk.reason === 'string' ? risk.reason : '',
    })),
  };
}

export function formatReport(review) {
  const lines = [`AI release review: ${review.decision}`];
  if (review.summary) lines.push(review.summary);
  for (const risk of review.risks) {
    lines.push(`- [${risk.severity}] ${risk.path}: ${risk.reason}`);
  }
  return lines.join('\n');
}

function git(args) {
  const env = { ...process.env };
  delete env.XAI_API_KEY;
  try {
    return execFileSync('git', args, { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    return null;
  }
}

function diffAgainst(range) {
  const diff = git(['diff', '--unified=3', range]);
  return diff && diff.trim() ? diff : null;
}

function realSha(value) {
  return typeof value === 'string' && /^[0-9a-f]{7,40}$/i.test(value) && !/^0+$/.test(value);
}

export function collectReviewInput() {
  const base = process.env.GITHUB_BASE_REF;
  if (base) {
    const ranged = diffAgainst(`origin/${base}...HEAD`) || diffAgainst(`${base}...HEAD`);
    if (ranged) return { kind: 'diff', body: ranged };
  }
  if (realSha(process.env.REVIEW_BEFORE)) {
    const pushed = diffAgainst(`${process.env.REVIEW_BEFORE}...HEAD`);
    if (pushed) return { kind: 'diff', body: pushed };
  }
  const previous = diffAgainst('HEAD~1...HEAD') || diffAgainst('HEAD^1');
  if (previous) return { kind: 'diff', body: previous };
  const parts = [];
  for (const file of CRITICAL_FILES) {
    if (!existsSync(file)) continue;
    parts.push(`===== ${file} =====\n${readFileSync(file, 'utf8')}`);
  }
  return { kind: 'files', body: parts.join('\n\n') };
}

export function textFromResponse(payload) {
  if (payload && typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  if (!payload || !Array.isArray(payload.output)) return '';
  let text = '';
  for (const item of payload.output) {
    if (!item || item.type !== 'message' || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (part && part.type === 'output_text' && typeof part.text === 'string') text += part.text;
    }
  }
  return text.trim();
}

export function reviewRequest(apiKey, prompt) {
  return {
    url: ENDPOINT,
    init: {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        store: false,
        input: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: prompt.kind === 'diff'
              ? `Review this unified diff for the Sistrum release.\n\n${prompt.body}`
              : `No diff was available. Review these deploy files for the Sistrum release.\n\n${prompt.body}`,
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'deploy_review',
            strict: true,
            schema: REVIEW_SCHEMA,
          },
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  };
}

async function main() {
  const apiKey = (process.env.XAI_API_KEY || '').trim();
  if (!apiKey) {
    console.log('AI release review skipped');
    return 0;
  }

  const collected = collectReviewInput();
  const prompt = {
    kind: collected.kind,
    body: truncate(redact(collected.body)),
  };
  const { url, init } = reviewRequest(apiKey, prompt);
  const response = await fetch(url, init);
  if (!response.ok) {
    const detail = redact(await response.text()).slice(0, 300);
    console.error(`AI release review failed: HTTP ${response.status} ${detail}`);
    return 2;
  }

  const review = parseReview(textFromResponse(await response.json()));
  if (!review) {
    console.error('AI release review failed: unreadable model output');
    return 2;
  }
  console.log(formatReport(review));
  return exitCodeForReview(review);
}

function invokedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

if (invokedDirectly()) {
  main()
    .then((code) => {
      process.exit(code);
    })
    .catch((err) => {
      const message = redact(err instanceof Error ? err.message : String(err)).slice(0, 300);
      console.error(`AI release review failed: ${message}`);
      process.exit(2);
    });
}
