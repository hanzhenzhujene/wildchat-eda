/** Aggregate metadata linkage workspace. No identifiers, individual histories,
 * joint distributions or inferred people are constructed by this module. */
import {linkageExplorerData} from './linkage-interactive.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=value=>Number(value).toLocaleString('en-US');
const percent=(count,n)=>{const p=100*count/n;return p>0&&p<.1?'<0.1%':p.toFixed(1)+'%';};
const SPAN_BANDS=['0 days','<1 day','1–6 days','7–29 days','30–89 days','90–364 days','365+ days'];
const THRESHOLD_START={all:0,day1:2,day7:3,day30:4,day90:5,day365:6};
const safeURL=value=>typeof value==='string'&&/^https:\/\//.test(value)?value:null;

export function linkageCanvasModel(data){
 const saved=linkageExplorerData(data),rows=data.totals.rows,completeRows=data.totals.complete_key_rows;
 if(!Number.isSafeInteger(rows)||rows<completeRows)throw new TypeError('Invalid released-record count.');
 const counts=new Map(data.span_distribution.map(x=>[x.band,x.groups]));
 const bins=SPAN_BANDS.map(band=>({id:'bin:'+band,label:band,count:counts.get(band),detail:band==='0 days'?'The earliest and latest stored timestamps are identical.':band==='<1 day'?'A positive span shorter than one day.':`The earliest and latest stored timestamps fall in the ${band} span band.`}));
 if(bins.some(x=>!Number.isSafeInteger(x.count)||x.count<0))throw new TypeError('A saved time-span bin is missing.');
 return {...saved,bins,totals:data.totals,repeated:data.repeated_key_groups,excludedRows:rows-completeRows,
  sourceURL:safeURL(data.source_url),documentationURL:safeURL(data.documentation_url),revision:String(data.revision||'Not recorded'),
  limits:Array.isArray(data.limits)?data.limits:[]};
}

/** Exact bins replace a threshold selection; these are never joint filters. */
export function linkageCanvasSelection(model,{view='span',selected}={}){
 view=view==='volume'?'volume':'span';
 const choices=view==='span'?[...model.span,...model.bins]:model.volume;
 const fallback=view==='span'?'day30':'2–5';
 const current=choices.find(x=>x.id===selected)||choices.find(x=>x.id===fallback)||choices[0];
 const denominator=model.denominators[view];
 const exactBin=view==='volume'||current.id.startsWith('bin:');
 const datedSubset=current.id==='dates3span30';
 const histogram=view==='span'?model.bins:model.volume;
 const selectedIds=datedSubset?[]:exactBin?[current.id]:histogram.slice(THRESHOLD_START[current.id]??0).map(x=>x.id);
 return {view,selected:current.id,current,denominator,exactBin,datedSubset,histogram,selectedIds,share:current.count/denominator};
}

const compactChart=()=>typeof matchMedia==='function'&&matchMedia('(max-width:650px)').matches;
function histogramHTML(model,s){
 const compact=compactChart(),W=compact?430:850,left=compact?12:125,right=compact?12:126,plot=W-left-right,top=compact?31:25,row=compact?66:49,bottom=compact?58:47,H=top+row*s.histogram.length+bottom;
 const end=top+row*s.histogram.length;
 const textStyle=compact?' style="font-size:18px"':'';
 const grid=[0,25,50,75,100].map(p=>{const x=left+plot*p/100;return `<line x1="${x}" x2="${x}" y1="${top-10}" y2="${end}" class="lc-gridline"/><text x="${x}" y="${end+24}" text-anchor="${compact&&p===0?'start':compact&&p===100?'end':'middle'}" class="lc-axis"${compact?' style="font-size:16px"':''}>${p}%</text>`;}).join('');
 const bars=s.histogram.map((item,i)=>{const y=top+i*row,active=s.selectedIds.includes(item.id),width=item.count/s.denominator*plot;
  const label=compact?`<text class="lc-bin-label" x="${left}" y="${y}"${textStyle}>${esc(item.label)}</text>`:`<text class="lc-bin-label" x="${left-14}" y="${y+7}" text-anchor="end">${esc(item.label)}</text>`;
  const count=`<text class="lc-bar-count" x="${compact?W-right:left+width+9}" y="${compact?y:y+7}"${compact?' text-anchor="end"':''}${textStyle}>${fmt(item.count)} <tspan class="lc-bar-share"${textStyle}>· ${esc(percent(item.count,s.denominator))}</tspan></text>`;
  return `<g class="lc-bar-button ${active?'selected':''}" role="button" tabindex="0" data-lc-bin="${esc(item.id)}" aria-pressed="${s.exactBin&&s.selected===item.id}" aria-label="${esc(item.label)}: ${fmt(item.count)} combinations, ${esc(percent(item.count,s.denominator))}. Select this exact band."><title>${esc(item.label)}: ${fmt(item.count)} / ${fmt(s.denominator)} combinations</title><rect class="lc-row-hit" x="0" y="${y-19}" width="${W}" height="${row-5}" rx="5" fill="transparent"/>${label}<rect class="lc-bar" x="${left}" y="${compact?y+13:y-8}" width="${width}" height="${compact?22:25}" rx="2" fill="${active?'#20675a':'#c5d0c6'}"/>${count}</g>`;
 }).join('');
 return `<svg class="lc-histogram${compact?' compact':''}" viewBox="0 0 ${W} ${H}" role="group" aria-label="${s.view==='span'?'Nonoverlapping time-span bands among repeated combinations':'Nonoverlapping record-count bands among complete combinations'}. Select a bar for exact counts.">${grid}${bars}<text class="lc-axis-title" x="${left+plot/2}" y="${H-7}" text-anchor="middle"${compact?' style="font-size:15px"':''}>Share of ${fmt(s.denominator)} ${s.view==='span'?'repeated':'complete'} combinations</text></svg>`;
}

