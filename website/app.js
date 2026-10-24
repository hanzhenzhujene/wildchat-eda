import {readHubReturn,hubReturnHref,hubReturnLabel} from './hub-navigation.js';
import {topicView,topicOverview,topicMethods,datasetTakeaways} from './topics.js?v=takeawaySourcesOct21';
import {setSourceTexts,getSourceRecord,sourcePair,sourcePreview,sourceConversation} from './source-text.js?v=topicsOct21b';
import {PERSONAL_DECISIONS,PERSONAL_TYPES,personalRows,personalReviewView} from './personal-review.js?v=topicsOct21b';
import {BENCHMARK_ROUTES,REVIEW_STATES,SOURCE_CHECK_STATES,CONTEXTS,FRAMES,aiDifferences,reviewState,auditMatches,auditStats,expandedAuditTakeaway,auditRowDetail,expandedReviewStatus,expandedResearchFit,randomExampleCards} from './relational-v2.js?v=copyOct24';
import {validationOverview,validationPanel,validationMethods} from './validation.js?v=topicsOct21b';
import {exampleTitle} from './example-names.js?v=topicsOct21b';
import {scopeMetrics,sourceNotes,scopeKeys,exampleMembership} from './scope-notes.js?v=copyOct24';
import {researchFitFlow,fitFocusFor} from './fit-flow.js?v=publicHubOct23';
import {turnHistogram,monthCoverage,ecdfExplorer,densityExplorer,templateBoxplot,mountStatsInteractions} from './stats-visuals.js?v=topicsOct21b';
import {languageTreemap,purposeFlow,mountCategoryInteractions} from './category-visuals.js?v=topicsOct21b';
import {samplingMap,evidenceMatrix,mountEvidenceInteractions} from './evidence-visuals.js?v=copyOct24';
import {initMotion,beforeRender,afterRender,animateInspector} from './motion.js?v=topicsOct21b';
import {initJump} from './jump.js?v=topicsOct21b';
import {escape as e,fmt,pct,counts,quantile,bars,vertical,ecdf,density,modelHeatmap,colors} from './charts.js?v=topicsOct21b';
import {miniDistribution, segmentedBar, recordAnatomy} from './dashboard-charts.js?v=topicsOct21b';
import {RELATIONAL_MODES, relevanceGrid, evidenceBoundary, retrievalFlow, mountResearchInteractions} from './research-visuals.js?v=topicsOct21b';
const chapters=[['overview','Overview'],['explorer','Distributions'],['audit','Requests'],['cases','Examples'],['fit','Data limits'],['structure','Inside a record'],['methods','Methods & sources'],['glossary','Glossary']];
const primary=chapters.slice(0,5);
const PURPOSE={text_work:'Text work',technical_problem:'Technical problem',information_learning:'Information / learning',creative_roleplay:'Creative / roleplay',social_chat:'Social chat',personal_guidance:'Personal guidance',other_unclear:'Other / unclear'};
const PACK={direct_request:'Direct request',pasted_document:'Supplied document / code',embedded_history:'Embedded dialogue',unclear:'Unclear'};
const REL={...Object.fromEntries(RELATIONAL_MODES.map(x=>[x.key,x.label])),none_or_unclear:'No focus / unclear (combined)'};
const $=s=>document.querySelector(s);let D={},route='overview';
let progress;try{progress=JSON.parse(localStorage.getItem('wildchat-atlas-progress')||'{"visited":[],"answers":{}}')}catch{progress={visited:[],answers:{}}}
const state={chartProbe:null,filters:{language:'',year:'',family:'',template:'',depth:'',month:'',turnBand:'',flag:''},auditView:'charts',overviewAudit:'relevance',explorerTab:'topic',topicSelected:{domain:'',intent:''},topicExpanded:{domain:false,intent:false},recordPage:0,sort:'row_index',auditFilters:{purpose:'',packaging:'',relational_mode:'',confidence:'',benchmark_route:'',review_status:'',source_check:'',context:'',earlier_only:''},auditPage:0,auditRecord:null,personalDecision:'',personalRecord:null,personalType:'',caseKind:'all',caseId:286012,demo:'direct',glossarySearch:'',fitRole:'advice',fitExample:286012,retrievalMode:'hits',retrievalGroup:'unrelated'};
const hubReturn=readHubReturn(location.search),hubLink=$('.public-hub-link');let hubEntryPending=Boolean(hubReturn);
if(hubReturn&&hubLink){hubLink.href=hubReturnHref(hubReturn);hubLink.textContent='← Back to '+hubReturnLabel(hubReturn);}
function save(){try{localStorage.setItem('wildchat-atlas-progress',JSON.stringify(progress))}catch{}};
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),2500)}
const head=(k,t,p)=>`<div class="page-head"><div class="eyebrow">${k}</div><h1>${t}</h1><p>${p}</p></div>`;
const takeaway=(s)=>`<div class="takeaway">${s}</div>`;
const badge=(s,t='')=>`<span class="badge ${t}">${e(s)}</span>`;
const metric=(n,l,detail='')=>`<div class="metric"><b>${n}</b><span>${l}</span>${detail?`<small>${detail}</small>`:''}</div>`;
const panel=(t,body,cls='')=>`<section class="panel ${cls}"><h3>${t}</h3>${body}</section>`;
const chart=(t,desc,body,foot='')=>`<section class="chart-panel"><h3>${t}</h3><div class="chart-desc">${desc}</div>${body}${foot?`<div class="chart-footer">${foot}</div>`:''}</section>`;
const list=a=>`<ul class="content-list">${a.map(x=>`<li>${e(x)}</li>`).join('')}</ul>`;
const options=(values,current,all='All')=>`${all===null?'':`<option value="">${all}</option>`}${values.map(v=>{const [val,label]=Array.isArray(v)?v:[v,v];return `<option value="${e(val)}" ${String(current)===String(val)?'selected':''}>${e(label)}</option>`}).join('')}`;
function field(id,label,values,current,all='All'){return `<div class="field"><label for="${id}">${label}</label><select id="${id}">${options(values,current,all)}</select></div>`}
function nav(){
 $('#nav').innerHTML=primary.map(([id,label])=>`<a class="nav-item ${route===id?'active':''}" href="#${id}" ${route===id?'aria-current="page"':''}><span>${label}</span>${id==='audit'?`<small><span class="nav-scope-full">${fmt(D.audit.rows.length)} sampled inputs</span><span class="nav-scope-short">${fmt(D.audit.rows.length)} sampled</span></small>`:id==='cases'?'<small><span class="nav-scope-full">Selected records</span><span class="nav-scope-short">Selected records</span></small>':''}</a>`).join('');
 $('#reference-nav').innerHTML=chapters.slice(5).map(([id,label])=>`<a class="${route===id?'active':''}" href="#${id}">${label}</a>`).join('');
 $('#breadcrumb').textContent=chapters.find(c=>c[0]===route)?.[1]||'Overview';
 $('#main').dataset.route=route;
}
function nextChapter(){return ''}
const disclose=(title,body)=>`<details class="disclosure"><summary>${title}</summary><div class="disclosure-body">${body}</div></details>`;
const linkIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(1 0) scale(.9)"/></svg>';
const smallHead=(title,scope)=>`<div class="workspace-heading"><h1>${title}</h1><p>${scope}</p><button class="copy-view" data-action="copy-view" title="Copy a link to this view">${linkIcon}Copy link</button></div>`;
function quiz(id){const q=D.learning.quizzes.find(x=>x.id===id);if(!q)return '';const answer=progress.answers[id],has=Number.isInteger(answer),ok=answer===q.correctIndex;return `<section class="quiz" data-quiz="${id}"><div class="eyebrow">Quick questions</div><h3>${e(q.question)}</h3><div class="quiz-options">${q.options.map((o,i)=>`<button class="quiz-option ${answer===i?'chosen '+(ok?'':'wrong'):''}" data-action="quiz" data-id="${id}" data-index="${i}" aria-pressed="${answer===i}">${e(o)}</button>`).join('')}</div>${has?`<div class="quiz-result" role="status"><strong>${ok?'Yes.':'Take another look.'}</strong> ${e(q.explanation)}</div>`:''}</section>`}
// Example membership comes from record IDs, never inferred from a category label.
const exampleButton=(id,label)=>`<button class="example-link" data-action="open-case" data-id="${id}">${e(label||(D.examples.find(x=>x.id===id).title))} <span aria-hidden="true">→</span></button>`;
function selectionExamples(rows,scope){
 const ids=new Set(rows.map(r=>r.row_index)),matches=D.examples.filter(x=>ids.has(x.id));
 const name=scope==='audit'?'Matching examples':scope==='english'?'Examples in this English-labeled selection':'Examples in this selection';
 return `<details class="selection-examples" ${matches.length?'open':''}><summary class="selection-example-heading"><strong>${name}</strong><span>${matches.length} example${matches.length===1?'':'s'}</span></summary><div class="selection-example-body">${matches.length?`<div class="selection-example-links">${matches.map(x=>exampleButton(x.id)).join('')}</div>`:`<p>No example matches. ${scope==='audit'?(rows.length?'See the AI summaries below.':'No requests match these filters.'):'See Rows for metadata.'}</p>`}${scope==='audit'&&state.auditFilters.relational_mode==='personal_help'?`<div class="outside-audit"><span>Separate earlier examples · not part of these counts</span>${exampleButton(286012)}${exampleButton(753427)}</div>`:''}</div></details>`;
}
const visualKey=()=>`<div class="atlas-visual-key" aria-label="Evidence colors"><span class="key-observed"><i></i>Recorded data</span><span class="key-proposed"><i></i>AI labels</span><span class="key-missing"><i></i>Missing evidence</span></div>`;

