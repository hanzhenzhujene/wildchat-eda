/** Source-grounded visual summaries. No inferred relevance or outcome labels. */
import {escape as e, fmt} from './charts.js?v=topicsOct21b';

export const RELATIONAL_MODES = [
  {key:'personal_help', label:'Personal interpersonal help', tone:'dark', definition:'Help with a situation presented as the user’s own, involving other people.'},
  {key:'social_participation', label:'AI in a presented social exchange', tone:'teal', definition:'AI is asked to respond within an exchange involving other people; authenticity is not verified.'},
  {key:'described_hypothetical', label:'Described / hypothetical content', tone:'muted', definition:'Interpersonal situations in fiction, general discussion or supplied material.'},
  {key:'none', label:'No interpersonal focus', tone:'gray', definition:'No substantive interpersonal focus in the final active request.'},
  {key:'unclear', label:'Cannot determine', tone:'amber', definition:'Insufficient or ambiguous evidence. Kept separate from negatives.'},
];
const MODES=RELATIONAL_MODES;
const icon = (name) => {
  const paths = {
    record:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    reply:'<path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 3v-3H3V6a2 2 0 0 1 2-2Z"/><path d="M7 9h10M7 13h7"/>',
    action:'<path d="M4 12h13M12 7l5 5-5 5M20 4v16"/>',
    people:'<circle cx="8" cy="7" r="3"/><circle cx="17" cy="9" r="2"/><path d="M2 21v-3a6 6 0 0 1 12 0v3M15 15a5 5 0 0 1 7 5"/>',
  };
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
};

export function relevanceGrid(rows,{action='select-relational',auditSize=2000}={}) {
 const input=Array.isArray(rows)?rows:[];
 if(!input.length)return '<div class="rv-empty">No inputs in this selection.</div>';
 const groups=MODES.map(m=>({...m,n:input.filter(r=>r.relational_mode===m.key).length}));
 const focused=groups.filter(g=>!['none','unclear'].includes(g.key)).reduce((s,g)=>s+g.n,0),full=input.length===auditSize;
 return `<figure class="rv-relevance" data-viz="relational-bars" aria-label="AI relational labels for ${fmt(input.length)} final requests">
 <figcaption class="rv-caption"><strong>AI labeled ${fmt(focused)} / ${fmt(input.length)} ${full?'final requests':'current matches'} as interpersonal</strong></figcaption>
 <div class="rel-mode-bars">${groups.map(g=>`<button type="button" class="rel-mode-row rv-${g.tone}" ${action?`data-action="${e(action)}" data-value="${g.key}"`:''} ${!g.n&&!full?'disabled':''} aria-label="${e(g.label)}: ${g.n} of ${input.length}"><span><strong>${e(g.label)}</strong><small>${e(g.definition)}</small></span><b>${fmt(g.n)}<span class="rel-mode-count">${(g.n/input.length*100).toFixed(1)}%</span></b><span class="rel-mode-track" aria-hidden="true"><i style="width:${g.n/input.length*100}%"></i></span></button>`).join('')}</div>
 <p class="rv-scope-note">${full?'Uniform sample from the full release.':`Filtered results; original random draw: ${fmt(auditSize)} records.`} First-pass AI labels; no human validation.</p>
 <p class="rv-help-distinction">Interpersonal content includes fiction and supplied text. It does not establish a personal-help request or a real interaction.</p></figure>`;
}

export function evidenceBoundary() {
  return `<figure class="rv-evidence" aria-label="Recorded text and evidence needed to study human outcomes">
    <div class="rv-evidence-side rv-recorded"><div class="rv-boundary-label">In the record</div><div class="rv-evidence-items"><div class="rv-evidence-item">${icon('record')}<strong>User’s account<br>+ request</strong></div><span class="rv-record-arrow" aria-hidden="true">→</span><div class="rv-evidence-item">${icon('reply')}<strong>Stored AI reply</strong></div></div></div>
    <div class="rv-evidence-side rv-unobserved"><div class="rv-boundary-label">Needs other evidence</div><div class="rv-evidence-items"><div class="rv-evidence-item">${icon('action')}<strong>What the user did next</strong></div><div class="rv-evidence-item">${icon('people')}<strong>Relationship outcomes</strong></div></div></div>
    <figcaption class="rv-note">The user’s account is not independently verified.</figcaption>
  </figure>`;
}

