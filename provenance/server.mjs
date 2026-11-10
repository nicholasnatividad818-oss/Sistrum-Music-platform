import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';

const vendor = 'https://studio-api.prod.suno.com/api/c2pa/detect';
const maxBytes = 99_000_000; // Leave room for the upstream multipart envelope.
const formats = new Map([['mp3','audio/mpeg'],['wav','audio/wav'],['flac','audio/flac'],
  ['m4a','audio/mp4'],['aac','audio/aac'],['ogg','audio/ogg'],['opus','audio/opus']]);
const verdicts = new Set(['verified_suno','no_suno_provenance','inconclusive']);
const assets = new Map(Object.entries({'/':['index.html','text/html'], '/app.js':['app.js','text/javascript'], '/style.css':['style.css','text/css']})
  .map(([route,[file,type]]) => [route,[readFileSync(new URL('./public/'+file, import.meta.url)),type]]));

class RequestError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function* boundedBody(stream, limit) {
  let count = 0;
  for await (const chunk of stream.iterator({ destroyOnReturn: false })) {
    count += chunk.length;
    if (count > limit) throw new RequestError(413, 'Request exceeds the size limit.');
    yield chunk;
  }
}

async function urlBody(req) {
  const chunks = [];
  for await (const chunk of boundedBody(req, 4096)) chunks.push(chunk);
  try {
    const { url } = JSON.parse(Buffer.concat(chunks));
    if (typeof url !== 'string') throw new Error();
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash) throw new Error();
    return JSON.stringify({ url: parsed.href });
  } catch {
    throw new RequestError(400, 'Enter a public HTTPS link directly to an audio file.');
  }
}

export function createApp({ detectorFetch = fetch } = {}) {
  let active = 0;
  let tokens = 6;
  let refill = Date.now();
  return createServer({requestTimeout: 120_000}, async (req, res) => {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
    res.setHeader('Cache-Control','no-store');
    const send = (status, payload) => {
      if (!res.destroyed) res.writeHead(status, {'Content-Type':'application/json'}).end(JSON.stringify(payload));
    };
    const asset = assets.get(req.url);
    if (req.method === 'GET' && asset) {
      res.writeHead(200, {'Content-Type':asset[1]+'; charset=utf-8'}).end(asset[0]);
      return;
    }
    if (req.method === 'GET' && req.url === '/healthz') return send(200, {ok:true});
    const isUrl = req.url === '/api/check/url';
    if (req.method !== 'POST' || (!isUrl && req.url !== '/api/check/file')) return send(404,{error:'Route not found.'});
    if (req.headers['sec-fetch-site'] === 'cross-site' || req.headers['x-provenance-request'] !== '1') {
      return send(403,{error:'Request blocked.'});
    }
    const now = Date.now();
    tokens = Math.min(6,tokens + Math.max(0,now-refill)/10_000);
    refill = now;
    if (active >= 2 || tokens < 1) {
      res.setHeader('Retry-After','10');
      return send(429,{error:'Checker is busy. Try again shortly.'});
    }
    active++;
    tokens--;
    const controller = new AbortController();
    const cancel = () => { if (!res.writableEnded) controller.abort(); };
    const deadline = setTimeout(() => { controller.abort(); send(504,{error:'The check timed out.'}); }, 90_000);
    res.on('close',cancel);
    try {
      let options;
      if (isUrl) {
        options = { headers:{'Content-Type':'application/json'}, body:await urlBody(req) };
      } else {
        const ext = req.headers['x-audio-extension'];
        const size = Number(req.headers['content-length']);
        if (!formats.has(ext)) throw new RequestError(415,'Choose a supported audio format.');
        if (!Number.isSafeInteger(size) || size < 1) throw new RequestError(411,'A nonempty file with a known size is required.');
        if (size > maxBytes) throw new RequestError(413,'Choose a file up to 99 MB.');
        const boundary = randomUUID();
        const head = Buffer.from('--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="track.'+ext+'"\r\nContent-Type: '+formats.get(ext)+'\r\n\r\n');
        const tail = Buffer.from('\r\n--'+boundary+'--\r\n');
        const body = Readable.from((async function* () {
          yield head;
          yield* boundedBody(req,size);
          yield tail;
        })());
        options = {duplex:'half',body,headers:{'Content-Type':'multipart/form-data; boundary='+boundary,
          'Content-Length':String(head.length+size+tail.length)}};
      }
      const upstream = await detectorFetch(vendor+(isUrl?'/url':''), {
        ...options, method:'POST', redirect:'error', signal:controller.signal
      });
      if (!upstream.ok) {
        await upstream.body?.cancel();
        if (upstream.status === 429) throw new RequestError(429,'Suno is rate limiting checks. Try again later.');
        if (upstream.status === 413) throw new RequestError(413,'Suno rejected the media size.');
        if ([400,415,422].includes(upstream.status)) throw new RequestError(422,'Suno could not process this media.');
        throw new RequestError(502,'Suno’s detector is temporarily unavailable.');
      }
      const chunks = [];
      let count = 0;
      for await (const chunk of upstream.body) {
        count += chunk.length;
        if (count > 1_000_000) throw new Error('Oversized detector response');
        chunks.push(chunk);
      }
      const {verdict} = JSON.parse(Buffer.concat(chunks));
      if (!verdicts.has(verdict)) throw new Error('Unexpected verdict');
      send(200,{provider:'suno',verdict,checkedAt:new Date().toISOString()});
    } catch (error) {
      if (!res.writableEnded) send(error.status ?? 502,{error:error.status ? error.message : 'Could not complete the check with Suno.'});
    } finally {
      clearTimeout(deadline);
      res.off('close',cancel);
      active--;
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createApp().listen(Number(process.env.PORT || 8080),'0.0.0.0');
}
