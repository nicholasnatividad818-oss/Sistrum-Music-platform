import { useEffect, useState } from 'react';
import { labelgrid, releases, validateRelease, submitRelease, uploadTrackFile } from '../lib/labelgrid/client';
import operations from '../lib/labelgrid/operations.json';

type Release = { id: number; titles?: { text?: string }[]; cat?: string; [key: string]: unknown };
const button = 'rounded-xl border border-neutral-700 px-4 py-2 text-sm hover:border-orange-500 disabled:opacity-40';
const field = 'w-full rounded-xl bg-neutral-950 border border-neutral-700 p-3 text-sm';
export function DistributionView() {
  const [rows, setRows] = useState<Release[]>([]);
  const [checks, setChecks] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [output, setOutput] = useState<unknown>(null);
  const [operation, setOperation] = useState(0);
  const [path, setPath] = useState(operations[0].path);
  const [payload, setPayload] = useState('{}');
  const [query, setQuery] = useState('{}');
  const [pending, setPending] = useState<Release | null>(null);
  const [trackId, setTrackId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { setOutput(await fn()); } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); }
    finally { setBusy(false); }
  };
  const refresh = async () => {
    const r = await releases();
    const items = r.data?.data || r.data;
    if (!Array.isArray(items)) throw new Error('Unexpected releases response.');
    setRows(items); setChecks({}); return r;
  };
  useEffect(() => { void run(refresh); }, []);
  const validate = async (row: Release) => {
    const result = await validateRelease(String(row.id));
    setChecks(old => ({ ...old, [row.id]: result.data })); return result;
  };
  const op = operations[operation];
  return <section className="max-w-6xl mx-auto px-4 py-10 text-white space-y-8">
    <div><p className="text-orange-400 text-sm font-bold">SISTRUM / LABELGRID</p><h1 className="text-3xl font-black mt-2">Distribution workspace</h1><p className="text-neutral-400 mt-3">Manage releases, credits, delivery, analytics and statements through your connected label account.</p></div>
    <div className="flex flex-wrap gap-3">
      <button className={button} disabled={busy} onClick={() => void run(refresh)}>Refresh releases</button>
      <button className={button} disabled={busy || !rows.length} onClick={() => void run(async () => { for (const row of rows) await validate(row); return { message: 'Validation completed for this page.' }; })}>Validate this page</button>
      <button className={button} disabled={busy} onClick={() => void run(() => labelgrid({ method: 'GET', path: '/queues/distro' }))}>Delivery queue</button>
      <button className={button} disabled={busy} onClick={() => void run(() => labelgrid({ action: 'events' }))}>Recent notifications</button>
    </div>
    {error && <p role="alert" className="bg-red-950/40 border border-red-800 rounded-xl p-4">{error}</p>}
    {busy && <p role="status" className="text-orange-300">Working…</p>}
    <div className="overflow-x-auto rounded-2xl border border-neutral-800"><table className="w-full text-sm"><thead className="bg-neutral-900"><tr><th className="p-4 text-left">Release</th><th className="p-4 text-left">Validation</th><th className="p-4 text-left">Actions</th></tr></thead><tbody>
      {!rows.length && <tr><td colSpan={3} className="p-6 text-neutral-400">No releases loaded. Connect your account or create a release below.</td></tr>}
      {rows.map(row => <tr key={row.id} className="border-t border-neutral-800"><td className="p-4"><strong>{row.titles?.[0]?.text || row.cat || `Release ${row.id}`}</strong><p className="text-neutral-500">#{row.id}</p></td><td className="p-4">{checks[row.id]?.result === 'OK' ? 'Ready for review' : checks[row.id]?.result === 'ERROR' ? 'Needs attention' : 'Not validated'}{checks[row.id]?.errors?.map((x: string, i: number) => <p key={i} className="text-red-300 mt-1">{x}</p>)}{checks[row.id]?.warnings?.map((x: string, i: number) => <p key={i} className="text-amber-300 mt-1">{x}</p>)}</td><td className="p-4"><div className="flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={() => void run(() => validate(row))}>Validate</button><button className={button} disabled={busy} onClick={() => void run(() => labelgrid({ method: 'GET', path: `/releases/${row.id}/delivery-status` }))}>Status</button><button className={button} disabled={busy || checks[row.id]?.result !== 'OK'} onClick={() => setPending(row)}>Submit</button></div></td></tr>)}
    </tbody></table></div>
    {pending && <div role="dialog" aria-modal="true" aria-labelledby="submit-title" className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"><div className="rounded-2xl bg-neutral-900 border border-neutral-700 p-6 max-w-lg space-y-4"><h2 id="submit-title" className="text-xl font-bold">Submit {pending.titles?.[0]?.text || pending.cat}?</h2><p>This opens a distribution review using this release’s configured DSPs. Verify rights, AI disclosures, credits, ISRCs, dates and territories before submitting.</p><div className="flex gap-3"><button autoFocus className={button} onClick={() => setPending(null)}>Cancel</button><button className={button} disabled={busy} onClick={() => { const id = String(pending.id); setPending(null); void run(async () => { const result = await submitRelease(id); setChecks(old => ({ ...old, [id]: undefined })); return result; }); }}>Confirm submission</button></div></div></div>}
    <div className="border border-neutral-800 rounded-2xl p-6 space-y-4"><h2 className="text-xl font-bold">Catalog and reporting tools</h2><p className="text-neutral-400 text-sm">Choose an operation. Replace path placeholders with IDs; use the API reference for required metadata. For pagination, add the documented query parameters. This editor is for authorized label operators.</p>
      <label className="block">Operation<select className={field} value={operation} onChange={e => { const i = Number(e.target.value); setOperation(i); setPath(operations[i].path); }}>{operations.map((o, i) => <option value={i} key={i}>{o.group} · {o.method} · {o.title}</option>)}</select></label>
      <label className="block">Endpoint path<input className={field} value={path} onChange={e => setPath(e.target.value)} /></label>
      <label className="block">Query parameters (JSON)<textarea className={field} value={query} onChange={e => setQuery(e.target.value)} /></label>
      {op.method !== 'GET' && <label className="block">Metadata (JSON)<textarea className={field + ' font-mono min-h-48'} value={payload} onChange={e => setPayload(e.target.value)} /></label>}
      <a href="https://api.labelgrid.com/docs/api" target="_blank" rel="noreferrer" className="text-orange-400 underline">LabelGrid API reference</a>
      <button className={button + ' block'} disabled={busy || /\/distribute$/.test(path)} onClick={() => void run(() => labelgrid({ method: op.method, path, query: JSON.parse(query), ...(op.method === 'GET' ? {} : { body: JSON.parse(payload) }) }))}>Run operation</button>
    </div>
    <div className="border border-neutral-800 rounded-2xl p-6 space-y-4"><h2 className="text-xl font-bold">Upload stereo master</h2><p className="text-sm text-neutral-400">WAV or 16-bit FLAC. Upload acceptance starts processing; check the returned upload attempt before distribution.</p><label className="block">LabelGrid track ID<input className={field} value={trackId} onChange={e => setTrackId(e.target.value)} /></label><label className="block">Audio file<input type="file" accept=".wav,.flac" className="block mt-2" onChange={e => setFile(e.target.files?.[0] || null)} /></label><button className={button} disabled={busy || !file || !/^\d+$/.test(trackId)} onClick={() => void run(() => uploadTrackFile(trackId, file!))}>Upload master</button></div>
    {output !== null && <div><h2 className="font-bold mb-3">Latest response</h2><pre className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl overflow-auto max-h-96 text-xs" aria-live="polite">{JSON.stringify(output, null, 2)}</pre></div>}
  </section>;
}