function validProbe(p){
 if(!p||typeof p!=='object')return null;
 if(p.kind==='english')return {kind:'english'};
 if(p.kind==='ecdf'&&Number.isFinite(p.max)&&p.max>=0)return {kind:'ecdf',field:'user_words',max:p.max};
 if(p.kind==='template'&&typeof p.matched==='boolean')return {kind:'template',matched:p.matched};
 if(p.kind==='density'&&['userMin','userMax','aiMin','aiMax'].every(k=>Number.isFinite(p[k])&&p[k]>=0)&&p.userMin<=p.userMax&&p.aiMin<=p.aiMax)return {kind:'density',userMin:p.userMin,userMax:p.userMax,aiMin:p.aiMin,aiMax:p.aiMax};
 return null;
}
function probeRecords(rows){const p=state.chartProbe;if(!p)return rows;return rows.filter(r=>r.language==='English'&&(p.kind==='english'?true:p.kind==='ecdf'?r.user_words<=p.max:p.kind==='template'?Boolean(r.group_template)===p.matched:r.user_words>=p.userMin&&r.user_words<=p.userMax&&r.assistant_words>=p.aiMin&&r.assistant_words<=p.aiMax));}
function probeLabel(){const p=state.chartProbe;return !p?'':p.kind==='english'?'Text-length scope':p.kind==='ecdf'?`User input ≤ ${fmt(p.max)} words`:p.kind==='template'?(p.matched?'Template match':'No template match'):`Input ${fmt(p.userMin)}–${fmt(p.userMax)} · output ${fmt(p.aiMin)}–${fmt(p.aiMax)} words`;}
function explorerRows(){const rows=selectedRecords();return probeRecords(state.explorerTab==='length'?rows.filter(r=>r.language==='English'):rows);}
function setExplorerTab(next){if(state.explorerTab==='length'&&next==='records'&&!state.chartProbe)state.chartProbe={kind:'english'};if(!['length','records'].includes(next))state.chartProbe=null;state.explorerTab=next;}
function explorerSelectionLabel(id){const rows=explorerRows();return rows.some(r=>r.row_index===Number(id))?[probeLabel(),`${fmt(rows.length)} selected records`].filter(Boolean).join(' · '):'Outside this chart selection';}
function exampleRail(){
 const rows=explorerRows(),ids=new Set(rows.map(r=>r.row_index)),matches=D.examples.filter(x=>ids.has(x.id));
 const card=x=>{const t=focusTurn(x);return `<button class="rail-example" data-action="open-case" data-id="${x.id}" data-case-focus="exchange"><span class="rail-example-meta">English paraphrase · ${e(x.language)} source · ${x.user_turns} user message${x.user_turns===1?'':'s'}</span><strong>${e(x.title)} <span aria-hidden="true">↗</span></strong><p>${e(t.user)}</p><span class="rail-example-turn">Read turn ${t.turn} in context</span></button>`;};
 return `<div class="chart-example-rail"><header><span>CHART SELECTION</span><h2>Matching examples</h2></header><div class="rail-count-flow" role="status" aria-live="polite"><div><strong>${fmt(rows.length)}</strong><span>selected records</span></div><b aria-hidden="true">→</b><div><strong>${matches.length}</strong><span>example${matches.length===1?'':'s'} here</span></div></div>${state.chartProbe?`<div class="rail-probe"><span>${e(probeLabel())}<small>English source labels</small></span><button class="text-button" data-action="clear-probe" aria-label="Clear chart selection">×</button></div>`:''}<p class="rail-scope">Matched by record ID · handpicked, not random.<br><a href="#methods?source=examples">Selection & label status ↗</a></p>${matches.length?matches.map(card).join(''):`<div class="rail-empty"><strong>No example on this site matches.</strong><span>${rows.length?'Matching metadata is available in Rows.':'Choose another chart value or clear a filter.'}</span></div>`}<button class="rail-rows" data-action="explorer-tab" data-value="records">${fmt(rows.length)} metadata rows →</button>${matches.length?`<button class="mobile-example-jump" data-action="show-matching-examples">${matches.length} matching example${matches.length===1?'':'s'} · View ↑</button>`:''}</div>`;
}

function caseReturnTarget(){
 const q=new URLSearchParams(location.hash.split('?')[1]||''),back=q.get('back'),from=q.get('from');
 return back&&chapters.some(c=>c[0]===back.split('?')[0])?back:chapters.some(c=>c[0]===from)?from:fitFocusFor(state.caseId,q.get('focus'))?'fit?example='+state.caseId:'overview';
}
function caseBackButton(){
 const q=new URLSearchParams(location.hash.split('?')[1]||''),hub=readHubReturn(location.search);
 if(hub&&!q.get('back'))return `<a class="case-back text-button" href="${e(hubReturnHref(hub))}">← Back to ${e(hubReturnLabel(hub))}</a>`;
 const label=chapters.find(c=>c[0]===caseReturnTarget().split('?')[0])?.[1]||'Overview';
 return `<button class="case-back text-button" data-action="return-chart">← Back to ${e(label)}</button>`;
}
function caseContext(){
 const selection=new URLSearchParams(location.hash.split('?')[1]||'').get('selection');
 return selection?`<div class="case-context"><span>${e(selection)}</span></div>`:'';
}
function readingOffset(){
 const header=$('.app-header'),fixed=header&&['sticky','fixed'].includes(getComputedStyle(header).position);
 const siteHeight=fixed?header.getBoundingClientRect().height:0;
 document.documentElement.style.setProperty('--atlas-header-height',`${siteHeight}px`);
 return siteHeight+($('.conversation-header')?.getBoundingClientRect().height||0)+16;
}
function focusCaseTarget(target){
 if(!target)return;
 const room=$('#case-focus-room');if(room)room.style.height='0px';
 const top=Math.max(0,target.getBoundingClientRect().top+scrollY-readingOffset());
 if(room)room.style.height=Math.ceil(Math.max(0,top-(document.documentElement.scrollHeight-innerHeight))+12)+'px';
 target.focus({preventScroll:true});window.scrollTo({top,behavior:'instant'});
}
// Preview a selection without losing the chart or its current filters.
let inspection=null;let returnPosition=null;const readingPositions=new Map();
const filterPanels={audit:false,explorer:false};
function filterDisclosure(kind,body){return `<details class="filter-disclosure" data-filter-kind="${kind}" ${filterPanels[kind]?'open':''}><summary>Filters</summary>${body}</details>`;}
const focusTurn=x=>x.turns.find(t=>t.turn===({255498:3,286012:2,753427:4}[x.id]||1))||x.turns[0];
function caseBrief(x){return `<div class="case-brief"><p class="case-situation">${e(x.summary)}</p></div>`;}

const turnTopics={
  255498:['Games','Make a game','classList'],
  286012:['Shorten draft','Spoken wording','Original role','Speaking style','Message structure','Use of skills','Email draft'],
  753427:['Feelings','Work comments','Spending','Why comments?','Partner’s calls']
};
function caseEvidenceMap(x,f){
 const t=focusTurn(x);
 return `<section class="case-evidence-map" id="case-evidence-map" tabindex="-1" aria-label="Original dataset question and response">
 <header class="case-map-header"><span>TURN ${t.turn} OF ${x.user_turns}</span></header>
 ${sourcePair(x.id,{turn:t.turn,limit:360})}
 </section>`;
}

function caseFocusFor(id,node){
 const existing=fitFocusFor(Number(id),node);if(existing)return existing;
 const x=D.examples.find(x=>x.id===Number(id));if(!x||node!=='exchange')return null;
 const turn=focusTurn(x).turn;return {node:'exchange',turn,target:`turn-${turn}`};
}
function currentCaseFocus(x){return caseFocusFor(x.id,new URLSearchParams(location.hash.split('?')[1]||'').get('focus'))}
function focusNote(x,f){return f.node==='gap'?`<p>${e(f.reason)}</p>`:'';}

function landOnCaseFocus(){
 if(route!=='cases')return;
 const x=D.examples.find(x=>x.id===state.caseId),f=x&&currentCaseFocus(x);if(!f)return;
 const hash=location.hash;
 requestAnimationFrame(()=>{
  if(location.hash!==hash||route!=='cases')return;
  const dialogue=['exchange','evidence','rating'].includes(f.node);
  if(dialogue&&$('#full-transcript'))$('#full-transcript').open=true;
  const target=document.getElementById(f.node==='gap'||dialogue?f.target:'case-evidence-map');if(!target)return;
  if(target.tagName==='DETAILS')target.open=true;
  focusCaseTarget(target);
 });
}
function landOnSource(){
 if(route!=='methods'||![...scopeKeys,'topics'].includes(new URLSearchParams(location.hash.split('?')[1]||'').get('source')))return;
 const hash=location.hash;requestAnimationFrame(()=>{if(location.hash!==hash)return;const t=$('#topic-methods')||$('#source-detail'),h=$('.app-header');if(!t)return;const off=h&&['sticky','fixed'].includes(getComputedStyle(h).position)?h.getBoundingClientRect().height+18:18;t.focus({preventScroll:true});window.scrollTo({top:Math.max(0,t.getBoundingClientRect().top+scrollY-off),behavior:'instant'});});
}
function previewExchange(x){
 const t=focusTurn(x);
 return `<div class="peek-meta">Record ${x.id} · ${exampleMembership(x.id)}</div><h3>${e(x.title)}</h3>
 ${sourcePair(x.id,{turn:t.turn,limit:300})}
 <div class="inspect-actions"><button class="button" data-action="full-case" data-id="${x.id}">Full context →</button></div>`;
}

function showInspector(title,body){
 const d=$('#inspect-dialog'),isNew=!d.open;
 d.innerHTML=`<header class="inspect-header"><h2 id="inspect-title">${e(title)}</h2><button class="inspect-close" data-action="close-inspector" aria-label="Close preview">×</button></header><div class="inspect-body">${body}</div>`;
 if(!d.open){d.showModal();}
 else d.querySelector('.inspect-body').scrollTop=0;
 d.querySelector('.inspect-close').focus({preventScroll:true});
 animateInspector(isNew);
}
function openCasePreview(id){
 const x=D.examples.find(x=>x.id===Number(id));if(!x)return;
 inspection=null;
 showInspector('Example',previewExchange(x));
}
function openAuditPreview(filters,baseFilters={}){
 const combined={...baseFilters,...filters};
 const rows=D.audit.rows.filter(r=>auditMatches(r,combined));
 const baseCount=D.audit.rows.filter(r=>auditMatches(r,baseFilters)).length;
 const label=Object.entries(filters).filter(([,v])=>v).map(([k,v])=>({purpose:PURPOSE,packaging:PACK,relational_mode:REL}[k]?.[v]||v)).join(' · ');
 const matches=D.examples.filter(x=>rows.some(r=>r.row_index===x.id));
 inspection={filters:combined,rows,label,baseCount,exampleId:matches[0]?.id};
 renderAuditPreview();
}
function renderAuditPreview(){
 const {rows,label,baseCount,exampleId}=inspection;
 const matches=D.examples.filter(x=>rows.some(r=>r.row_index===x.id));
 const x=matches.find(x=>x.id===exampleId);
 showInspector(label,`<div class="inspect-summary"><strong>${rows.length} of ${baseCount} final inputs in this chart</strong><p class="peek-meta">${fmt(D.audit.rows.length)} row-random sample from the full release · AI labels · no human validation</p></div>
 ${matches.length>1?`<div class="peek-example-picker">${matches.map(c=>`<button data-action="peek-example" data-id="${c.id}" aria-pressed="${c.id===exampleId}">${e(c.title)}</button>`).join('')}</div>`:''}
 ${x?previewExchange(x):`<p class="peek-meta">${rows.length?'No conversation example in this selection.':'No requests match this combination.'}</p>`}
 ${rows.length?`<div class="inspect-notes"><details ${x?'':'open'}><summary>AI summaries</summary>${rows.slice(0,3).map(r=>`<div class="inspect-note"><span>Row ${r.row_index} · ${e(r.language)}</span><p>${e(r.reason)}</p></div>`).join('')}</details><button class="text-button" data-action="inspect-records">View ${rows.length} requests →</button></div>`:inspection.filters.relational_mode==='personal_help'?`<div class="outside-audit"><span>Separate retrieval · outside this audit</span>${exampleButton(286012)}${exampleButton(753427)}</div>`:''}`);
}
function filterChips(kind){
 const f=kind==='audit'?state.auditFilters:state.filters;
 const names=kind==='audit'?{purpose:PURPOSE,packaging:PACK,relational_mode:REL}:{template:{yes:'Group template',no:'No group template'},depth:{single:'One user message',multi:'Multiple user messages'},turnBand:Object.fromEntries([...Array.from({length:10},(_,i)=>[String(i+1),`${i+1} user message${i?'s':''}`]),['4-5','4–5 user messages'],['6-10','6–10 user messages'],['11plus','11+ user messages']]),flag:{repeat:'Repeated dialogue',template:'Group template',redacted:'Redacted',empty:'Empty user message',keyword:'Keyword hit',code:'Code markers',creative:'Creative markers',zero:'No user words'}};
 return `<div class="filter-chips">${Object.entries(f).filter(([,v])=>v).map(([key,value])=>`<button class="filter-chip" data-action="remove-filter" data-kind="${kind}" data-key="${key}" aria-label="Remove ${e(names[key]?.[value]||value)} filter">${e(names[key]?.[value]||value)} <span aria-hidden="true">×</span></button>`).join('')}</div>`;
}
function overviewOrigin(){
 const back=new URLSearchParams(location.hash.split('?')[1]||'').get('back');
 return back?.split('?')[0]==='overview'?back:null;
}
function overviewReturn(){return overviewOrigin()?'<div class="case-context"><button class="text-button" data-action="return-chart">← Overview chart</button></div>':'';}
function withOverviewOrigin(target){
 const [page,query='']=target.split('?'),q=new URLSearchParams(query);
 if(route==='overview'){
  syncViewURL();const back=location.hash.slice(1);readingPositions.set(back,window.scrollY);q.set('back',back);
 }else if((route==='audit'||route==='explorer')&&overviewOrigin())q.set('back',overviewOrigin());
 return page+(q.size?'?'+q.toString():'');
}
function returnToChart(){
 const target=caseReturnTarget();
 returnPosition=readingPositions.has(target)?readingPositions.get(target):null;
 location.hash=target;
}

