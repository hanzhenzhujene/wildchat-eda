import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {overviewCanvas,overviewComposition,roundedSquares,mountOverviewCanvas} from '../website/overview-canvas.js';
const read=async p=>JSON.parse(await readFile(new URL('../website/data/'+p,import.meta.url),'utf8'));
const validation=await read('validation.json'),topics=await read('microsoft_topics.json'),audit=await read('relational_v2/summary.json');
const data={validation,topics,audit};
for(const mode of ['turns','tasks','topics']){
 const s=overviewComposition(data,mode);
 assert.equal(s.denominator,3199860);
 assert.equal(s.rows.reduce((sum,r)=>sum+r.count,0),3199860);
 assert.equal(s.rows.reduce((sum,r)=>sum+r.squares,0),1000);
 assert.ok(s.rows.length<=7);
 for(const row of s.rows){assert.ok(Math.abs(row.squares-row.count/s.denominator*1000)<1);assert.ok(row.href.startsWith('#distributions?chart='));}
 if(mode!=='turns'){
  const original=mode==='tasks'?topics.intents:topics.domains;
  for(const row of s.rows.filter(x=>!x.aggregate))assert.equal(row.count,original.find(r=>r.id===row.id).count);
  assert.equal(s.sourceLabel,'Microsoft AI-assigned labels');
 }
}
assert.deepEqual(roundedSquares([{count:1},{count:1},{count:1}],3),[334,333,333]);
assert.throws(()=>overviewComposition({...data,validation:{scopes:{census:{n:100,one_n:101}}}},'turns'));
let examples=0,scopes=0;
const html=overviewCanvas({...data,examples:[{user:'a'},{user:'b'},{user:'c'}],atlas:path=>'atlas.html#'+path,example:x=>{examples++;return '<article>source '+x.user+'</article>';},scopeTable:()=>{scopes++;return '<table id="scope-table"></table>';}});
assert.equal((html.match(/<rect /g)||[]).length,1000);
assert.equal((html.match(/data-overview-mode=/g)||[]).length,3);
assert.equal(examples,2);assert.equal(scopes,1);
assert.match(html,/Squares are not individual conversations/);
assert.match(html,/3,199,860 released records/);
assert.match(html,/10,334,364/);assert.match(html,/source-language labels/);
assert.match(html,/31 \/ 2,000/);
assert.match(html,/<details class="ov-scope-details">/);
assert.ok(html.includes('methods?source=topics')&&html.includes('methods?source=validation')&&html.includes('methods?source=audit'));
const hostile={...topics,domains:topics.domains.map((r,i)=>i? r:{...r,label:'<script>bad()</script>'})};
const safe=overviewCanvas({...data,topics:hostile});assert.ok(!safe.includes('<script>'));assert.ok(safe.includes('&lt;script&gt;'));
let add=0,remove=0,listener;
const target={innerHTML:'',dataset:{}};
const controls=['turns','tasks','topics'].map(mode=>({dataset:{overviewMode:mode},classList:{toggle(){}},setAttribute(k,v){this[k]=v;}}));
const root={addEventListener(name,fn){add++;listener=fn;},removeEventListener(){remove++;},contains:()=>true,querySelector:()=>target,querySelectorAll:()=>controls};
const cleanup=mountOverviewCanvas(root,data);assert.equal(mountOverviewCanvas(root,data),cleanup);assert.equal(add,1);
listener({target:{closest:()=>controls[1]}});
assert.equal(target.dataset.mode,'tasks');assert.equal(controls[1]['aria-pressed'],'true');assert.equal(controls[0]['aria-pressed'],'false');assert.equal((target.innerHTML.match(/<rect /g)||[]).length,1000);assert.match(target.innerHTML,/Microsoft AI-assigned labels/);
cleanup();assert.equal(remove,1);
console.log('PASS: exact scope/counts, 1,000 rounded-share squares in all modes, source links, original examples, escaping and idempotent interactive controls.');
