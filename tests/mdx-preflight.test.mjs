import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareMdxCatalog } from '../integrations/mdx/prepare.mjs';

test('preflight normalizes ISRC and reports incomplete publishing metadata', () => {
  const [row] = prepareMdxCatalog([{title:'Example', artist_name:'NRN', isrc:'us-abc-26-00001'}]);
  assert.equal(row.isrc,'USABC2600001');
  assert.equal(row.status,'needs_review');
  assert.ok(row.warnings.includes('Missing publisher identity'));
});

test('blocks invalid identifiers and duplicate ISRCs', () => {
  const rows = prepareMdxCatalog([
    {title:'Example 1',artist_name:'NRN',isrc:'USABC2600001'},
    {title:'Example 2',artist_name:'NRN',isrc:'USABC2600001'},
    {title:'Example 3',artist_name:'NRN',isrc:'bad'},
  ]);
  assert.ok(rows[1].errors.some(e=>e.includes('Duplicate')));
  assert.ok(rows[2].errors.some(e=>e.includes('ISRC')));
});

test('rejects impossible shares without guessing composition ownership', () => {
  const [row] = prepareMdxCatalog([{title:'Example',artist_name:'NRN',isrc:'USABC2600002',publisher_share_percent:110}]);
  assert.equal(row.status,'blocked');
});

test('requires a catalog array', () => {
  assert.throws(()=>prepareMdxCatalog({}), TypeError);
});
