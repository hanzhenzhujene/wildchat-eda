import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {linkageCanvasModel,linkageCanvasSelection,renderLinkageCanvas,mountLinkageCanvas} from '../website/linkage-canvas.js';
const data=JSON.parse(await readFile(new URL('../website/data/public-hub/linkage.json',import.meta.url),'utf8'));
const m=linkageCanvasModel(data);
assert.equal(m.excludedRows,367603);
assert.equal(m.denominators.span,156930);assert.equal(m.denominators.volume,1921755);
assert.equal(m.bins.reduce((sum,x)=>sum+x.count,0),156930);
assert.equal(m.volume.reduce((sum,x)=>sum+x.count,0),1921755);
assert.equal(m.volume.reduce((sum,x)=>sum+x.rows,0),2832257);
const expected={all:156930,day1:57722,day7:26888,day30:5844,day90:1687,day365:66,dates3span30:4602};
for(const [id,count] of Object.entries(expected)){
 const s=linkageCanvasSelection(m,{view:'span',selected:id});assert.equal(s.current.count,count);assert.equal(s.share,count/156930);
 if(id==='dates3span30'){assert.deepEqual(s.selectedIds,[]);assert.equal(s.datedSubset,true);}
 else assert.equal(m.bins.filter(x=>s.selectedIds.includes(x.id)).reduce((sum,x)=>sum+x.count,0),count,'Highlighted exact bins sum to the chosen threshold');
}
for(const bin of m.bins){const s=linkageCanvasSelection(m,{selected:bin.id});assert.equal(s.current.count,bin.count);assert.equal(s.exactBin,true);assert.deepEqual(s.selectedIds,[bin.id]);}
for(const bin of m.volume){const s=linkageCanvasSelection(m,{view:'volume',selected:bin.id});assert.equal(s.current.count,bin.count);assert.equal(s.denominator,1921755);}
assert.equal(linkageCanvasSelection(m,{view:'unknown',selected:'unknown'}).selected,'day30');
assert.equal(linkageCanvasSelection(m,{view:'volume',selected:'day30'}).selected,'2–5');
const html=renderLinkageCanvas(data,{view:'span',selected:'dates3span30'});
for(const value of ['3,199,860','2,832,257','1,921,755','156,930','367,603','4,602','4.3 hours','66'])assert.ok(html.includes(value),value);
assert.equal((html.match(/data-lc-bin=/g)||[]).length,7);
assert.match(html,/3\+ dates subset/);assert.match(html,/only aggregates are public/);
assert.ok(!html.includes('href="atlas.html'),'No actual conversation links invented');
assert.match(html,/<details class="lc-methods">/);
const volume=renderLinkageCanvas(data,{view:'volume',selected:'2–5'});assert.equal((volume.match(/data-lc-bin=/g)||[]).length,5);assert.match(volume,/327,805 records/);
const untrusted={...data,revision:'<script>bad()</script>',limits:['<img src=x onerror=bad()>'],source_url:'javascript:bad()'};
const safe=renderLinkageCanvas(untrusted);assert.ok(!safe.includes('<script>'));assert.ok(safe.includes('&lt;script&gt;'));assert.ok(!safe.includes('javascript:'));
const invalid=structuredClone(data);invalid.span_distribution[0].groups++;assert.throws(()=>linkageCanvasModel(invalid));
// Minimal event surface verifies native keyboard handling, callback state and
// cleanup/idempotence without requiring a renderer-specific DOM library.
let calls=0,removed=0,focused=0;const listeners={},workspace={innerHTML:'',querySelector:()=>({focus(){focused++;}}),querySelectorAll:()=>[]};
const container={dataset:{lcCurrentView:'span',lcCurrentSelection:'day30'},contains:()=>true,querySelector:()=>workspace,addEventListener(name,fn){calls++;listeners[name]=fn;},removeEventListener(){removed++;}};
let latest;const cleanup=mountLinkageCanvas(container,data,{onChange:s=>latest=s});assert.equal(mountLinkageCanvas(container,data,{onChange:s=>latest=s}),cleanup);assert.equal(calls,3);
listeners.change({target:{matches:()=>true,value:'day365'}});assert.deepEqual(latest,{view:'span',selected:'day365'});assert.equal(focused,1);
let prevented=false;listeners.keydown({key:'Enter',preventDefault(){prevented=true;},target:{closest:()=>({dataset:{lcBin:'bin:1–6 days'}})}});assert.equal(prevented,true);assert.deepEqual(latest,{view:'span',selected:'bin:1–6 days'});
listeners.click({target:{closest:selector=>selector==='[data-lc-view]'?{dataset:{lcView:'volume'}}:null}});assert.deepEqual(latest,{view:'volume',selected:'2–5'});
cleanup();assert.equal(removed,3);
// Compact SVG uses one keyboard target per bin, with readable labels/counts
// above each bar. Orientation changes redraw only across the breakpoint.
let mediaListener,mediaAdds=0,mediaRemoves=0;
const media={matches:true,addEventListener(name,fn){assert.equal(name,'change');mediaAdds++;mediaListener=fn;},removeEventListener(name,fn){assert.equal(name,'change');assert.equal(fn,mediaListener);mediaRemoves++;}};
globalThis.matchMedia=()=>media;
const compact=renderLinkageCanvas(data);
assert.match(compact,/class="lc-histogram compact" viewBox="0 0 430 /);
assert.equal((compact.match(/data-lc-bin=/g)||[]).length,7,'Mobile does not duplicate chart controls');
assert.match(compact,/class="lc-bar-count" x="418" y="31" text-anchor="end"/);
assert.match(compact,/style="font-size:18px"/);
let resized=0;
const mobileContainer={...container,dataset:{lcCurrentView:'span',lcCurrentSelection:'day30'}};
const mobileCleanup=mountLinkageCanvas(mobileContainer,data,{onChange:()=>resized++});
assert.equal(mediaAdds,1);
mediaListener({matches:true});assert.equal(resized,0,'No redraw within the same mode');
media.matches=false;mediaListener({matches:false});assert.equal(resized,1);assert.match(workspace.innerHTML,/viewBox="0 0 850 /);
media.matches=true;mediaListener({matches:true});assert.equal(resized,2);assert.match(workspace.innerHTML,/viewBox="0 0 430 /);
mobileCleanup();assert.equal(mediaRemoves,1);delete globalThis.matchMedia;
console.log('PASS: saved counts/thresholds, exact-bin state, denominators, no invented joint filters/examples, escaping, keyboard/focus, compact SVG and resize cleanup.');
