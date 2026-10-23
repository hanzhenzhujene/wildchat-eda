/** Public overview composed from saved aggregates. Squares encode rounded shares,
 * not individual source records. All data text remains explicit about its scope.
 */
const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = value => Number(value).toLocaleString('en-US');
const pct = (value,n) => n > 0 ? (100*value/n).toFixed(1)+'%' : 'Not recorded';
const MODES = ['turns','tasks','topics'];
const PALETTES = {
 turns:['#193f44','#c3e4bc'],
 tasks:['#193f44','#3f7080','#73928b','#acc3a8','#d2dca8','#c28c5c','#e5e9e3'],
 topics:['#193f44','#526c9b','#8c82a7','#bd9e9e','#d4b875','#95b1a3','#e5e9e3'],
};

/** Largest-remainder allocation: total squares stays exactly 1,000. */
export function roundedSquares(rows,denominator,squares=1000){
 const parts=rows.map((r,index)=>{const exact=r.count/denominator*squares;return {index,floor:Math.floor(exact),fraction:exact-Math.floor(exact)};});
 const result=parts.map(x=>x.floor);
 const remaining=squares-result.reduce((sum,n)=>sum+n,0);
 [...parts].sort((a,b)=>b.fraction-a.fraction||a.index-b.index).slice(0,Math.max(0,remaining)).forEach(x=>result[x.index]++);
 return result;
}

/** Pure composition model used by the visual and its source-fidelity tests. */
export function overviewComposition(data,mode='turns'){
 if(!MODES.includes(mode))mode='turns';
 const validation=data.validation,topics=data.topics,n=Number(validation?.scopes?.census?.n??validation?.source?.n??0);
 if(!Number.isFinite(n)||n<=0)throw new TypeError('The full-release denominator is required.');
 let rows,denominator=n,source,sourceLabel,title;
 if(mode==='turns'){
  const one=Number(validation.scopes.census.one_n);
  rows=[{id:'single',label:'One user message',count:one},{id:'multiple',label:'Multiple user messages',count:n-one}];
  source='validation';sourceLabel='Counted from stored messages';title='Stored conversation length';
 }else{
  const field=mode==='tasks'?'intents':'domains',chart=mode==='tasks'?'intent':'domain';
  const all=[...(topics?.[field]||[])].sort((a,b)=>b.count-a.count||String(a.id).localeCompare(String(b.id)));
  denominator=Number(topics?.scope?.denominator??topics?.scope?.rows??0);
  if(!Number.isFinite(denominator)||denominator<=0)throw new TypeError('The label denominator is required.');
  rows=all.slice(0,6).map(x=>({...x}));
  const rest=all.slice(6);
  if(rest.length)rows.push({id:'remaining',label:`${rest.filter(r=>r.id!=='unclassified').length} other ${mode==='tasks'?'tasks':'topics'} + unclassified`,count:rest.reduce((sum,r)=>sum+r.count,0),aggregate:true});
  source='topics';sourceLabel='Microsoft AI-assigned labels';title=mode==='tasks'?'What users ask AI to do':'What conversations are about';
  rows.forEach(row=>row.chart=chart);
 }
 if(rows.some(r=>!Number.isFinite(r.count)||r.count<0)||rows.reduce((sum,r)=>sum+r.count,0)!==denominator)throw new TypeError('Composition counts must sum to their stated denominator.');
 const assigned=roundedSquares(rows,denominator);
 rows=rows.map((r,i)=>({...r,squares:assigned[i],color:PALETTES[mode][i],href:mode==='turns'?'#distributions?chart=turn_bucket':`#distributions?chart=${r.chart}${r.aggregate?'':'&label='+encodeURIComponent(r.id)}`}));
 return {mode,rows,denominator,source,sourceLabel,title};
}

