import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const operator='10000000-0000-0000-0000-000000000001',member='10000000-0000-0000-0000-000000000002',developer='10000000-0000-0000-0000-000000000003',fresh='10000000-0000-0000-0000-000000000004';
async function setup(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,created_at timestamptz default now()-interval '8 days',email_confirmed_at timestamptz default now());
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 insert into auth.users(id) values ('${operator}'),('${member}'),('${developer}');
 insert into auth.users(id,created_at) values ('${fresh}',now());`);
 await db.exec(readFileSync('supabase/migrations/20261001044839_community_proposals.sql','utf8'));
 await db.query('insert into proposal_operators(user_id) values ($1)',[operator]);
 const act=async id=>db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`);
 return {db,act};
}
test('proposals voting, operator hiring, milestone review and reputation resist unauthorized writes',async()=>{
 const {db,act}=await setup();
 try{
 await act(member);
 const {rows:[idea]}=await db.query(`insert into community_proposals(author_id,title,problem,solution,success_criteria,category) values ($1,'Accessible player','Keyboard users need better controls','Add focus management and accessible labels','All controls work with keyboard','accessibility') returning id`,[member]);
 await db.query('insert into proposal_votes(proposal_id,voter_id) values ($1,$2)',[idea.id,member]);
 await assert.rejects(db.query('insert into proposal_votes(proposal_id,voter_id) values ($1,$2)',[idea.id,member]),/duplicate key/);
 await assert.rejects(db.query(`update community_proposals set status='accepted' where id=$1 returning id`,[idea.id]).then(r=>{if(!r.rows.length)throw new Error('denied');}),/denied/);
 await assert.rejects(db.query('insert into proposal_operators(user_id) values ($1)',[member]),/permission denied/);
 await act(fresh);
 await assert.rejects(db.query('insert into proposal_votes(proposal_id,voter_id) values ($1,$2)',[idea.id,fresh]),/row-level security/);
 await act(operator);
 await db.query(`update community_proposals set status='accepted',review_note='Accepted for an accessibility improvement pilot' where id=$1`,[idea.id]);
 const {rows:[project]}=await db.query(`insert into proposal_projects(proposal_id,operator_id,brief,budget_cents,deadline) values ($1,$2,'Implement accessible player controls and verify keyboard operation',10000,now()+interval '2 days') returning id`,[idea.id,operator]);
 const {rows:[milestone]}=await db.query(`insert into project_milestones(project_id,title,acceptance_criteria,amount_cents) values ($1,'Accessible controls','Keyboard navigation and screen reader labels pass review',10000) returning id`,[project.id]);
 await assert.rejects(db.query(`insert into project_milestones(project_id,title,acceptance_criteria,amount_cents) values ($1,'Extra feature','An extra feature outside the budget',100)`,[project.id]),/exceed project budget/);
 await act(developer);
 await db.query(`insert into developer_applications(project_id,developer_id,plan,portfolio_url) values ($1,$2,'Implement keyboard navigation with clear focus states','https://github.com/example/developer')`,[project.id,developer]);
 await act(member);
 assert.equal((await db.query('select * from developer_applications')).rows.length,0);
 await act(operator);
 await db.query('update proposal_projects set developer_id=$1 where id=$2',[developer,project.id]);
 await assert.rejects(db.query(`update community_proposals set status='shipped',review_note='Trying to ship before completing any milestones' where id=$1`,[idea.id]),/Accept all/);
 await act(developer);
 await assert.rejects(db.query(`update project_milestones set status='accepted',quality_score=5 where id=$1`,[milestone.id]),/Submit a pull request/);
 await assert.rejects(db.query(`update project_milestones set amount_cents=100000 where id=$1`,[milestone.id]),/permission denied/);
 await db.query(`update project_milestones set status='submitted',pull_request_url='https://github.com/example/repo/pull/1',delivery_notes='Keyboard checks passed' where id=$1`,[milestone.id]);
 await act(operator);
 await db.query(`update project_milestones set status='revision',review_note='Please include visible focus on the volume control' where id=$1`,[milestone.id]);
 await act(developer);
 await db.query(`update project_milestones set status='submitted',delivery_notes='Added volume focus styling and retested' where id=$1`,[milestone.id]);
 await act(operator);
 await db.query(`update project_milestones set status='accepted',quality_score=4,review_note='Keyboard and screen reader checks passed the acceptance criteria' where id=$1`,[milestone.id]);
 const {rows:[rep]}=await db.query('select * from developer_reputation');
 assert.equal(rep.accepted_milestones,1);assert.equal(rep.developer_id,developer);assert.equal(Number(rep.average_quality),4);assert.equal(Number(rep.approved_fees_cents),10000);
 await assert.rejects(db.query(`update project_milestones set quality_score=5 where id=$1`,[milestone.id]),/Only submitted/);
 await db.query(`update community_proposals set status='shipped',review_note='All milestones accepted and release reviewed' where id=$1`,[idea.id]);
 await db.exec('reset role;set role anon');
 await assert.rejects(db.query('select * from community_proposals'),/permission denied/);
 }finally{await db.close();}
});
