import {sourcePreview} from './source-text.js?v=topicsOct21b';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const fmt = value => finite(value) ? value.toLocaleString('en-US') : 'Not recorded';
const percent = value => finite(value) ? value > 0 && value < 0.1 ? '&lt;0.1%' : `${value.toLocaleString('en-US',{maximumFractionDigits:1})}%` : '—';
const kindOf = kind => kind === 'intent' ? 'intent' : 'domain';
const names = {domain:{singular:'Topic',plural:'Topics',field:'domains',view:'topic',description:'What the conversation concerns. Microsoft’s domain taxonomy also includes writing categories.'},intent:{singular:'Task',plural:'Tasks',field:'intents',view:'task',description:'What the user asks the assistant to do, using Microsoft’s intent labels.'}};
const total = data => finite(data?.scope?.total_rows) ? data.scope.total_rows : finite(data?.scope?.rows) ? data.scope.rows : null;
const rowsFor = (data,kind) => [...(Array.isArray(data?.[names[kind].field]) ? data[names[kind].field] : [])].sort((a,b) => (finite(b.count)?b.count:-1)-(finite(a.count)?a.count:-1) || String(a.label).localeCompare(String(b.label)));
const share = (row,n) => finite(row?.count) && finite(n) && n > 0 ? row.count/n*100 : null;
const safeURL = value => typeof value === 'string' && /^https?:\/\//i.test(value) ? value : null;
const viewURL = (kind,id) => `#explorer?snapshot=1&view=${names[kind].view}${id === undefined ? '' : `&label=${encodeURIComponent(id)}`}`;
const labelStatus = data => data?.source?.label_status || 'AI labels; these released labels have not been human-checked here.';
const empty = text => `<p class="topic-empty">${escape(text)}</p>`;
const sourceLink = data => safeURL(data?.source?.url) ? `<a href="${escape(data.source.url)}" target="_blank" rel="noopener">Microsoft label source ↗</a>` : '';

function filterNote(data) {
  const filters = data?.scope?.filters_applied;
  return Array.isArray(filters) ? filters.length ? `Additional filters: ${filters.map(value=>typeof value==='string'?value:JSON.stringify(value)).join(', ')}.` : 'All released rows; no additional filters.' : 'Source filter information is not recorded.';
}

function sourceFoot(data) {
  return `<p class="topic-footnote">${escape(filterNote(data))} Each record counts once. <a href="#methods?source=topics">Methods & weighting ↗</a>${sourceLink(data) ? ` · ${sourceLink(data)}` : ''}</p>`;
}

function exampleFor(data,kind,id) {
  const collection = Array.isArray(data?.examples) ? data.examples : Array.isArray(data?.examples?.examples) ? data.examples.examples : null;
  if (collection) return collection.find(example=>example.kind===kind && String(example.id)===String(id)) || null;
  return data?.examples?.[kind]?.[id] || null;
}

function explicitIndex(example,keys) {
  for (const key of keys) if (Object.hasOwn(example,key)) return example[key];
  return undefined;
}

export function topicExample(data,kind,id) {
  kind=kindOf(kind);
  const row=rowsFor(data,kind).find(item=>String(item.id)===String(id));
  if (!row) return `<section class="topic-example" id="topic-example">${empty('Select a category to inspect its source example.')}</section>`;
  const example=exampleFor(data,kind,row.id), n=total(data);
  const original=example && example.row_index!==undefined && example.row_index!==null
    ? `<div class="topic-example-record"><span>Record ${escape(example.row_index)}</span><span>Selected illustration</span></div>${sourcePreview(example.row_index,{userIndex:explicitIndex(example,['user_message_index','source_user_message_index','userIndex']),replyIndex:explicitIndex(example,['reply_message_index','source_reply_message_index','replyIndex']),limit:320})}<p class="topic-example-note">${escape(example.selection_note || 'Selected to illustrate this AI label; not a random or representative example.')}</p>`
    : empty('An original source example has not been included for this label.');
  return `<section class="topic-example" id="topic-example" tabindex="-1" aria-label="Selected ${names[kind].singular.toLowerCase()} example"><header class="topic-example-header"><div><span class="topic-kicker">SELECTED ${names[kind].singular.toUpperCase()}</span><h3>${escape(row.label)}</h3></div><div class="topic-example-count"><strong>${percent(share(row,n))}</strong><span>${fmt(row.count)} / ${fmt(n)} records</span></div></header>${row.definition?`<details class="topic-definition"><summary>Label definition</summary><p>${escape(row.definition)}</p></details>`:''}${original}</section>`;
}

