import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/services/artistRewards.ts'],bundle:true,write:false,format:'esm'});
const {rewardPoolCents}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
test('reward pool uses realized profit, respects cap and subtracts existing awards',()=>{
 assert.equal(rewardPoolCents(200000,50000),20000);
 assert.equal(rewardPoolCents(1000000,50000,10000),40000);
 assert.equal(rewardPoolCents(-10000,50000),0);
 assert.equal(rewardPoolCents(200000,50000,30000),0);
 assert.throws(()=>rewardPoolCents(NaN,100));
 assert.throws(()=>rewardPoolCents(100,-1));
});
