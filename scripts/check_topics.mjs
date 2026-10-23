import assert from 'node:assert/strict';
import {topicView,topicOverview,topicMethods,topicExample} from '../website/topics.js';
import {setSourceTexts} from '../website/source-text.js?v=topicsOct21b';

const data={
  source:{repo:'microsoft/example-fixture',revision:'abc123',url:'https://example.org/source',classifier_model:'Fixture classifier',classification_unit:'conversation',upstream_dataset:'fixture/upstream',label_status:'AI labels; these released labels have not been human-checked here.'},
  scope:{total_rows:100,rows:100,labeled_domain_rows:90,labeled_intent_rows:80,missing_domain_rows:10,missing_intent_rows:20,filters_applied:[],unit:'released conversation records'},
  domains:[{id:'health',label:'Health',count:60,share_pct:99,definition:'Questions about health.'},{id:'writing',label:'Writing',count:30,definition:'Supplied writing tasks.'},{id:'unclassified',label:'Unclassified',count:10}],
  intents:[{id:'advice',label:'Advice',count:50,definition:'Ask for advice.'},{id:'editing',label:'Editing',count:30},{id:'unclassified',label:'Unclassified',count:20}],
  examples:[{kind:'domain',id:'health',row_index:1,user_message_index:0,reply_message_index:1,selection_note:'Illustrative fixture only.'},{kind:'intent',id:'advice',row_index:2,user_message_index:0,reply_message_index:null}]
};
setSourceTexts({records:[{row_index:1,messages:[{role:'user',content:'Original fixture <script>doNotRun()</script>.'},{role:'assistant',content:'Source response & detail.'}]},{row_index:2,messages:[{role:'user',content:'Different task fixture.'},{role:'assistant',content:'Must not infer this explicit missing reply.'}]}]});

const topic=topicView(data,{kind:'domain',selected:'health'});
assert.ok(topic.includes('Topic distribution'));
assert.ok(topic.includes('Share of all 100 records'));
assert.ok(topic.includes('60%'),'Shares derive from count / all records, not supplied share_pct.');
assert.ok(!topic.includes('99%'));
assert.ok(topic.includes('style="width:60%"'));
assert.ok(topic.includes('unclassified / missing'));
assert.ok(topic.includes('data-value="unclassified"'));
assert.ok(topic.includes('All released rows; no additional filters.'));
assert.ok(topic.includes('data-action="topic-select" data-kind="domain" data-value="health"'));
assert.ok(topic.includes('id="topic-example"'));
assert.ok(!topic.includes('topic-example-label'));
assert.ok(topic.includes('Original fixture &lt;script&gt;doNotRun()&lt;/script&gt;.'));
assert.ok(!topic.includes('<script>'));
assert.ok(topic.includes('Source response &amp; detail.'));
assert.ok(topic.includes('Illustrative fixture only.'));
assert.ok(!topic.includes('Different task fixture.'));
assert.ok(topic.includes('including')||topic.includes('includes writing categories'));
assert.ok(topic.includes('have not been human-checked here'));
assert.ok(!topic.includes('No human validation'));

const task=topicView(data,{kind:'intent',selected:'advice'});
assert.ok(task.includes('Task distribution'));
assert.ok(task.includes('50%'));
assert.ok(task.includes('data-kind="intent"'));
assert.ok(task.includes('Different task fixture.'));
assert.ok(task.includes('No stored response is available'));
assert.ok(!task.split('<details class="source-conversation"')[0].includes('Must not infer this explicit missing reply.'),'A full-context message must not be paired with an explicit missing reply.');
assert.ok(!task.includes('Original fixture'));
assert.ok(topicExample(data,'domain','writing').includes('An original source example has not been included'));
assert.ok(!topicExample(data,'domain','writing').includes('Original fixture'));
assert.ok(topicExample(data,'domain','absent').includes('Select a category'));
const wrapped={...data,examples:{metadata:{},examples:data.examples}};
assert.ok(topicExample(wrapped,'domain','health').includes('Original fixture'));

const many={...data,domains:Array.from({length:30},(_,index)=>({id:`group${index}`,label:`Group ${index}`,count:30-index}))};
const short=topicView(many,{kind:'domain'}),long=topicView(many,{kind:'domain',expanded:true});
assert.equal((short.match(/class="topic-row(?: selected)?"/g)||[]).length,10);
assert.equal((long.match(/class="topic-row(?: selected)?"/g)||[]).length,30);
assert.ok(short.includes('data-action="topic-expand" data-kind="domain" data-expanded="true"'));
assert.ok(long.includes('data-expanded="false"'));
assert.ok(short.includes('Show all 30 categories'));
assert.ok(long.includes('Show largest 10'));
assert.ok(topicView(data,{kind:'domain',selected:'absent'}).includes('data-value="health" aria-pressed="true"'));

const overview=topicOverview(data);
assert.ok(overview.includes('#explorer?snapshot=1&view=topic&label=health'));
assert.ok(overview.includes('#explorer?snapshot=1&view=task&label=advice'));
assert.ok(overview.includes('including unclassified records'));
assert.ok(overview.includes('Topic distribution →'));


assert.ok(topicView({...data,scope:{...data.scope,total_rows:100000},domains:[{id:'rare',label:'Rare',count:1}]}).includes('&lt;0.1%'),'Nonzero rare labels must not display as zero percent.');
const methods=topicMethods(data);
assert.ok(methods.includes('id="topic-methods"'));
assert.ok(methods.includes('90 labeled · 10 unclassified / missing · denominator 100'));
assert.ok(methods.includes('80 labeled · 20 unclassified / missing · denominator 100'));
assert.ok(methods.includes('separate from the locally annotated 2,000-record Requests sample'));
assert.ok(methods.includes('prior validation on English data'));
assert.ok(methods.includes('longer than 5,000 characters'));
assert.ok(methods.includes('5,000'));
assert.ok(!topicMethods({...data,source:{...data.source,url:'javascript:alert(1)'}}).includes('href="javascript:'));
const hostile={...data,domains:[{id:'x" onclick="bad()',label:'<b>Fixture</b>',count:100,definition:'<img src=x onerror=bad()>'}]};
const safe=topicView(hostile,{kind:'domain'});
assert.ok(safe.includes('&lt;b&gt;Fixture&lt;/b&gt;'));
assert.ok(!safe.includes('<img'));
assert.ok(!safe.includes(' onclick="bad()'));
assert.ok(topicView(null).includes('unavailable'));
assert.equal(topicOverview(null),'');
assert.ok(topicMethods(null).includes('unavailable'));
assert.ok(!/\b(?:undefined|NaN)\b/.test(topic+task+overview+methods));
console.log('Topic/task views: denominator, distinct label dimensions, source examples, missing coverage, escaping, expansion and scoped methods passed.');
