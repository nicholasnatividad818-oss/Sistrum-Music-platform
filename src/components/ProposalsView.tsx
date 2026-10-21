import { useEffect, useMemo, useState } from 'react';
import type { ReactNode, FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import type { ProposalCategory, ProposalData, ProposalStatus, ProposalProject } from '../services/proposals.types';
import { addMilestone, applyToProject, commissionProject, deliverMilestone, loadProposals, reviewMilestone, reviewProposal, selectDeveloper, setProposalVote, submitProposal } from '../services/proposals';

const money = (value: number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value/100);
const control = 'mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white';
const button = 'rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-40';
const empty: ProposalData = {proposals:[],votes:[],projects:[],applications:[],milestones:[],reputation:[],isOperator:false};
const read = (data: FormData,key: string) => String(data.get(key) || '');
type Run = (work: () => Promise<void>,message: string) => Promise<boolean>;
export function Field({label,name,multiline=false,min=0,max=3000,type='text'}:{label:string;name:string;multiline?:boolean;min?:number;max?:number;type?:string}) {
 return <label className="block text-sm text-neutral-300">{label}{multiline ? <textarea required={min>0} minLength={min} maxLength={max} name={name} rows={3} className={control}/> : <input required minLength={min} maxLength={max} type={type} name={name} className={control}/>}</label>;
}
export function WorkForm({children,submit,busy,label}:{children:ReactNode;submit:(data:FormData)=>Promise<boolean>;busy:boolean;label:string}) {
 async function handle(event:FormEvent<HTMLFormElement>) {event.preventDefault(); const form=event.currentTarget; if(await submit(new FormData(form))) form.reset();}
 return <form onSubmit={handle} className="mt-4 space-y-3 rounded-xl border border-neutral-700 bg-neutral-900 p-4"><fieldset disabled={busy} className="space-y-3">{children}<button className={button}>{busy?'Saving…':label}</button></fieldset></form>;
}

export function ProposalsView({user,onSignIn}:{user:User|null;onSignIn:()=>void}) {
 const [data,setData]=useState<ProposalData>(empty);
 const [tab,setTab]=useState<'ideas'|'projects'|'developers'|'my-work'>('ideas');
 const [selected,setSelected]=useState<string|null>(null);
 const [showCreate,setShowCreate]=useState(false);
 const [loading,setLoading]=useState(Boolean(user));
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [filter,setFilter]=useState('all');
 const [search,setSearch]=useState('');
 useEffect(()=>{
  if(!user) return;
  let active=true;
  loadProposals(user.id).then(result=>{if(active)setData(result);}).catch(e=>{if(active)setError(e.message || 'Unable to load proposals.');}).finally(()=>{if(active)setLoading(false);});
  return ()=>{active=false;};
 },[user?.id]);
 const run:Run=async(work,message)=>{
  setBusy(true);setError('');setNotice('');
  try {await work();setData(await loadProposals(user!.id));setNotice(message);return true;}
  catch(e){setError(e instanceof Error?e.message:'Unable to save. Please retry.');return false;}
  finally{setBusy(false);}
 };
 const votes=useMemo(()=>data.votes.reduce<Record<string,number>>((counts,v)=>{counts[v.proposal_id]=(counts[v.proposal_id]||0)+1;return counts;},{}),[data.votes]);
 const ideas=data.proposals.filter(p=>(filter==='all'||p.status===filter) && `${p.title} ${p.problem} ${p.category}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>(votes[b.id]||0)-(votes[a.id]||0) || b.created_at.localeCompare(a.created_at));
 const activeProposal=data.proposals.find(p=>p.id===selected);
 const myProjectIds=data.projects.filter(p=>p.developer_id===user?.id).map(p=>p.id);
 const owed=data.milestones.filter(m=>myProjectIds.includes(m.project_id) && m.status==='accepted').reduce((total,m)=>total+m.amount_cents,0);
 const myRep=data.reputation.find(r=>r.developer_id===user?.id);
 const voteEligible=Boolean(user?.email_confirmed_at && Date.now()-Date.parse(user.created_at)>=7*86400000);

 function projectCard(project:ProposalProject) {
  const proposal=data.proposals.find(p=>p.id===project.proposal_id);
  const milestones=data.milestones.filter(m=>m.project_id===project.id);
  const applications=data.applications.filter(a=>a.project_id===project.id);
  const mine=project.developer_id===user?.id;
  const applicationOpen=!project.developer_id && Date.parse(project.deadline)>Date.now();
  return <article key={project.id} className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 sm:p-6">
   <div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-violet-300">{project.developer_id?'Developer selected':'Developer opportunity'}</p><h3 className="mt-2 text-xl font-bold">{proposal?.title || 'Community project'}</h3></div><div className="text-right"><p className="text-xl font-black">{money(project.budget_cents)}</p><p className="text-xs text-amber-200">Budget commitment · not deposited</p></div></div>
   <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-neutral-300">{project.brief}</p>
   <p className="mt-3 text-xs text-neutral-500">Applications close {new Date(project.deadline).toLocaleString()} · Milestone scope {money(milestones.reduce((n,m)=>n+m.amount_cents,0))}</p>
   {project.developer_id && <p className="mt-2 text-sm text-violet-300">Assigned developer: {mine?'You':`Member ${project.developer_id.slice(0,8)}`}</p>}
   {applicationOpen && user && !applications.some(a=>a.developer_id===user.id) && <details className="mt-4"><summary className="cursor-pointer text-sm font-bold text-violet-300">Apply to implement this idea</summary><WorkForm busy={busy} label="Send developer application" submit={f=>run(()=>applyToProject(project.id,user.id,read(f,'plan'),read(f,'portfolio')),'Application submitted. Selection is made by platform operators.')}><Field name="plan" label="Implementation plan, relevant experience, and availability" multiline min={20} max={4000}/><Field name="portfolio" label="Public portfolio or relevant code (HTTPS)" type="url" max={2000}/><label className="flex gap-2 text-xs text-neutral-400"><input required type="checkbox"/>I understand these are proposed project terms. Funding and payment terms must be finalized before work begins.</label></WorkForm></details>}
   {applications.some(a=>a.developer_id===user?.id) && !data.isOperator && <p className="mt-4 text-sm text-emerald-300">Your application is recorded.{mine?' You have been selected.':''}</p>}
   {data.isOperator && !project.developer_id && <details className="mt-4"><summary className="cursor-pointer text-sm font-bold text-violet-300">Define a milestone</summary><WorkForm busy={busy} label="Add fixed milestone" submit={f=>run(()=>addMilestone(project.id,read(f,'title'),read(f,'criteria'),read(f,'amount')),'Milestone saved. Terms are fixed once added.')}><Field name="title" label="Milestone title" min={5} max={120}/><Field name="criteria" label="Acceptance criteria and required checks" multiline min={20}/><Field name="amount" label="Agreed milestone fee (USD)"/></WorkForm></details>}
   {data.isOperator && applications.length>0 && <div className="mt-5 space-y-3"><h4 className="font-bold">Developer applications</h4>{applications.map(a=>{
    const rep=data.reputation.find(r=>r.developer_id===a.developer_id);
    return <div key={a.id} className="rounded-xl border border-neutral-700 p-4"><p className="text-sm font-bold">Member {a.developer_id.slice(0,8)}</p><p className="mt-1 text-xs text-neutral-400">{rep?`${rep.accepted_milestones} accepted milestones · ${rep.average_quality}/5 average quality`:'New contributor · no verified milestones yet'}</p><p className="mt-3 whitespace-pre-wrap text-sm text-neutral-300">{a.plan}</p><a href={a.portfolio_url} target="_blank" rel="noopener noreferrer" className="mt-2 block text-sm text-violet-300 underline">Review portfolio</a>{applicationOpen && <button disabled={busy||!milestones.length||a.developer_id===user?.id} className={`${button} mt-3`} onClick={()=>void run(()=>selectDeveloper(project.id,a.developer_id),'Developer selected. Access is granted separately; no money has moved.')}>Select developer</button>}</div>;
   })}</div>}
   <div className="mt-5 space-y-3">{milestones.map(m=><div key={m.id} className="rounded-xl border border-neutral-700 p-4">
    <div className="flex flex-wrap justify-between gap-2"><h4 className="font-bold">{m.title}</h4><span className="text-sm font-bold">{money(m.amount_cents)} · {m.status}</span></div>
    <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-400">{m.acceptance_criteria}</p>
    {m.pull_request_url && <a href={m.pull_request_url} target="_blank" rel="noopener noreferrer" className="mt-3 block text-sm text-violet-300 underline">Review pull request</a>}
    {m.delivery_notes && <p className="mt-2 whitespace-pre-wrap text-sm">{m.delivery_notes}</p>}
    {m.review_note && <p className="mt-2 whitespace-pre-wrap text-sm text-amber-200">Review: {m.review_note}</p>}
    {m.status==='accepted' && <p className="mt-2 text-xs text-emerald-300">Quality {m.quality_score}/5 · approved fee owed · payment processing not connected.</p>}
    {mine && ['pending','revision'].includes(m.status) && <details className="mt-4"><summary className="cursor-pointer text-sm font-bold text-violet-300">Submit work for review</summary><WorkForm busy={busy} label="Submit milestone" submit={f=>run(()=>deliverMilestone(m.id,read(f,'url'),read(f,'notes')),'Milestone submitted for review.')}><Field name="url" label="GitHub pull request URL" type="url" max={2000}/><Field name="notes" label="Tests, staging preview, and delivery notes" multiline/></WorkForm></details>}
    {data.isOperator && !mine && m.status==='submitted' && <WorkForm busy={busy} label="Save milestone review" submit={f=>run(()=>reviewMilestone(m.id,read(f,'decision')==='accepted',read(f,'review'),Number(read(f,'score'))),read(f,'decision')==='accepted'?'Milestone accepted. The fee is owed and reputation updated.':'Revision requested.')}><Field name="review" label="Review evidence, checks, and feedback" multiline min={20}/><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Decision<select name="decision" className={control}><option value="revision">Request revision</option><option value="accepted">Accept work and fee</option></select></label><label className="text-sm">Quality score for accepted work<select name="score" className={control}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} / 5</option>)}</select></label></div></WorkForm>}
   </div>)}</div>
   {!milestones.length && <p className="mt-4 text-sm text-neutral-500">Milestones must be defined before a developer is selected.</p>}
  </article>;
 }
 return <section className="mb-12 space-y-6">
  <header className="rounded-3xl border border-violet-500/30 bg-gradient-to-br from-violet-950 to-neutral-900 p-6 sm:p-10"><p className="text-xs font-bold uppercase tracking-[.25em] text-violet-300">Sistrum Proposals</p><h1 className="mt-3 text-3xl font-black sm:text-4xl">A voice in what we build.</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-300">Suggest improvements. Support useful ideas. Apply to build them. Earn a reputation through accepted work and thoughtful collaboration.</p><div className="mt-6 flex flex-wrap gap-2 text-xs text-violet-200">{['Propose','Vote','Review','Commission','Build','Accept'].map((step,i)=><span key={step} className="rounded-full border border-violet-400/30 px-3 py-1.5">{i+1}. {step}</span>)}</div>{!user && <button onClick={onSignIn} className={`${button} mt-6`}>Sign in to participate</button>}</header>
  <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-4 text-xs leading-5 text-amber-200">Pilot: voting guides platform decisions. Project budgets are commitments, not deposited funds. Payment processing is not connected; accepted fees show money owed. Reputation does not grant access to production.</div>
  {user && <>
   <nav aria-label="Proposals sections" className="flex flex-wrap gap-2">{(['ideas','projects','developers','my-work'] as const).map(t=><button key={t} onClick={()=>{setTab(t);setSelected(null);}} aria-current={tab===t?'page':undefined} className={`rounded-xl px-4 py-2 text-sm capitalize ${tab===t?'bg-violet-600':'bg-neutral-900 text-neutral-300'}`}>{t.replace('-',' ')}</button>)}<button disabled={busy} onClick={()=>setShowCreate(!showCreate)} className={`${button} ml-auto`}>Suggest an idea</button></nav>
   {error && <div role="alert" className="rounded-xl border border-rose-800 bg-rose-950/30 p-4 text-sm text-rose-200">{error}<button disabled={busy} className="ml-3 underline" onClick={()=>void run(async()=>{},'Reloaded proposals.')}>Reload</button></div>}
   {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
   {showCreate && <WorkForm busy={busy} label="Submit community proposal" submit={f=>run(async()=>{await submitProposal(user.id,{title:read(f,'title'),problem:read(f,'problem'),solution:read(f,'solution'),success_criteria:read(f,'criteria'),category:read(f,'category') as ProposalCategory});setShowCreate(false);setTab('ideas');},'Idea submitted. Members can now support it.')}><h2 className="text-xl font-bold">What should Sistrum improve?</h2><Field label="Idea title" name="title" min={5} max={120}/><label className="text-sm">Category<select name="category" className={control}>{['music','community','creator-tools','accessibility','platform'].map(c=><option key={c}>{c}</option>)}</select></label><Field label="The problem and who it affects" name="problem" multiline min={20}/><Field label="Your proposed solution" name="solution" multiline min={20}/><Field label="How we will know it works" name="criteria" multiline min={10} max={2000}/><p className="text-xs text-neutral-500">Check for existing ideas first. Up to three proposals per account per day. Proposal text is visible to signed-in members.</p></WorkForm>}
   {loading ? <p role="status" className="py-12 text-center text-neutral-400">Loading community proposals…</p> : <>
    {tab==='ideas' && <>
     <div className="flex flex-wrap gap-3"><label className="min-w-48 flex-1 text-xs text-neutral-400">Search proposals<input className={control} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by problem or category"/></label><label className="text-xs text-neutral-400">Status<select className={control} value={filter} onChange={e=>setFilter(e.target.value)}>{['all','open','reviewing','accepted','deferred','declined','shipped'].map(s=><option key={s}>{s}</option>)}</select></label></div>
     <p className="text-xs text-neutral-500">One vote per confirmed account at least seven days old. Votes are visible to signed-in members. Ideas are ranked by member votes; purchased votes are prohibited.</p>
     {!activeProposal && <div className="grid gap-4 md:grid-cols-2">{ideas.map(p=>{
      const voted=data.votes.some(v=>v.proposal_id===p.id && v.voter_id===user.id);
      return <article key={p.id} className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5"><div className="flex justify-between gap-2 text-xs"><span className="text-violet-300">{p.category}</span><span className="capitalize text-neutral-400">{p.status}</span></div><h2 className="mt-3 text-xl font-bold">{p.title}</h2><p className="mt-3 line-clamp-3 text-sm leading-6 text-neutral-400">{p.problem}</p><div className="mt-5 flex flex-wrap items-center gap-3"><button disabled={busy||!['open','reviewing'].includes(p.status)||(!voted&&!voteEligible)} title={!voteEligible?'Confirmed account must be at least seven days old':undefined} onClick={()=>void run(()=>setProposalVote(p.id,user.id,!voted),voted?'Vote removed.':'Vote recorded.')} className={`rounded-xl border px-3 py-2 text-sm font-bold disabled:opacity-40 ${voted?'border-violet-400 text-violet-300':'border-neutral-700'}`}>{voted?'Supported':'Support'} · {votes[p.id]||0}</button><button onClick={()=>setSelected(p.id)} className="ml-auto text-sm font-bold text-violet-300">View proposal →</button></div></article>;
     })}</div>}
     {!ideas.length && !activeProposal && <p className="rounded-2xl border border-neutral-800 p-10 text-center text-neutral-400">No matching ideas yet. Submit the first one.</p>}
     {activeProposal && <article className="space-y-5 rounded-2xl border border-neutral-800 p-6"><button onClick={()=>setSelected(null)} className="text-sm text-violet-300">← All ideas</button><div><p className="text-xs text-neutral-400">{activeProposal.status} · {votes[activeProposal.id]||0} votes</p><h2 className="mt-2 text-2xl font-bold">{activeProposal.title}</h2></div>{[['Problem',activeProposal.problem],['Proposed solution',activeProposal.solution],['Success criteria',activeProposal.success_criteria]].map(([label,value])=><div key={label}><h3 className="text-sm font-bold text-violet-300">{label}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-300">{value}</p></div>)}{activeProposal.review_note && <div className="rounded-xl bg-neutral-900 p-4"><h3 className="text-sm font-bold">Platform decision</h3><p className="mt-2 whitespace-pre-wrap text-sm text-neutral-300">{activeProposal.review_note}</p></div>}
      {data.isOperator && activeProposal.status!=='shipped' && <WorkForm busy={busy} label="Record platform decision" submit={f=>run(()=>reviewProposal(activeProposal.id,read(f,'status') as ProposalStatus,read(f,'note')),'Review decision published.')}><label className="text-sm">Decision<select name="status" className={control}>{(['reviewing','accepted','deferred','declined','shipped'] as const).filter(s=>s!==activeProposal.status).map(s=><option key={s}>{s}</option>)}</select></label><Field label="Explain the decision to members" name="note" multiline min={10}/></WorkForm>}
      {data.isOperator && activeProposal.status==='accepted' && !data.projects.some(p=>p.proposal_id===activeProposal.id) && <WorkForm busy={busy} label="Publish developer opportunity" submit={f=>run(()=>commissionProject(activeProposal.id,user.id,{brief:read(f,'brief'),budget:read(f,'budget'),deadline:read(f,'deadline')}),'Developer opportunity published. Define milestones before selecting an applicant.')}><h3 className="font-bold">Commission this improvement</h3><Field name="brief" label="Scope, deliverables, review process, and payment terms" multiline min={20} max={5000}/><Field name="budget" label="Total project budget (USD)"/><Field name="deadline" label="Developer application deadline" type="datetime-local"/><label className="flex gap-2 text-xs"><input required type="checkbox"/>I am authorized to commit this budget. Funding must be arranged before implementation begins.</label></WorkForm>}
      {data.projects.filter(p=>p.proposal_id===activeProposal.id).map(projectCard)}
     </article>}
    </>}
    {tab==='projects' && <div className="space-y-4">{data.projects.map(projectCard)}{!data.projects.length && <p className="rounded-2xl border border-neutral-800 p-10 text-center text-neutral-400">Accepted ideas become developer opportunities after platform review.</p>}</div>}
    {tab==='developers' && <section className="space-y-4"><h2 className="text-2xl font-bold">Reputation backed by accepted work</h2><p className="text-sm leading-6 text-neutral-400">Quality scores come from reviewed milestones. Sample counts show the experience behind each rating. These records do not measure agreement with platform leadership.</p>{!data.reputation.length ? <p className="rounded-2xl border border-neutral-800 p-10 text-center text-neutral-400">No accepted developer milestones yet. New contributors can apply with a portfolio.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-neutral-700 text-neutral-400"><tr>{['Developer','Accepted milestones','Projects contributed to','Average quality'].map(h=><th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{data.reputation.map(r=><tr key={r.developer_id} className="border-b border-neutral-800"><td className="p-3">{r.developer_id===user.id?'You':`Member ${r.developer_id.slice(0,8)}`}</td><td className="p-3">{r.accepted_milestones}</td><td className="p-3">{r.contributing_projects}</td><td className="p-3 text-violet-300">{r.average_quality}/5</td></tr>)}</tbody></table></div>}<p className="text-xs text-neutral-500">Pilot ratings cover quality only. Reliability, collaboration, disputes, and appeals need a defined review process before adding further scores.</p></section>}
    {tab==='my-work' && <section className="space-y-4"><div className="grid gap-3 sm:grid-cols-3">{[['Approved fees owed',money(owed)],['Accepted milestones',String(myRep?.accepted_milestones||0)],['Reviewed quality',myRep?`${myRep.average_quality}/5`:'No reviews yet']].map(([label,value])=><div key={label} className="rounded-2xl border border-neutral-800 p-5"><p className="text-xs text-neutral-400">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>)}</div><p className="text-xs text-amber-200">Amounts owed are not withdrawable balances. No payment is sent from this pilot.</p>{data.projects.filter(p=>p.developer_id===user.id||data.applications.some(a=>a.project_id===p.id&&a.developer_id===user.id)).map(projectCard)}{!data.applications.some(a=>a.developer_id===user.id)&&!myProjectIds.length&&<p className="rounded-2xl border border-neutral-800 p-10 text-center text-neutral-400">Apply to a developer opportunity to start building your record.</p>}</section>}
   </>}
  </>}
 </section>;
}
