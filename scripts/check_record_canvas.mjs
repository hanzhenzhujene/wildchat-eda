import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {unpackCanvasRecords, storedTurnBucket, groupCanvasRecords, canvasSourceIndex, canvasSourcePair,
  filterCanvasRecords, layoutCanvasRecords, canvasAtlasURL, renderRecordCanvas} from '../website/record-canvas.js';

const root=new URL('../website/data/',import.meta.url);
const read=path=>JSON.parse(readFileSync(new URL(path,root),'utf8'));
const records=unpackCanvasRecords(read('records.json'));
const sources=canvasSourceIndex([read('topic_source_texts.json'),read('source_texts.json')]);
assert.equal(records.length,20000);assert.equal(new Set(records.map(row=>row.row_index)).size,20000);
assert.equal(sources.size,77);
const defaults={group:'turn_bucket',color:'model_family',filter:'',withText:false,selected:null,search:''};
assert.equal(filterCanvasRecords(records,defaults,sources).length,20000);
const withText=filterCanvasRecords(records,{...defaults,withText:true},sources);
assert.equal(withText.length,33,'Only the exact metadata/source overlap may appear in original-text mode');
assert.ok(withText.every(row=>sources.has(row.row_index)));
assert.equal(filterCanvasRecords(records,{...defaults,search:'286012'},sources)[0].row_index,286012);
assert.equal(filterCanvasRecords(records,{...defaults,search:'28601'},sources).length,0,'Record-ID search is exact, not a substitute record');
assert.equal(filterCanvasRecords(records,{...defaults,search:'1e3'},sources).length,0);
assert.equal(filterCanvasRecords(records,{...defaults,search:'not an ID'},sources).length,0);
assert.equal(filterCanvasRecords(records,{...defaults,color:'year',filter:'2023'},sources).length,3700);
assert.equal(filterCanvasRecords(records,{...defaults,color:'turn_bucket',filter:'1'},sources).length,16599);
assert.deepEqual([1,2,3,4,5,6,10,11,500].map(storedTurnBucket),['1','2','3','4–5','4–5','6–10','6–10','11+','11+']);
assert.ok(!Object.hasOwn(records[0],'topic')&&!Object.hasOwn(records[0],'task'),'No full-corpus semantic label is imputed onto the metadata sample');

for(const field of ['year','model_family','turn_bucket']) {
  const groups=groupCanvasRecords(records,field);
  assert.equal(groups.reduce((sum,group)=>sum+group.count,0),20000);
  assert.equal(new Set(groups.flatMap(group=>group.rows.map(row=>row.row_index))).size,20000);
  for(const [width,height] of [[860,480],[360,400]]) {
    const layout=layoutCanvasRecords(records,{width,height,group:field});
    assert.equal(layout.points.length,20000);
    assert.equal(new Set(layout.points.map(point=>point.id)).size,20000);
    assert.ok(layout.size>0&&Number.isFinite(layout.size));
    assert.ok(layout.points.every(point=>Number.isFinite(point.x)&&Number.isFinite(point.y)&&point.x>=0&&point.x<=width&&point.y>=0&&point.y<=height),'Every actual record fits inside the canvas');
    assert.equal(layout.panels.reduce((sum,panel)=>sum+panel.count,0),20000);
  }
}
assert.equal(layoutCanvasRecords([]).points.length,0);
assert.throws(()=>groupCanvasRecords(records,'topic'),/Unsupported/);
assert.throws(()=>unpackCanvasRecords({columns:['row_index'],rows:[[1],[1]]}),/repeated/);

for(const row of withText) {
  const pair=canvasSourcePair(row.row_index,sources),original=sources.get(row.row_index);
  assert.strictEqual(pair.source,original);
  assert.equal(pair.userIndex,original.messages.findIndex(message=>message.role==='user'));
  assert.strictEqual(pair.user,original.messages[pair.userIndex]);
  if(pair.replyIndex>=0) {
    assert.equal(pair.reply.role,'assistant');assert.ok(pair.replyIndex>pair.userIndex);
    assert.strictEqual(pair.reply,original.messages[pair.replyIndex]);
  }
}
assert.equal(canvasSourcePair(4595,sources),null,'An absent source never falls back to another record');
const missing=canvasSourcePair(7,new Map([[7,{row_index:7,messages:[{role:'user',content:'Only a user message.'}]}]]));
assert.equal(missing.reply,null);assert.equal(missing.replyIndex,-1);
const row=records.find(row=>row.row_index===286012);
const href=canvasAtlasURL(row,records,'#distributions?chart=records&group=year');
assert.ok(href.startsWith('atlas.html?hub='));assert.ok(href.endsWith('#cases?record=286012'));
const ordinary=records.find(row=>row.row_index===4595),metadataURL=canvasAtlasURL(ordinary,records);
assert.ok(metadataURL.includes('view=records'));assert.ok(metadataURL.includes('sort=row_index'));assert.ok(metadataURL.includes('page=1'));
const html=renderRecordCanvas();assert.ok(html.includes('data-record-canvas'));assert.ok(html.includes('With original text'));assert.ok(html.includes('do not show semantic similarity'));
console.log('Record canvas passed: 20,000 unique marks, 33 exact source overlaps, metadata partitions, mobile/desktop layouts, scoped filters and exact Q/A pairing.');