function turnMap(x){
 const t=focusTurn(x),topics=turnTopics[x.id]||[];
 return `<div class="record-timeline"><div class="timeline-caption"><span>Conversation sequence</span><span>Select a turn to read its context</span></div><div class="record-turns" aria-label="Stored user turns">${x.turns.map(turn=>`<button class="record-turn ${turn.turn===t.turn?'is-focus':''}" data-action="jump-turn" data-id="${turn.turn}" aria-label="Read turn ${turn.turn}: ${e(topics[turn.turn-1]||'User input')}"><b>${turn.turn}</b><span>${e(topics[turn.turn-1]||'User input')}</span>${turn.turn===t.turn?'<small>Shown above</small>':''}</button>`).join('')}</div></div>`;
}
function overviewExamples(){
 return `<section class="overview-examples" aria-labelledby="overview-examples-title">
  <div class="overview-section-heading"><div><h2 id="overview-examples-title">Example exchanges</h2><p>Selected records · dataset text (identifiers hidden where marked). <a href="#methods?source=examples">Sources ↗</a></p></div><a href="#cases">All examples →</a></div>
  <div class="overview-exchange-grid">${[1671993,286012,2606561].map(id=>{
   const x=D.examples.find(x=>x.id===id),t=focusTurn(x);
   return `<article class="overview-exchange"><h3>${e(exampleTitle(x.id,x.title))}</h3>
    ${sourcePair(x.id,{turn:t.turn,limit:160})}
    <button data-action="open-case" data-id="${x.id}" data-case-focus="exchange">Read ${x.user_turns>1?'turn '+t.turn+' in context':'this record'} <span aria-hidden="true">→</span></button>
   </article>`;
  }).join('')}</div>
 </section>`;
}
function overview(){const rows=D.records,full=D.validation.scopes.census,one=full.one_n;return `
 ${smallHead('WildChat conversations','WildChat is a dataset of user–AI conversations. Each record stores a sequence of messages, with model, date and language metadata.')}
 ${datasetTakeaways(D.topics,D.validation)}
 ${scopeMetrics(D)}
 <div class="overview-data-links"><a href="#explorer?snapshot=1&view=records">Browse record metadata →</a><a href="#methods?source=units">What counts as a record? ↗</a></div>
 ${overviewExamples()}
 ${topicOverview(D.topics)}
 <section class="overview-sample" aria-labelledby="overview-sample-title">
 <div class="overview-section-heading"><div><h2 id="overview-sample-title">Dataset patterns</h2><p>Message counts and language labels cover the full release. The request analysis below uses ${fmt(D.audit.rows.length)} uniformly sampled records.</p></div><a href="#explorer">All distributions →</a></div>
 ${visualKey()}
 ${expandedAuditTakeaway(D.audit,{compact:true})}
 <div class="overview-sample-charts">
 <section class="chart-panel overview-request-chart"><div class="chart-scope-tag">${fmt(D.audit.rows.length)} final inputs · AI labels</div><div class="chart-heading"><h2>What do users ask?</h2><a href="#audit" data-action="open-requests">Requests ↗</a></div><div class="format-switch" role="group" aria-label="Request chart">${[['relevance','Relational content'],['purpose','Task (sample)']].map(([value,label])=>`<button aria-pressed="${state.overviewAudit===value}" class="${state.overviewAudit===value?'active':''}" data-action="overview-audit" data-value="${value}">${label}</button>`).join('')}</div>${state.overviewAudit==='relevance'?relevanceGrid(D.audit.rows,{action:'open-relational',auditSize:D.audit.rows.length}):miniDistribution(Object.keys(PURPOSE).map(k=>({label:PURPOSE[k],value:k,count:D.audit.rows.filter(r=>r.purpose===k).length})),{denominator:D.audit.rows.length,title:'Final request purpose',action:'open-purpose',unit:'Final inputs',table:false})}<div class="chart-note">Uniform record sample from the full release · AI labels, no human validation. <a href="#methods?source=audit">Source ↗</a></div></section>
 <div class="overview-coverage-charts"><div class="chart-scope-tag">${fmt(full.n)} records · full pinned release</div>
 <section class="chart-panel"><div class="chart-heading"><h2>How much dialogue is stored?</h2><a href="#explorer?snapshot=1&view=exchange" data-action="open-depth">Message counts ↗</a></div><div class="big-stat">${pct(one,full.n)}<span>store one user message</span></div>${segmentedBar([{label:'One user message',count:one,value:'single'},{label:'Multiple',count:full.n-one,value:'multi'}],{denominator:full.n,title:'Stored user messages in the full release',action:'open-depth-filter',table:false})}<div class="chart-note">${fmt(one)} / ${fmt(full.n)} records. Select a segment → matching records in the original 20,000-row sample.</div></section>
 <section class="chart-panel"><div class="chart-heading"><h2>Which languages appear?</h2><a href="#explorer?snapshot=1&view=composition" data-action="open-languages">Language counts ↗</a></div>${miniDistribution(D.validation.categories.language.map(r=>({label:r.label,value:r.label,count:r.census.count})),{denominator:full.n,action:'open-language',limit:7,table:false,scope:false})}<div class="chart-note">${fmt(full.english_n)} / ${fmt(full.n)} (${pct(full.english_n,full.n)}) have an English source label. Select a language → matching records in the original sample.</div></section>
 </div></div></section>
 ${validationOverview(D.validation)}
 `}

function structure(){const ex=D.examples.find(x=>x.kind===state.demo);return smallHead('Inside a record','Metadata + an ordered message list. Supplied material can be inside a message.')+`
 <div class="schema-layout"><div class="dataset-stack"><span class="label">Dataset rows</span><div class="dataset-row">Record 1</div><div class="dataset-row selected">Record 2 →</div><div class="dataset-row">Record 3</div><div class="dataset-row">… more records</div><p class="micro">A row is not a verified person or an independent observation.</p></div><div class="schema-record"><span class="label">One record</span><details class="schema-field" open><summary>Metadata: source model, date, language</summary><p>The model field identifies the AI that generated the stored reply. It is not an EDA annotator or a future LLM judge.</p><code>row_index: 255498 · model: gpt-3.5-turbo-0613<br>language: Vietnamese · date: 2023-07-08</code></details><details class="schema-field" open><summary>conversation: an ordered message list</summary><div class="message"><div class="role">user</div>content: current request + any supplied material</div><div class="message assistant"><div class="role">assistant</div>content: the model’s reply</div><p>The example record stores 3 user messages and 3 AI replies. Pasted history inside one user message does not add stored turns.</p></details><details class="schema-field"><summary>Other fields and their limits</summary><p>Language is an automatic source label. Redaction and moderation flags do not establish relational quality or complete removal of sensitive information. Device and location fields are excluded from this site.</p><a href="#methods">View field definitions and sampling →</a></details></div></div>
 <div class="section-head"><h2>Three input formats</h2><p>Counts classify final inputs in the ${fmt(D.audit.rows.length)}-record uniform sample.</p></div>
 <div class="tabs" role="group" aria-label="Input formats">${[['direct','Direct request · '+D.audit.rows.filter(r=>r.packaging==='direct_request').length],['document','Supplied document · '+D.audit.rows.filter(r=>r.packaging==='pasted_document').length],['embedded','Embedded dialogue · '+D.audit.rows.filter(r=>r.packaging==='embedded_history').length]].map(([k,l])=>`<button class="tab ${state.demo===k?'active':''}" aria-pressed="${state.demo===k}" data-action="demo" data-value="${k}">${l}</button>`).join('')}</div>
 <div class="grid-2"><div class="panel input-demo"><span class="label">Example · ${ex.id}</span><h3>${e(ex.title)}</h3><div class="message"><div class="role">User input (paraphrase)${state.demo==='direct'?' · turn 3':''}</div>${state.demo!=='direct'?`<div class="supplied">${state.demo==='document'?'[Supplied job advert]':'[Bot rules + supplied group history]'}</div>`:''}${e(state.demo==='direct'?ex.turns.at(-1).user:ex.turns[0].user)}</div><div class="message assistant"><div class="role">AI reply (paraphrase)</div>${e(state.demo==='direct'?ex.turns.at(-1).assistant:ex.turns[0].assistant)}</div></div><div class="panel"><span class="label">What to notice</span><h3>${state.demo==='direct'?'A direct request can have earlier turns.':state.demo==='document'?'One message can contain a document.':'A pasted conversation is inside the input.'}</h3><p>${e(ex.observed)}</p><div class="definition-line">${e(ex.limit)}</div><p class="micro">${e(ex.selection)}. Deidentified English paraphrases.</p><button class="button secondary small" data-action="open-case" data-id="${ex.id}">Read example →</button></div></div>
 ${takeaway('Extract the active request with the context it needs. Count supplied history separately from stored turns.')}`}
