import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const dir=mkdtempSync(join(tmpdir(),'sistrum-wallet-'));
process.on('exit',()=>rmSync(dir,{recursive:true,force:true}));
for(const configured of [false,true]) {
 const output=join(dir,`${configured}.cjs`);
 await build({stdin:{contents:`import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {WalletConnectPanel} from './src/components/WalletConnectPanel'; export const render=()=>renderToStaticMarkup(React.createElement(WalletConnectPanel));`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'node',format:'cjs',outfile:output,external:['@walletconnect/ethereum-provider'],define:{'import.meta.env':JSON.stringify(configured?{VITE_WALLETCONNECT_PROJECT_ID:'a'.repeat(32)}:{})}});
 const {render}=createRequire(import.meta.url)(output);
 test(configured?'wallet panel explicitly distinguishes connection from payment':'unconfigured wallet panel is hidden',()=>{const html=render();if(!configured){assert.equal(html,'');return}assert.match(html,/Connect with WalletConnect/);assert.match(html,/Ethereum/);assert.match(html,/does not sign you in, send funds/);assert.doesNotMatch(html,/Connected:/)});
}