function chartRow(row,kind,selected,n,index) {
  const active=String(row.id)===String(selected), p=share(row,n);
  return `<button type="button" class="topic-row${active?' selected':''}" data-action="topic-select" data-kind="${kind}" data-value="${escape(row.id)}" aria-pressed="${active}" aria-label="Inspect ${escape(row.label)}: ${fmt(row.count)} records, ${percent(p)}"><span class="topic-row-top"><span class="topic-row-name"><small>${index+1}</small><span>${escape(row.label)}</span></span><span class="topic-row-values"><strong>${percent(p)}</strong><small>${fmt(row.count)}</small><i aria-hidden="true">↗</i></span></span><span class="topic-track" aria-hidden="true"><span style="width:${finite(p)?Math.min(100,p):0}%"></span></span></button>`;
}

export function topicView(data,state={}) {
  const kind=kindOf(state.kind), config=names[kind], rows=rowsFor(data,kind), n=total(data);
  if (!rows.length || !finite(n)) return empty(`${config.singular} label counts are unavailable in this export.`);
  const selected=rows.some(row=>String(row.id)===String(state.selected)) ? state.selected : (rows.find(row=>row.id!=='unclassified')||rows[0]).id;
  const limit=10, visible=state.expanded?rows:rows.slice(0,limit), labeled=data?.scope?.[`labeled_${kind}_rows`], missing=data?.scope?.[`missing_${kind}_rows`];
  return `<section class="topic-view" data-topic-kind="${kind}"><header class="topic-heading"><div><h2>${config.singular} distribution <span class="topic-heading-tag">Microsoft AI labels</span></h2><p>${config.description}</p></div><a href="#methods?source=topics">Source & method ↗</a></header><div class="topic-scope"><div><strong>${fmt(n)}</strong><span>released records</span></div><div><strong>${fmt(labeled)}</strong><span>with a ${config.singular.toLowerCase()} label</span></div><div><strong>${fmt(missing)}</strong><span>unclassified / missing</span></div></div><p class="topic-status">These released labels have not been human-checked here.</p><div class="topic-layout"><section class="topic-chart" aria-label="${config.singular} label counts"><div class="topic-chart-heading"><h3>${config.plural}</h3><span>Share of all ${fmt(n)} records</span></div><p class="topic-chart-hint">Choose a label to read one original example.</p><div class="topic-ranked">${visible.map((row,index)=>chartRow(row,kind,selected,n,index)).join('')}</div>${rows.length>limit?`<button type="button" class="topic-expand" data-action="topic-expand" data-kind="${kind}" data-expanded="${!state.expanded}">${state.expanded?`Show largest ${limit}`:`Show all ${rows.length} categories`} <span aria-hidden="true">${state.expanded?'−':'+'}</span></button>`:''}<p class="topic-chart-note">One ${config.singular.toLowerCase()} label per record. Unclassified records stay in the denominator. Each bar uses a 0–100% scale.</p></section>${topicExample(data,kind,selected)}</div>${sourceFoot(data)}</section>`;
}