function visualHTML(data,mode,atlas){
 const s=overviewComposition(data,mode),cols=50,cell=8,gap=3,step=cell+gap,W=cols*step-gap,H=20*step-gap;
 let cursor=0;
 const segments=s.rows.map(row=>{
  const cells=Array.from({length:row.squares},()=>{const i=cursor++;return `<rect x="${i%cols*step}" y="${Math.floor(i/cols)*step}" width="${cell}" height="${cell}" rx="1.2" fill="${row.color}"/>`;}).join('');
  return `<a href="${escape(row.href)}" aria-label="${escape(row.label)}: ${fmt(row.count)} of ${fmt(s.denominator)} records, ${pct(row.count,s.denominator)}. Open distribution." tabindex="0"><title>${escape(row.label)} · ${fmt(row.count)} / ${fmt(s.denominator)} · ${pct(row.count,s.denominator)}</title>${cells}</a>`;
 }).join('');
 return `<div class="ov-canvas-head"><h3>${escape(s.title)}</h3><span class="ov-source-tag ${s.source==='topics'?'ai':'recorded'}">${escape(s.sourceLabel)}</span></div><svg class="ov-waffle" viewBox="0 0 ${W} ${H}" role="group" aria-label="${escape(s.title)}. One thousand squares show rounded shares; each square represents approximately 0.1 percent of the stated records, not one actual conversation."><desc>Categories link to their distribution. Legend counts and percentages are calculated from the exact saved counts.</desc>${segments}</svg><p class="ov-waffle-unit">1 square ≈ 0.1% of records (rounded). <span>Squares are not individual conversations.</span></p><ul class="ov-legend" aria-label="Exact category counts">${s.rows.map(row=>`<li><a href="${escape(row.href)}"><i style="--ov-color:${row.color}" aria-hidden="true"></i><span>${escape(row.label)}</span><strong>${pct(row.count,s.denominator)}</strong><small>${fmt(row.count)}</small></a></li>`).join('')}</ul><div class="ov-chart-foot"><span>${fmt(s.denominator)} records${s.source==='topics'?' · unclassified records retained':''}</span><a href="${escape(atlas('methods?source='+s.source))}">Source & method ↗</a></div>`;
}

