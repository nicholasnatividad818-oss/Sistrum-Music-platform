import { ArtistRewardsPanel } from './ArtistRewardsPanel';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Track } from '../types';
import type { CampaignKind, SignalCampaign, SignalJob } from '../services/signal.types';
import { applySignal, createSignalCampaign, loadSignal, updateSignalJob } from '../services/signal';

const dollars = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const inputStyle = 'w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white';
const buttonStyle = 'rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40';

export function SignalView({ user, tracks, onSignIn }: { user: User | null; tracks: Track[]; onSignIn: () => void }) {
 const [campaigns, setCampaigns] = useState<SignalCampaign[]>([]);
 const [jobs, setJobs] = useState<SignalJob[]>([]);
 const [loading, setLoading] = useState(false);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 const [notice, setNotice] = useState('');
 const [view, setView] = useState<'opportunities' | 'artist' | 'earnings'>('opportunities');
 const [showCreate, setShowCreate] = useState(false);
 const [selected, setSelected] = useState<string | null>(null);
 const [pitch, setPitch] = useState('');
 const [proofUrl, setProofUrl] = useState('');
 const [notes, setNotes] = useState('');
 const [review, setReview] = useState('');
 const [form, setForm] = useState({trackId: '', title: '', brief: '', kind: 'content' as CampaignKind, budget: '100', fee: '25', deadline: ''});
 const owned = tracks.filter(t => t.artistId === user?.id);
 const refresh = async () => { const result = await loadSignal(); setCampaigns(result.campaigns); setJobs(result.jobs); };
 useEffect(() => {
  if (!user) return;
  let active = true;
  setLoading(true);
  loadSignal().then(result => { if(active) {setCampaigns(result.campaigns); setJobs(result.jobs);} }).catch(e => {if(active) setError(e.message || 'Signal is unavailable.');}).finally(() => {if(active) setLoading(false);});
  return () => { active = false; };
 }, [user?.id]);
 const perform = async (action: () => Promise<void>, message: string) => {
  setBusy(true); setError(''); setNotice('');
  try { await action(); await refresh(); setNotice(message); setSelected(null); }
  catch(e) {setError(e instanceof Error ? e.message : String((e as {message?: string})?.message || 'Unable to complete this action.'));}
  finally {setBusy(false);}
 };
 const myJobs = jobs.filter(j => j.promoter_id === user?.id);
 const approved = myJobs.filter(j => j.status === 'approved').reduce((n,j) => n+j.fee_cents, 0);
 const pending = myJobs.filter(j => ['selected','submitted','revision'].includes(j.status)).reduce((n,j) => n+j.fee_cents, 0);
 const shown = campaigns.filter(c => view === 'artist' ? c.artist_id === user?.id : view === 'earnings' ? myJobs.some(j => j.campaign_id === c.id) : c.artist_id !== user?.id && Date.parse(c.deadline) > Date.now());
 return <section className="mb-12 space-y-6">
  <div className="rounded-3xl border border-violet-500/30 bg-gradient-to-br from-violet-950 to-neutral-900 p-6 sm:p-10">
   <p className="text-xs font-bold uppercase tracking-[.25em] text-violet-300">Sistrum Signal</p>
   <h1 className="mt-3 text-3xl font-black sm:text-4xl">Great music. Real advocates.</h1>
   <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-300">Artists commission shares, original content, and promotional campaigns. Apply with your plan, agree to the brief, and earn a fixed fee for work the artist approves.</p>
   <p className="mt-4 text-xs text-amber-200">Pilot · budgets are artist commitments, not deposited funds. Payout processing is not connected. Approved fees are amounts owed, not withdrawable cash.</p>
   {!user && <button className={`${buttonStyle} mt-5`} onClick={onSignIn}>Sign in to explore opportunities</button>}
  </div>
  <ArtistRewardsPanel />
  {user && <>
   <div className="grid gap-3 sm:grid-cols-3">{[['Approved fees owed',dollars(approved)],['Work in progress',dollars(pending)],['Your assignments',String(myJobs.length)]].map(([label,value]) => <div key={label} className="rounded-2xl border border-neutral-800 p-5"><p className="text-xs text-neutral-400">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>)}</div>
   <div className="flex flex-wrap items-center gap-2">{(['opportunities','artist','earnings'] as const).map(v => <button key={v} className={`rounded-xl px-4 py-2 text-sm capitalize ${view === v ? 'bg-violet-600 text-white' : 'bg-neutral-900 text-neutral-300'}`} onClick={() => {setView(v);setSelected(null);}}>{v === 'artist' ? 'My campaigns' : v === 'earnings' ? 'My work & earnings' : 'Opportunities'}</button>)}<button className={`${buttonStyle} ml-auto`} onClick={() => setShowCreate(!showCreate)}>Create campaign</button></div>
   {error && <div role="alert" className="rounded-xl border border-rose-800 p-4 text-sm text-rose-200">{error}<button disabled={busy} className="ml-3 underline" onClick={() => perform(refresh, 'Refreshed.')}>Retry loading</button></div>}
   {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
   {showCreate && <form className="space-y-4 rounded-2xl border border-neutral-700 bg-neutral-900 p-6" onSubmit={e => { e.preventDefault(); void perform(async () => { await createSignalCampaign({...form,artistId:user.id});setShowCreate(false);setView('artist');},'Campaign created. Its terms are fixed for applicants.'); }}>
    <h2 className="text-xl font-bold">Commission a campaign</h2>
    <label className="block text-sm">Your track<select required className={`${inputStyle} mt-1`} value={form.trackId} onChange={e => setForm({...form,trackId:e.target.value})}><option value="">Choose your track</option>{owned.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
    {!owned.length && <p className="text-sm text-amber-200">Upload a track you own before creating a campaign.</p>}
    <label className="block text-sm">Campaign title<input required minLength={3} maxLength={120} className={`${inputStyle} mt-1`} value={form.title} onChange={e => setForm({...form,title:e.target.value})}/></label>
    <label className="block text-sm">Deliverables, channels, rights granted, disclosure and acceptance criteria<textarea required minLength={20} maxLength={5000} className={`${inputStyle} mt-1`} rows={4} placeholder="Example: one original 15-second Reel using the supplied song excerpt. Include #ad. Submit a public link. Artist may repost with credit for 30 days." value={form.brief} onChange={e => setForm({...form,brief:e.target.value})}/></label>
    <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Work type<select className={`${inputStyle} mt-1`} value={form.kind} onChange={e => setForm({...form,kind:e.target.value as CampaignKind})}><option value="share">Disclosed promotional share</option><option value="content">Original fan / creator content</option><option value="campaign">Campaign management</option></select></label><label className="text-sm">Application deadline<input type="datetime-local" required className={`${inputStyle} mt-1`} value={form.deadline} onChange={e => setForm({...form,deadline:e.target.value})}/></label><label className="text-sm">Total budget (USD)<input required inputMode="decimal" className={`${inputStyle} mt-1`} value={form.budget} onChange={e => setForm({...form,budget:e.target.value})}/></label><label className="text-sm">Fee per selected person (USD)<input required inputMode="decimal" className={`${inputStyle} mt-1`} value={form.fee} onChange={e => setForm({...form,fee:e.target.value})}/></label></div>
    <label className="flex gap-2 text-sm text-neutral-300"><input required type="checkbox"/>I can authorize use of this music and will pay approved work under this brief. Paid promotion must be disclosed. No guaranteed streams, paid playlist placement, or unsolicited bulk messaging.</label>
    <button disabled={busy || !owned.length} className={buttonStyle}>{busy ? 'Saving…' : 'Create opportunity'}</button>
   </form>}
   {loading ? <p role="status">Loading opportunities…</p> : !shown.length ? <div className="rounded-2xl border border-neutral-800 p-10 text-center text-neutral-400">{view === 'earnings' ? 'Your applications and earnings will appear here.' : 'No campaigns here yet.'}</div> : <div className="space-y-4">{shown.map(c => {
    const isArtist = c.artist_id === user.id;
    const assignments = jobs.filter(j => j.campaign_id === c.id && (isArtist || j.promoter_id === user.id));
    const committed = assignments.filter(j => ['selected','submitted','revision','approved'].includes(j.status)).reduce((n,j) => n+j.fee_cents,0);
    return <article key={c.id} className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
     <div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-violet-300">{c.kind} · {tracks.find(t => t.id === c.track_id)?.title || 'Artist track'}</p><h2 className="mt-2 text-xl font-bold">{c.title}</h2></div><div className="text-right"><p className="text-xl font-black">{dollars(c.fee_cents)}</p><p className="text-xs text-neutral-400">per approved assignment</p></div></div>
     <p className="my-4 whitespace-pre-wrap text-sm leading-6 text-neutral-300">{c.brief}</p>
     <p className="text-xs text-neutral-400">Budget {dollars(c.budget_cents)} · Apply by {new Date(c.deadline).toLocaleString()}{isArtist && ` · Committed ${dollars(committed)}`}</p>
     {!isArtist && !assignments.length && <div className="mt-4">{selected === c.id ? <form className="space-y-3" onSubmit={e => {e.preventDefault(); void perform(() => applySignal(c.id,user.id,pitch),'Application sent. The artist will choose participants.');}}><label className="block text-sm">Your plan<textarea required minLength={10} maxLength={2000} className={`${inputStyle} mt-1`} value={pitch} onChange={e => setPitch(e.target.value)}/></label><label className="flex gap-2 text-xs"><input required type="checkbox"/>I agree to the brief and fee, and will disclose paid promotion.</label><button disabled={busy} className={buttonStyle}>Submit application</button></form> : <button className={buttonStyle} onClick={() => {setSelected(c.id);setPitch('');}}>Apply for {dollars(c.fee_cents)}</button>}</div>}
     <div className="mt-4 space-y-3">{assignments.map(j => <div key={j.id} className="rounded-xl border border-neutral-700 p-4">
      <p className="text-sm font-bold capitalize">{j.status} · {dollars(j.fee_cents)}{isArtist ? ` · Applicant ${j.promoter_id.slice(0,8)}` : ''}</p><p className="mt-2 whitespace-pre-wrap text-sm text-neutral-400">{j.pitch}</p>
      {j.proof_url && <a className="mt-2 block text-sm text-violet-300 underline" href={j.proof_url} target="_blank" rel="noopener noreferrer">Review published work</a>}
      {j.proof_notes && <p className="mt-2 whitespace-pre-wrap text-sm">{j.proof_notes}</p>}
      {j.review_notes && <p className="mt-2 text-sm text-amber-200">Artist feedback: {j.review_notes}</p>}
      {j.status === 'approved' && <p className="mt-2 text-xs text-emerald-300">Approved {new Date(j.approved_at!).toLocaleDateString()} · Payment owed; transfer is not processed by this pilot.</p>}
      {isArtist && j.status === 'applied' && <div className="mt-3 flex gap-2"><button disabled={busy} className={buttonStyle} onClick={() => perform(() => updateSignalJob(j.id,'selected'),'Applicant selected. Fee committed within your budget.')}>Select</button><button disabled={busy} className="px-4 text-sm" onClick={() => perform(() => updateSignalJob(j.id,'declined'),'Application declined.')}>Decline</button></div>}
      {isArtist && j.status === 'submitted' && <div className="mt-3 space-y-3"><label className="block text-sm">Review / revision notes<textarea maxLength={3000} className={`${inputStyle} mt-1`} value={selected === j.id ? review : ''} onChange={e => {setSelected(j.id);setReview(e.target.value);}}/></label><div className="flex gap-2"><button disabled={busy} className={buttonStyle} onClick={() => perform(() => updateSignalJob(j.id,'approved',{review_notes:selected === j.id ? review : ''}),'Work approved. The agreed fee is now owed.')}>Approve work · {dollars(j.fee_cents)}</button><button disabled={busy || selected !== j.id || review.trim().length < 5} className="px-4 text-sm" onClick={() => perform(() => updateSignalJob(j.id,'revision',{review_notes:review}),'Revision requested.')}>Request revision</button></div></div>}
      {!isArtist && ['selected','revision'].includes(j.status) && <div className="mt-3">{selected === j.id ? <form className="space-y-3" onSubmit={e => {e.preventDefault();void perform(() => updateSignalJob(j.id,'submitted',{proof_url:proofUrl,proof_notes:notes}),'Proof submitted for artist review.');}}><label className="block text-sm">Published work link<input required type="url" maxLength={2000} className={`${inputStyle} mt-1`} value={proofUrl} onChange={e => setProofUrl(e.target.value)}/></label><label className="block text-sm">Delivery notes<textarea maxLength={3000} className={`${inputStyle} mt-1`} value={notes} onChange={e => setNotes(e.target.value)}/></label><button disabled={busy} className={buttonStyle}>Submit proof</button></form> : <button className={buttonStyle} onClick={() => {setSelected(j.id);setProofUrl(j.proof_url || '');setNotes(j.proof_notes);}}>Submit your work</button>}</div>}
     </div>)}</div>
    </article>;
   })}</div>}
   <p className="text-xs leading-5 text-neutral-500">Fixed fees reward agreed promotional deliverables. Listening counts do not generate earnings. Campaigns and assignments are loaded in batches of up to 100 and 1,000; totals cover loaded records.</p>
  </>}
 </section>;
}
