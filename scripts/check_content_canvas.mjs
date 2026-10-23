import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {contentDimensions,contentPreview,contentCategories,contentSourceIndex,contentCategoryRows,contentSourcePair,
  validateContentState,validateContentRows,layoutContentUnits,contentRequestsURL,renderContentCanvas} from '../website/content-canvas.js';

const root=new URL('../website/data/',import.meta.url),read=path=>JSON.parse(readFileSync(new URL(path,root),'utf8'));
const audit=read('relational_v2.json'),summary=audit.summary,rows=audit.rows;
const sources=contentSourceIndex([read('topic_source_texts.json'),read('source_texts.json')]);
assert.ok(validateContentRows(summary,rows));
assert.equal(rows.length,2000);assert.equal(rows.filter(row=>row.primary_status==='labeled').length,1998);
assert.equal(rows.filter(row=>row.primary_status==='input_limit').length,2);
assert.equal(summary.relational_mode_counts.unclear,23);
assert.equal(rows.filter(row=>row.relational_mode==='unclear'&&row.primary_status==='labeled').length,21);
assert.equal(summary.relational_mode_counts.social_participation+summary.relational_mode_counts.described_hypothetical+summary.relational_mode_counts.personal_help,225);
assert.equal(summary.relational_mode_counts.personal_help,31);

const overlap=rows.filter(row=>sources.has(row.row_index));
assert.equal(overlap.length,38);
assert.deepEqual(Object.fromEntries(['none','personal_help','social_participation','described_hypothetical','unclear'].map(key=>[key,overlap.filter(row=>row.relational_mode===key).length])),
  {none:4,personal_help:31,social_participation:2,described_hypothetical:1,unclear:0});
for(const row of overlap){
  const pair=contentSourcePair(row,sources),source=sources.get(row.row_index);
  assert.equal(pair.status,'available');assert.strictEqual(pair.source,source);
  assert.equal(pair.requestIndex,row.evidence_message_index);
  assert.strictEqual(pair.request,source.messages[row.evidence_message_index]);
  assert.equal(pair.request.role,'user');assert.equal(pair.reply.role,'assistant');
  assert.equal(pair.replyIndex,row.evidence_message_index+1,'All actual published pairs have the immediate following assistant');
  assert.equal(source.source_text_sha256,row.source_text_sha256);
}
const later=rows.find(row=>row.row_index===21520);
assert.equal(later.evidence_message_index,6);
assert.equal(contentSourcePair(later,sources).requestIndex,6,'Use the labeled request, not the first user message');
assert.notStrictEqual(contentSourcePair(later,sources).request,sources.get(21520).messages[0]);
assert.equal(contentSourcePair(rows.find(row=>!sources.has(row.row_index)),sources).status,'not_published');
assert.equal(contentSourcePair({...later,evidence_message_index:null},sources).status,'invalid_evidence');
assert.equal(contentSourcePair({...later,evidence_message_index:7},sources).status,'invalid_evidence');
assert.equal(contentSourcePair({...later,source_text_sha256:'mismatch'},sources).status,'source_mismatch');
assert.equal(contentSourcePair({...later,primary_status:'input_limit'},sources).status,'not_labeled');

for(const dimension of Object.keys(contentDimensions)){
  const categories=contentCategories(summary,dimension);
  assert.equal(categories.reduce((total,category)=>total+category.count,0),2000);
  assert.equal(new Set(categories.flatMap(category=>contentCategoryRows(rows,dimension,category.id)).map(row=>row.row_index)).size,2000);
  for(const [width,height] of [[820,420],[350,340]]){
    const layout=layoutContentUnits(rows,summary,dimension,{width,height});
    assert.equal(layout.points.length,2000);assert.equal(new Set(layout.points.map(point=>point.id)).size,2000);
    assert.ok(layout.points.every(point=>Number.isFinite(point.x)&&Number.isFinite(point.y)&&point.x>0&&point.x<width&&point.y>0&&point.y<height));
    assert.equal(layout.points.filter(point=>point.row.primary_status==='input_limit').length,2);
  }
}
assert.equal(validateContentState(summary,{}).selected,'none');
assert.equal(validateContentState(summary,{dimension:'not_a_dimension',selected:'not_a_category'}).dimension,'relational_mode_counts');
const actual=validateContentState(summary,{dimension:'relational_mode_counts',selected:'none',record:2971191},rows);
assert.equal(actual.selected,'personal_help');assert.equal(actual.record,2971191,'Requested actual record determines its real category');
assert.equal(validateContentState(summary,{record:999999999},rows).record,999999999,'Missing requested record must not silently select another');
assert.equal(validateContentState(summary,{record:'invalid'}).record,null);
assert.throws(()=>contentCategories({...summary,n:1998}),/denominator/);
assert.throws(()=>validateContentRows(summary,rows.slice(1)),/membership/);
const bad=structuredClone(summary);bad.relational_mode_counts.none--;
assert.throws(()=>contentCategories(bad),/denominator/);

const url=contentRequestsURL({dimension:'relational_mode_counts',selected:'personal_help',record:2971191},'#content?dimension=relational_mode_counts&label=personal_help');
assert.ok(url.startsWith('atlas.html?hub='));
const query=new URLSearchParams(url.split('#audit?')[1]);
assert.equal(query.get('relational_mode'),'personal_help');assert.equal(query.get('record'),'2971191');
assert.equal(contentPreview('😀👨‍👩‍👧‍👦a',1).text,'😀');
assert.equal(contentPreview('😀👨‍👩‍👧‍👦a',2).text,'😀👨‍👩‍👧‍👦');
assert.equal(contentPreview('😀',1).truncated,false);
const html=renderContentCanvas(summary,{selected:'personal_help'});
assert.ok(html.includes('2,000 sampled records'));assert.ok(html.includes('1,998 AI-classified'));assert.ok(html.includes('2 input-limit cases'));assert.ok(html.includes('no human validation'));
assert.ok(html.includes('data-cc-selected="personal_help"'));assert.ok(!html.includes('AI reason'));
console.log('Content canvas passed: 2,000 actual units, 38 exact source overlaps, evidence-index Q/A pairing, 1,998 labels + 2 input-limit cases, all category totals, mobile layout and validated navigation state.');
