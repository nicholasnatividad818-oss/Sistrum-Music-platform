import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const artist='00000000-0000-0000-0000-000000000001', fan='00000000-0000-0000-0000-000000000002', other='00000000-0000-0000-0000-000000000003';
async function setup() {
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
 create table public.tracks(id uuid primary key,owner_id uuid);
 grant select on public.tracks to authenticated;
 insert into auth.users values ('${artist}'),('${fan}'),('${other}');
 insert into public.tracks values ('${artist}','${artist}');`);
 await db.exec(readFileSync('supabase/migrations/20261001043631_signal_marketplace.sql','utf8'));
 const act=async id=>{await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false)`);};
 await act(artist);
 const {rows:[c]}=await db.query(`insert into signal_campaigns(artist_id,track_id,title,brief,kind,budget_cents,fee_cents,deadline) values ($1,$1,'Campaign','Create one original disclosed promotional video','content',2500,2500,now()+interval '1 day') returning id`,[artist]);
 return {db,act,c:c.id};
}
test('only selected promoter can submit; only artist can approve; budget and terms are protected',async()=>{
 const {db,act,c}=await setup();
 try {
 await act(fan);
 const {rows:[j]}=await db.query(`insert into signal_jobs(campaign_id,promoter_id,pitch) values ($1,$2,'Original video for my audience') returning *`,[c,fan]);
 assert.equal(j.fee_cents,2500);
 await assert.rejects(db.query(`update signal_jobs set status='approved' where id=$1`,[j.id]),/Submit proof/);
 await assert.rejects(db.query(`update signal_jobs set fee_cents=1 where id=$1`,[j.id]),/permission denied/);
 await act(other);
 assert.equal((await db.query('select * from signal_jobs')).rows.length,0);
 const {rows:[j2]}=await db.query(`insert into signal_jobs(campaign_id,promoter_id,pitch) values ($1,$2,'Second original video application') returning *`,[c,other]);
 await act(artist);
 await assert.rejects(db.query(`insert into signal_jobs(campaign_id,promoter_id,pitch) values ($1,$2,'Self referral should fail')`,[c,artist]),/not permitted/);
 await db.query(`update signal_jobs set status='selected' where id=$1`,[j.id]);
 await assert.rejects(db.query(`update signal_jobs set status='selected' where id=$1`,[j2.id]),/budget exceeded/);
 await assert.rejects(db.query(`update signal_campaigns set title='Different' where id=$1`,[c]),/immutable/);
 await act(fan);
 await assert.rejects(db.query(`update signal_jobs set status='submitted' where id=$1`,[j.id]),/Submit proof/);
 await db.query(`update signal_jobs set status='submitted', proof_url='https://example.com/my-video' where id=$1`,[j.id]);
 await act(artist);
 await db.query(`update signal_jobs set status='revision',review_notes='Please include the agreed disclosure' where id=$1`,[j.id]);
 await act(fan);
 await db.query(`update signal_jobs set status='submitted',proof_url='https://example.com/revised-video' where id=$1`,[j.id]);
 await act(artist);
 await db.query(`update signal_jobs set status='approved' where id=$1`,[j.id]);
 assert.ok((await db.query('select approved_at from signal_jobs where id=$1',[j.id])).rows[0].approved_at);
 await assert.rejects(db.query(`update signal_jobs set status='revision' where id=$1`,[j.id]),/Invalid artist transition/);
 await db.exec('reset role; set role anon');
 await assert.rejects(db.query('select * from signal_jobs'),/permission denied/);
 } finally {await db.close();}
});