const flagMatch={repeat:r=>r.repeat_count>1,template:r=>r.group_template,redacted:r=>r.redacted,empty:r=>r.empty_user_messages>0,keyword:r=>r.candidate,code:r=>r.code_flag,creative:r=>r.creative_flag,zero:r=>r.user_words===0};
function selectedRecords(filters=state.filters){const f=filters;return D.records.filter(r=>(!f.language||r.language===f.language)&&(!f.year||r.year===Number(f.year))&&(!f.family||r.model_family===f.family)&&(!f.template||(f.template==='yes')===r.group_template)&&(!f.depth||(f.depth==='single'?r.user_turns===1:r.user_turns>1))&&(!f.month||r.date.startsWith(f.month))&&(!f.turnBand||(f.turnBand==='11plus'?r.user_turns>=11:f.turnBand==='4-5'?r.user_turns>=4&&r.user_turns<=5:f.turnBand==='6-10'?r.user_turns>=6&&r.user_turns<=10:r.user_turns===Number(f.turnBand)))&&(!f.flag||flagMatch[f.flag]?.(r)))}
function explorerFinding(rows){if(state.explorerTab==='exchange'&&(state.filters.depth||state.filters.turnBand))return '';const single=rows.filter(r=>r.user_turns===1).length;const text={composition:'These charts show dataset coverage. Relational relevance requires reading the request and reply.',exchange:`${pct(single,rows.length)} of selected records store one user message. Pasted history can still be inside it.`,length:'Long input can be a supplied document or pasted history. Word count alone does not show dialogue depth.',quality:'These flags locate repeated text and input formats.',records:'This table contains metadata only. Linked record IDs open examples.'}[state.explorerTab];return `<p class="section-finding">${e(rows.length?text:'No records match this selection.')}</p>`}
function explorer(){const rows=selectedRecords(),eng=rows.filter(r=>r.language==='English'),f=state.filters,semantic=['topic','task'].includes(state.explorerTab),kind=state.explorerTab==='task'?'intent':'domain';return smallHead('Distributions',semantic?'Topic = subject matter. Task = what the user asks AI to do.':'Full-release statistics, compared with two 20,000-row samples · <a href="#methods?source=validation">Methods ↗</a>')+`
 ${overviewReturn()}<div class="view-controls global-distribution-views"><div class="tabs" role="group" aria-label="Distribution views">${[['topic','Topic'],['task','Task'],['composition','Coverage'],['exchange','Turns & dates'],['length','Text length'],['quality','Flags'],['records','Rows']].map(([k,l])=>`<button class="tab ${state.explorerTab===k?'active':''}" aria-pressed="${state.explorerTab===k}" data-action="explorer-tab" data-value="${k}">${l}</button>`).join('')}</div></div>${semantic?topicView(D.topics,{kind,selected:state.topicSelected[kind],expanded:state.topicExpanded[kind]}):`${validationPanel(D.validation,state.explorerTab)}
 <div class="sample-browser-heading" id="sample-browser" tabindex="-1"><h2>Browse the original sample</h2><p>Filters and examples below use 20,000 records. The full-release comparison above stays fixed.</p></div>
 <div class="workspace-tools explorer-tools">${filterDisclosure('explorer',`<div class="toolbar">${field('filter-language','Source language',D.validation.categories.language.map(r=>[r.key,`${r.label} (${fmt(r.original.count)})`]),f.language,'All source labels')}${field('filter-year','Source year',[2023,2024,2025],f.year,'All years')}${field('filter-family','Source model family',counts(D.records,'model_family').map(x=>x[0]),f.family,'All families')}${field('filter-template','Known group template',[['yes','Template match'],['no','No template match']],f.template,'All template matches')}${field('filter-depth','Stored user messages',[['single','One message'],['multi','More than one']],f.depth,'All message counts')}<button class="button secondary" data-action="reset-filters">Reset</button></div>`)}${filterChips('explorer')}
 <div class="view-controls"><span><strong id="selected-count">${fmt(explorerRows().length)}</strong> <span id="selected-scope">of 20,000 records selected (${pct(explorerRows().length,20000)}).</span></span>
 </div></div>
 ${explorerFinding(rows)}
 <div class="distribution-workspace"><div class="distribution-charts"><div class="chart-selection-guide"><span>Choose a chart value</span><b aria-hidden="true">→</b><span>Open a matching example</span></div>${explorerView(rows,eng)}</div><aside id="distribution-examples" aria-label="Examples matching chart selection">${exampleRail()}</aside></div>`}
 `}
function explorerView(rows,eng){switch(state.explorerTab){
 case 'composition':return `<div class="grid-2">${chart('Language labels','Counts before language filtering · select a bar',miniDistribution(counts(selectedRecords({...state.filters,language:''}),'language'),{denominator:selectedRecords({...state.filters,language:''}).length,action:'filter-language',limit:10,scope:false}),'Automatic labels; one input may contain several languages.')}${chart('Source models','Counts before model-family filtering · select a bar',miniDistribution(counts(selectedRecords({...state.filters,family:''}),'model_family'),{denominator:selectedRecords({...state.filters,family:''}).length,action:'filter-family',scope:false}),'Coverage, not a model-quality comparison.')}</div><div class="chart-wide">${chart('Models × year','Counts before model/year filtering · select a cell',modelHeatmap(selectedRecords({...state.filters,family:'',year:''})),'Each column uses its own year’s record count.')}</div>`;
 case 'exchange':return `<div class="grid-2">${chart('Stored user messages','Before message-count filtering · select a bar',turnHistogram(selectedRecords({...state.filters,depth:'',turnBand:''})),'Pasted dialogue does not add stored turns.')}${chart('Records by month','Before month filtering · select a point',monthCoverage(selectedRecords({...state.filters,month:''})),'Sample coverage, not a trend in all WildChat usage.')}</div>${disclose('One message can contain a longer history',`<div class="compact-message-flow"><div><span>User message</span><b>Request + pasted history</b></div><span aria-hidden="true">→</span><div><span>AI message</span><b>Stored reply</b></div></div><p>The people and events in pasted history are not independently verified.</p>`)}`;
 case 'length':return `<div class="grid-2">${chart('Text length',`${fmt(eng.length)} English-labeled records`,ecdfExplorer(eng,state.chartProbe))}${chart('Input × output',`${fmt(eng.length)} English-labeled records`,densityExplorer(eng,state.chartProbe))}</div><div class="chart-wide">${chart('Length by template match','English-labeled records · matched versus unmatched',templateBoxplot(eng,state.chartProbe),'Whitespace words, summed per record and role. Template matching identifies a format, not a verified group conversation.')}</div>`;
 case 'quality':{const flagRows=selectedRecords({...state.filters,flag:''});const notes={repeat:['Repeated dialogue','Selected records whose dialogue occurs more than once in the original 20,000-row sample. Separate duplicate conversations before splitting data.'],template:['Group template','A literal prompt-format match. It does not verify real group participation.'],redacted:['Source redaction','The source marked a redaction. An unflagged record is not guaranteed free of personal information.'],empty:['Empty user message','At least one stored user message contains no non-whitespace text.'],keyword:['Keyword hit','Passed the English keyword screen. It is not a confirmed relational case.'],code:['Code markers','User text matched code-related markers. Supplied code can trigger this flag; it is not a verified task category.'],creative:['Creative markers','User text matched creative-writing or roleplay markers. Supplied text can trigger this flag; it is not a verified task category.'],zero:['No user words','All stored user messages are empty after trimming whitespace. These 64 records are included in the broader empty-message flag.']};const chosen=notes[state.filters.flag]||['Select a flag','Each bar counts records. A record can have more than one flag.'];return `<div class="grid-2">${chart('Record flags','Counts before flag filtering · select one',miniDistribution(Object.entries(notes).map(([key,[label]])=>({label,value:key,count:flagRows.filter(flagMatch[key]).length})),{denominator:flagRows.length,action:'filter-flag',color:colors.teal,table:false}),'Flags overlap; shares do not add to 100%.')}<section class="flag-detail"><span class="label">Selected flag</span><h2>${chosen[0]}</h2><p>${chosen[1]}</p><button class="example-link" data-action="explorer-tab" data-value="records">View metadata →</button></section></div>${disclose('Repetition in the original sample','<p>The original 20,000-row sample contains 1,370 copies beyond distinct dialogues. This differs from counting every row that belongs to a repeated dialogue.</p>')}`}
 case 'records':return recordTable(probeRecords(rows));
}}
function recordTable(rows){let sorted=[...rows].sort((a,b)=>state.sort==='row_index'?a.row_index-b.row_index:state.sort==='date'?b.date.localeCompare(a.date):b[state.sort]-a[state.sort]);const pages=Math.max(1,Math.ceil(rows.length/25));state.recordPage=Math.min(state.recordPage,pages-1);const batch=sorted.slice(state.recordPage*25,(state.recordPage+1)*25);return `<div class="table-meta"><span>Metadata only. Source conversation text is not included.</span><div style="display:flex;gap:10px;align-items:center">${field('record-sort','Sort', [['row_index','Source row'],['date','Newest first'],['user_words','Longest input'],['user_turns','Most stored turns']],state.sort,null)}<button class="button secondary small" data-action="export-records">Download selected rows (CSV) ↓</button></div></div><div class="record-table-wrap"><table><thead><tr><th>Source row</th><th>Language</th><th>Model family</th><th>Date</th><th>User messages</th><th>Input words</th><th>Output words</th><th>Group template</th></tr></thead><tbody>${batch.map(r=>`<tr><td>${D.examples.some(x=>x.id===r.row_index)?exampleButton(r.row_index,String(r.row_index)):r.row_index}</td><td>${e(r.language)}</td><td title="${e(r.model)}">${e(r.model_family)}</td><td>${r.date}</td><td class="numeric">${r.user_turns}</td><td class="numeric">${fmt(r.user_words)}</td><td class="numeric">${fmt(r.assistant_words)}</td><td>${r.group_template?badge('Matched'):'—'}</td></tr>`).join('')||'<tr><td colspan="8">No records match these filters. Use Reset above.</td></tr>'}</tbody></table></div><div class="table-meta"><span>${rows.length?state.recordPage*25+1:0}–${Math.min((state.recordPage+1)*25,rows.length)} of ${fmt(rows.length)} records</span>${pagination('record',state.recordPage,pages)}</div><p class="evidence-note">Source row is an offset in the pinned dataset, not a person identifier. Word counts here describe the source text; cross-language comparisons are not equivalent to the English-only length charts.</p>`}
function pagination(name,page,pages){return `<div class="pagination"><button data-action="${name}-page" data-step="-1" ${page===0?'disabled':''} aria-label="Previous page">←</button><span>Page ${page+1} / ${pages}</span><button data-action="${name}-page" data-step="1" ${page>=pages-1?'disabled':''} aria-label="Next page">→</button></div>`}
function filteredAudit(){return D.audit.rows.filter(r=>auditMatches(r,state.auditFilters))}
function auditMatrix(){const rows=filteredAudit(),f=state.auditFilters,pkeys=Object.keys(PURPOSE),packs=Object.keys(PACK),cell=(p,k)=>rows.filter(r=>r.purpose===p&&r.packaging===k).length,maximum=Math.max(1,...pkeys.flatMap(p=>packs.map(k=>cell(p,k))));
 if(!rows.length)return `<div class="empty-state">No requests match these filters.<button class="text-button" data-action="reset-audit">Clear filters</button></div>`;
 return chart('Purpose × input format',`${rows.length} selected final inputs · view a cell`, `<div class="horizontal-scroll"><table class="heatmap-table" data-viz="matrix"><thead><tr><th>Purpose</th>${packs.map(k=>`<th>${PACK[k]}</th>`).join('')}</tr></thead><tbody>${pkeys.map(p=>`<tr><th>${PURPOSE[p]}</th>${packs.map(k=>{const n=cell(p,k),a=n/maximum;return `<td><button ${!n&&rows.length<D.audit.rows.length?'disabled':''} class="heatmap-cell ${f.purpose===p&&f.packaging===k?'active':''}" data-action="audit-cell" data-purpose="${p}" data-packaging="${k}" style="background:rgba(65,110,178,${.04+a*.85});color:${a>.6?'white':'#123341'}" aria-label="${PURPOSE[p]}, ${PACK[k]}: ${n} records">${n}</button></td>`}).join('')}</tr>`).join('')}</tbody></table></div>`);
}
function auditScope(rows){return `<div class="audit-scope-summary" aria-label="Result scope and label status"><div class="audit-current"><span>Current matches</span><strong id="audit-count">${rows.length}</strong><small>final inputs</small></div><div><span>Random draw</span><strong>${D.audit.rows.length}</strong><small>records · one final input each</small></div><div class="audit-label-status"><span>Label status</span><strong>AI labels</strong><small>${fmt(auditStats(D.audit).primaryLabeled)} completed · no human validation</small></div></div>`;}
function auditActiveFilters(){const names={purpose:'Purpose',packaging:'Input format',relational_mode:'Relational label',confidence:'AI confidence',benchmark_route:'Earlier proposed-use filter',review_status:'AI review',source_check:'AI source check',context:'Setting',earlier_only:'Earlier request'},labels={purpose:PURPOSE,packaging:PACK,relational_mode:REL,benchmark_route:BENCHMARK_ROUTES,review_status:REVIEW_STATES,source_check:SOURCE_CHECK_STATES,context:CONTEXTS,earlier_only:{yes:'Flagged earlier only'}};const active=Object.entries(state.auditFilters).filter(([,v])=>v);return `<div class="audit-active-filters"><span>Filters:</span>${active.length?active.map(([key,value])=>`<button class="filter-chip" data-action="remove-filter" data-kind="audit" data-key="${key}" aria-label="Remove ${e(names[key])}: ${e(labels[key]?.[value]||value)}">${e(names[key])}: <strong>${e(labels[key]?.[value]||value)}</strong> <span aria-hidden="true">×</span></button>`).join(''):`<strong>None · all ${fmt(D.audit.rows.length)} inputs</strong>`}${active.length?'<button class="text-button" data-action="reset-audit">Clear all</button>':''}</div>`;}
function auditCategoryInfo(){const mode=RELATIONAL_MODES.find(m=>m.key===state.auditFilters.relational_mode);return mode?`<div class="audit-category-info rv-${mode.tone}"><strong>${e(mode.label)}</strong><span>${e(mode.definition)}</span></div>`:'';}
function audit(){if(state.auditView==='personal')return smallHead('Personal-help requests','31 AI-labeled requests · original text with separate paraphrases')+overviewReturn()+`<div class="tabs p31-view-tabs" role="group" aria-label="Request views"><button class="tab active" aria-pressed="true" data-action="audit-view" data-value="personal">31 personal-help requests</button><button class="tab" aria-pressed="false" data-action="audit-view" data-value="charts">All request charts</button></div>`+personalReviewView(D.audit,{decision:state.personalDecision,record:state.personalRecord,requestType:state.personalType});const f=state.auditFilters,rows=filteredAudit(),pkeys=Object.keys(PURPOSE);return smallHead('Requests',`${fmt(D.audit.rows.length)} records · one final request per record · AI labels`)+`
 ${overviewReturn()}
 ${expandedAuditTakeaway(D.audit)}
 ${auditScope(rows)}
 <p class="audit-scope-note">Uniform draw from ${fmt(D.audit.metadata.population_rows)} released rows. Charts show first-pass AI labels; ambiguous cases stay visible. <a href="#methods?source=audit">Sampling & AI review ↗</a></p>
 <div class="workspace-tools audit-tools">${filterDisclosure('audit',`<div class="toolbar">${field('audit-purpose','Purpose',Object.entries(PURPOSE),f.purpose,'All purposes')}${field('audit-packaging','Input format',Object.entries(PACK),f.packaging,'All formats')}${field('audit-relational_mode','Relational label',Object.entries(REL),f.relational_mode,'All relevance labels')}${field('audit-review_status','AI checks',Object.entries(REVIEW_STATES),f.review_status,'All statuses')}${field('audit-source_check','AI source check',Object.entries(SOURCE_CHECK_STATES),f.source_check,'All source-check statuses')}${field('audit-context','Setting',Object.entries(CONTEXTS),f.context,'All settings')}${field('audit-confidence','AI confidence',['high','medium','low'],f.confidence,'All levels')}<button class="button secondary" data-action="reset-audit">Reset</button></div>`)}
 <div class="tabs" role="group" aria-label="Request views">${[['charts','Charts'],['flow','Flow'],['matrix','Matrix'],['records','Matching requests'],['personal','31 personal-help requests']].map(([k,l])=>`<button class="tab ${state.auditView===k?'active':''}" aria-pressed="${state.auditView===k}" data-action="audit-view" data-value="${k}">${l}</button>`).join('')}</div>
 ${auditActiveFilters()}</div>
 ${auditCategoryInfo()}
 ${state.auditView!=='records'&&rows.length<D.audit.rows.length?'<p class="audit-chart-scope">Charts show current matches.</p>':''}
 ${state.auditView==='flow'?chart('Purpose → input format',`${rows.length} current matches · select a ribbon`,purposeFlow(rows,{PURPOSE,PACK}),`Ribbon width = final inputs within these matches. Random draw: ${fmt(D.audit.rows.length)} records.`):state.auditView==='matrix'?auditMatrix():state.auditView==='records'?auditTable(rows):!rows.length?auditEmpty():`<div class="audit-charts"><section class="chart-panel audit-relevance"><div class="chart-heading"><h2>Relational content</h2></div>${relevanceGrid(rows,{auditSize:D.audit.rows.length})}</section><div class="chart-stack audit-secondary"><section class="chart-panel"><div class="chart-heading"><h2>Request purpose</h2></div>${miniDistribution(pkeys.map(k=>({label:PURPOSE[k],value:k,count:rows.filter(r=>r.purpose===k).length,interactive:rows.some(r=>r.purpose===k)||rows.length===D.audit.rows.length})),{denominator:rows.length,action:'select-purpose',title:'Request purpose',unit:'Current matches',table:false})}</section><section class="chart-panel"><div class="chart-heading"><h2>Input format</h2></div>${segmentedBar(Object.keys(PACK).map(k=>({label:PACK[k],value:k,count:rows.filter(r=>r.packaging===k).length,interactive:rows.some(r=>r.packaging===k)||rows.length===D.audit.rows.length})),{denominator:rows.length,title:'Input packaging',action:'select-packaging',unit:'Current matches',table:false})}</section></div></div>`}
 ${disclose('Label definitions',`<div class="axis-definitions"><p><strong>Purpose</strong> = the task the user asks AI to do.</p><p><strong>Input format</strong> = how that request is presented.</p><p><strong>Relational label</strong> = how the request involves other people.</p></div><p>Labels describe the request, not the quality of the reply.</p><div class="record-table-wrap"><table><tbody>${RELATIONAL_MODES.map(m=>`<tr><th>${e(m.label)}</th><td>${e(m.definition)}<br><code>${e(m.key)}</code></td></tr>`).join('')}${pkeys.map(k=>`<tr><th>${PURPOSE[k]}</th><td>${e(D.aggregates.audit.purpose_definitions[k])}</td></tr>`).join('')}</tbody></table></div>`)}`;}
