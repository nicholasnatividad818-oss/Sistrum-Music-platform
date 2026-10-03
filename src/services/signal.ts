import { supabase } from '../lib/supabase';
import type { CampaignKind, JobStatus } from './signal.types';
export function moneyToCents(value: string) {
 if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error('Enter a dollar amount with up to two decimals.');
 const [whole, fraction = ''] = value.split('.');
 const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
 if (!Number.isSafeInteger(cents) || cents < 100 || cents > 10000000) throw new Error('Amount must be $1–$100,000.');
 return cents;
}
export async function loadSignal() {
 const [campaigns, jobs] = await Promise.all([
  supabase.from('signal_campaigns').select('*').order('created_at', { ascending: false }).limit(100),
  supabase.from('signal_jobs').select('*').order('created_at', { ascending: false }).limit(1000)
 ]);
 if (campaigns.error || jobs.error) throw campaigns.error || jobs.error;
 return { campaigns: campaigns.data, jobs: jobs.data };
}
export async function createSignalCampaign(input: { artistId: string; trackId: string; title: string; brief: string; kind: CampaignKind; budget: string; fee: string; deadline: string }) {
 const budget = moneyToCents(input.budget), fee = moneyToCents(input.fee);
 if (fee > budget) throw new Error('The fee must fit within the campaign budget.');
 if (input.title.trim().length < 3 || input.brief.trim().length < 20) throw new Error('Add a title and a brief of at least 20 characters.');
 if (!Number.isFinite(Date.parse(input.deadline)) || Date.parse(input.deadline) <= Date.now()) throw new Error('Choose a future deadline.');
 const { error } = await supabase.from('signal_campaigns').insert({artist_id: input.artistId, track_id: input.trackId, title: input.title.trim(), brief: input.brief.trim(), kind: input.kind, budget_cents: budget, fee_cents: fee, deadline: new Date(input.deadline).toISOString()});
 if (error) throw error;
}
export async function applySignal(campaignId: string, promoterId: string, pitch: string) {
 if (pitch.trim().length < 10) throw new Error('Describe your plan in at least 10 characters.');
 const { error } = await supabase.from('signal_jobs').insert({ campaign_id: campaignId, promoter_id: promoterId, pitch: pitch.trim() });
 if (error) throw error;
}
export async function updateSignalJob(id: string, status: JobStatus, details: { proof_url?: string; proof_notes?: string; review_notes?: string } = {}) {
 if (status === 'submitted') {
  const url = new URL(details.proof_url || '');
  if (url.protocol !== 'https:') throw new Error('Use an HTTPS link to your published work.');
 }
 const { data, error } = await supabase.from('signal_jobs').update({ status, ...details }).eq('id', id).select('id');
 if (error) throw error;
 if (!data?.length) throw new Error('This assignment is unavailable or you do not have permission.');
}
