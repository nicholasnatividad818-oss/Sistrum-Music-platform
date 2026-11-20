import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/services/walletConnect.ts'],bundle:true,write:false,platform:'node',format:'esm',packages:'external',define:{'import.meta.env':'{}'}});
const {walletConnectConfig,readWalletAccount}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
test('missing or malformed project ID disables wallet connection',()=>{for(const id of ['',undefined,'fake','<script>'])assert.equal(walletConnectConfig({VITE_WALLETCONNECT_PROJECT_ID:id}),null)});
test('valid public project ID enables Ethereum connection',()=>{const config=walletConnectConfig({VITE_WALLETCONNECT_PROJECT_ID:'a'.repeat(32)});assert.equal(config.projectId,'a'.repeat(32));assert.deepEqual(config.chains,[1])});
test('empty, malformed and unsupported accounts do not appear connected',()=>{for(const accounts of [[],null,['wrong'],['0x123']])assert.equal(readWalletAccount(accounts),null);assert.equal(readWalletAccount(['0x'+'1'.repeat(40)]),'0x'+'1'.repeat(40))});

test('project ID whitespace is normalized without accepting executable text',()=>{assert.equal(walletConnectConfig({VITE_WALLETCONNECT_PROJECT_ID:'  '+'b'.repeat(32)+'  '}).projectId,'b'.repeat(32));assert.equal(walletConnectConfig({VITE_WALLETCONNECT_PROJECT_ID:'b'.repeat(32)+'?redirect=evil'}),null)});

test('approval after leaving page closes the late session',async()=>{
 const {connectWalletSession}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
 let approve;let active=true;let connected=false;
 const provider={chainId:1,accounts:['0x'+'1'.repeat(40)],connect:()=>new Promise(resolve=>{approve=()=>{connected=true;resolve()}}),disconnect:async()=>{connected=false}};
 const pending=connectWalletSession(provider,()=>active);active=false;approve();assert.equal(await pending,null);assert.equal(connected,false);
});
