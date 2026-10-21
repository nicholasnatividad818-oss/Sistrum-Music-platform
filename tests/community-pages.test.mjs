import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
const directory=mkdtempSync(join(tmpdir(),'sistrum-pages-'));
const output=join(directory,'pages.cjs');
await build({stdin:{contents:`import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {ProposalsView} from './src/components/ProposalsView'; import {CommunityView} from './src/components/CommunityView'; import {Navbar} from './src/components/Navbar'; export function renderProposal(){return renderToStaticMarkup(React.createElement(ProposalsView,{user:null,onSignIn:()=>{}}));} export function renderCommunity(){return renderToStaticMarkup(React.createElement(CommunityView,{user:null,onSignIn:()=>{}}));} export function renderNavigation(){return renderToStaticMarkup(React.createElement(Navbar,{activeTab:'community',onSelectTab:()=>{},searchQuery:'',onSearchChange:()=>{},onOpenUpload:()=>{},onOpenArtistProfile:()=>{},onOpenTrackDetail:()=>{},searchResults:{tracks:[],artists:[]},user:null,profile:null,onOpenAuth:()=>{},onSignOut:async()=>{},onDeleteAccount:()=>{}}));}`,resolveDir:process.cwd(),loader:'tsx'},outfile:output,bundle:true,platform:'node',format:'cjs',plugins:[{name:'stub-backend',setup(build){build.onResolve({filter:/lib\/supabase$/},()=>({path:'supabase',namespace:'stub'}));build.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export const supabase = {};'}));}}]});
const pages=createRequire(import.meta.url)(output);
test('community and proposal page shells render with sign-in and clear payment boundaries',()=>{
 assert.match(pages.renderProposal(),/Sistrum Proposals/);
 assert.match(pages.renderProposal(),/Payment processing is not connected/);
 assert.match(pages.renderCommunity(),/voice coaches/);
 assert.match(pages.renderCommunity(),/Sign in to join/);
 const navigation=pages.renderNavigation();assert.match(navigation,/Community tools/);assert.match(navigation,/proposals/);assert.match(navigation,/community/);
});
process.on('exit',()=>rmSync(directory,{recursive:true,force:true}));
