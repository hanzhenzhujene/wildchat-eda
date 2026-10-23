import {sourcePreview} from './source-text.js?v=topicsOct21b';
import {escape as e,fmt} from './charts.js?v=topicsOct21b';

// Retained for compatibility with historical annotation exports.
export const PERSONAL_DECISIONS={
 candidate:{label:'Candidate',detail:'An observable relational choice',tone:'candidate'},
 conditional:{label:'Scope to decide',detail:'Context or scope needs judgment',tone:'conditional'},
 routine:{label:'Ordinary wording',detail:'No clear relational choice',tone:'routine'},
 other:{label:'Other task',detail:'A different assessment target',tone:'other'}
};
const decisionKeys=Object.keys(PERSONAL_DECISIONS);
// Preserve existing request_type links; the displayed groups use saved help_type labels.
export const PERSONAL_TYPES={communication_draft:'Drafting',advice_response:'Advice'};
const helpTypes={communication_draft:'drafting',advice_response:'advice'};

export function personalRows(audit){return audit.rows.filter(r=>r.relational_mode==='personal_help'&&r.personal_review);}
export function personalCounts(audit){const rows=personalRows(audit);return Object.fromEntries(decisionKeys.map(k=>[k,rows.filter(r=>r.personal_review.decision===k).length]));}
export function personalURL({record=null,requestType=''}={}){
 const q=new URLSearchParams({snapshot:'1',view:'personal'});
 if(record!==null)q.set('personal_record',String(record));
 if(Object.hasOwn(PERSONAL_TYPES,requestType))q.set('request_type',requestType);
 return '#audit?'+q.toString();
}
export function personalSelection(audit,_decision='',requestType=''){
 const type=helpTypes[requestType];
 return personalRows(audit).filter(r=>!type||r.help_type===type).sort((a,b)=>a.row_index-b.row_index);
}
function detailBody(row,{compact=false}={}){
 const r=row.personal_review;if(!r)return '';
 return `<div class="p31-detail-body">${sourcePreview(row.row_index,{userIndex:r.source_user_message_index,replyIndex:r.source_reply_message_index,limit:320})}
 <details class="source-paraphrase"><summary>English paraphrase (AI)</summary><div class="p31-exchange"><div><span>User request</span><p>${e(r.question_paraphrase||'Request paraphrase not recorded.')}</p></div><span class="p31-arrow" aria-hidden="true">→</span><div><span>AI reply</span><p>${e(r.reply_paraphrase||'No reply is available for this request.')}</p></div></div>${r.source_framing?`<p class="p31-source"><b>Source context:</b> ${e(r.source_framing)}</p>`:''}<p class="micro">AI-written paraphrases, not quotations. No human validation recorded.</p></details>
 <div class="p31-detail-foot">${compact?`<a href="${personalURL({record:row.row_index})}">Browse personal-help requests →</a>`:`<a href="#audit?snapshot=1&view=records&record=${row.row_index}">Labels & source details →</a>`}</div></div>`;
}

export function personalRowDetail(row){return row.personal_review?`<section class="p31-inline">${detailBody(row,{compact:true})}</section>`:'';}
export function personalSummary(audit){
 const rows=personalRows(audit);if(!rows.length)return '';
 return `<aside class="p31-entry"><div><strong>${fmt(rows.length)} personal-help requests</strong><p>First-pass AI labels · original text available · no human label validation.</p></div><a href="${personalURL()}">Browse requests →</a></aside>`;
}
export function personalMethods(audit){
 const rows=personalRows(audit);
 return rows.length?`<tr><th>Personal-help examples</th><td>Original question/response text and separate English paraphrases are available for all ${fmt(rows.length)} records labeled personal help by the first AI pass. Request, reply and source context were inspected by AI; human validation has not been done. <a href="${personalURL()}">Browse requests →</a></td></tr>`:'';
}
export function personalReviewView(audit,{record=null,requestType=''}={}){
 const all=personalRows(audit),selected=personalSelection(audit,'',requestType),type=PERSONAL_TYPES[requestType];
 if(!all.length)return '<p class="p31-empty">Personal-help request paraphrases are not available in this data export.</p>';
 const human=all.filter(r=>r.personal_review.human_review_status==='reviewed').length;
 return `<section class="p31-review" aria-label="Personal-help requests"><div class="p31-intro"><div><span class="p31-kicker">SAMPLED REQUESTS</span><h2>Personal-help requests</h2></div><a href="#audit?snapshot=1&view=charts">All request labels →</a></div><p class="p31-scope">${fmt(all.length)} records labeled personal help by the first AI pass, from the ${fmt(audit.rows.length)}-record sample. <b>Human validation: ${fmt(human)}.</b></p><p class="p31-lead">Original dataset text is shown first. English paraphrases are separate.</p>${personalTypeSplit(audit,{requestType})}<div class="p31-list-heading"><div><h3>${type?e(type):'All requests'}</h3>${type?`<span>${fmt(selected.length)} shown</span>`:''}</div>${type?`<a href="${personalURL()}">Show all requests</a>`:''}</div><div class="p31-case-list">${selected.map(row=>{const r=row.personal_review;return `<details class="p31-case" data-personal-row="${row.row_index}" ${record===row.row_index?'open':''}><summary><div><small>Record ${row.row_index}</small></div><h4>${e(r.title)}</h4><span class="p31-expand">Request & reply <i aria-hidden="true">+</i></span></summary>${detailBody(row,{showProvenance:false})}</details>`;}).join('')||'<div class="p31-empty">No requests with this help-type label.</div>'}</div></section>`;
}
export function personalTypeSplit(audit,{requestType=''}={}){
 const rows=personalRows(audit);if(!rows.length)return '';
 return `<div class="p31-type-split"><p>Existing AI help-type labels</p><nav class="tabs p31-view-tabs" aria-label="AI help-type labels">${Object.entries(PERSONAL_TYPES).map(([type,label])=>{const n=rows.filter(r=>r.help_type===helpTypes[type]).length;return `<a class="tab ${requestType===type?'active':''}" href="${personalURL({requestType:type})}" ${requestType===type?'aria-current="true"':''}>${e(label)} · ${fmt(n)}</a>`;}).join('')}</nav></div>`;
}
export function personalCompare(){return '';}