export function datasetTakeaways(data,validation) {
  const n=total(data), census=validation?.scopes?.census;
  if (!finite(n) || !census || census.n!==n || !finite(census.one_n)) return '';
  const domains=rowsFor(data,'domain'), intents=rowsFor(data,'intent');
  const leading=domains.find(row=>row.id!=='unclassified');
  const writing=intents.find(row=>row.id==='text_generation'), lookup=intents.find(row=>row.id==='information_lookup');
  const template=validation?.comparisons?.find(row=>row.key==='wrapper')?.census;
  if (!leading || !writing || !lookup || !template || template.n!==n) return '';
  const cards=[
    {kind:'ai',label:'Topics',title:'No single subject dominates.',body:`Even the largest topic label covers ${percent(share(leading,n))} of records. Overall averages combine very different uses.`,href:viewURL('domain'),link:'See topic distribution'},
    {kind:'ai',label:'Tasks',title:'Producing text and finding facts are central uses.',body:`Text generation (including editing) and factual lookup together account for ${percent((writing.count+lookup.count)/n*100)} of records.`,href:viewURL('intent'),link:'See task distribution'},
    {kind:'recorded',label:'Stored messages',title:'Most records offer a snapshot of AI use.',body:`${percent(census.one_n/n*100)} store one user message, leaving little stored back-and-forth. A message can still contain pasted history.`,href:'#explorer?snapshot=1&view=exchange',link:'See message counts'},
    {kind:'recorded',label:'Input format',title:'Recurring prompt formats shape the data.',body:`One group-bot template appears in ${percent(template.count/n*100)} of records. These template-based requests do not establish that a real group interaction occurred.`,href:'#explorer?snapshot=1&view=quality',link:'See input-format counts'}
  ];
  return `<section class="dataset-takeaways" aria-labelledby="dataset-takeaways-title"><header><h2 id="dataset-takeaways-title">Dataset takeaways</h2><a href="#methods?source=validation">${fmt(n)} records · this pinned release ↗</a></header><div class="dataset-takeaway-grid">${cards.map(card=>`<article class="dataset-takeaway ${card.kind}"><div class="takeaway-meta"><span class="takeaway-kind">${card.label}</span><a href="#methods?source=${card.kind==='ai'?'topics':'validation'}">${card.kind==='ai'?'Based on Microsoft AI labels':'Our full-release counts'} ↗</a></div><h3>${card.title}</h3><p>${card.body}</p><a href="${card.href}">${card.link} →</a></article>`).join('')}</div><p class="takeaway-scope">Takeaways are our interpretation. Microsoft’s labels have not been human-validated here. Shares count records, not people.</p></section>`;
}

export function topicOverview(data) {
  const n=total(data);
  if (!finite(n) || !rowsFor(data,'domain').length) return '';

  return `<section class="topic-overview"><header class="topic-heading"><div><span class="topic-kicker">CONTENT ACROSS THE RELEASE</span><h2>What are the conversations about?</h2><p>Microsoft AI labels across ${fmt(n)} records.</p></div><a href="${viewURL('domain')}">Topic distribution →</a></header><div class="topic-overview-grid">${['domain','intent'].map(kind=>{const rows=rowsFor(data,kind).filter(row=>row.id!=='unclassified').slice(0,3);return `<section class="topic-overview-card"><header><h3>${names[kind].plural}</h3><span>${kind==='domain'?'Subject / domain':'Requested task / intent'}</span></header>${rows.length?rows.map(row=>`<a class="topic-overview-row" href="${viewURL(kind,row.id)}"><span>${escape(row.label)}</span><strong>${percent(share(row,n))}</strong><i aria-hidden="true">↗</i></a>`).join(''):empty('Label counts unavailable.')}<a class="topic-overview-all" href="${viewURL(kind)}">All ${names[kind].plural.toLowerCase()} →</a></section>`;}).join('')}</div><p class="topic-footnote">Shares use all ${fmt(n)} released records, including unclassified records. Labels have not been human-checked here.</p></section>`;
}

