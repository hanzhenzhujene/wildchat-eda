import {withHubReturn} from './hub-navigation.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt=value=>Number(value).toLocaleString('en-US');
export const contentDimensions={
  relational_mode_counts:{label:'Interpersonal content',field:'relational_mode',labels:{none:'No interpersonal focus',social_participation:'Presented social exchange',described_hypothetical:'Described / hypothetical',personal_help:'Personal help',unclear:'Unclear / input limit'}},
  purpose_counts:{label:'Requested task',field:'purpose',labels:{text_work:'Text work',information_learning:'Information / learning',social_chat:'Social chat',technical_problem:'Technical problem',creative_roleplay:'Creative / roleplay',personal_guidance:'Personal guidance',other_unclear:'Other / unclear'}},
  packaging_counts:{label:'Input format',field:'packaging',labels:{direct_request:'Direct request',pasted_document:'Supplied document / code',embedded_history:'Embedded dialogue',unclear:'Unclear'}},
};
const palette=['#739d8b','#6874cc','#d39345','#248c83','#c16c88','#78a94e','#4b9bbd'];
const graphemes=typeof Intl.Segmenter==='function'?new Intl.Segmenter(undefined,{granularity:'grapheme'}):null;
export function contentPreview(value,limit=280){
  const text=String(value??'');let preview='',count=0;
  const iterable=graphemes?graphemes.segment(text):text;
  for(const item of iterable){if(count++===limit)return {text:preview,truncated:true};preview+=graphemes?item.segment:item;}
  return {text:preview,truncated:false};
}
export function contentCategories(summary,dimension='relational_mode_counts'){
  const spec=contentDimensions[dimension];
  if(!spec||!summary?.[dimension])throw new Error('Content classification dimension is unavailable');
  const rows=Object.entries(summary[dimension]).map(([id,count])=>{
    if(!Number.isSafeInteger(count)||count<0||!Object.hasOwn(spec.labels,id))throw new Error('Invalid saved content category');
    return {id,count,label:spec.labels[id]};
  }).sort((a,b)=>b.count-a.count||a.id.localeCompare(b.id));
  const n=rows.reduce((sum,row)=>sum+row.count,0);
  if(n!==2000||(summary.n!==undefined&&summary.n!==n))throw new Error('Content denominator must match the saved 2,000-record draw');
  return rows.map((row,index)=>({...row,color:palette[index%palette.length]}));
}
export function contentSourceIndex(collections){
  const sources=new Map();
  for(const collection of collections)for(const source of collection?.records||[]){
    if(Number.isSafeInteger(source.row_index)&&Array.isArray(source.messages))sources.set(source.row_index,source);
  }
  return sources;
}
export function contentCategoryRows(rows,dimension,selected){
  const spec=contentDimensions[dimension];if(!spec)throw new Error('Unsupported content dimension');
  return rows.filter(row=>row[spec.field]===selected);
}
export function contentSourcePair(row,sources){
  const source=sources.get(row?.row_index);
  if(!source)return {status:'not_published',source:null,request:null,reply:null};
  if(source.row_index!==row.row_index||source.source_text_sha256!==row.source_text_sha256)return {status:'source_mismatch',source:null,request:null,reply:null};
  if(row.primary_status!=='labeled')return {status:'not_labeled',source,request:null,reply:null};
  const index=row.evidence_message_index;
  if(!Number.isInteger(index)||index<0||source.messages[index]?.role!=='user')return {status:'invalid_evidence',source,request:null,reply:null};
  const replyIndex=source.messages.findIndex((message,i)=>i>index&&message.role==='assistant');
  return {status:'available',source,requestIndex:index,replyIndex,request:source.messages[index],reply:replyIndex<0?null:source.messages[replyIndex]};
}
export function validateContentState(summary,input={},rows=null){
  const dimension=Object.hasOwn(contentDimensions,input.dimension)?input.dimension:'relational_mode_counts';
  const categories=contentCategories(summary,dimension);
  let selected=categories.some(category=>category.id===input.selected)?input.selected:categories[0].id;
  const record=input.record!==null&&input.record!==undefined&&String(input.record)!==''&&Number.isSafeInteger(Number(input.record))&&Number(input.record)>=0?Number(input.record):null;
  const actual=rows?.find(row=>row.row_index===record);
  if(actual)selected=actual[contentDimensions[dimension].field];
  return {dimension,selected,record};
}
export function validateContentRows(summary,rows){
  if(!Array.isArray(rows)||rows.length!==2000||new Set(rows.map(row=>row.row_index)).size!==2000)throw new Error('Content row membership does not match the saved draw');
  for(const dimension of Object.keys(contentDimensions))for(const category of contentCategories(summary,dimension)){
    if(contentCategoryRows(rows,dimension,category.id).length!==category.count)throw new Error('Content rows disagree with saved category counts');
  }
  return true;
}
export function layoutContentUnits(rows,summary,dimension,{width=720,height=420}={}){
  const categories=contentCategories(summary,dimension),columns=Math.max(1,Math.ceil(Math.sqrt(rows.length*width/height))),gridRows=Math.ceil(rows.length/columns);
  const pitch=Math.min((width-20)/columns,(height-20)/Math.max(1,gridRows)),left=(width-columns*pitch)/2,top=(height-gridRows*pitch)/2;
  const ordered=categories.flatMap(category=>contentCategoryRows(rows,dimension,category.id).sort((a,b)=>a.row_index-b.row_index));
  return {size:Math.min(8,pitch*.68),points:ordered.map((row,index)=>({id:row.row_index,row,key:row[contentDimensions[dimension].field],x:left+(index%columns+.5)*pitch,y:top+(Math.floor(index/columns)+.5)*pitch}))};
}
export function contentRequestsURL({dimension,selected,record=null},fragment='#content'){
  const field=contentDimensions[dimension]?.field;if(!field)throw new Error('Unsupported content dimension');
  const query=new URLSearchParams({snapshot:'1',view:'records',[field]:selected});
  if(Number.isSafeInteger(record))query.set('record',String(record));
  return withHubReturn('atlas.html#audit?'+query.toString(),fragment);
}
function toolbar(state){return `<div class="cc-toolbar segmented" role="group" aria-label="Content classification dimension">${Object.entries(contentDimensions).map(([dimension,spec])=>`<button type="button" data-cc-dimension="${dimension}" class="${state.dimension===dimension?'active':''}" aria-pressed="${state.dimension===dimension}">${esc(spec.label)}</button>`).join('')}<button type="button" data-cc-expand aria-expanded="false">Expand ↗</button></div>`;}
export function renderContentCanvas(summary,options={}){
  const state=validateContentState(summary,options);
  return `<section class="cc-shell" data-content-canvas data-cc-dimension="${state.dimension}" data-cc-selected="${esc(state.selected)}" ${state.record!==null?`data-cc-record="${state.record}"`:''} aria-label="Content in the 2,000-record sample">${toolbar(state)}<p class="cc-status" role="status"><strong>2,000 sampled records</strong> · 1,998 AI-classified · 2 input-limit cases · no human validation</p><div class="cc-layout"><div class="cc-map"><div class="cc-stage"><canvas class="cc-canvas" aria-label="One mark per sampled record. Select a category or use the original-example selector for keyboard access."></canvas><div class="cc-tooltip" role="tooltip" hidden></div></div><div class="cc-legend" aria-label="Content category counts"></div><p class="cc-mark-key">Each mark is one sampled record. Outlined marks = the two input-limit cases.</p></div><aside class="cc-detail" aria-label="Selected category and record"><p class="cc-loading">Loading the selected requests…</p></aside></div></section>`;
}
let resourcePromise;
async function resources(){
  if(!resourcePromise)resourcePromise=(async()=>{
    const get=async path=>{const response=await fetch(new URL(path,import.meta.url));if(!response.ok)throw new Error(`${path}: ${response.status}`);return response.json();};
    const [audit,sourceFiles]=await Promise.all([get('data/relational_v2.json'),Promise.allSettled([get('data/topic_source_texts.json'),get('data/source_texts.json')])]);
    return {rows:audit.rows,sources:contentSourceIndex(sourceFiles.filter(result=>result.status==='fulfilled').map(result=>result.value)),sourceErrors:sourceFiles.filter(result=>result.status==='rejected').length};
  })().catch(error=>{resourcePromise=null;throw error;});
  return resourcePromise;
}
function sourceMessage(message,label){
  if(!message)return `<div class="cc-message"><small>${label}</small><p>No following stored response is available.</p></div>`;
  const content=typeof message.content==='string'?message.content:'',preview=contentPreview(content);
  return `<div class="cc-message ${message.role==='assistant'?'ai':''}"><small>${label} · dataset text</small><p dir="auto">${esc(preview.text||'(Empty stored message)')}${preview.truncated?'…':''}</p>${preview.truncated?`<details><summary>Read full message</summary><p dir="auto">${esc(content)}</p></details>`:''}</div>`;
}
export function mountContentCanvas(container,{summary,initialState={},onStateChange}={}){
  if(!container)return()=>{};
  let state=validateContentState(summary,{dimension:container.dataset.ccDimension,selected:container.dataset.ccSelected,record:container.dataset.ccRecord,...initialState});
  let alive=true,data,layout={points:[],size:1},positions=new Map(),hits=new Map(),frame=0,observer,width=0,height=0;
  const canvas=container.querySelector('canvas'),stage=container.querySelector('.cc-stage'),detail=container.querySelector('.cc-detail'),tooltip=container.querySelector('.cc-tooltip'),context=canvas.getContext('2d');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let expanded=false;const originalOverflow=document.body.style.overflow;
  function toggleExpanded(next){expanded=next;container.classList.toggle('cc-expanded',expanded);document.body.style.overflow=expanded?'hidden':originalOverflow;container.querySelector('[data-cc-expand]').textContent=expanded?'Close ✕':'Expand ↗';container.querySelector('[data-cc-expand]').setAttribute('aria-expanded',String(expanded));if(expanded){container.setAttribute('role','dialog');container.setAttribute('aria-modal','true');}else{container.removeAttribute('role');container.removeAttribute('aria-modal');}paint(false);}
  const keydown=event=>{if(!expanded)return;if(event.key==='Escape'){toggleExpanded(false);container.querySelector('[data-cc-expand]').focus({preventScroll:true});return;}if(event.key==='Tab'){const stops=[...container.querySelectorAll('button:not(:disabled),select,a[href],summary')].filter(el=>el.getClientRects().length);const first=stops[0],last=stops.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};
  const dimensions=()=>({width:Math.max(220,stage.clientWidth||700),height:Math.max(260,stage.clientHeight||420)});
  const notify=()=>{if(typeof onStateChange==='function')onStateChange({...state});};
  const categories=()=>contentCategories(summary,state.dimension);
  const matching=()=>contentCategoryRows(data.rows,state.dimension,state.selected);
  function originals(){return matching().filter(row=>contentSourcePair(row,data.sources).status==='available');}
  function pickIllustration(){
    const available=originals();
    state.record=(available.find(row=>row.row_index===655284)||available[0])?.row_index??null;
  }
  function draw(time,start,previous,target){
    if(!alive)return;
    const progress=reduced?1:Math.min(1,(time-start)/440),ease=1-Math.pow(1-progress,3),size=target.size;
    context.clearRect(0,0,width,height);positions=new Map();hits=new Map();
    const colors=new Map(categories().map(category=>[category.id,category.color]));
    for(const point of target.points){
      const before=previous.get(point.id)||point,x=before.x+(point.x-before.x)*ease,y=before.y+(point.y-before.y)*ease;
      const displayed={...point,x,y};positions.set(point.id,displayed);const hit=`${Math.floor(x/12)},${Math.floor(y/12)}`;if(!hits.has(hit))hits.set(hit,[]);hits.get(hit).push(displayed);
      context.globalAlpha=point.key===state.selected?1:.58;context.fillStyle=colors.get(point.key);context.strokeStyle=colors.get(point.key);
      if(point.row.primary_status==='input_limit'){context.lineWidth=1.5;context.strokeRect(x-size/2,y-size/2,size,size);}
      else context.fillRect(x-size/2,y-size/2,size,size);
    }
    context.globalAlpha=1;const point=positions.get(state.record);
    if(point){context.beginPath();context.arc(point.x,point.y,Math.max(7,size*.9),0,Math.PI*2);context.strokeStyle='#fff';context.lineWidth=4;context.stroke();context.strokeStyle='#142b25';context.lineWidth=1.7;context.stroke();}
    if(progress<1)frame=requestAnimationFrame(next=>draw(next,start,previous,target));
  }
  function paint(animate=true){
    if(!data||!alive)return;cancelAnimationFrame(frame);
    const size=dimensions(),ratio=Math.min(devicePixelRatio||1,2);width=size.width;height=size.height;
    canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);canvas.style.width=width+'px';canvas.style.height=height+'px';context.setTransform(ratio,0,0,ratio,0,0);
    layout=layoutContentUnits(data.rows,summary,state.dimension,size);const previous=animate?new Map(positions):new Map(),start=performance.now();draw(start+(animate?0:440),start,previous,layout);
  }
  function renderDetail(){
    const category=categories().find(item=>item.id===state.selected),available=originals(),row=data.rows.find(item=>item.row_index===state.record);
    const selectedSource=available.some(item=>item.row_index===state.record);
    const field=contentDimensions[state.dimension].field;
    const incomplete=matching().filter(item=>item.primary_status!=='labeled').length;
    const status=incomplete?`<p class="cc-source-note">${category.count-incomplete} completed AI labels + ${incomplete} input-limit cases.</p>`:'';
    const select=`${available.length?`<label class="cc-record-select">Published originals · ${available.length}<select data-cc-record aria-label="Choose an original request in this category">${state.record!==null&&!row?'<option value="" selected disabled>Requested ID is outside this sample</option>':!selectedSource&&row?`<option value="${row.row_index}" selected>${row.row_index} · metadata only</option>`:''}${available.map(item=>`<option value="${item.row_index}" ${item.row_index===state.record?'selected':''}>Record ${item.row_index}</option>`).join('')}</select></label>`:''}`;
    let body='';
    if(state.record!==null&&!row)body='<div class="cc-empty"><p>This record is not in the 2,000-record content sample.</p></div>';
    else if(!row)body=`<div class="cc-empty"><p>${data.sourceErrors?'Original-text coverage could not be fully loaded.':'No original Q&A is published here for this category.'}</p></div>`;
    else {
      const pair=contentSourcePair(row,data.sources);
      body=`<div class="cc-record-header"><h4>Record ${row.row_index}</h4><p class="cc-source-note">${esc(row.language)} source label · ${esc(row.date)} · ${row.user_turns} user message${row.user_turns===1?'':'s'}</p>${row.disagreement_fields?.length?`<span class="cc-disagreement">${row.disagreement_fields.length} fields differ between AI passes</span>`:''}</div>`;
      if(row.primary_status==='input_limit')body+='<div class="cc-empty"><strong>Input limit</strong><p>No completed AI label. This record remains in the 2,000-record denominator.</p></div>';
      else if(pair.status==='available')body+=`<p class="cc-source-note">AI-marked request · stored message ${pair.requestIndex+1}. ${esc(pair.source.text_status||'Original source text; marked redactions retained.')}</p>${sourceMessage(pair.request,'User request')}${sourceMessage(pair.reply,'AI response')}<details class="cc-full-context"><summary>Full stored context · ${pair.source.messages.length} messages</summary>${pair.source.messages.map((message,index)=>`<div class="cc-context-message"><small>${index+1} · ${esc(message.role)}</small><p dir="auto">${esc(typeof message.content==='string'?message.content:'')}</p></div>`).join('')}</details>`;
      else if(pair.status==='not_published')body+=`<div class="cc-empty"><strong>Metadata only</strong><p>${data.sourceErrors?'A source-text file failed to load; the text may be unavailable for that reason.':'Original text is not included for this exact record.'}</p></div>`;
      else body+='<div class="cc-empty"><p>The saved source and evidence pointer could not be matched. No other record has been substituted.</p></div>';
      body+=`<a class="card-link" href="${esc(contentRequestsURL({...state,selected:row[field]},location.hash))}">Open this request in the data browser ↗</a>`;
    }
    detail.innerHTML=`<button type="button" class="cc-detail-back" data-cc-back>↑ Categories</button><span class="eyebrow">Selected category · AI classification</span><h3>${esc(category.label)}</h3><div class="cc-category-count">${fmt(category.count)} <small>/ 2,000</small></div><p class="cc-source-note">${(category.count/2000*100).toFixed(2)}% of the sampled records.</p>${status}<a class="card-link" href="${esc(contentRequestsURL({...state,record:null},location.hash))}">All ${fmt(category.count)} matching requests ↗</a>${available.length?`<p class="cc-source-note">${available.length} selected originals available here${data.sourceErrors?' (coverage incomplete)':''}. These examples are not a random subset.</p>`:''}${select}${body}`;
  }
  function render(animate=true,focusCategory=false,focusRecord=false){
    if(!data||!alive)return;
    container.querySelectorAll('[data-cc-dimension]').forEach(button=>{const active=button.dataset.ccDimension===state.dimension;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
    const count=data.rows.filter(row=>contentSourcePair(row,data.sources).status==='available').length;
    container.querySelector('.cc-status').innerHTML=`<strong>2,000 sampled records</strong> · 1,998 AI-classified · 2 input-limit cases · no human validation<span class="cc-source-coverage"> · ${count} selected originals${data.sourceErrors?' (source loading incomplete)':''}</span>`;
    container.querySelector('.cc-legend').innerHTML=categories().map(category=>`<button type="button" class="cc-legend-item ${category.id===state.selected?'active':''}" data-cc-category="${category.id}" aria-pressed="${category.id===state.selected}"><span><i style="background:${category.color}"></i>${esc(category.label)}</span><strong>${fmt(category.count)} <small>· ${(category.count/2000*100).toFixed(2)}%</small></strong></button>`).join('');
    renderDetail();paint(animate);notify();
    if(focusCategory)container.querySelector('[data-cc-category][aria-pressed="true"]')?.focus({preventScroll:true});
    if(focusRecord)detail.querySelector('[data-cc-record]')?.focus({preventScroll:true});
  }
  function pointAt(event){
    const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top,cx=Math.floor(x/12),cy=Math.floor(y/12);let found=null,distance=Infinity;
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const point of hits.get(`${cx+dx},${cy+dy}`)||[]){const d=(point.x-x)**2+(point.y-y)**2;if(d<distance){found=point;distance=d;}}
    return distance<100?found:null;
  }
  const move=event=>{const point=pointAt(event);canvas.style.cursor=point?'pointer':'default';if(!point){tooltip.hidden=true;return;}const category=categories().find(item=>item.id===point.key);tooltip.innerHTML=`<strong>Record ${point.id}</strong><span>${esc(category.label)}</span><small>${point.row.primary_status==='input_limit'?'Input limit · no completed label':contentSourcePair(point.row,data.sources).status==='available'?'Original Q&A available':'Metadata only · AI label'}</small>`;tooltip.hidden=false;const rect=stage.getBoundingClientRect();tooltip.style.left=Math.max(4,Math.min(rect.width-220,event.clientX-rect.left+12))+'px';tooltip.style.top=Math.max(4,event.clientY-rect.top-70)+'px';};
  const leave=()=>{tooltip.hidden=true;};
  const click=event=>{
    if(event.target.closest('[data-cc-back]')){container.querySelector('.cc-legend').scrollIntoView({block:'start',behavior:reduced?'instant':'smooth'});container.querySelector('[data-cc-category][aria-pressed="true"]')?.focus({preventScroll:true});return;}
    if(event.target.closest('[data-cc-expand]')){toggleExpanded(!expanded);return;}
    if(!data)return;
    const dimension=event.target.closest('button[data-cc-dimension]');if(dimension){state=validateContentState(summary,{...state,dimension:dimension.dataset.ccDimension,selected:null},data.rows);if(state.record===null)pickIllustration();render();return;}
    const category=event.target.closest('[data-cc-category]');if(category){state.selected=category.dataset.ccCategory;state.record=null;pickIllustration();render(false,true);if(innerWidth<=900)detail.scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'});return;}
    if(event.target===canvas){const point=pointAt(event);if(point){state.record=point.id;state.selected=point.key;render(false);if(innerWidth<=900)detail.scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'});}}
  };
  const change=event=>{if(data&&event.target.matches('select[data-cc-record]')){const id=Number(event.target.value);if(originals().some(row=>row.row_index===id)){state.record=id;render(false,false,true);}}};
  document.addEventListener('keydown',keydown);container.addEventListener('click',click);container.addEventListener('change',change);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerleave',leave);
  resources().then(value=>{if(!alive)return;data=value;validateContentRows(summary,data.rows);state=validateContentState(summary,state,data.rows);if(state.record===null)pickIllustration();render(false);observer=new ResizeObserver(()=>{const next=dimensions();if(next.width!==width||next.height!==height)paint(false);});observer.observe(stage);}).catch(error=>{if(alive){detail.innerHTML='<div class="cc-empty"><p>Content records could not load. No source example was substituted.</p></div>';console.error(error);}});
  return()=>{alive=false;if(expanded)document.body.style.overflow=originalOverflow;document.removeEventListener('keydown',keydown);cancelAnimationFrame(frame);observer?.disconnect();container.removeEventListener('click',click);container.removeEventListener('change',change);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerleave',leave);};
}
