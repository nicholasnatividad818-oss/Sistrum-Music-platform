import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';

const MAX_BODY_BYTES = 64_000;

type ApiResponse = ServerResponse & {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => ApiResponse;
};

function wrapResponse(res: ServerResponse): ApiResponse {
  const nodeRes = res as ApiResponse;
  nodeRes.status = (code: number) => {
    nodeRes.statusCode = code;
    return nodeRes;
  };
  nodeRes.json = (body: unknown) => {
    if (!nodeRes.headersSent) {
      nodeRes.setHeader('Content-Type', 'application/json');
    }
    nodeRes.end(JSON.stringify(body));
    return nodeRes;
  };
  return nodeRes;
}

function attachQuery(req: IncomingMessage) {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });
  (req as IncomingMessage & { query: Record<string, string> }).query = query;
}

async function readJsonBody(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      wrapResponse(res).status(413).json({ error: 'Request too large' });
      return false;
    }
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) {
    (req as IncomingMessage & { body: unknown }).body = {};
    return true;
  }
  try {
    const withBody = req as IncomingMessage & { body: unknown; rawBody?: string };
    withBody.rawBody = raw;
    withBody.body = JSON.parse(raw);
    return true;
  } catch {
    wrapResponse(res).status(400).json({ error: 'Invalid JSON' });
    return false;
  }
}

/** Serves files in /api as local Vercel-style handlers during `vite` dev. */
export function sistrumApiPlugin(root: string): Plugin {
  return {
    name: 'sistrum-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url || '').split('?')[0];
        if (!pathname.startsWith('/api/')) return next();

        const file = path.join(root, `${pathname}.ts`);
        if (!fs.existsSync(file)) return next();

        try {
          attachQuery(req);
          if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            const ok = await readJsonBody(req, res);
            if (!ok) return;
          }
          const mod = await server.ssrLoadModule(file);
          const handler = mod.default;
          if (typeof handler !== 'function') return next();
          await handler(req, wrapResponse(res));
        } catch (err) {
          next(err);
        }
      });
    },
  };
}