function auditEmpty(){return `<div class="audit-empty"><strong>No requests match these filters.</strong><p>Clear a filter to see other requests in this random draw.</p><button class="text-button" data-action="reset-audit">Clear filters →</button></div>`;}
function auditReviewStatus(r){return expandedReviewStatus(r)}
function auditRecordURL(id){
 const q=new URLSearchParams({snapshot:'1',view:'records',page:String(state.auditPage+1),record:String(id)});
 for(const[k,v]of Object.entries(state.auditFilters))if(v)q.set(k,v);
 const back=overviewOrigin();if(back)q.set('back',back);
 return '#audit?'+q.toString();
}
function auditTable(rows){const pages=Math.max(1,Math.ceil(rows.length/15));state.auditPage=Math.min(state.auditPage,pages-1);if(!rows.length)return auditEmpty();return `<div class="audit-results-heading"><h2>Matching requests</h2><p>AI summaries are labeled separately. Selected records include original questions and responses.</p></div><div class="audit-request-table"><table><thead><tr><th>Request & evidence</th><th>First-pass AI labels</th><th>Review status</th></tr></thead><tbody>${rows.slice(state.auditPage*15,(state.auditPage+1)*15).map(r=>`<tr data-audit-row="${r.row_index}" tabindex="-1"><td data-label="Request"><a class="audit-row-id" href="${e(auditRecordURL(r.row_index))}">Record ${r.row_index} ↗</a> <span class="audit-row-id">${e(r.language)}</span><p>${e(r.reason)}</p>${auditRowDetail(r)}${D.examples.some(x=>x.id===r.row_index)?exampleButton(r.row_index,'Read earlier example'):''}</td><td data-label="Labels"><strong class="audit-row-relevance">${e(REL[r.relational_mode])}</strong><span>Purpose: ${e(PURPOSE[r.purpose])}</span><span>Format: ${e(PACK[r.packaging])}</span><span>Framing: ${e(FRAMES[r.frame]||r.frame)}</span></td><td data-label="Review">${auditReviewStatus(r)}</td></tr>`).join('')}</tbody></table></div><div class="table-meta"><span>Showing ${state.auditPage*15+1}–${Math.min((state.auditPage+1)*15,rows.length)} of ${fmt(rows.length)} matches · original draw: ${fmt(D.audit.rows.length)}</span>${pagination('audit',state.auditPage,pages)}</div><p class="audit-review-footnote">AI checks are not human validation. <a href="data/relational_v2.json" download>Labels & provenance ↓</a></p>`;}
function openRelationalRequests(value){
 if(!Object.hasOwn(REL,value))return;
 if(route!=='audit')Object.keys(state.auditFilters).forEach(k=>state.auditFilters[k]='');
 state.auditRecord=null;state.auditFilters.relational_mode=value;state.auditView='records';state.auditPage=0;
 const q=new URLSearchParams({snapshot:'1',view:'records',page:'1'});for(const[k,v]of Object.entries(state.auditFilters))if(v)q.set(k,v);
 const target=withOverviewOrigin('audit?'+q.toString());if(location.hash.slice(1)===target)render({scroll:true});else location.hash=target;
}

const caseOrder=[286012,753427,2632268,255498,1671993,2606561];
const caseTags={255498:'Learning',1671993:'Supplied document',2606561:'Embedded dialogue',286012:'Workplace drafting',753427:'Workplace advice',2632268:'AI social participation'};
function cases(){const x=D.examples.find(x=>x.id===state.caseId)||D.examples[0];return smallHead('Examples','Dataset questions and responses · expand for full text and context')+`
 <div class="section-head"><h2>Selected records</h2><a href="#methods?source=examples">Selection & sample membership →</a></div>
 ${caseContext()}
 <div class="case-browser"><div class="case-mobile-picker"><label for="case-picker">Choose example</label><select id="case-picker">${caseOrder.map(id=>D.examples.find(c=>c.id===id)).map(c=>`<option value="${c.id}" ${c.id===x.id?'selected':''}>${e(c.title)}</option>`).join('')}</select></div><aside class="case-list" aria-label="Choose a record">${[['Advice & drafting',[286012,753427]],['AI participation',[2632268]],['Input formats',[255498,1671993,2606561]]].map(([label,ids])=>`<div class="case-nav-group"><h3>${label}</h3>${ids.map(id=>{const c=D.examples.find(c=>c.id===id);return `<button class="case-choice ${c.id===x.id?'selected':''}" data-action="select-case" data-id="${c.id}" aria-pressed="${c.id===x.id}"><strong>${e(c.title)}</strong><span>${`${c.user_turns} user message${c.user_turns===1?'':'s'}`} <span>↗</span></span></button>`}).join('')}</div>`).join('')}<div class="list-footnote">Selected examples; not a frequency estimate.</div></aside>${caseDetail(x)}</div>${randomExampleCards(D.audit)}`}
