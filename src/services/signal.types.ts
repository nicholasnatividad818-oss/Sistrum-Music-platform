export type JobStatus = 'applied' | 'selected' | 'submitted' | 'revision' | 'approved' | 'declined';
export type CampaignKind = 'share' | 'content' | 'campaign';
export type SignalCampaign = {
 id: string; artist_id: string; track_id: string; title: string; brief: string;
 kind: CampaignKind; budget_cents: number; fee_cents: number; currency: string;
 deadline: string; created_at: string;
};
export type SignalJob = {
 id: string; campaign_id: string; promoter_id: string; pitch: string;
 status: JobStatus; proof_url: string | null; proof_notes: string; review_notes: string;
 fee_cents: number; approved_at: string | null; created_at: string;
};
