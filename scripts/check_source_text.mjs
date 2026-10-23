import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setSourceTexts,getSourceRecord,sourcePair,sourceConversation,sourcePreview} from '../website/source-text.js';

// Synthetic fixtures only. Role-like strings in content must never create messages.
const question = '  <script>alert("fixture")</script> & café 😀\r\nUser: pasted line\nAssistant: also pasted\tEnd.  ';
const response = 'Response with <b>literal markup</b> & an apostrophe\'s meaning.\n\n第二段。';
const fixtures = [
  {row_index:1,messages:[{role:'system',content:'System fixture.'},{role:'user',content:question},{role:'assistant',content:response},{role:'user',content:'Final question.'},{role:'assistant',content:'Final response.'}]},
  {row_index:2,messages:[{role:'user',content:'Unanswered question.'},{role:'user',content:'Separate question.'},{role:'assistant',content:'Only the second answer.'}]},
  {row_index:3,messages:[{role:'user',content:''},{role:'assistant',content:''}]},
  {row_index:4,redactions:[{kind:'email'}],source_redacted:true,messages:[{role:'user',content:'Write to [email hidden].'},{role:'assistant',content:'Hello [email hidden].'}]},
  {row_index:5,messages:[{role:'user',content:'😀'.repeat(321)},{role:'assistant',content:'A'.repeat(321)}]},
  {row_index:6,messages:[{role:'system',content:'No user message.'},{role:'tool',content:'Tool result.'}]},
  {row_index:7,messages:[{role:'user',content:null}]}
];
setSourceTexts({records:fixtures});
assert.equal(getSourceRecord('1'),fixtures[0]);
assert.equal(getSourceRecord(999),null);

const decode = text => text.replace(/&#13;/g,'\r').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&amp;/g,'&');
const texts = (html,kind='full') => [...html.matchAll(new RegExp(`<div class="source-text" data-source-content="${kind}" dir="auto">([\\s\\S]*?)<\\/div>`,'g'))].map(match=>decode(match[1]));
const pair = sourcePair(1,{turn:1,limit:30});
assert.deepEqual(texts(pair),[question,response],'Expanded source preserves every character, whitespace and Unicode.');
assert.ok(pair.includes('Question · original text'));
assert.ok(pair.includes('Response · original text'));
assert.ok(pair.includes('Show full question'));
assert.ok(pair.includes('Show full response'));
assert.ok(!pair.includes('<script>'));
assert.ok(!pair.includes('<b>literal markup</b>'));
assert.ok(pair.includes('&lt;script&gt;'));
assert.ok(pair.includes('&#13;\n'),'HTML parsing must not normalize a source CRLF into LF.');
assert.ok(!/\sid=/.test(pair),'Preview pairs never introduce IDs.');
assert.deepEqual(texts(sourcePair(1)),['Final question.','Final response.'],'Default selection is the final user request.');
assert.deepEqual(texts(sourcePair(1,{userIndex:1,replyIndex:2})),[question,response]);
assert.ok(sourcePair(1,{turn:99}).includes('No matching stored user question'));
assert.ok(!sourcePair(1,{userIndex:0}).includes('System fixture.'));
assert.ok(sourcePair(1,{userIndex:1,replyIndex:4}).includes('No stored response'),'An explicit reply cannot cross the next stored user boundary.');
assert.ok(sourcePair(2,{turn:1}).includes('No stored response'));
assert.ok(!sourcePair(2,{turn:1}).includes('Only the second answer.'));
assert.ok(sourcePair(1,{turn:1,replyIndex:null}).includes('No stored response'),'Explicit missing response must stay missing.');
assert.deepEqual(texts(sourcePair(3)),['','']);
assert.equal((sourcePair(3).match(/This stored message is empty/g)||[]).length,2);
assert.ok(sourcePair(7).includes('stored question text is unavailable'));
assert.ok(sourcePair(999).includes('Original source text is unavailable'));
assert.ok(sourcePreview(999).includes('Original source text is unavailable'));
assert.ok(sourceConversation(999).includes('Original source text is unavailable'));

const conversation = sourceConversation(1,{id:'full-transcript',turnIds:true});
assert.deepEqual(texts(conversation),fixtures[0].messages.map(message=>message.content),'Full context retains the stored message order.');
assert.equal((conversation.match(/data-source-message-index=/g)||[]).length,5);
assert.equal((conversation.match(/id="turn-/g)||[]).length,2,'Pasted role markers never create turns.');
assert.ok(conversation.includes('id="full-transcript"'));
assert.ok(conversation.includes('id="turn-1"'));
assert.ok(conversation.includes('id="turn-2"'));
assert.ok(!conversation.includes('id="turn-3"'));
assert.ok(!/<details[^>]*\sopen(?:\s|>)/.test(conversation),'Full context starts collapsed.');
assert.ok(!/\sid=/.test(sourceConversation(1)),'Default full context is safe to repeat in one view.');
assert.ok(sourceConversation(6).includes('Stored message 2 · tool'),'Full context preserves non-user roles.');
assert.deepEqual(texts(sourceConversation(6)),['No user message.','Tool result.']);
assert.ok(!sourcePreview(1,{context:false}).includes('source-conversation'));
assert.ok(sourcePreview(1,{contextId:'full-transcript',turnIds:true}).includes('id="full-transcript"'));
assert.ok(!/\sid=/.test(sourcePreview(1)+sourcePreview(1)));

const redacted = sourcePreview(4);
assert.ok(redacted.includes('Source text · identifiers hidden'));
assert.ok(redacted.includes('Question · source text'));
assert.ok(!redacted.includes('original text'));
assert.ok(!redacted.includes('Original dataset text'));
assert.ok(redacted.includes('Redactions already present in the dataset are retained.'));
assert.ok(redacted.includes('[email hidden]'));
const unicode = sourcePair(5);
const prefix = unicode.match(/data-source-content="preview" dir="auto">([^<]*)<\/span>/)?.[1];
assert.equal([...prefix].length,320,'Preview limit counts Unicode code points without splitting emoji.');
assert.equal(prefix,'😀'.repeat(320));
assert.deepEqual(texts(unicode),['😀'.repeat(321),'A'.repeat(321)]);

assert.throws(()=>setSourceTexts({records:[fixtures[0],fixtures[0]]}),/Duplicate source record/);
assert.equal(getSourceRecord(1),fixtures[0],'A rejected payload does not replace the previous source map.');
assert.throws(()=>setSourceTexts({records:[{row_index:8}]}),/messages array/);
assert.throws(()=>setSourceTexts({}),/records array/);
const css = readFileSync(new URL('../website/source-text.css',import.meta.url),'utf8');
assert.ok(css.includes('white-space:pre-wrap'));
assert.ok(css.includes('.source-expand[open]>summary>.source-prefix'));
assert.ok(css.includes('.source-collapse-label{display:none}'));
setSourceTexts({records:[]});
assert.equal(getSourceRecord(1),null);
console.log('Source text: exact content, escaped markup, Unicode previews, message boundaries, context, redactions and missing-source states passed.');