function caseDetail(x){const idx=caseOrder.indexOf(x.id),f=currentCaseFocus(x);return `<article class="conversation-pane" id="case-detail"><header class="conversation-header"><div><span class="label">Record ${x.id}</span><h2>${e(x.title)}</h2>${caseBackButton()}</div><div class="case-pager"><button data-action="select-case" data-id="${caseOrder[(idx+5)%6]}" aria-label="Previous example">←</button><span>${idx+1} / 6</span><button data-action="select-case" data-id="${caseOrder[(idx+1)%6]}" aria-label="Next example">→</button></div></header>
 <p class="case-provenance">${e(x.language)} source label · ${x.user_turns} stored user messages · ${exampleMembership(x.id)}</p>
 ${caseEvidenceMap(x,f)}
 ${x.id===286012?'<p class="source-limit">The final reply ends mid-sentence in the source record.</p>':''}
 ${x.user_turns>1?turnMap(x):''}
 ${sourceConversation(x.id,{id:'full-transcript',turnIds:true})}
 <details class="source-paraphrase disclosure"><summary>English paraphrase (AI)</summary><p>${e(x.summary)}</p>${x.turns.map(t=>`<div class="source-paraphrase-turn"><small>Turn ${t.turn}</small><p><b>User:</b> ${e(t.user)}</p><p><b>AI reply:</b> ${e(t.assistant)}</p></div>`).join('')}<p class="micro">AI-written paraphrases, not quotations. No human validation recorded.</p></details>
 <details id="case-evidence-gap" tabindex="-1" class="disclosure ${f?.node==='gap'?'case-focus-target fit-needed':''}" ${f?.node==='gap'?'open':''}><summary>Evidence gap & source limits</summary><div class="disclosure-body">${f?.node==='gap'?focusNote(x,f):''}${list(x.missing)}<p>${e(x.limit)}</p></div></details>
 ${disclose('Source & selection',`<p>${e(x.language)} source label · ${e(x.model)} · ${x.user_turns} stored user messages.</p><p><strong>Selection:</strong> ${e(x.selection)}</p><p>Text comes from the pinned public WildChat release. Any additional identifier redactions are marked; English paraphrases are separate.</p><p><a href="${e(D.meta.links.pinned_dataset)}" target="_blank" rel="noopener">Pinned dataset ↗</a> · <a href="data/source_texts.json">Source text & provenance ↗</a></p><p>Contains information from WildChat, made available under the <a href="https://opendatacommons.org/licenses/by/1-0/" target="_blank" rel="noopener">ODC Attribution License</a>.</p>`)}${f?'<div id="case-focus-room" aria-hidden="true"></div>':''}</article>`}

function fit(){
 return smallHead('Data limits','What the records show, what is missing, and what keyword search retrieves.')+`
 ${evidenceMatrix()}
 <div class="section-head"><h2>What the keyword search found</h2><span class="mini-note">Separate retrieval audit</span></div>
 ${retrievalFlow({mode:state.retrievalMode,group:state.retrievalGroup})}
 ${disclose('Group templates in keyword hits',`<div class="template-enrichment"><a href="#explorer?snapshot=1&language=English&template=yes&view=quality"><span>Original sample · English</span><i style="--share:6.6%"></i><strong>6.6%</strong><small>704 / 10,636</small></a><a href="#explorer?snapshot=1&language=English&template=yes&flag=keyword&view=quality"><span>Keyword hits</span><i style="--share:39.3%"></i><strong>39.3%</strong><small>686 / 1,747</small></a></div><p class="micro">Share matching the group-bot template. Relationship words inside supplied histories can trigger the screen.</p>`)}

 `}

const figureNames={'01_languages':'Language labels','02_models':'Source model families','03_models_by_year':'Model coverage by year','04_stored_turns':'Stored user messages','05_text_length_ecdf':'Input/output length ECDF','06_template_length':'Template length distribution','07_repetition_quality':'Repetition and quality flags','08_month_coverage':'Month coverage','09_request_purpose':'Request purpose','10_purpose_packaging':'Purpose × packaging','11_relational_modes':'Relational relevance','12_joint_lengths':'Joint input/output density'};
function analysisCoverage(){const c=D.coverage;return `<section class="analysis-coverage"><div class="section-head"><h2>Checks completed</h2></div><div class="coverage-links">
<a href="#methods?source=validation"><span>Full-release scan</span><strong>${fmt(D.validation.source.n)}</strong><span>rows · all ${D.validation.source.shards} files →</span></a>
<a href="#audit?snapshot=1&view=charts"><span>Request labels</span><strong>${fmt(auditStats(D.audit).primaryLabeled)} / ${fmt(D.audit.metadata.n)}</strong><span>final inputs →</span></a>
<a href="#fit"><span>Retrieval review</span><strong>${c.retrieval_audit.hits.reviewed} + ${c.retrieval_audit.nonhits.reviewed}</strong><span>hits + non-hits →</span></a>
<a href="#cases"><span>Earlier examples checked by AI</span><strong>6 / 6</strong><span>records →</span></a></div><p class="coverage-note">AI review is not human validation. <a href="#methods?source=audit">Review status ↗</a></p>
<details class="coverage-checks"><summary>Checks & limits</summary><div class="coverage-check-body"><p><strong>Original sample:</strong> 17 exported fields; no missing values or duplicate source IDs.</p><p><strong>Label checks:</strong> ${fmt(auditStats(D.audit).checked)} second AI passes; ${fmt(auditStats(D.audit).human)} human-validated labels.</p><p><strong>Scope:</strong> The new ${fmt(D.audit.rows.length)}-record draw, earlier 120-record analysis and retrieval audit remain separate. Relational labels cover the random sample only. Microsoft’s separate topic/task labels are summarized under Distributions.</p></div></details></section>`}
function methods(){const m=D.meta;return smallHead('Methods & sources','Sources, sampling and label checks')+`
 <div class="scope-strip"><span>${e(m.source.dataset)}</span><span>Original sample: ${e(m.source.retrieval_date)}</span><a href="${e(m.links.pinned_dataset)}" target="_blank" rel="noopener">Pinned release ↗</a></div>
 ${new URLSearchParams(location.hash.split('?')[1]||'').get('source')==='topics'?topicMethods(D.topics):sourceNotes(D,new URLSearchParams(location.hash.split('?')[1]||'').get('source'))}
 ${analysisCoverage()}
 ${disclose('Earlier sampling paths (separate from the new random draw)',samplingMap(m))}
 ${disclose('Collection & sampling',`<p>WildChat offered free ChatGPT access to users who opted in to transcript collection. Its <a href="${e(m.links.paper)}" target="_blank" rel="noopener">original paper</a> describes one million conversations. This EDA uses a later pinned release.</p><div class="method-steps">${D.learning.methodSteps.map(x=>`<div class="method-step"><h3>${e(x.title)}</h3><p>${e(x.body)}</p></div>`).join('')}</div><p>Agreement between AI reviewers is not human validation.</p><p class="micro">Revision: <code>${e(m.source.revision)}</code></p>`)}
 ${disclose('17 metadata fields',`<div class="record-table-wrap"><table><thead><tr><th>Field</th><th>Meaning</th></tr></thead><tbody>${Object.entries(m.fields).map(([k,v])=>`<tr><th><code>${e(k)}</code></th><td>${e(v)}</td></tr>`).join('')}</tbody></table></div>`)}
 <div class="section-head"><h2>Sources & downloads</h2></div>
 <div class="source-compact">${D.learning.sources.map(x=>`<a href="${e(x.url)}" target="_blank" rel="noopener">${e(x.title)} ↗</a>`).join('')}</div>
 <div class="download-grid"><a class="button secondary" href="data/validation.json" download>Census & sample comparison ↓</a><a class="button" href="assets/WildChat_Relational_EDA.pdf" download>Public figure book (PDF) ↓</a><a class="button secondary" href="data/records.json" download>20,000 metadata rows ↓</a><a class="button secondary" href="data/relational_v2.json" download>${fmt(D.audit.rows.length)} random content labels ↓</a><a class="button secondary" href="data/audit.json" download>Earlier 120 labels ↓</a><a class="button secondary" href="data/aggregates.json" download>Aggregates ↓</a><a class="button secondary" href="data/source_metadata.json" download>Source manifest ↓</a><a class="button secondary" href="data/analysis_coverage.json" download>Analysis checks ↓</a><a class="button secondary" href="data/scope_verification.json" download>Statistical scope checks ↓</a></div>
 <p class="evidence-note">Original text for ${fmt(D.sourceCount)} selected records is included; the rest of the catalog contains metadata and AI summaries. Optional paraphrases are labeled separately. Request summaries are AI-generated; no human validation is recorded. Source row offsets remain for traceability.</p>
 ${disclose('12 original-sample figures',`<div class="figures-grid">${m.assets.filter(x=>x.path.endsWith('.png')).map(a=>{const key=a.path.split('/').pop().replace('.png','');return `<button class="figure-tile" data-action="figure" data-src="${e(a.path)}" data-title="${e(figureNames[key]||key)}"><img src="${e(a.path)}" loading="lazy" alt="${e(figureNames[key]||key)}"><span>${e(figureNames[key]||key)} ↗</span></button>`}).join('')}</div>`)}
 `}
function glossary(){const term=state.glossarySearch.toLowerCase(),items=D.learning.glossary.filter(g=>[g.term,g.definition,g.zh].join(' ').toLowerCase().includes(term));return smallHead('Glossary','Definitions in English and Chinese')+`<div class="field" style="max-width:500px"><label for="glossary-search">Find a term</label><input id="glossary-search" type="search" placeholder="Find a data or sampling term…" value="${e(state.glossarySearch)}"></div><div class="glossary-grid">${items.map(g=>`<article class="glossary-item"><h3>${e(g.term)}</h3><p>${e(g.definition)}</p><h4>Use in this analysis</h4><p>${e(g.why)}</p><p class="zh" lang="zh">${e(g.zh)}</p></article>`).join('')||'<div class="empty-state">No matching term. Try a shorter search.</div>'}</div><div class="section-head"><h2>Quick questions</h2><p>Your answers stay in this browser.</p></div>${D.learning.quizzes.map(q=>quiz(q.id)).join('')}`}
function render({scroll=false}={}){beforeRender();const focused=document.activeElement;const focusKey=focused?.id?'#'+CSS.escape(focused.id):focused?.dataset?.action?'[data-action="'+focused.dataset.action+'"]'+Object.entries(focused.dataset).filter(([k])=>k!=='action').map(([k,v])=>'[data-'+k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+'="'+CSS.escape(v)+'"]').join(''):null;route=location.hash.slice(1).split('?')[0]||'overview';if(!chapters.some(c=>c[0]===route))route='overview';if(route==='cases'){const id=Number(new URLSearchParams(location.hash.split('?')[1]||'').get('record'));if(D.examples.some(x=>x.id===id))state.caseId=id;}if(!progress.visited.includes(route)){progress.visited.push(route);save()}const views={overview,structure,explorer,audit,cases,fit,methods,glossary};$('#main').innerHTML=views[route]()+nextChapter();document.title=`${chapters.find(c=>c[0]===route)[1]} · WildChat Atlas`;nav();if(route==='cases'&&innerWidth<=700){const active=$('.case-list .selected');if(active)$('.case-list').scrollLeft=active.offsetLeft-$('.case-list').offsetLeft-8;}if(!scroll&&focusKey)$(focusKey)?.focus({preventScroll:true});if(scroll){const menu=$('.reference-menu');if(menu)menu.open=false;window.scrollTo({top:0,behavior:'instant'});$('#main').focus({preventScroll:true})}syncViewURL();mountStatsInteractions($('#main'));markChartSelections();mountCategoryInteractions($('#main'));mountEvidenceInteractions($('#main'));mountResearchInteractions($('#main'));afterRender();landOnCaseFocus();landOnSource();landOnAuditRow();landOnPersonalRow();landOnHubEntry()}
function landOnHubEntry(){
 if(!hubEntryPending)return;hubEntryPending=false;
 if(route!=='explorer'||['topic','task'].includes(state.explorerTab)||!Object.values(state.filters).some(Boolean))return;
 const hash=location.hash;
 requestAnimationFrame(()=>{if(location.hash!==hash)return;const target=$('#sample-browser');if(!target)return;target.focus({preventScroll:true});const header=$('.app-header')?.getBoundingClientRect().height||0;window.scrollTo({top:Math.max(0,target.getBoundingClientRect().top+scrollY-header-14),behavior:'instant'});});
}
function landOnPersonalRow(){if(route!=='audit'||state.auditView!=='personal'||state.personalRecord===null)return;requestAnimationFrame(()=>{const row=document.querySelector(`[data-personal-row="${state.personalRecord}"]`);if(row){row.open=true;row.scrollIntoView({block:'start',behavior:'instant'});}});}
function landOnAuditRow(){if(route!=='audit'||state.auditRecord===null)return;const id=state.auditRecord;requestAnimationFrame(()=>{if(route!=='audit'||state.auditRecord!==id)return;const row=document.querySelector(`[data-audit-row="${id}"]`);if(!row)return;row.querySelector('details.rel-row-detail')?.setAttribute('open','');row.focus({preventScroll:true});const off=document.querySelector('.app-header')?.getBoundingClientRect().height||0;window.scrollTo({top:Math.max(0,row.getBoundingClientRect().top+scrollY-off-14),behavior:'instant'});});}
function markChartSelections(){
 if(route!=='explorer')return;
 for(const el of document.querySelectorAll('.distribution-charts [data-action]')){
  const d=el.dataset;let selected=false;
  if(d.action==='stat-filter')selected=state.filters[d.field]===d.value;
  if(d.action==='filter-language')selected=state.filters.language===d.value;
  if(d.action==='filter-family')selected=state.filters.family===d.value;
  if(d.action==='filter-flag')selected=state.filters.flag===d.value;
  if(d.action==='filter-model-year')selected=state.filters.family===d.family&&state.filters.year===d.year;
  if(selected){el.classList.add('chart-selected');el.setAttribute('aria-pressed','true');}
 }
}
function openCase(id,focus=null){
 state.caseKind='all';state.caseId=Number(id);
 const q=route==='cases'?new URLSearchParams(location.hash.split('?')[1]||''):new URLSearchParams();q.set('record',String(id));q.delete('focus');if(caseFocusFor(id,focus))q.set('focus',focus);
 if(route==='cases')q.delete('selection');
 if(route!=='cases'){
  syncViewURL();const back=location.hash.slice(1);readingPositions.set(back,window.scrollY);
  q.set('back',back);q.set('from',route);
  if(inspection?.label&&inspection.rows.some(r=>r.row_index===Number(id)))q.set('selection',inspection.label+' · '+inspection.rows.length+' requests');
  else if(route==='audit'){
   const rows=filteredAudit(),labels={purpose:PURPOSE,packaging:PACK,relational_mode:REL};
   if(rows.some(r=>r.row_index===Number(id))){
    const filters=Object.entries(state.auditFilters).filter(([,v])=>v).map(([k,v])=>labels[k]?.[v]||v);
    q.set('selection',[...filters,`${rows.length} matching requests`].join(' · '));
   }else if(!D.audit.rows.some(r=>r.row_index===Number(id)))q.set('selection','Outside this random content sample');
  }
  else if(route==='explorer')q.set('selection',explorerSelectionLabel(id));
 }
 inspection=null;
 const hash='cases?'+q.toString();if(location.hash.slice(1)===hash)render({scroll:true});else location.hash=hash;
}