export function topicMethods(data) {
  if (!data?.source || !data?.scope) return `<section id="topic-methods">${empty('Topic and task source details are unavailable in this export.')}</section>`;
  const s=data.source, n=total(data), coverage=kind=>`${fmt(data.scope[`labeled_${kind}_rows`])} labeled · ${fmt(data.scope[`missing_${kind}_rows`])} unclassified / missing · denominator ${fmt(n)}`;
  const detailRows=[
    ['Source',`${escape(s.repo||'Microsoft label release')}${sourceLink(data)?` · ${sourceLink(data)}`:''}${s.revision?`<br><code>${escape(s.revision)}</code>`:''}`],
    ['Population',`${fmt(n)} ${escape(data.scope.unit||'released conversation records')}. ${escape(filterNote(data))}`],
    ['Dates',`${escape(String(data.scope.date_min||'Not recorded').slice(0,10))} → ${escape(String(data.scope.date_max||'Not recorded').slice(0,10))} (stored timestamps; no local date cutoff).`],
    ['Topic',`Microsoft’s domain labels, including writing categories. ${coverage('domain')}.`],
    ['Task',`Microsoft’s intent labels describe requested tasks. ${coverage('intent')}. These are separate from the locally annotated 2,000-record Requests sample.`],
    ['Counting',`One domain and one intent label per ${escape(s.classification_unit||'conversation')}. Category shares use all ${fmt(n)} records. Missing and invalid outputs remain unclassified.`],
    ['Filters & weights',`${escape(data.scope.weighting||'Each released record contributes one count. These are record shares, not user shares.')}${Array.isArray(data.scope.filters_applied)&&data.scope.filters_applied.length===0?' No additional IP or date filter is applied.':''}${data.scope.deduplication_applied===false?' Repeated records are not deduplicated.':''}`],
    ...(Array.isArray(data.caveats)&&data.caveats.length?[['Scope & limitations',data.caveats.map(escape).join('<br>')]]:[]),
    ['Classifier',escape(s.classifier_model||'Model not recorded in this export')],
    ['Input',escape(s.input_scope||s.input_note||'The classifier reads ordered conversation messages. In the released classification code, messages longer than 5,000 characters are shortened to head and tail excerpts.')],
    ['Validation',`${escape(s.validation_note||'The adapted classifiers have prior validation on English data. These released labels have not been human-checked here; accuracy across languages is not established by this site.')}${safeURL(s.validation_url)?` <a href="${escape(s.validation_url)}" target="_blank" rel="noopener">Prior validation ↗</a>`:''}`],
    ['Alignment',`${fmt(data.quality?.source_aligned_rows)} rows match the pinned census on row position, conversation hash, model, language, turn count and date. Examples also match the full timestamp; ambiguous keys are excluded. <a href="data/microsoft_topics/audit.json">Audit ↗</a>`],
    ['Examples','Selected source records illustrate labels. They are not a random or representative subsample. Original text and any contact-detail redactions are identified in each example. <a href="data/microsoft_topics/examples-selected-source-verification.json">Source-text checks ↗</a>'],
    ['Upstream',`${safeURL(s.upstream_url)?`<a href="${escape(s.upstream_url)}" target="_blank" rel="noopener">${escape(s.upstream_dataset)} ↗</a>`:escape(s.upstream_dataset||'Upstream dataset not recorded')}${s.upstream_revision_note?`<br>${escape(s.upstream_revision_note)}`:''}${s.matched_atlas_revision?`<br>Matched Atlas revision: <code>${escape(s.matched_atlas_revision)}</code>`:''}`],
    ...(s.original_conversation_license||s.label_license_note ? [['License',`${s.original_conversation_license?`Original conversations: ${escape(s.original_conversation_license)}.`:''}${s.label_license_note?` ${escape(s.label_license_note)}`:''}`]] : [])
  ];
  return `<section class="topic-methods" id="topic-methods" tabindex="-1"><header class="topic-heading"><div><span class="topic-kicker">THIRD-PARTY CLASSIFICATION</span><h2>Topic & task labels</h2><p>${escape(labelStatus(data))}</p></div></header><table class="topic-method-table"><tbody>${detailRows.map(([key,value])=>`<tr><th scope="row">${key}</th><td>${value}</td></tr>`).join('')}</tbody></table><p class="topic-footnote"><a href="data/microsoft_topics.json" download>Counts & example mappings ↓</a> · <a href="data/microsoft_topics/manifest.json" download>172 label-file checksums ↓</a> · <a href="${escape(s.paper_url||'https://arxiv.org/abs/2605.29018v2')}" target="_blank" rel="noopener">Classification paper ↗</a> · <a href="data/microsoft_topics/MICROSOFT-LICENSE.txt">Repository license ↗</a></p></section>`;
}