// Verified against outputs/review_summary.json and outputs/annotations.json.
// These two reviews have different selection rules and must never share a denominator.
const retrievalGroups=[
  {key:'personal_drafting',label:'Personal drafting',tone:'dark',summary:'One request asks for a workplace message; the other asks for a community invitation.'},
  {key:'fiction_or_general',label:'Fiction / general content',tone:'muted',summary:'These requests concern fictional scenes or general material. They do not ask for help with the user’s own situation.'},
  {key:'unrelated',label:'Outside personal-help scope',tone:'gray',summary:'Includes technical tasks and bot exchanges. The bot exchanges could support research on AI participation in conversations.'},
  {key:'unclear',label:'Unclear personal-help intent',tone:'light',summary:'The request asks a group bot to flatter another member. The review could not distinguish personal drafting from playful bot banter.'},
];
const retrievalReviews={
 hits:{n:80,pool:1747,poolLabel:'Keyword hits',label:'80 AI-labeled hits',counts:[2,37,40,1],formats:[{native_chat:2},{pasted_document:21,native_chat:5,embedded_other_history:6,embedded_group_history:5},{native_chat:1,pasted_document:8,embedded_group_history:29,embedded_other_history:2},{embedded_group_history:1}]},
 nonhits:{n:40,pool:8889,poolLabel:'Non-hits',label:'40 AI-labeled non-hits',counts:[0,19,21,0],formats:[{},{native_chat:8,pasted_document:11},{native_chat:7,pasted_document:9,embedded_other_history:5},{}]},
};
const formatLabels={native_chat:'Native chat',pasted_document:'Supplied document',embedded_other_history:'Other dialogue inside a prompt',embedded_group_history:'Group chat inside a prompt'};
const formatColors={native_chat:'#167b74',pasted_document:'#75aaa2',embedded_other_history:'#8c999e',embedded_group_history:'#365e5a'};
function retrievalDetail(mode,key) {
 const review=retrievalReviews[mode],i=retrievalGroups.findIndex(g=>g.key===key),g=retrievalGroups[i],n=review.counts[i];
 const formats=Object.entries(review.formats[i]).sort((a,b)=>b[1]-a[1]);
 let summary=n?g.summary:'No requests received this label in this review sample.';
 if(mode==='nonhits'&&key==='unrelated')summary='Includes technical questions and document tasks, without a personal-help request.';
 const example=mode==='hits'&&key==='personal_drafting'?{id:286012,label:'Read the workplace example'}:mode==='hits'&&key==='unrelated'?{id:2632268,label:'Read the bot-reply example'}:null;
 return `<div class="rv-retrieval-detail rv-${g.tone}" role="status" aria-live="polite"><div class="rv-detail-title"><strong>${n} of ${review.n} · ${e(g.label)}</strong><span>${mode==='hits'?'Keyword-hit review':'Non-hit review'}</span></div><p>${e(summary)}</p>${formats.length?`<div class="rv-format-breakdown"><span class="rv-format-title">Input formats in this group</span>${formats.map(([k,v])=>`<div class="rv-format-row"><span>${e(formatLabels[k])}</span><span class="rv-format-track"><i style="width:${v/n*100}%;background:${formatColors[k]}"></i></span><strong>${v}</strong></div>`).join('')}</div>`:''}${example?`<button type="button" class="rv-detail-example" data-action="open-case" data-id="${example.id}">${e(example.label)} ↗</button>`:''}</div>`;
}
function retrievalContents(mode='hits',selected='unrelated') {
 const review=retrievalReviews[mode];
 return `<div class="rv-search-flow"><div class="rv-search-node"><strong>10,636</strong><span>English-labeled records</span></div><div class="rv-flow-link"><span>Keyword screen</span><i aria-hidden="true">→</i></div><div class="rv-search-node"><strong>${fmt(review.pool)}</strong><span>${review.poolLabel}</span></div><div class="rv-flow-link rv-sample-link"><span>Random sample</span><i aria-hidden="true">→</i></div><div class="rv-search-node rv-reviewed"><strong>${review.n}</strong><span>AI-labeled ${mode==='hits'?'hits':'non-hits'}</span></div></div>
 <div class="rv-retrieval-toggle" role="group" aria-label="Choose review sample"><button type="button" data-retrieval-mode="hits" aria-pressed="${mode==='hits'}">80 hits</button><button type="button" data-retrieval-mode="nonhits" aria-pressed="${mode==='nonhits'}">40 non-hits</button><span>AI labels · separate samples</span></div>
 <div class="rv-result-heading"><strong>${mode==='hits'?'2 of 80 were labeled personal drafting.':'0 of 40 were labeled personal advice or drafting.'}</strong><span>Select a category</span></div>
 <div class="rv-result-bar" aria-label="Distribution of ${review.n} AI-labeled ${mode==='hits'?'hits':'non-hits'}">${retrievalGroups.map((g,i)=>review.counts[i]?`<button type="button" tabindex="-1" class="rv-${g.tone}" data-retrieval-group="${g.key}" aria-label="${e(g.label)}: ${review.counts[i]} of ${review.n}" title="${e(g.label)}: ${review.counts[i]}" style="flex:${review.counts[i]}">${review.counts[i]/review.n>=.15?`<span>${review.counts[i]}</span>`:''}</button>`:'').join('')}</div>
 <div class="rv-result-legend">${retrievalGroups.map((g,i)=>`<button type="button" data-retrieval-group="${g.key}" aria-pressed="${selected===g.key}" class="rv-result-item rv-${g.tone}"><span class="rv-swatch" aria-hidden="true"></span><strong>${review.counts[i]}</strong><span>${e(g.label)}</span><span class="rv-result-percent">${(review.counts[i]/review.n*100).toFixed(1).replace(/\.0$/,'')}%</span></button>`).join('')}</div>
 <p class="rv-gray-meaning"><span class="rv-swatch rv-gray" aria-hidden="true"></span>Gray = outside personal-help scope, not unread or missing.</p>
 <div data-retrieval-detail>${retrievalDetail(mode,selected)}</div>`;
}
export function retrievalFlow({mode='hits',group='unrelated'}={}) {
 mode=Object.hasOwn(retrievalReviews,mode)?mode:'hits';
 group=retrievalGroups.some(g=>g.key===group)?group:'unrelated';
 return `<figure class="rv-retrieval" data-viz="retrieval-flow" data-retrieval-root data-mode="${mode}" data-group="${group}" aria-label="Keyword retrieval and separate reviews of hits and non-hits"><div data-retrieval-content>${retrievalContents(mode,group)}</div><figcaption class="rv-note">AI labels; no human validation is recorded. Separate from both random content samples. These samples do not establish prevalence or recall.</figcaption></figure>`;
}
const researchMounted=new WeakSet();
export function mountResearchInteractions(root=document) {
 if(researchMounted.has(root))return;researchMounted.add(root);
 root.addEventListener('click',event=>{
  const modeButton=event.target.closest?.('[data-retrieval-mode]'),groupButton=event.target.closest?.('[data-retrieval-group]');
  if(!modeButton&&!groupButton)return;
  const figure=(modeButton||groupButton).closest('[data-retrieval-root]');if(!figure)return;
  if(modeButton){figure.dataset.mode=modeButton.dataset.retrievalMode;figure.querySelector('[data-retrieval-content]').innerHTML=retrievalContents(figure.dataset.mode,figure.dataset.group);figure.querySelector(`[data-retrieval-mode="${figure.dataset.mode}"]`).focus({preventScroll:true});}
  else {figure.dataset.group=groupButton.dataset.retrievalGroup;figure.querySelectorAll('.rv-result-item').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.retrievalGroup===figure.dataset.group)));figure.querySelector('[data-retrieval-detail]').innerHTML=retrievalDetail(figure.dataset.mode,figure.dataset.group);}
  figure.dispatchEvent(new CustomEvent('retrieval-change',{bubbles:true,detail:{mode:figure.dataset.mode,group:figure.dataset.group}}));
  const detail=figure.querySelector('[data-retrieval-detail]');if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&detail.animate)detail.animate([{opacity:.5},{opacity:1}],{duration:160,easing:'ease-out'});
 });
}