// URL snapshots contain display settings only, never conversation text.
function syncViewURL(){
 const q=route==='cases'?new URLSearchParams(location.hash.split('?')[1]||''):new URLSearchParams();
 if(route==='cases')q.set('record',String(state.caseId));
 if(route==='audit'&&state.auditView!=='personal'&&state.auditRecord!==null)q.set('record',String(state.auditRecord));
 if(route==='audit'||route==='explorer'){
  if(overviewOrigin())q.set('back',overviewOrigin());
  q.set('snapshot','1');
  const filters=route==='audit'?state.auditFilters:state.filters;
  for(const[k,v]of Object.entries(filters))if(v&&!(route==='audit'&&state.auditView==='personal')&&!(route==='explorer'&&['topic','task'].includes(state.explorerTab)))q.set(k,v);
  if(route==='audit'&&state.auditView==='personal'){if(state.personalDecision)q.set('decision',state.personalDecision);if(state.personalRecord!==null)q.set('personal_record',String(state.personalRecord));if(state.personalType)q.set('request_type',state.personalType);}
  q.set('view',route==='audit'?state.auditView:state.explorerTab);
  if(route==='explorer'&&['topic','task'].includes(state.explorerTab)){const k=state.explorerTab==='task'?'intent':'domain';if(state.topicSelected[k])q.set('label',state.topicSelected[k]);if(state.topicExpanded[k])q.set('all','1');}
  if(route==='explorer'&&state.chartProbe)q.set('probe',JSON.stringify(state.chartProbe));
  if(route==='explorer'&&state.explorerTab==='records')q.set('sort',state.sort);
  if((route==='audit'&&state.auditView==='records')||(route==='explorer'&&state.explorerTab==='records'))q.set('page',String((route==='audit'?state.auditPage:state.recordPage)+1));
 }else if(route==='fit'){q.set('role',state.fitRole);q.set('example',String(state.fitExample));q.set('review',state.retrievalMode);q.set('group',state.retrievalGroup);
 }else if(route==='methods'){const topic=new URLSearchParams(location.hash.split('?')[1]||'').get('source');if([...scopeKeys,'topics'].includes(topic))q.set('source',topic);
 }else if(route==='overview'||route==='structure'){
  if(state.demo!=='direct')q.set('format',state.demo);
  if(route==='overview'&&state.overviewAudit!=='relevance')q.set('chart',state.overviewAudit);
 }
 const hash='#'+route+(q.size?'?'+q.toString():'');
 if(location.hash!==hash)history.replaceState(null,'',hash);
}
function restoreViewURL(){
 const r=location.hash.slice(1).split('?')[0],q=new URLSearchParams(location.hash.split('?')[1]||'');
 if(q.get('snapshot')==='1'&&(r==='audit'||r==='explorer')){
  const filters=r==='audit'?state.auditFilters:state.filters;
  const allowed=r==='audit'?{purpose:Object.keys(PURPOSE),packaging:Object.keys(PACK),relational_mode:Object.keys(REL),confidence:['high','medium','low'],benchmark_route:Object.keys(BENCHMARK_ROUTES),review_status:Object.keys(REVIEW_STATES),source_check:Object.keys(SOURCE_CHECK_STATES),context:Object.keys(CONTEXTS),earlier_only:['yes']}:{language:D.validation.categories.language.map(r=>r.key),year:['2023','2024','2025'],family:[...new Set(D.records.map(x=>x.model_family))],template:['yes','no'],depth:['single','multi'],month:[...new Set(D.records.map(x=>x.date.slice(0,7)))],turnBand:[...Array.from({length:10},(_,i)=>String(i+1)),'4-5','6-10','11plus'],flag:Object.keys(flagMatch)};
  for(const k of Object.keys(filters))filters[k]=allowed[k].includes(q.get(k))?q.get(k):'';
  if(r==='explorer'){if(filters.turnBand)filters.depth='';try{state.chartProbe=validProbe(JSON.parse(q.get('probe')))}catch{state.chartProbe=null;}}
  if(r==='audit'){state.auditView=['charts','flow','matrix','records','personal'].includes(q.get('view'))?q.get('view'):'charts';state.auditRecord=q.has('record')&&D.audit.rows.some(row=>row.row_index===Number(q.get('record')))?Number(q.get('record')):null;}
  else{state.explorerTab=['topic','task','composition','exchange','length','quality','records'].includes(q.get('view'))?q.get('view'):(Object.values(filters).some(Boolean)?'composition':'topic');const k=state.explorerTab==='task'?'intent':'domain';state.topicSelected[k]=(k==='intent'?D.topics.intents:D.topics.domains).some(x=>x.id===q.get('label'))?q.get('label'):'';state.topicExpanded[k]=q.get('all')==='1'||(k==='intent'?D.topics.intents:D.topics.domains).findIndex(x=>x.id===state.topicSelected[k])>=10;state.sort=['row_index','date','user_words','user_turns'].includes(q.get('sort'))?q.get('sort'):'row_index';if(!['length','records'].includes(state.explorerTab))state.chartProbe=null;}
  const page=Math.max(0,Math.min(1000,(Number.parseInt(q.get('page'),10)||1)-1));
  if(r==='audit'){state.personalType=Object.hasOwn(PERSONAL_TYPES,q.get('request_type'))?q.get('request_type'):'';state.personalDecision=Object.hasOwn(PERSONAL_DECISIONS,q.get('decision'))?q.get('decision'):'';state.personalRecord=q.has('personal_record')&&personalRows(D.audit).some(row=>row.row_index===Number(q.get('personal_record')))?Number(q.get('personal_record')):null;if(state.auditView==='personal'){state.auditRecord=null;Object.keys(state.auditFilters).forEach(k=>state.auditFilters[k]='');}state.auditPage=page;if(state.auditRecord!==null){const idx=filteredAudit().findIndex(row=>row.row_index===state.auditRecord);if(idx>=0){state.auditView='records';state.auditPage=Math.floor(idx/15);}else state.auditRecord=null;}}else state.recordPage=page;
 }
 if(r==='fit'){state.fitRole=q.get('role')==='participation'?'participation':'advice';state.fitExample=[286012,753427,2632268].includes(Number(q.get('example')))?Number(q.get('example')):state.fitRole==='participation'?2632268:286012;state.retrievalMode=q.get('review')==='nonhits'?'nonhits':'hits';state.retrievalGroup=['personal_drafting','fiction_or_general','unrelated','unclear'].includes(q.get('group'))?q.get('group'):'unrelated';}
 if(r==='overview'||r==='structure'){
  state.demo=['direct','document','embedded'].includes(q.get('format'))?q.get('format'):'direct';
  if(r==='overview')state.overviewAudit=q.get('chart')==='purpose'?'purpose':'relevance';
 }
}
async function copyView(){
 syncViewURL();
 try{await navigator.clipboard.writeText(location.href);toast('Link copied.')}catch{
  // Select a visible URL if clipboard permission is unavailable.
  showInspector('Link to this view',`<label for="view-link">Copy this link</label><input id="view-link" type="text" readonly value="${e(location.href)}" style="width:100%;margin-top:12px;padding:10px">`);
  $('#view-link').focus();$('#view-link').select();
 }
}
function downloadCSV(){const rows=probeRecords(selectedRecords()),cols=D.recordColumns;const encode=v=>'"'+String(v??'').replaceAll('"','""')+'"';const csv=[cols.join(','),...rows.map(r=>cols.map(k=>encode(r[k])).join(','))].join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='wildchat-selected-metadata.csv';a.hidden=true;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast(`${fmt(rows.length)} metadata rows exported.`)}
document.addEventListener('atlas-selection',ev=>{
 if(route!=='explorer'||state.explorerTab!=='length')return;
 state.chartProbe=validProbe(ev.detail);if(!state.chartProbe)return;
 const rows=explorerRows();$('#distribution-examples').innerHTML=exampleRail();$('#selected-count').textContent=fmt(rows.length);$('#selected-scope').textContent=`of 20,000 records selected (${pct(rows.length,20000)}).`;syncViewURL();
 const rail=$('.rail-count-flow');rail?.classList.add('selection-updated');
});
document.addEventListener('retrieval-change' ,ev=>{state.retrievalMode=ev.detail.mode;state.retrievalGroup=ev.detail.group;syncViewURL()});
document.querySelector('.skip-link').addEventListener('click',ev=>{
 ev.preventDefault();$('#main').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});
});
document.addEventListener('click',ev=>{const el=ev.target.closest('[data-action]');if(!el)return;const a=el.dataset.action;
 if(['stat-filter','filter-model-year','filter-flag','filter-language','filter-family','reset-filters','open-depth-filter','open-depth','open-languages','open-language'].includes(a)||(a==='remove-filter'&&el.dataset.kind==='explorer')||(a==='explorer-tab'&&!['length','records'].includes(el.dataset.value)))state.chartProbe=null;
 if(a==='topic-select'){const k=el.dataset.kind==='intent'?'intent':'domain';state.topicSelected[k]=el.dataset.value||el.dataset.id;render();if(innerWidth<=760)document.getElementById('topic-example')?.scrollIntoView({block:'start',behavior:'smooth'});return}
 if(a==='topic-expand'){const k=state.explorerTab==='task'?'intent':'domain';state.topicExpanded[k]=!state.topicExpanded[k];if(!state.topicExpanded[k]&&(k==='intent'?D.topics.intents:D.topics.domains).findIndex(x=>x.id===state.topicSelected[k])>=10)state.topicSelected[k]='';render();return}
 if(a==='clear-probe'){state.chartProbe=null;render();return}
 if(a==='show-matching-examples'){$('.chart-example-rail').classList.add('mobile-open');$('#distribution-examples').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});return}
 if(a==='copy-view'){copyView();return}
 if(a==='fit-case'){state.fitExample=Number(el.dataset.id);state.fitRole=state.fitExample===2632268?'participation':'advice';render();return}
 if(a==='stat-filter'){if(['month','turnBand'].includes(el.dataset.field)){state.filters[el.dataset.field]=el.dataset.value;if(el.dataset.field==='turnBand')state.filters.depth='';state.recordPage=0;render()}return}
 if(a==='filter-model-year'){state.filters.family=el.dataset.family;state.filters.year=el.dataset.year;state.recordPage=0;render();return}
 if(a==='filter-flag'){state.filters.flag=el.dataset.value;state.recordPage=0;render();return}
 if(['open-relational','open-purpose','select-relational','select-purpose','select-packaging','audit-cell','open-case'].includes(a)){document.querySelectorAll('[data-inspected]').forEach(x=>x.removeAttribute('data-inspected'));let origin=el;if(el.matches('.rv-tile-group'))origin=el.closest('.rv-relevance')?.querySelector(`.rv-legend-row[data-value="${CSS.escape(el.dataset.value)}"]`)||el;origin.setAttribute('data-inspected','true');if(origin.matches('button'))origin.focus({preventScroll:true});}
 if(a==='close-inspector'){$('#inspect-dialog').close();inspection=null;return}
 if(a==='full-case'){$('#inspect-dialog').close();openCase(el.dataset.id,'exchange');return}
 if(a==='peek-example'){inspection.exampleId=Number(el.dataset.id);renderAuditPreview();return}
 if(a==='inspect-records'){state.auditRecord=null;for(const k of Object.keys(state.auditFilters))state.auditFilters[k]=inspection.filters[k]||'';state.auditPage=0;state.auditView='records';$('#inspect-dialog').close();if(route==='audit')render({scroll:true});else location.hash=withOverviewOrigin('audit');return}
 if(a==='remove-filter'){state.auditRecord=null;const f=el.dataset.kind==='audit'?state.auditFilters:state.filters;f[el.dataset.key]='';state.auditPage=state.recordPage=0;render();return}
 if(a==='jump-turn'){const transcript=$('#full-transcript');if(transcript)transcript.open=true;focusCaseTarget(document.getElementById(`turn-${el.dataset.id}`));return}
 if(a==='case-gap'){const gap=$('#case-evidence-gap');gap.open=true;focusCaseTarget(gap);return}
 if(a==='return-chart'){returnToChart();return}
 if(a==='overview-jump'){const target=document.getElementById(el.dataset.id);if(target){target.focus({preventScroll:true});target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}return}
 if(a==='overview-audit'){state.overviewAudit=el.dataset.value;render();return}
 if(a==='open-relational'||a==='select-relational'){openRelationalRequests(el.dataset.value);return}
 if(a==='open-purpose'){openAuditPreview({purpose:el.dataset.value});return}
 if(a==='open-requests'){ev.preventDefault();Object.keys(state.auditFilters).forEach(k=>state.auditFilters[k]='');state.auditView='charts';state.auditPage=0;location.hash=withOverviewOrigin('audit');return}
 if(a==='open-depth-filter'){Object.keys(state.filters).forEach(k=>state.filters[k]='');state.filters.depth=el.dataset.value;state.explorerTab='exchange';location.hash=withOverviewOrigin('explorer');return}
 if(a==='open-depth'){ev.preventDefault();Object.keys(state.filters).forEach(k=>state.filters[k]='');state.explorerTab='exchange';location.hash=withOverviewOrigin('explorer');return}
 if(a==='open-languages'){ev.preventDefault();Object.keys(state.filters).forEach(k=>state.filters[k]='');state.explorerTab='composition';location.hash=withOverviewOrigin('explorer');return}
 if(a==='open-language'){Object.keys(state.filters).forEach(k=>state.filters[k]='');state.filters.language=el.dataset.value;state.explorerTab='composition';location.hash=withOverviewOrigin('explorer');return}
 if(a==='audit-view'){state.auditRecord=null;state.personalRecord=null;state.auditView=el.dataset.value;if(state.auditView==='personal'){Object.keys(state.auditFilters).forEach(k=>state.auditFilters[k]='');state.personalDecision='';state.personalType='';}}
 if(a==='select-packaging'){openAuditPreview({packaging:el.dataset.value},state.auditFilters);return}
 if(a==='select-purpose'){openAuditPreview({purpose:el.dataset.value},state.auditFilters);return}
 if(a==='quiz'){progress.answers[el.dataset.id]=Number(el.dataset.index);save();const box=el.closest('.quiz');box.outerHTML=quiz(el.dataset.id);nav();document.querySelector(`[data-action="quiz"][data-id="${el.dataset.id}"][data-index="${el.dataset.index}"]`)?.focus({preventScroll:true});return}
 if(a==='figure'){$('#full-figure').src=el.dataset.src;$('#full-figure').alt=el.dataset.title;$('#figure-caption').textContent=el.dataset.title+' · unchanged source figure; denominator and scope are shown on the image.';$('#figure-dialog').showModal();return}
 if(a==='export-records'){downloadCSV();return}
 if(a==='open-case'){if(!$('#inspect-dialog').open)inspection=null;$('#inspect-dialog').close();openCase(el.dataset.id,el.dataset.caseFocus);return}
 if(a==='reset-filters'){Object.keys(state.filters).forEach(k=>state.filters[k]='');state.recordPage=0}
 if(a==='filter-language'){state.filters.language=el.dataset.value;state.recordPage=0}
 if(a==='filter-family'){state.filters.family=el.dataset.value;state.recordPage=0}
 if(a==='explorer-tab')setExplorerTab(el.dataset.value);
 if(a==='record-page')state.recordPage+=Number(el.dataset.step);
 if(a==='audit-page'){state.auditRecord=null;state.auditPage+=Number(el.dataset.step);}
 if(a==='reset-audit'){state.auditRecord=null;Object.keys(state.auditFilters).forEach(k=>state.auditFilters[k]='');state.auditPage=0}
 if(a==='audit-cell'){openAuditPreview({purpose:el.dataset.purpose,packaging:el.dataset.packaging},state.auditFilters);return}
 if(a==='case-kind')state.caseKind=el.dataset.value;
 if(a==='select-case'){openCase(el.dataset.id);return}
 if(a==='demo')state.demo=el.dataset.value;
 render();if(a==='select-case'){const pane=$('#case-detail');if(pane)pane.scrollTop=0;}
});
document.addEventListener('keydown',ev=>{if((ev.key==='Enter'||ev.key===' ')&&ev.target.matches('svg [data-action]')){ev.preventDefault();ev.target.dispatchEvent(new MouseEvent('click',{bubbles:true}))}});
document.addEventListener('toggle',ev=>{if(ev.target.matches('.filter-disclosure'))filterPanels[ev.target.dataset.filterKind]=ev.target.open},true);
$('#inspect-dialog').addEventListener('close',()=>document.querySelectorAll('[data-inspected]').forEach(el=>el.removeAttribute('data-inspected')));
$('#inspect-dialog').addEventListener('click',ev=>{if(ev.target===$('#inspect-dialog')){const r=ev.target.getBoundingClientRect();if(ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom)ev.target.close()}});
document.addEventListener('change',ev=>{const id=ev.target.id;if(id==='case-picker'){openCase(ev.target.value)}else if(id.startsWith('filter-')){state.filters[id.replace('filter-','')]=ev.target.value;if(id==='filter-depth')state.filters.turnBand='';state.chartProbe=null;state.recordPage=0;render()}else if(id.startsWith('audit-')){state.auditFilters[id.replace('audit-','')]=ev.target.value;state.auditRecord=null;state.auditPage=0;render()}else if(id==='record-sort'){state.sort=ev.target.value;state.recordPage=0;render()}});
document.addEventListener('input',ev=>{if(ev.target.id==='glossary-search'){const value=ev.target.value,caret=ev.target.selectionStart;state.glossarySearch=value;render();$('#glossary-search').focus();$('#glossary-search').setSelectionRange(caret,caret)}});
$('#reset-progress')?.addEventListener('click',()=>{progress={visited:[route],answers:{}};save();render();toast('Learning progress reset.')});
$('.close-dialog').addEventListener('click',()=>$('#figure-dialog').close());
$('#figure-dialog').addEventListener('click',ev=>{if(ev.target===$('#figure-dialog'))$('#figure-dialog').close()});
window.addEventListener('hashchange',()=>{$('#inspect-dialog').close();restoreViewURL();render({scroll:true});if(returnPosition!==null){const y=returnPosition;returnPosition=null;requestAnimationFrame(()=>window.scrollTo({top:y,behavior:'instant'}))}});
async function boot(){try{const files=['records','aggregates','audit','examples','learning','source_metadata','analysis_coverage','audit_review','validation','relational_v2','source_texts','microsoft_topics','topic_source_texts'];const out=await Promise.all(files.map(async f=>{const r=await fetch(`data/${f}.json`,{cache:'no-cache'});if(!r.ok)throw Error(`Could not load ${f}: ${r.status}`);return r.json()}));const [rec,agg,audit,examples,learning,meta,coverage,auditReviews,validation,relationalV2,sourceTexts,topics,topicSourceTexts]=out;const sourceRecords=[...new Map([...topicSourceTexts.records,...sourceTexts.records].map(x=>[String(x.row_index),x])).values()];setSourceTexts({records:sourceRecords});D={topics,sourceCount:sourceRecords.length,auditPilot:audit,validation,auditReviews,coverage,records:rec.rows.map(row=>Object.fromEntries(rec.columns.map((c,i)=>[c,row[i]]))),recordColumns:rec.columns,aggregates:agg,audit:relationalV2,examples:examples.map(x=>({...x,title:exampleTitle(x.id,x.title)})),learning,meta};initMotion();initJump({pages:chapters,examples:D.examples,openExample:openCase});restoreViewURL();render();new ResizeObserver(()=>readingOffset()).observe($('.app-header'));window.__atlas={state,data:D,selectedRecords,filteredAudit};}catch(err){$('#main').innerHTML=head('Loading issue','The dataset could not be loaded.','Please refresh the page. If this persists, the site may be missing a data asset.')+`<p class="micro">${e(err.message)}</p><button class="button" onclick="location.reload()">Try again</button>`;console.error(err)}}boot();
