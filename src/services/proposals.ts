import { supabase } from '../lib/supabase';
import { moneyToCents } from './signal';
import type { ProposalCategory, ProposalStatus, ProposalData } from './proposals.types';
function text(value: string, minimum: number, maximum: number, label: string) {
 const trimmed = value.trim();
 if (trimmed.length < minimum || trimmed.length > maximum) throw new Error(`${label} must contain ${minimum}–${maximum} characters.`);
 return trimmed;
}
export function safeHttps(value: string) {
 const url = new URL(value);
 if (url.protocol !== 'https:' || url.username || url.password || value.length > 2000) throw new Error('Provide a public HTTPS link without embedded credentials.');
 return url.href;
}
// Load every page so vote totals and reputation are not derived from truncated batches.
export async function allRows<T>(query: (start: number, end: number) => PromiseLike<{data: unknown; error: {message: string} | null}>): Promise<T[]> {
 const rows: T[] = [];
 for(let start=0;;start+=500) {
  const {data,error}=await query(start,start+499);
  if(error) throw new Error(error.message);
  const page=(data || []) as T[]; rows.push(...page);
  if(page.length < 500) return rows;
 }
}
export async function loadProposals(userId: string): Promise<ProposalData> {
 const [proposals,votes,projects,applications,milestones,reputation,operator] = await Promise.all([
  allRows<ProposalData['proposals'][number]>((a,b) => supabase.from('community_proposals').select('*').order('created_at',{ascending:false}).order('id').range(a,b)),
  allRows<ProposalData['votes'][number]>((a,b) => supabase.from('proposal_votes').select('*').order('proposal_id').order('voter_id').range(a,b)),
  allRows<ProposalData['projects'][number]>((a,b) => supabase.from('proposal_projects').select('*').order('id').range(a,b)),
  allRows<ProposalData['applications'][number]>((a,b) => supabase.from('developer_applications').select('*').order('id').range(a,b)),
  allRows<ProposalData['milestones'][number]>((a,b) => supabase.from('project_milestones').select('*').order('created_at').order('id').range(a,b)),
  allRows<ProposalData['reputation'][number]>((a,b) => supabase.from('developer_reputation').select('*').order('developer_id').range(a,b)),
  supabase.from('proposal_operators').select('user_id').eq('user_id',userId)
 ]);
 if(operator.error) throw new Error(operator.error.message);
 return {proposals,votes,projects,applications,milestones,reputation,isOperator:Boolean(operator.data?.length)};
}
export async function submitProposal(userId: string, input: {title: string; problem: string; solution: string; success_criteria: string; category: ProposalCategory}) {
 const {error}=await supabase.from('community_proposals').insert({author_id:userId,title:text(input.title,5,120,'Title'),problem:text(input.problem,20,3000,'Problem'),solution:text(input.solution,20,3000,'Solution'),success_criteria:text(input.success_criteria,10,2000,'Acceptance criteria'),category:input.category});
 if(error) throw new Error(error.message);
}
export async function setProposalVote(proposalId: string,userId: string,voted: boolean) {
 const result=voted ? await supabase.from('proposal_votes').insert({proposal_id:proposalId,voter_id:userId}) : await supabase.from('proposal_votes').delete().eq('proposal_id',proposalId).eq('voter_id',userId);
 if(result.error) throw new Error(result.error.code === '42501' ? 'Voting requires a confirmed account at least seven days old.' : result.error.message);
}
export async function reviewProposal(id: string,status: ProposalStatus,note: string) {
 const {data,error}=await supabase.from('community_proposals').update({status,review_note:text(note,10,3000,'Review explanation')}).eq('id',id).select('id');
 if(error) throw new Error(error.message); if(!data?.length) throw new Error('Operator permission required.');
}
export async function commissionProject(proposalId: string,userId: string,input: {brief: string; budget: string; deadline: string}) {
 if(!Number.isFinite(Date.parse(input.deadline)) || Date.parse(input.deadline)<=Date.now()) throw new Error('Choose a future application deadline.');
 const {error}=await supabase.from('proposal_projects').insert({proposal_id:proposalId,operator_id:userId,brief:text(input.brief,20,5000,'Project brief'),budget_cents:moneyToCents(input.budget),deadline:new Date(input.deadline).toISOString()});
 if(error) throw new Error(error.message);
}
export async function applyToProject(projectId: string,userId: string,plan: string,portfolio: string) {
 const {error}=await supabase.from('developer_applications').insert({project_id:projectId,developer_id:userId,plan:text(plan,20,4000,'Implementation plan'),portfolio_url:safeHttps(portfolio)});
 if(error) throw new Error(error.message);
}
export async function selectDeveloper(projectId: string,developerId: string) {
 const {data,error}=await supabase.from('proposal_projects').update({developer_id:developerId}).eq('id',projectId).select('id');
 if(error) throw new Error(error.message); if(!data?.length) throw new Error('Operator permission required.');
}
export async function addMilestone(projectId: string,title: string,criteria: string,amount: string) {
 const {error}=await supabase.from('project_milestones').insert({project_id:projectId,title:text(title,5,120,'Milestone title'),acceptance_criteria:text(criteria,20,3000,'Milestone acceptance criteria'),amount_cents:moneyToCents(amount)});
 if(error) throw new Error(error.message);
}
export async function deliverMilestone(id: string,url: string,notes: string) {
 const link=safeHttps(url);
 if(!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+$/.test(link)) throw new Error('Use a GitHub pull request URL.');
 const {data,error}=await supabase.from('project_milestones').update({status:'submitted',pull_request_url:link,delivery_notes:text(notes,0,3000,'Delivery notes')}).eq('id',id).select('id');
 if(error) throw new Error(error.message); if(!data?.length) throw new Error('Only the assigned developer may submit work.');
}
export async function reviewMilestone(id: string,accept: boolean,note: string,score: number) {
 if(accept && (!Number.isInteger(score) || score<1 || score>5)) throw new Error('Choose a quality score from 1 to 5.');
 const {data,error}=await supabase.from('project_milestones').update({status:accept?'accepted':'revision',review_note:text(note,20,3000,'Review explanation'),quality_score:accept?score:null}).eq('id',id).select('id');
 if(error) throw new Error(error.message); if(!data?.length) throw new Error('Operator permission required.');
}
