import {useEffect,useRef,useState} from 'react';
import type {User} from '@supabase/supabase-js';
import type {CommunityData,MusicCategory,MusicReply} from '../services/community.types';
import {createMusicTopic,hideMusicReply,loadCommunity,loadReplies,moderateMusicTopic,replyToMusicTopic,reportMusicTopic,reviewMusicReport} from '../services/community';
import {Field,WorkForm} from './ProposalsView';
const control='mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white';
const button='rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40';
const categories:MusicCategory[]=['general','production','songwriting','collaboration','music-lessons','voice-lessons','gear','gigs','services'];
const labels:Record<MusicCategory,string>={'general':'General music','production':'Production','songwriting':'Songwriting','collaboration':'Collaboration','music-lessons':'Music lessons','voice-lessons':'Voice lessons','gear':'Gear & instruments','gigs':'Gigs & opportunities','services':'Music services'};
const read=(f:FormData,key:string)=>String(f.get(key)||'');
const blank:CommunityData={topics:[],reports:[],isOperator:false};
export function CommunityView({user,onSignIn}:{user:User|null;onSignIn:()=>void}){
 const [data,setData]=useState<CommunityData>(blank);
 const [tab,setTab]=useState<'discussion'|'classified'|'reports'>('discussion');
 const [category,setCategory]=useState('all');
 const [search,setSearch]=useState('');
 const [showCreate,setShowCreate]=useState(false);
 const [selected,setSelected]=useState<string|null>(null);
 const [replies,setReplies]=useState<MusicReply[]>([]);
 const [loading,setLoading]=useState(Boolean(user));
 const [loadingReplies,setLoadingReplies]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [showClosed,setShowClosed]=useState(false);
 const topicRef=useRef<string|null>(null);
 const replyRequest=useRef(0);
 const topic=data.topics.find(t=>t.id===selected);
 useEffect(()=>{
  if(!user)return;let active=true;
  loadCommunity(user.id).then(result=>{if(active)setData(result);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[user?.id]);
 useEffect(()=>{
  topicRef.current=selected;const version=++replyRequest.current;setReplies([]);
  if(!selected||!user)return;setLoadingReplies(true);
  loadReplies(selected).then(result=>{if(version===replyRequest.current)setReplies(result);}).catch(e=>{if(version===replyRequest.current)setError(e.message);}).finally(()=>{if(version===replyRequest.current)setLoadingReplies(false);});
  return()=>{++replyRequest.current;};
 },[selected,user?.id]);
 async function run(work:()=>Promise<void>,message:string){
  setBusy(true);setError('');setNotice('');
  try{await work();setData(await loadCommunity(user!.id));const current=topicRef.current;if(current){const updated=await loadReplies(current);if(current===topicRef.current)setReplies(updated);}setNotice(message);return true;}
  catch(e){setError(e instanceof Error?e.message:'Unable to save. Please retry.');return false;}
  finally{setBusy(false);}
 }
 const expired=(time:string|null)=>Boolean(time&&Date.parse(time)<=Date.now());
 const topics=data.topics.filter(t=>t.kind===tab && (category==='all'||t.category===category) && `${t.title} ${t.body} ${t.location}`.toLowerCase().includes(search.toLowerCase()) && (showClosed||t.status==='open'&&!expired(t.expires_at)));
 return <section className="mb-12 space-y-6">
  <header className="rounded-3xl border border-violet-500/30 bg-gradient-to-br from-violet-950 to-neutral-900 p-6 sm:p-10"><p className="text-xs font-bold uppercase tracking-[.25em] text-violet-300">Sistrum Music Community</p><h1 className="mt-3 text-3xl font-black sm:text-4xl">Find your people. Make more music.</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-300">Talk production, songwriting, and performance. Find music lessons, voice coaches, collaborators, instruments, gigs, and creative services.</p>{!user&&<button className={`${button} mt-6`} onClick={onSignIn}>Sign in to join the conversation</button>}</header>
  <p className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-xs leading-5 text-neutral-400">Posts and replies are visible to signed-in members. Share only contact details you want members to see. Listings are member offers; Sistrum has not verified instructors, sellers, or availability and does not process transactions here.</p>
  {user&&<>
   <nav aria-label="Music community sections" className="flex flex-wrap gap-2">{(['discussion','classified'] as const).map(t=><button key={t} disabled={busy} onClick={()=>{setTab(t);setSelected(null);setCategory('all');}} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab===t?'bg-violet-600':'bg-neutral-900 text-neutral-300'}`}>{t==='discussion'?'Discussions':'Classifieds'}</button>)}{data.isOperator&&<button disabled={busy} className={`rounded-xl px-4 py-2 text-sm ${tab==='reports'?'bg-violet-600':'bg-neutral-900'}`} onClick={()=>{setTab('reports');setSelected(null);}}>Reports · {data.reports.filter(r=>r.status==='open').length}</button>}<button disabled={busy} className={`${button} ml-auto`} onClick={()=>setShowCreate(!showCreate)}>Post a thread or listing</button></nav>
   {error&&<div role="alert" className="rounded-xl border border-rose-800 p-4 text-sm text-rose-200">{error}<button disabled={busy} className="ml-3 underline" onClick={()=>void run(async()=>{},'Community refreshed.')}>Reload</button></div>}
   {notice&&<p role="status" className="text-sm text-emerald-300">{notice}</p>}
   {showCreate&&<WorkForm busy={busy} label="Publish to the music community" submit={f=>run(async()=>{const kind=read(f,'kind') as 'discussion'|'classified';await createMusicTopic(user.id,{kind,category:read(f,'category') as MusicCategory,title:read(f,'title'),body:read(f,'body'),location:read(f,'location'),price_text:read(f,'price')});setShowCreate(false);setSelected(null);setTab(kind);},'Published. Your post is now visible to members.')}><h2 className="text-xl font-bold">Start a conversation or offer something musical</h2><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Post type<select name="kind" className={control} defaultValue={tab==='classified'?'classified':'discussion'}><option value="discussion">Discussion</option><option value="classified">Classified listing</option></select></label><label className="text-sm">Category<select name="category" className={control}>{categories.map(c=><option key={c} value={c}>{labels[c]}</option>)}</select></label></div><Field label="Title" name="title" min={5} max={120}/><Field label="Details: what you offer, need, or want to discuss" name="body" multiline min={20} max={6000}/><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Location or online (optional)<input name="location" maxLength={120} className={control} placeholder="Rancho Cucamonga, CA · Online"/></label><label className="text-sm">Rate or price (optional)<input name="price" maxLength={120} className={control} placeholder="$40 per lesson · Free · Negotiable"/></label></div><label className="flex gap-2 text-xs text-neutral-400"><input type="checkbox" required/>This is music-related and accurately describes my offer or request. I will respect members and avoid spam.</label><p className="text-xs text-neutral-500">Up to five new posts per day. Classifieds expire after 30 days. You can close or hide your post.</p></WorkForm>}
   {loading?<p role="status" className="py-12 text-center text-neutral-400">Loading the music community…</p>:<>
    {!selected&&tab!=='reports'&&<>
     <div className="flex flex-wrap items-end gap-3"><label className="min-w-48 flex-1 text-xs text-neutral-400">Search posts, lessons, or locations<input className={control} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Voice lessons, mixing, online…"/></label><label className="text-xs text-neutral-400">Category<select className={control} value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All music categories</option>{categories.map(c=><option key={c} value={c}>{labels[c]}</option>)}</select></label><label className="flex items-center gap-2 pb-3 text-xs text-neutral-400"><input type="checkbox" checked={showClosed} onChange={e=>setShowClosed(e.target.checked)}/>Include closed / expired</label></div>
     <div className="grid gap-4 md:grid-cols-2">{topics.map(t=><article key={t.id} className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5"><div className="flex justify-between gap-3 text-xs"><span className="text-violet-300">{labels[t.category]}</span><span className="text-neutral-500">{expired(t.expires_at)?'Expired':t.status}</span></div><h2 className="mt-3 text-xl font-bold">{t.title}</h2><p className="mt-3 line-clamp-3 text-sm leading-6 text-neutral-400">{t.body}</p>{(t.location||t.price_text)&&<p className="mt-4 text-sm text-violet-200">{[t.location,t.price_text].filter(Boolean).join(' · ')}</p>}<div className="mt-5 flex items-center justify-between gap-2"><p className="text-xs text-neutral-500">{new Date(t.created_at).toLocaleDateString()}</p><button className="text-sm font-bold text-violet-300" onClick={()=>setSelected(t.id)}>{t.kind==='classified'?'View listing':'Join discussion'} →</button></div></article>)}</div>
     {!topics.length&&<p className="rounded-2xl border border-neutral-800 p-10 text-center text-neutral-400">{tab==='classified'?'No matching listings yet. Offer a lesson, find a collaborator, or post a music service.':'No matching discussions yet. Start a music conversation.'}</p>}
    </>}
    {tab==='reports'&&!selected&&data.isOperator&&<section className="space-y-3"><h2 className="text-2xl font-bold">Member reports</h2>{data.reports.filter(r=>r.status==='open').map(r=><article key={r.id} className="rounded-xl border border-neutral-800 p-5"><h3 className="font-bold">{data.topics.find(t=>t.id===r.topic_id)?.title||'Reported thread'}</h3><p className="mt-3 whitespace-pre-wrap text-sm text-neutral-300">{r.reason}</p><div className="mt-4 flex gap-3"><button className="text-sm text-violet-300" onClick={()=>setSelected(r.topic_id)}>Review thread</button><button disabled={busy} className={button} onClick={()=>void run(()=>reviewMusicReport(r.id),'Report marked reviewed.')}>Mark reviewed</button></div></article>)}{!data.reports.some(r=>r.status==='open')&&<p className="text-sm text-neutral-400">No open reports.</p>}</section>}
    {selected&&topic&&<article className="space-y-5 rounded-2xl border border-neutral-800 p-5 sm:p-6"><button className="text-sm text-violet-300" onClick={()=>setSelected(null)}>← Back to {tab==='reports'?'reports':tab==='classified'?'classifieds':'discussions'}</button><div><p className="text-xs text-violet-300">{labels[topic.category]} · {expired(topic.expires_at)?'Expired':topic.status}</p><h2 className="mt-2 text-2xl font-bold">{topic.title}</h2><p className="mt-2 text-xs text-neutral-500">{topic.author_id===user.id?'Posted by you':`Member ${topic.author_id.slice(0,8)}`} · {new Date(topic.created_at).toLocaleString()}</p></div>{(topic.location||topic.price_text)&&<p className="text-sm font-bold text-violet-200">{[topic.location,topic.price_text].filter(Boolean).join(' · ')}</p>}<p className="whitespace-pre-wrap text-sm leading-7 text-neutral-300">{topic.body}</p>{topic.expires_at&&<p className="text-xs text-neutral-500">Listing expires {new Date(topic.expires_at).toLocaleDateString()}</p>}
     {(topic.author_id===user.id||data.isOperator)&&<div className="flex flex-wrap gap-3">{topic.status==='open'&&<button disabled={busy} className="text-sm text-violet-300" onClick={()=>void run(()=>moderateMusicTopic(topic.id,'closed'),'Thread closed. Existing replies remain visible.')}>{topic.kind==='classified'?'Close listing':'Close discussion'}</button>}{topic.status!=='hidden'&&<button disabled={busy} className="text-sm text-rose-300" onClick={()=>void run(()=>moderateMusicTopic(topic.id,'hidden'),'Thread hidden from other members.')}>{topic.author_id===user.id?'Hide my post':'Hide thread'}</button>}{data.isOperator&&topic.status!=='open'&&<button disabled={busy} className="text-sm text-violet-300" onClick={()=>void run(()=>moderateMusicTopic(topic.id,'open'),'Thread restored. Expired listing dates remain unchanged.')}>Restore thread</button>}</div>}
     <section className="space-y-3 border-t border-neutral-800 pt-5"><h3 className="font-bold">Conversation</h3>{loadingReplies?<p role="status" className="text-sm text-neutral-500">Loading replies…</p>:replies.length?replies.map(r=><div key={r.id} className={`rounded-xl border border-neutral-800 p-4 ${r.status==='hidden'?'opacity-50':''}`}><div className="flex justify-between gap-2 text-xs text-neutral-500"><span>{r.author_id===user.id?'You':`Member ${r.author_id.slice(0,8)}`}{r.status==='hidden'?' · Hidden':''}</span><span>{new Date(r.created_at).toLocaleString()}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-300">{r.body}</p>{r.status!=='hidden'&&(r.author_id===user.id||data.isOperator)&&<button disabled={busy} className="mt-3 text-xs text-rose-300" onClick={()=>void run(()=>hideMusicReply(r.id),'Reply hidden.')}>{r.author_id===user.id?'Hide my reply':'Hide reply'}</button>}</div>):<p className="text-sm text-neutral-500">No replies yet. Be the first to respond.</p>}
      {topic.status==='open'&&!expired(topic.expires_at)&&<WorkForm busy={busy} label="Post reply" submit={f=>run(()=>replyToMusicTopic(topic.id,user.id,read(f,'body')),'Reply posted.')}><Field label="Your reply" name="body" multiline min={2}/><p className="text-xs text-neutral-500">Keep it helpful and music-related. Up to twenty replies per hour.</p></WorkForm>}
     </section>
     <details className="border-t border-neutral-800 pt-4"><summary className="cursor-pointer text-xs text-neutral-400">Report this thread or a reply</summary><WorkForm busy={busy} label="Send private report to moderators" submit={f=>run(()=>reportMusicTopic(topic.id,user.id,read(f,'reason')),'Report recorded for moderators.')}><Field name="reason" label="Explain the issue. For a reply, identify the member and posting time." multiline min={10} max={2000}/><p className="text-xs text-neutral-500">Only you and platform moderators can read your report.</p></WorkForm></details>
    </article>}
    {selected&&!topic&&<p className="text-sm text-neutral-400">This thread is unavailable.</p>}
   </>}
  </>}
 </section>;
}