function selectionHTML(model,s){
 const type=s.view==='volume'?'Record-count band':s.datedSubset?'Saved span + active-date rule':s.exactBin?'Exact time-span band':'Cumulative span threshold';
 const unit=s.view==='span'?'combinations appearing in 2+ records':'complete metadata combinations';
 const extra=s.view==='volume'?`<div class="lc-result-extra"><strong>${fmt(s.current.rows)} records</strong><span>inside these combinations (${esc(percent(s.current.rows,model.completeRows))} of ${fmt(model.completeRows)} eligible records).</span></div>`:s.datedSubset?`<div class="lc-result-extra"><strong>Subset of ${fmt(model.repeated.span_ge_30days)}</strong><span>combinations spanning 30+ days. Its distribution across the span bands is not available.</span></div>`:'';
 return `<aside class="lc-selection" role="status" aria-live="polite" aria-atomic="true"><button type="button" class="lc-result-back" data-lc-back>↑ Chart</button><span class="lc-selection-kind">${type}</span><h3>${esc(s.current.label)}</h3><div class="lc-result-number">${fmt(s.current.count)}</div><span class="lc-result-unit">IP/browser combinations</span><div class="lc-result-meter" aria-hidden="true"><span style="width:${s.share*100}%"></span></div><p class="lc-result-share"><strong>${esc(percent(s.current.count,s.denominator))}</strong> of ${fmt(s.denominator)} ${unit}.</p><p class="lc-result-description">${esc(s.current.detail)}</p>${extra}</aside>`;
}
function workspaceHTML(model,options){
 const s=linkageCanvasSelection(model,options);
 const presets=s.view==='span'?`<label class="lc-threshold-label">Span threshold<select data-lc-threshold aria-label="Choose a saved span threshold"><option value="" disabled ${s.exactBin?'selected':''}>Exact band selected</option>${model.span.map(item=>`<option value="${esc(item.id)}" ${s.selected===item.id?'selected':''}>${esc(item.label)}</option>`).join('')}</select></label>`:'<p class="lc-select-hint">Select a bar to inspect one record-count band.</p>';
 const note=s.datedSubset?'The chart shows span only. No per-band counts are available for the 3+ dates subset.':s.view==='span'&&!s.exactBin?'Highlighted bands add up to the selected threshold. Thresholds overlap.':'Each bar is one nonoverlapping band.';
 return `<div class="lc-workspace-head"><div class="lc-tabs" role="group" aria-label="Aggregate view"><button type="button" data-lc-view="span" aria-pressed="${s.view==='span'}" class="${s.view==='span'?'active':''}">Time span</button><button type="button" data-lc-view="volume" aria-pressed="${s.view==='volume'}" class="${s.view==='volume'?'active':''}">Record count</button></div>${presets}</div><div class="lc-workspace-grid"><section class="lc-plot"><div class="lc-plot-title"><h2>${s.view==='span'?'Most repeated matches span less than a day.':'Most IP/browser combinations appear once.'}</h2><span>${s.view==='span'?fmt(model.denominators.span)+' repeated combinations · median span '+(model.repeated.median_span_days*24).toFixed(1)+' hours':fmt(model.denominators.volume)+' complete combinations'}</span></div><div class="lc-chart-key">${s.datedSubset?'':'<span><i class="lc-selected-swatch"></i>Selected bands</span>'}<span><i class="lc-context-swatch"></i>${s.datedSubset?'All span bands':'Other bands'}</span></div>${histogramHTML(model,s)}<p class="lc-chart-note">${note}</p></section>${selectionHTML(model,s)}</div>`;
}
function flowHTML(model){
 const t=model.totals,steps=[['Released records',t.rows,'records'],['IP/browser fields present',t.complete_key_rows,'records'],['Distinct IP/browser combinations',t.complete_keys,'combinations'],['Appearing in 2+ records',model.denominators.span,'combinations']],labels=['Require fields','Group exact matches','Keep repeats'];
 return `<div class="lc-data-flow" aria-label="Analysis units"><div class="lc-flow-steps">${steps.map(([title,count,unit],i)=>`${i?`<div class="lc-flow-arrow" aria-hidden="true"><span>${labels[i-1]}</span><b>→</b></div>`:''}<div class="lc-step"><span>${title}</span><strong>${fmt(count)}</strong><small>${unit}</small></div>`).join('')}</div><p class="lc-excluded"><strong>${fmt(model.excludedRows)} records excluded</strong> (at least one required field is missing).</p></div>`;
}
function methodsHTML(model,data){
 const links=`<div class="lc-downloads"><a href="data/public-hub/linkage.json" download>Aggregate counts (JSON) ↓</a>${model.documentationURL?`<a href="${esc(model.documentationURL)}" target="_blank" rel="noopener">Official field documentation ↗</a>`:''}${model.sourceURL?`<a href="${esc(model.sourceURL)}" target="_blank" rel="noopener">Pinned release ↗</a>`:''}</div>`;
 return `<details class="lc-methods"><summary><span>Method & limits</span><small>Matching rule, denominators and downloads</small></summary><div class="lc-method-body"><dl><div><dt>Match</dt><dd>The exact tuple (hashed IP, accept-language header, user-agent header), with every component nonblank.</dd></div><div><dt>Span</dt><dd>Latest minus earliest stored record timestamp (UTC last-turn timestamps).</dd></div><div><dt>Denominators</dt><dd>Time-span bands and thresholds use ${fmt(model.denominators.span)} repeated combinations. Record-count bands use all ${fmt(model.denominators.volume)} complete combinations, including those appearing once. The saved export has no span × record-count table.</dd></div><div><dt>Missing metadata</dt><dd>${fmt(model.excludedRows)} records lack at least one required field. Individual missing-field counts overlap: ${fmt(model.totals.missing_language_header_rows)} lack a language header; ${fmt(model.totals.missing_user_agent_rows)} lack a user-agent header. These counts must not be added.</dd></div><div><dt>Identity limits</dt><dd>Shared networks or browser settings can merge people; changes can split one person. A long span does not establish continuous use or one continuing issue.</dd></div><div><dt>Scope</dt><dd>All 86 files of one pinned, filtered WildChat release. No message content was analyzed for this linkage calculation. <code>${esc(model.revision)}</code></dd></div></dl><p>No conversation examples are linked to these combinations; only aggregates are public.</p>${links}</div></details>`;
}
export function renderLinkageCanvas(data,options={}){
 const model=linkageCanvasModel(data),s=linkageCanvasSelection(model,options);
 return `<section class="linkage-canvas-page" data-linkage-canvas data-lc-current-view="${s.view}" data-lc-current-selection="${esc(s.selected)}"><header class="lc-page-head"><div><div class="eyebrow">Metadata matches</div><h1>Across conversations</h1><p>Matching IP/browser metadata can associate records. It cannot confirm the same person.</p></div><a class="button" href="data/public-hub/linkage.json" download>Saved counts ↓</a></header>${flowHTML(model)}<section class="lc-workspace" data-lc-workspace aria-label="Aggregate cross-conversation distributions">${workspaceHTML(model,s)}</section><div class="lc-observations"><button type="button" data-lc-select="day365"><strong>${fmt(model.bins.find(x=>x.id==='bin:365+ days').count)}</strong><span>span at least one year →</span></button><button type="button" data-lc-select="dates3span30"><strong>${fmt(model.repeated.dates3_span30)}</strong><span>span 30+ days, across 3+ dates →</span></button></div>${methodsHTML(model,data)}</section>`;
}
const bindings=new WeakMap();
export function mountLinkageCanvas(container,data,{onChange}={}){
 if(!container?.addEventListener)return ()=>{};
 const old=bindings.get(container);if(old){old.onChange=onChange;return old.cleanup;}
 const model=linkageCanvasModel(data),initial=linkageCanvasSelection(model,{view:container.dataset.lcCurrentView,selected:container.dataset.lcCurrentSelection});
 const state={view:initial.view,selected:{span:initial.view==='span'?initial.selected:'day30',volume:initial.view==='volume'?initial.selected:'2–5'}};
 const media=typeof matchMedia==='function'?matchMedia('(max-width:650px)'):null;
 const binding={onChange,compact:media?.matches??false};
 function paint(focus){
  const s=linkageCanvasSelection(model,{view:state.view,selected:state.selected[state.view]});
  state.selected[state.view]=s.selected;container.dataset.lcCurrentView=s.view;container.dataset.lcCurrentSelection=s.selected;
  const target=container.querySelector('[data-lc-workspace]');if(!target)return;
  target.innerHTML=workspaceHTML(model,s);binding.onChange?.({view:s.view,selected:s.selected});
  if(focus==='threshold')target.querySelector('[data-lc-threshold]')?.focus({preventScroll:true});
  else if(focus==='view')target.querySelector(`[data-lc-view="${s.view}"]`)?.focus({preventScroll:true});
  else if(focus==='bin')Array.from(target.querySelectorAll('[data-lc-bin]')).find(el=>el.dataset.lcBin===s.selected)?.focus({preventScroll:true});
 }
 function selectBin(id){if(!linkageCanvasSelection(model,{view:state.view,selected:id}).histogram.some(x=>x.id===id))return;state.selected[state.view]=id;paint('bin');}
 function showResult(){if(typeof matchMedia==='function'&&matchMedia('(max-width:900px)').matches)container.querySelector('.lc-selection')?.scrollIntoView?.({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});}
 function click(event){
  const back=event.target?.closest?.('[data-lc-back]');if(back){container.querySelector('.lc-plot')?.scrollIntoView?.({block:'start',behavior:typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});(Array.from(container.querySelectorAll('[data-lc-bin]')).find(el=>el.getAttribute('aria-pressed')==='true')||container.querySelector('.lc-bar-button.selected')||container.querySelector('[data-lc-bin]'))?.focus?.({preventScroll:true});return;}
  const tab=event.target?.closest?.('[data-lc-view]');if(tab&&container.contains(tab)&&['span','volume'].includes(tab.dataset.lcView)){state.view=tab.dataset.lcView;paint('view');return;}
  const bin=event.target?.closest?.('[data-lc-bin]');if(bin&&container.contains(bin)){selectBin(bin.dataset.lcBin);showResult();return;}
  const preset=event.target?.closest?.('[data-lc-select]');if(preset&&container.contains(preset)&&model.span.some(x=>x.id===preset.dataset.lcSelect)){state.view='span';state.selected.span=preset.dataset.lcSelect;paint();showResult();if(typeof matchMedia==='function'&&!matchMedia('(max-width:900px)').matches)container.querySelector('[data-lc-workspace]')?.scrollIntoView?.({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});}
 }
 function change(event){if(!event.target?.matches?.('[data-lc-threshold]'))return;const id=event.target.value;if(!model.span.some(x=>x.id===id))return;state.selected.span=id;paint('threshold');showResult();}
 function keydown(event){if(!['Enter',' '].includes(event.key))return;const bar=event.target?.closest?.('[data-lc-bin]');if(!bar||!container.contains(bar))return;event.preventDefault();selectBin(bar.dataset.lcBin);}
 const resize=event=>{if(Boolean(event.matches)===binding.compact)return;binding.compact=Boolean(event.matches);const active=typeof document==='undefined'?null:document.activeElement;const focus=active?.matches?.('[data-lc-threshold]')?'threshold':active?.closest?.('[data-lc-bin]')?'bin':active?.matches?.('[data-lc-view]')?'view':null;paint(focus);};
 container.addEventListener('click',click);container.addEventListener('change',change);container.addEventListener('keydown',keydown);
 if(media?.addEventListener)media.addEventListener('change',resize);else media?.addListener?.(resize);
 binding.cleanup=()=>{container.removeEventListener('click',click);container.removeEventListener('change',change);container.removeEventListener('keydown',keydown);if(media?.removeEventListener)media.removeEventListener('change',resize);else media?.removeListener?.(resize);bindings.delete(container);};
 bindings.set(container,binding);return binding.cleanup;
}