export function overviewCanvas({validation,topics,audit,examples=[],atlas=path=>'atlas.html#'+path,scopeTable=()=>'',example=()=>'',initialMode='turns'}){
 const activeMode=MODES.includes(initialMode)?initialMode:'turns';
 const data={validation,topics,audit},c=validation.scopes.census,n=c.n;
 const tasks=topics.intents,writingLookup=tasks.filter(x=>['text_generation','information_lookup'].includes(x.id)).reduce((sum,r)=>sum+r.count,0);
 const lead=[...topics.domains].filter(x=>x.id!=='unclassified').sort((a,b)=>b.count-a.count)[0];
 const template=validation.comparisons.find(x=>x.key==='wrapper')?.census;
 const a=audit?.summary||audit,personal=a?.relational_mode_counts?.personal_help??0,contentN=a?.n??2000;
 const cards=[
  {label:'Tasks',value:pct(writingLookup,topics.scope.denominator),title:'Writing and factual lookup lead.',body:'Records labeled Text Generation or Information Lookup.',status:'Microsoft AI labels',href:atlas('methods?source=topics'),target:'#distributions?chart=intent'},
  {label:'Topics',value:pct(lead.count,topics.scope.denominator),title:'No single topic dominates.',body:`The largest label is ${lead.label}.`,status:'Microsoft AI labels',href:atlas('methods?source=topics'),target:'#distributions?chart=domain'},
  {label:'Input formats',value:pct(template.count,n),title:'Repeated formats shape the data.',body:`${fmt(template.count)} records match one named group-bot template; this does not verify a group exchange.`,status:'Full-release counts',href:atlas('methods?source=validation'),target:atlas('explorer?snapshot=1&view=quality')},
  {label:'Personal help',value:`${personal} / ${fmt(contentN)}`,title:'Personal help is a small subset.',body:'Final requests labeled personal interpersonal help in a separate random sample.',status:'Sample · AI labels',href:atlas('methods?source=audit'),target:'#content?dimension=relational_mode_counts&label=personal_help'},
 ];
 return `<section class="overview-hero" aria-labelledby="ov-title"><div class="ov-intro"><div class="eyebrow">Public data · Independent analysis</div><h1 id="ov-title">WildChat<br><span>EDA.</span></h1><p class="ov-lead">Conversations from a free AI chat service. Stored exchanges are usually short.</p><div class="ov-main-number">${(n/1e6).toFixed(1)}<span>M</span></div><p class="ov-exact">${fmt(n)} released records<br><a href="#sources">One pinned, filtered release ↗</a></p><p class="ov-short-stat"><strong>${pct(c.one_n,n)}</strong> contain one user message.</p></div><div class="overview-visual"><div class="ov-controls" role="group" aria-label="Conversation composition">${MODES.map((mode,i)=>`<button type="button" data-overview-mode="${mode}" class="${mode===activeMode?'active':''}" aria-pressed="${mode===activeMode}">${mode[0].toUpperCase()+mode.slice(1)}</button>`).join('')}</div><div data-overview-composition>${visualHTML(data,activeMode,atlas)}</div></div></section>
 <div class="ov-reading-key"><span>A record is a stored conversation, not a person.</span><a href="#sources">Units, version & filters →</a></div>
 <div class="ov-dataset-facts"><a href="#sources"><strong>${fmt(c.stored_messages)}</strong><span>stored messages</span></a><a href="#distributions?chart=language"><strong>${c.language_count}</strong><span>source-language labels</span></a><a href="#distributions?chart=month"><strong>Apr 2023–Jul 2025</strong><span>record dates</span></a></div>
 <section class="ov-findings" aria-labelledby="ov-findings-title"><div class="section-line"><div><div class="eyebrow">Read the distributions</div><h2 id="ov-findings-title">What stands out</h2></div><a href="#distributions">All distributions →</a></div><div class="ov-takeaways">${cards.map((r,i)=>`<article class="ov-takeaway"><div class="ov-takeaway-top"><span>${String(i+1).padStart(2,'0')} / ${escape(r.label)}</span><a href="${escape(r.href)}">${escape(r.status)} ↗</a></div><a class="ov-takeaway-body" href="${escape(r.target)}"><strong>${escape(r.value)}</strong><h3>${escape(r.title)}</h3><p>${escape(r.body)}</p></a></article>`).join('')}</div></section>
 <section class="ov-originals" aria-labelledby="ov-originals-title"><div class="section-line"><div><div class="eyebrow">The stored text</div><h2 id="ov-originals-title">Original requests. Recorded replies.</h2><p>Two deliberately selected records, not a random sample.</p></div><a href="${escape(atlas('cases'))}">All examples →</a></div><div class="grid ov-example-grid">${examples.slice(0,2).map(example).join('')}</div></section>
 <details class="ov-scope-details"><summary><span>Data scopes</span><small>Census, AI labels and samples use different denominators.</small><span aria-hidden="true">+</span></summary><div class="ov-scope-body">${scopeTable()}</div></details>
 <div class="ov-bottom-paths"><a href="#linkage"><span>Across conversations</span><strong>What recurring metadata can link →</strong></a><a href="#datasets"><span>Related datasets</span><strong>How collection methods differ →</strong></a><a href="#figures"><span>Chart library</span><strong>24 figures with their sources →</strong></a></div>`;
}

const bindings=new WeakMap();
/** Idempotent binding; native links and buttons retain ordinary keyboard behavior. */
export function mountOverviewCanvas(root,data){
 if(!root?.addEventListener)return ()=>{};
 const old=bindings.get(root);if(old){old.data=data;return old.cleanup;}
 const binding={data};
 function click(event){
  const button=event.target?.closest?.('[data-overview-mode]');
  if(!button||!root.contains(button))return;
  const mode=button.dataset.overviewMode;if(!MODES.includes(mode))return;
  const target=root.querySelector('[data-overview-composition]');if(!target)return;
  const atlas=binding.data.atlas|| (path=>'atlas.html#'+path);
  target.innerHTML=visualHTML(binding.data,mode,atlas);target.dataset.mode=mode;
  for(const item of root.querySelectorAll('[data-overview-mode]')){const active=item.dataset.overviewMode===mode;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active));}
  binding.data.onModeChange?.(mode);
 }
 binding.cleanup=()=>{root.removeEventListener('click',click);bindings.delete(root);};
 bindings.set(root,binding);root.addEventListener('click',click);return binding.cleanup;
}
