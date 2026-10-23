import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {escape as e} from '../website/charts.js';
import {PERSONAL_DECISIONS,personalRows,personalCounts,personalSelection,personalReviewView,personalURL,personalRowDetail,personalTypeSplit,personalSummary,personalMethods,personalCompare} from '../website/personal-review.js';
import {auditRowDetail,expandedAuditTakeaway} from '../website/relational-v2.js';

const audit=JSON.parse(readFileSync(new URL('../website/data/relational_v2.json',import.meta.url),'utf8'));
const rows=personalRows(audit);
assert.equal(rows.length,31,'All personal-help records with saved paraphrases remain available');
assert.equal(new Set(rows.map(r=>r.row_index)).size,31);
assert.equal(audit.rows.filter(r=>r.relational_mode==='personal_help').length,31);
for(const r of rows){
 assert.ok(Object.hasOwn(PERSONAL_DECISIONS,r.personal_review.decision));
 assert.equal(r.personal_review.human_review_status,'not_reviewed');
 for(const key of ['title','question_paraphrase','reply_paraphrase','source_framing'])assert.ok(r.personal_review[key],`${r.row_index}: ${key}`);
 const body=personalRowDetail(r);
 assert.ok(body.includes(e(r.personal_review.question_paraphrase)));
 assert.ok(body.includes(e(r.personal_review.reply_paraphrase)));
 assert.ok(body.includes(e(r.personal_review.source_framing)));
 assert.ok(body.includes('English paraphrase (AI)'));
 assert.ok(!body.includes(e(r.personal_review.reason)),'Historical screening reasons stay out of the request detail');
 assert.ok(auditRowDetail(r).includes(body),'The request table retains the descriptive exchange');
}
// Historical helpers remain available without controlling the public browser.
assert.deepEqual(personalCounts(audit),{candidate:5,conditional:11,routine:14,other:1});
assert.equal(personalSelection(audit,'candidate').length,31);
assert.equal(personalSelection(audit,'routine','communication_draft').length,25);
assert.equal(personalSelection(audit,'other','advice_response').length,6);
const typeProbe={rows:[{...rows[0],help_type:'drafting',benchmark_route:'advice_response'}]};
assert.equal(personalSelection(typeProbe,'candidate','communication_draft').length,1,'Groups use help_type, not proposed benchmark use');
assert.equal(personalSelection(typeProbe,'candidate','advice_response').length,0);
assert.equal(personalRows({rows:[{...rows[0],personal_review:{...rows[0].personal_review,decision:'unknown'}}]}).length,1,'Historical screening decisions cannot exclude a personal-help record');

const html=personalReviewView(audit);
assert.equal((html.match(/data-personal-row=/g)||[]).length,31);
assert.equal((html.match(/Human validation: 0/g)||[]).length,1);
assert.equal((html.match(/31 records labeled personal help/g)||[]).length,1);
for(const r of rows)assert.ok(html.includes(e(r.personal_review.title)));
const selectedHTML=personalReviewView(audit,{decision:'candidate',requestType:'communication_draft'});
assert.equal((selectedHTML.match(/data-personal-row=/g)||[]).length,25);
assert.ok(selectedHTML.includes('25 shown'));
assert.ok(selectedHTML.includes('<h3>Drafting</h3>'));
assert.deepEqual(personalSelection(audit,'candidate').map(r=>r.row_index),personalSelection(audit,'routine').map(r=>r.row_index));
const url=personalURL({decision:'candidate',record:2971191,requestType:'communication_draft'});
assert.ok(url.includes('view=personal'));
assert.ok(!url.includes('decision='));
assert.ok(url.includes('personal_record=2971191'));
assert.ok(url.includes('request_type=communication_draft'));
const detailHTML=personalReviewView(audit,{decision:'routine',record:2971191});
assert.ok(detailHTML.includes('data-personal-row="2971191" open'));
const split=personalTypeSplit(audit);
assert.ok(split.includes('Existing AI help-type labels'));
assert.ok(split.includes('Drafting · 25'));
assert.ok(split.includes('Advice · 6'));
assert.ok(personalSummary(audit).includes('31 personal-help requests'));
assert.ok(personalMethods(audit).includes('all 31 records labeled personal help'));
assert.equal(personalCompare(audit),'');
const takeaway=expandedAuditTakeaway(audit);
assert.ok(takeaway.includes('31 requests labeled as personal help.'));
assert.ok(takeaway.includes('25 message drafts'));
assert.ok(takeaway.includes('6 advice requests'));
assert.ok(takeaway.includes('Read the 31 requests'));
assert.ok(takeaway.includes(personalURL({requestType:'communication_draft'})));
for(const output of [html,selectedHTML,detailHTML,split,takeaway,personalSummary(audit),personalMethods(audit),...rows.map(personalRowDetail)]){
 assert.ok(!/\b(?:undefined|NaN)\b/.test(output));
 for(const removed of ['Benchmark screening','Possible assessment','Open question','candidate screening','candidates for further judgment','Compare the decisions','p31-candidate','p31-conditional','p31-routine','p31-other','decision='])assert.ok(!output.includes(removed),`Public rendering must omit ${removed}`);
}
console.log('31 personal-help requests: stored paraphrases, help-type filters, label provenance and compatible record links passed.');
