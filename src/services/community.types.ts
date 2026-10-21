export type MusicCategory = 'general'|'production'|'songwriting'|'collaboration'|'music-lessons'|'voice-lessons'|'gear'|'gigs'|'services';
export type MusicTopic = {id:string;author_id:string;kind:'discussion'|'classified';category:MusicCategory;title:string;body:string;location:string;price_text:string;status:'open'|'closed'|'hidden';expires_at:string|null;created_at:string};
export type MusicReply = {id:string;topic_id:string;author_id:string;body:string;status:'visible'|'hidden';created_at:string};
export type MusicReport = {id:string;topic_id:string;reporter_id:string;reason:string;status:'open'|'reviewed';created_at:string};
export type CommunityData = {topics:MusicTopic[];reports:MusicReport[];isOperator:boolean};
