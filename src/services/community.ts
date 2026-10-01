import {supabase} from '../lib/supabase';
import {allRows} from './proposals';
import type {CommunityData,MusicReply,MusicTopic} from './community.types';
function content(value:string,min:number,max:number,label:string){const result=value.trim();if(result.length<min||result.length>max)throw new Error(`${label} must contain ${min}–${max} characters.`);return result;}
export async function loadCommunity(userId:string):Promise<CommunityData>{
 const [topics,reports,operator]=await Promise.all([
  allRows<CommunityData['topics'][number]>((a,b)=>supabase.from('music_topics').select('*').order('created_at',{ascending:false}).order('id').range(a,b)),
  allRows<CommunityData['reports'][number]>((a,b)=>supabase.from('music_reports').select('*').order('id').range(a,b)),
  supabase.from('proposal_operators').select('user_id').eq('user_id',userId)
 ]);
 if(operator.error)throw new Error(operator.error.message);
 return {topics,reports,isOperator:Boolean(operator.data?.length)};
}
export async function loadReplies(topicId:string){return allRows<MusicReply>((a,b)=>supabase.from('music_replies').select('*').eq('topic_id',topicId).order('created_at').order('id').range(a,b));}
export async function createMusicTopic(userId:string,input:Pick<MusicTopic,'kind'|'category'|'title'|'body'|'location'|'price_text'>){
 const {error}=await supabase.from('music_topics').insert({...input,author_id:userId,title:content(input.title,5,120,'Title'),body:content(input.body,20,6000,'Post'),location:content(input.location,0,120,'Location'),price_text:content(input.price_text,0,120,'Rate')});
 if(error)throw new Error(error.message);
}
export async function replyToMusicTopic(topicId:string,userId:string,body:string){
 const {error}=await supabase.from('music_replies').insert({topic_id:topicId,author_id:userId,body:content(body,2,3000,'Reply')});
 if(error)throw new Error(error.message);
}
export async function reportMusicTopic(topicId:string,userId:string,reason:string){
 const {error}=await supabase.from('music_reports').insert({topic_id:topicId,reporter_id:userId,reason:content(reason,10,2000,'Report')});
 if(error)throw new Error(error.code==='23505'?'You have already reported this thread.':error.message);
}
export async function moderateMusicTopic(id:string,status:MusicTopic['status']){
 const {data,error}=await supabase.from('music_topics').update({status}).eq('id',id).select('id');
 if(error)throw new Error(error.message);if(!data?.length)throw new Error('You do not have permission to change this thread.');
}
export async function hideMusicReply(id:string){
 const {data,error}=await supabase.from('music_replies').update({status:'hidden'}).eq('id',id).select('id');
 if(error)throw new Error(error.message);if(!data?.length)throw new Error('You do not have permission to remove this reply.');
}
export async function reviewMusicReport(id:string){
 const {data,error}=await supabase.from('music_reports').update({status:'reviewed'}).eq('id',id).select('id');
 if(error)throw new Error(error.message);if(!data?.length)throw new Error('Moderator permission required.');
}
