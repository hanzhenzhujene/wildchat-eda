import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const root=path.resolve(import.meta.dirname,'../website');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const V=read('data/validation.json'),T=read('data/microsoft_topics.json');
const R=read('data/relational_v2/summary.json'),F=read('data/public-hub/figures.json');
const L=read('data/public-hub/linkage.json'),B=read('data/public-hub/literature.json');
const revision='c827c6df8fcf008219ffaffa4d1dd77491099367',N=3199860;
assert.equal(V.source.revision,revision);assert.equal(V.scopes.census.n,N);
assert.equal(T.scope.denominator,N);assert.equal(R.n,2000);assert.equal(R.human_validated_n,0);
for(const [key,rows] of Object.entries(V.categories)){
 for(const s of ['census','original','random'])assert.equal(rows.reduce((n,r)=>n+r[s].count,0),V.scopes[s].n,`${key}/${s}`);
}
for(const rows of [T.domains,T.intents])assert.equal(rows.reduce((n,r)=>n+r.count,0),N);
for(const field of ['purpose_counts','relational_mode_counts','packaging_counts'])assert.equal(Object.values(R[field]).reduce((a,b)=>a+b,0),2000);
assert.equal(L.totals.rows,N);assert.equal(L.linkage_keys_published,false);
assert.equal(L.span_distribution.reduce((n,r)=>n+r.groups,0),L.repeated_key_groups.groups);
assert.equal(L.records_per_key_distribution.reduce((n,r)=>n+r.groups,0),L.totals.complete_keys);
assert.equal(F.length,24);
for(const f of F){
 for(const k of ['id','title','scope','source','takeaway','denominator'])assert.ok(f[k],`${f.id}: missing ${k}`);
 for(const k of ['file','svg'])if(f[k])assert.ok(fs.existsSync(path.join(root,f[k].replace(/^\//,''))),`${f.id}: missing ${k}`);
 if(f.explorer_href){assert.match(f.explorer_href,/^\/atlas\.html#/);const q=new URL(f.explorer_href,'https://example.test').hash.split('?')[1];const view=new URLSearchParams(q).get('view');if(view)assert.ok(['topic','task','composition','exchange','length','quality','records','charts'].includes(view),`${f.id}: invalid view ${view}`)}
}
for(const id of ['archive_09_request_purpose','archive_10_purpose_packaging','archive_11_relational_modes']){const f=F.find(f=>f.id===id);if(f)assert.equal(f.denominator,120)}
assert.ok(B.datasets.find(d=>d.id==='prism').linkage.includes('user_id'));
assert.ok(B.datasets.find(d=>d.id==='ultrachat').kind==='Synthetic');
for(const d of [...B.datasets,...B.studies])for(const k of ['paper_url',...(d.card_url?['card_url']:[])])assert.ok(/^https:\/\//.test(d[k]),`${d.id} ${k}`);
for(const f of ['index.html','hub.js','hub.css','atlas.html','data/public-hub/figures.json','data/public-hub/linkage.json','data/public-hub/literature.json']){
 const text=fs.readFileSync(path.join(root,f),'utf8');assert.doesNotMatch(text,/localhost|127\.0\.0\.1|Bearer\s+[A-Za-z0-9]/i,`Public editorial text: ${f}`);
}
const pdf=fs.readFileSync(path.join(root,'assets/WildChat_Relational_EDA.pdf'));
assert.ok(pdf.length>1e6);assert.ok(pdf.subarray(0,4).toString()==='%PDF');
const M=read('data/source_metadata.json');assert.equal(M.public_catalog.sha256,createHash('sha256').update(pdf).digest('hex'));
assert.ok(fs.readFileSync(path.join(root,'hub.js'),'utf8').includes("sort((a,b)=>a.key.localeCompare(b.key))"),'Dates require chronological order');
assert.ok(!fs.readFileSync(path.join(root,'fit-flow.js'),'utf8').includes('github.com/hanzhenzhujene/'),'Public evidence links should be accessible');
console.log(JSON.stringify({status:'passed',release_rows:N,figures:F.length,dataset_snapshots:B.datasets.length,content_sample:R.n,human_validated_labels:R.human_validated_n,linkage_identifiers_published:L.linkage_keys_published,pdf_sha256:M.public_catalog.sha256},null,2));
