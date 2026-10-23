import fs from 'node:fs';
import assert from 'node:assert/strict';
import {comparisonRows,scopeComparison} from '../website/scope-comparison.js';
const v=JSON.parse(fs.readFileSync(new URL('../website/data/validation.json',import.meta.url)));
for(const dimension of ['language','model_family','turn_bucket'])for(const scope of ['original','random']){
 const rows=comparisonRows(v,dimension,scope);
 assert.equal(rows.reduce((n,r)=>n+r.count,0),v.scopes[scope].n);
 assert.ok(Math.abs(rows.reduce((n,r)=>n+r.delta,0))<1e-10);
 assert.ok(Math.abs(rows.reduce((n,r)=>n+r.samplePct,0)-100)<1e-10);
 const html=scopeComparison(v,dimension,scope,{all:true,href:r=>'atlas.html#'+encodeURIComponent(r.key)});
 assert.ok(html.includes('20,000 records'));assert.ok(html.includes('3,199,860 records'));
 assert.equal((html.match(/class="comparison-row"/g)||[]).length,rows.length);
 assert.ok(!html.includes('NaN'));assert.ok(html.includes(' pp'));
}
const f=comparisonRows(v,'language','original').find(r=>r.label==='French');
assert.ok(Math.abs(f.delta-(-1.21))<.01);
assert.throws(()=>comparisonRows(v,'language','census'));
assert.throws(()=>comparisonRows(v,'intent','random'));
console.log('Scope comparison: denominators, deltas and supported measures pass.');
