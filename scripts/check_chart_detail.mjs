#!/usr/bin/env node
/** Check source fidelity, lazy requests, escaping, retry and event lifecycle. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createChartDetailController,resolveChartSelection,chartLabelAttributes} from '../website/chart-detail.js';
const root=new URL('../website/',import.meta.url);
const read=async name=>JSON.parse(await readFile(new URL(name,root),'utf8'));
const topics=await read('data/microsoft_topics.json');
const source=await read('data/topic_source_texts.json');
const registry=new Map(source.records.map(r=>[r.row_index,r]));
assert.equal(topics.examples.length,41);
for(const e of topics.examples){
 const s=resolveChartSelection(topics,e.kind,e.id,registry);
 assert.ok(s,`label ${e.kind}/${e.id} exists`);
 assert.equal(s.question,s.record.messages[e.user_message_index].content);
 assert.equal(s.response,s.record.messages[e.reply_message_index].content);
 assert.equal(s.denominator,3199860);
 assert.ok(s.question!==null&&s.response!==null,`original pair ${e.row_index} available`);
}
assert.equal(resolveChartSelection(topics,'domain','unknown',registry),null);
assert.ok(chartLabelAttributes('topic','a"<').includes('a&quot;&lt;'));
assert.throws(()=>chartLabelAttributes('arbitrary','x'),TypeError);
let calls=[];
const details=createChartDetailController({topics,fetchImpl:async path=>{calls.push(path);return {ok:true,json:async()=>source};}});
assert.equal(calls.length,0,'no text fetched during controller creation');
assert.match(details.renderHTML(),/Select a bar/);
await details.load('domain','gaming');
await details.load('intent','text_generation');
assert.equal(calls.length,1,'saved source shared across labels');
const gaming=resolveChartSelection(topics,'domain','gaming',registry),html=details.renderHTML('domain','gaming');
assert.ok(html.includes(gaming.question.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')));
assert.match(html,/Deliberately chosen; not a random sample/);
assert.match(html,/Recorded output; not a reference answer/);
assert.match(html,/view=topic&amp;label=gaming/);
assert.ok(!html.includes('Direct question about a named video game.'),'editorial selection note is not substituted for source');
const hostileTopics={scope:{denominator:1},domains:[{id:'x',label:'<img onerror=bad()>',count:1,definition:'<script>bad()</script>'}],intents:[],examples:[{kind:'domain',id:'x',row_index:0,user_message_index:0,reply_message_index:1}]};
const hostileSource={records:[{row_index:0,source_language:'English',model:'test',messages:[{role:'user',content:'<script>alert(1)</script>'},{role:'assistant',content:'x'.repeat(500)}]}]};
const x=createChartDetailController({topics:hostileTopics,fetchImpl:async()=>({ok:true,json:async()=>hostileSource})});await x.load('domain','x');const escaped=x.renderHTML();assert.ok(!escaped.includes('<script>'));assert.ok(escaped.includes('&lt;script&gt;'));assert.match(escaped,/<details><summary>Read full response/);
let failures=0;
const retry=createChartDetailController({topics,fetchImpl:async()=>++failures===1?{ok:false}:{ok:true,json:async()=>source}});
await assert.rejects(retry.load('domain','gaming'));
assert.match(retry.renderHTML(),/Try again/);
await retry.load('domain','gaming');assert.equal(failures,2);assert.doesNotMatch(retry.renderHTML(),/Try again/);
let events=0,removed=0;
const container={addEventListener(){events++},removeEventListener(){removed++},querySelectorAll(){return []}};
const cleanup=details.bind(container);assert.equal(details.bind(container),cleanup);assert.equal(events,1,'binding twice adds one listener');cleanup();assert.equal(removed,1);details.bind(container);assert.equal(events,2,'cleanup permits rebinding');
console.log('PASS: 41 exact original-source pairs; lazy shared fetch; safe escaping; retry; idempotent event binding.');
