import {withHubReturn} from './hub-navigation.js';

const FIELDS = ['turn_bucket','model_family','year'];
const LABELS = {turn_bucket:'User messages',model_family:'Model family',year:'Year'};
const TURNS = ['1','2','3','4–5','6–10','11+'];
const PALETTE = ['#2c8d80','#6575d5','#d78c40','#b063a5','#67a841','#3d9bce','#cd6475','#9b8d48'];
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt = value => Number(value).toLocaleString('en-US');
export const canvasDefaults = {group:'turn_bucket',color:'model_family',filter:'',withText:false,selected:null,search:''};

export function unpackCanvasRecords(packed) {
  if (!Array.isArray(packed?.columns) || !Array.isArray(packed?.rows)) throw new Error('Record metadata is unavailable');
  const records = packed.rows.map(values => Object.fromEntries(packed.columns.map((key,index) => [key,values[index]])));
  if (records.some(row => !Number.isSafeInteger(row.row_index)) || new Set(records.map(row => row.row_index)).size !== records.length) {
    throw new Error('Record IDs are invalid or repeated');
  }
  return records;
}
export function storedTurnBucket(value) {
  return value <= 3 ? String(value) : value <= 5 ? '4–5' : value <= 10 ? '6–10' : '11+';
}
export function canvasLevel(row, field) {
  return field === 'turn_bucket' ? storedTurnBucket(row.user_turns) : String(row[field]);
}
export function groupCanvasRecords(records, field) {
  if (!FIELDS.includes(field)) throw new Error('Unsupported metadata grouping');
  const groups = new Map();
  for (const row of records) {
    const key = canvasLevel(row,field);
    if (!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(row);
  }
  return [...groups].sort(([a],[b]) => field === 'turn_bucket' ? TURNS.indexOf(a)-TURNS.indexOf(b) : a.localeCompare(b)).map(([key,rows]) => ({key,rows,count:rows.length}));
}
export function canvasSourceIndex(collections) {
  const index = new Map();
  for (const collection of collections) for (const row of collection?.records || []) {
    if (Number.isSafeInteger(row.row_index) && Array.isArray(row.messages)) index.set(row.row_index,row);
  }
  return index;
}
export function canvasSourcePair(rowId, sources) {
  const source = sources.get(Number(rowId));
  if (!source) return null;
  const userIndex = source.messages.findIndex(message => message.role === 'user');
  const replyIndex = userIndex < 0 ? -1 : source.messages.findIndex((message,index) => index > userIndex && message.role === 'assistant');
  return {source,userIndex,replyIndex,user:userIndex < 0 ? null : source.messages[userIndex],reply:replyIndex < 0 ? null : source.messages[replyIndex]};
}
export function filterCanvasRecords(records, state, sources = new Map()) {
  const search = String(state.search || '').trim();
  return records.filter(row => (!state.withText || sources.has(row.row_index))
    && (!state.filter || canvasLevel(row,state.color) === state.filter)
    && (!search || /^\d+$/.test(search) && row.row_index === Number(search)));
}
export function layoutCanvasRecords(records, {width=800,height=480,group='turn_bucket'} = {}) {
  const groups = groupCanvasRecords(records,group);
  if (!groups.length) return {points:[],panels:[],size:1};
  const columns = Math.min(groups.length,width < 500 ? 2 : groups.length > 6 ? 4 : 3);
  const rows = Math.ceil(groups.length / columns), gap=9, cw=(width-gap*(columns-1))/columns, ch=(height-gap*(rows-1))/rows;
  let minimumPitch=Infinity;
  const panels = groups.map((item,index) => {
    const x=(index%columns)*(cw+gap), y=Math.floor(index/columns)*(ch+gap), innerW=Math.max(8,cw-12),innerH=Math.max(8,ch-32);
    const dotColumns=Math.max(1,Math.ceil(Math.sqrt(item.count*innerW/innerH))),dotRows=Math.ceil(item.count/dotColumns);
    const pitch=Math.min(innerW/dotColumns,innerH/dotRows);
    minimumPitch=Math.min(minimumPitch,pitch);
    return {...item,x,y,width:cw,height:ch,dotColumns,dotRows,pitch};
  });
  const size=Math.min(4,minimumPitch*.67);
  const points=[];
  for (const panel of panels) {
    const left=panel.x+(panel.width-panel.dotColumns*panel.pitch)/2;
    const top=panel.y+25+(Math.max(0,panel.height-30-panel.dotRows*panel.pitch))/2;
    panel.rows.forEach((record,index) => points.push({id:record.row_index,record,
      x:left+(index%panel.dotColumns+.5)*panel.pitch,y:top+(Math.floor(index/panel.dotColumns)+.5)*panel.pitch}));
  }
  return {points,panels,size};
}
export function canvasAtlasURL(record, records, fragment='#distributions?chart=records') {
  const examples = new Set([286012,753427,2632268,255498,1671993,2606561]);
  const position=[...records].sort((a,b)=>a.row_index-b.row_index).findIndex(row=>row.row_index===record.row_index);
  const url=examples.has(record.row_index) ? `atlas.html#cases?record=${record.row_index}`
    : `atlas.html#explorer?snapshot=1&view=records&sort=row_index&page=${Math.floor(position/25)+1}`;
  return withHubReturn(url,fragment);
}
function controls(name,selected) {
  return FIELDS.map(field => `<option value="${field}" ${field === selected ? 'selected' : ''}>${esc(LABELS[field])}</option>`).join('');
}
export function renderRecordCanvas() {
  return `<section class="record-canvas-shell" data-record-canvas aria-label="Record metadata map">
    <div class="rc-toolbar"><label class="rc-control">Group by<select data-rc-group>${controls('group','turn_bucket')}</select></label><label class="rc-control">Color by<select data-rc-color>${controls('color','model_family')}</select></label><label class="rc-control">Record ID<input data-rc-search type="search" inputmode="numeric" placeholder="e.g. 1494984" aria-label="Find an exact source row ID"></label><label class="rc-original-toggle"><input type="checkbox" data-rc-text><span>With original text <b data-rc-source-count>…</b></span></label><button type="button" class="rc-reset" data-rc-reset hidden>Clear filters</button><button type="button" class="rc-expand" data-rc-expand aria-expanded="false">Expand ↗</button></div>
    <div class="rc-status" role="status" aria-live="polite">Loading the 20,000-record metadata sample…</div>
    <div class="rc-layout"><div class="rc-map"><div class="rc-stage"><canvas class="rc-canvas" aria-label="Each mark is one selected record. Use the record selector for keyboard access."></canvas><div class="rc-tooltip" role="tooltip" hidden></div></div><div class="rc-legend" aria-label="Color categories"></div><p class="rc-map-note">One equal-size mark per record. Positions group metadata; they do not show semantic similarity.</p></div><aside class="rc-detail" aria-label="Selected record"><p class="rc-loading">Loading record details…</p></aside></div>
  </section>`;
}
let resourcePromise;
async function loadResources() {
  if (!resourcePromise) resourcePromise = (async () => {
    const get=async path=>{const response=await fetch(new URL(path,import.meta.url));if(!response.ok)throw new Error(`${path}: ${response.status}`);return response.json();};
    const [packed,sourceResults]=await Promise.all([get('data/records.json'),Promise.allSettled([get('data/topic_source_texts.json'),get('data/source_texts.json')])]);
    return {records:unpackCanvasRecords(packed),sources:canvasSourceIndex(sourceResults.filter(result=>result.status==='fulfilled').map(result=>result.value)),sourceErrors:sourceResults.filter(result=>result.status==='rejected').length};
  })().catch(error=>{resourcePromise=null;throw error;});
  return resourcePromise;
}
function sourceMessage(message, label) {
  if (!message) return `<div class="rc-message"><small>${label}</small><p>No stored message is available.</p></div>`;
  const content=typeof message.content === 'string' ? message.content : '';
  const preview=content.length>340?content.slice(0,340)+'…':content;
  return `<div class="rc-message ${message.role==='assistant'?'ai':''}"><small>${label} · dataset text</small><p dir="auto">${esc(preview || '(Empty stored message)')}</p>${content.length>340?`<details><summary>Read full message</summary><p dir="auto">${esc(content)}</p></details>`:''}</div>`;
}

export function mountRecordCanvas(container, {initialState={},onStateChange} = {}) {
  if (!container) return () => {};
  const state={...canvasDefaults,...initialState};
  state.group=FIELDS.includes(state.group)?state.group:canvasDefaults.group;
  state.color=FIELDS.includes(state.color)?state.color:canvasDefaults.color;
  state.withText=state.withText===true||state.withText==='1';
  state.search=String(state.search||'').trim();
  let alive=true,resources,visible=[],layout={points:[],panels:[],size:1},frame=0,points=new Map(),selected=null,hitGrid=new Map(),palette=new Map(),observer;
  let lastWidth=0,lastHeight=0,hoverId=null,expanded=false;
  const originalBodyOverflow=document.body.style.overflow;
  function toggleExpanded(next){expanded=next;container.classList.toggle('rc-expanded',expanded);if(expanded){container.setAttribute('role','dialog');container.setAttribute('aria-modal','true');}else{container.removeAttribute('role');container.removeAttribute('aria-modal');}document.body.style.overflow=expanded?'hidden':originalBodyOverflow;const b=container.querySelector('[data-rc-expand]');b.textContent=expanded?'Close ✕':'Expand ↗';b.setAttribute('aria-expanded',String(expanded));relayout(false);}
  const keydown=event=>{if(!expanded)return;if(event.key==='Escape'){toggleExpanded(false);container.querySelector('[data-rc-expand]').focus({preventScroll:true});return;}if(event.key==='Tab'){const stops=[...container.querySelectorAll('button:not(:disabled),select,input,a[href],summary')].filter(e=>e.getClientRects().length);const first=stops[0],last=stops.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};
  const canvas=container.querySelector('canvas'),stage=container.querySelector('.rc-stage'),tooltip=container.querySelector('.rc-tooltip'),detail=container.querySelector('.rc-detail');
  const context=canvas.getContext('2d');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const snapshot=()=>({...state,selected:selected?.row_index??null});
  const notify=()=>{if(typeof onStateChange==='function')onStateChange(snapshot());};
  const lookup=id=>resources.records.find(row=>row.row_index===Number(id));
  const dimensions=()=>({width:Math.max(220,stage.clientWidth||700),height:Math.max(260,stage.clientHeight||480)});
  function buildPalette() {palette=new Map(groupCanvasRecords(resources.records,state.color).map((item,index)=>[item.key,PALETTE[index%PALETTE.length]]));}
  function updateDetail() {
    if (!selected) {detail.innerHTML='<div class="rc-empty"><h3>No match in this sample</h3><p>Clear a filter or try another ID. A record outside this 20,000-row sample may still exist in WildChat.</p></div>';return;}
    const row=selected,pair=canvasSourcePair(row.row_index,resources.sources),position=visible.findIndex(item=>item.row_index===row.row_index);
    // Cap the native selector to nearby actual matches; previous/next reaches every match.
    const start=Math.max(0,Math.min(position-35,visible.length-80)),options=visible.slice(start,start+80);
    detail.innerHTML=`<div class="rc-detail-header"><span class="eyebrow">Selected record</span><h3>Record ${fmt(row.row_index)}</h3><span class="chip ${pair?'':'archive'}">${pair?'Original text available':'Metadata only'}</span></div>
      <div class="rc-record-list"><button type="button" data-rc-step="-1" aria-label="Previous matching record" ${position<=0?'disabled':''}>←</button><label><span>Matching record ${fmt(position+1)} / ${fmt(visible.length)}</span><select data-rc-select aria-label="Choose a matching record">${options.map(item=>`<option value="${item.row_index}" ${item.row_index===row.row_index?'selected':''}>${item.row_index}${resources.sources.has(item.row_index)?' · original text':''}</option>`).join('')}</select></label><button type="button" data-rc-step="1" aria-label="Next matching record" ${position>=visible.length-1?'disabled':''}>→</button></div>
      <dl class="rc-meta-grid"><div><dt>Source language</dt><dd>${esc(row.language)}</dd></div><div><dt>Recorded date</dt><dd>${esc(row.date)}</dd></div><div><dt>Stored messages</dt><dd>${row.user_turns} user + ${row.assistant_messages} AI</dd></div><div><dt>Recorded model</dt><dd>${esc(row.model)}</dd></div></dl>
      ${pair?`<div class="rc-source-heading"><h4>First stored exchange</h4><p>${esc(pair.source.text_status||'Original dataset text; marked redactions retained.')}</p></div>${sourceMessage(pair.user,'User request')}${sourceMessage(pair.reply,'AI response')}<details class="rc-full-context"><summary>Full stored context · ${pair.source.messages.length} messages</summary>${pair.source.messages.map((message,index)=>`<div class="rc-context-message"><small>${index+1} · ${esc(message.role)}</small><p dir="auto">${esc(typeof message.content==='string'?message.content:'')}</p></div>`).join('')}</details>`:
        `<div class="rc-empty"><p>${resources.sourceErrors?'Original text may be unavailable because a source-text file failed to load.':'Original text is not included for this record in the site’s selected excerpts.'}</p><small>No question or response is inferred from the metadata.</small></div>`}
      <a class="card-link" href="${esc(canvasAtlasURL(row,resources.records,location.hash))}">${[286012,753427,2632268,255498,1671993,2606561].includes(row.row_index)?'Open stored example':'Open the matching metadata page'} in the data browser ↗</a>`;
  }
  function draw(at, start, previous, target) {
    if (!alive) return;
    const progress=reduced?1:Math.min(1,(at-start)/460),eased=1-Math.pow(1-progress,3),{width,height}=dimensions();
    context.clearRect(0,0,width,height);
    context.font='11px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    for (const panel of target.panels) {
      context.fillStyle='#edf1ec';context.fillRect(panel.x,panel.y,panel.width,panel.height);
      context.fillStyle='#44574e';let label=`${state.group==='turn_bucket'?panel.key+' user message'+(panel.key==='1'?'':'s'):panel.key} · ${fmt(panel.count)}`;
      while(label.length>3&&context.measureText(label).width>panel.width-12)label=label.slice(0,-2)+'…';
      context.fillText(label,panel.x+6,panel.y+15);
    }
    points=new Map();hitGrid=new Map();
    const batches=new Map();
    for (const point of target.points) {
      const old=previous.get(point.id)||point,x=old.x+(point.x-old.x)*eased,y=old.y+(point.y-old.y)*eased;
      const displayed={...point,x,y};points.set(point.id,displayed);
      const cell=`${Math.floor(x/12)},${Math.floor(y/12)}`;
      if(!hitGrid.has(cell))hitGrid.set(cell,[]);hitGrid.get(cell).push(displayed);
      const color=palette.get(canvasLevel(point.record,state.color))||'#61766b';
      if(!batches.has(color))batches.set(color,[]);batches.get(color).push(displayed);
    }
    for (const [color,batch] of batches) {context.fillStyle=color;context.beginPath();for(const point of batch)context.rect(point.x-target.size/2,point.y-target.size/2,target.size,target.size);context.fill();}
    const selectedPoint=points.get(selected?.row_index);
    if(selectedPoint){context.beginPath();context.arc(selectedPoint.x,selectedPoint.y,Math.max(6,target.size*2),0,Math.PI*2);context.strokeStyle='#fff';context.lineWidth=4;context.stroke();context.strokeStyle='#172c25';context.lineWidth=1.7;context.stroke();}
    if(progress<1)frame=requestAnimationFrame(time=>draw(time,start,previous,target));
  }
  function relayout(animate=true) {
    if(!resources||!alive)return;
    cancelAnimationFrame(frame);const {width,height}=dimensions(),ratio=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);canvas.style.width=width+'px';canvas.style.height=height+'px';context.setTransform(ratio,0,0,ratio,0,0);
    lastWidth=width;lastHeight=height;
    layout=layoutCanvasRecords(visible,{width,height,group:state.group});
    const previous=animate?new Map(points):new Map();
    const start=performance.now();draw(start+(animate?0:460),start,previous,layout);
  }
  function select(id, announce=true) {
    const active=document.activeElement;
    const focusSelect=active?.matches('[data-rc-select]');
    const focusStep=active?.matches('[data-rc-step]')?active.dataset.rcStep:null;
    selected=visible.find(row=>row.row_index===Number(id))||null;state.selected=selected?.row_index??null;
    updateDetail();relayout(false);
    if(focusSelect)detail.querySelector('[data-rc-select]')?.focus({preventScroll:true});
    else if(focusStep){const target=detail.querySelector(`[data-rc-step="${focusStep}"]:not(:disabled)`)||detail.querySelector('[data-rc-select]');target?.focus({preventScroll:true});}
    if(announce)notify();
  }
  function update(animate=true) {
    if(!resources||!alive)return;
    const focusFilter=document.activeElement?.matches('[data-rc-filter]')?document.activeElement.dataset.rcFilter:null;
    visible=filterCanvasRecords(resources.records,state,resources.sources);
    const available=resources.records.filter(row=>resources.sources.has(row.row_index)).length;
    selected=visible.find(row=>row.row_index===Number(state.selected))||visible.find(row=>row.row_index===1494984)||visible.find(row=>resources.sources.has(row.row_index))||visible[0]||null;
    state.selected=selected?.row_index??null;
    container.querySelector('[data-rc-group]').value=state.group;container.querySelector('[data-rc-color]').value=state.color;container.querySelector('[data-rc-text]').checked=state.withText;
    container.querySelector('[data-rc-search]').value=state.search;
    container.querySelector('[data-rc-reset]').hidden=!(state.filter||state.withText||state.search);
    container.querySelector('[data-rc-source-count]').textContent=`${fmt(available)} / ${fmt(resources.records.length)}`;
    const originalNote=state.withText?'Original-text records are deliberately published illustrations, not a random subset.':'Original-text availability is limited to deliberately published illustrations.';
    container.querySelector('.rc-status').innerHTML=`<strong>${fmt(visible.length)}</strong> / ${fmt(resources.records.length)} sample records shown · <span>${originalNote}</span>${resources.sourceErrors?'<b class="rc-source-error"> Source-text loading incomplete.</b>':''}`;
    const base=filterCanvasRecords(resources.records,{...state,filter:''},resources.sources);
    const counts=new Map(groupCanvasRecords(base,state.color).map(item=>[item.key,item.count]));
    container.querySelector('.rc-legend').innerHTML=`<span class="rc-legend-label">${esc(LABELS[state.color])} · counts before category filter</span><button type="button" data-rc-filter="" class="rc-legend-item ${!state.filter?'active':''}" aria-pressed="${!state.filter}">All · ${fmt(base.length)}</button>${[...palette].map(([key,color])=>`<button type="button" data-rc-filter="${esc(key)}" class="rc-legend-item ${state.filter===key?'active':''}" aria-pressed="${state.filter===key}"><i style="background:${color}"></i>${esc(key)} · ${fmt(counts.get(key)||0)}</button>`).join('')}`;
    buildPalette();updateDetail();relayout(animate);if(focusFilter!==null)[...container.querySelectorAll('[data-rc-filter]')].find(b=>b.dataset.rcFilter===focusFilter)?.focus({preventScroll:true});notify();
  }
  function pointAt(event) {
    const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top,cx=Math.floor(x/12),cy=Math.floor(y/12);
    let nearest=null,distance=Infinity;
    for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(const point of hitGrid.get(`${cx+i},${cy+j}`)||[]){const d=(point.x-x)**2+(point.y-y)**2;if(d<distance){nearest=point;distance=d;}}
    return distance<=100?nearest:null;
  }
  const move=event=>{
    const point=pointAt(event);hoverId=point?.id??null;canvas.style.cursor=point?'pointer':'default';
    if(!point){tooltip.hidden=true;return;}
    tooltip.innerHTML=`<strong>Record ${fmt(point.id)}</strong><span>${esc(point.record.language)} · ${esc(point.record.model_family)}</span><span>${point.record.user_turns} stored user message${point.record.user_turns===1?'':'s'} · ${esc(point.record.date)}</span><small>${resources.sources.has(point.id)?'Original text available':'Metadata only'}</small>`;
    tooltip.hidden=false;const rect=stage.getBoundingClientRect();tooltip.style.left=Math.min(rect.width-210,Math.max(4,event.clientX-rect.left+12))+'px';tooltip.style.top=Math.max(4,event.clientY-rect.top-80)+'px';
  };
  const leave=()=>{tooltip.hidden=true;hoverId=null;};
  const click=event=>{
    if(!resources)return;
    if(event.target===canvas){const point=pointAt(event);if(point){select(point.id);if(matchMedia('(max-width:900px)').matches)detail.scrollIntoView({block:'start',behavior:reduced?'instant':'smooth'});}return;}
    const filter=event.target.closest('[data-rc-filter]');if(filter){state.filter=filter.dataset.rcFilter;update();return;}
    const step=event.target.closest('[data-rc-step]');if(step){const index=visible.findIndex(row=>row.row_index===selected?.row_index),next=visible[index+Number(step.dataset.rcStep)];if(next)select(next.row_index);return;}
    if(event.target.closest('[data-rc-expand]')){toggleExpanded(!expanded);return;}
    if(event.target.closest('[data-rc-reset]')){state.filter='';state.withText=false;state.search='';update();}
  };
  const change=event=>{
    if(!resources)return;
    if(event.target.matches('[data-rc-group]'))state.group=event.target.value;
    else if(event.target.matches('[data-rc-color]')){state.color=event.target.value;state.filter='';buildPalette();}
    else if(event.target.matches('[data-rc-text]'))state.withText=event.target.checked;
    else if(event.target.matches('[data-rc-select]')){select(event.target.value);return;}
    else return;
    update();
  };
  const input=event=>{if(resources&&event.target.matches('[data-rc-search]')){state.search=event.target.value.trim();update(false);}};
  document.addEventListener('keydown',keydown);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerleave',leave);container.addEventListener('click',click);container.addEventListener('change',change);container.addEventListener('input',input);
  loadResources().then(value=>{
    if(!alive)return;resources=value;buildPalette();
    if(state.filter&&!palette.has(state.filter))state.filter='';
    update(false);observer=new ResizeObserver(()=>{const {width,height}=dimensions();if(width!==lastWidth||height!==lastHeight)relayout(false);});observer.observe(stage);
  }).catch(error=>{if(alive){container.querySelector('.rc-status').textContent='Record metadata could not load. Refresh to retry.';detail.innerHTML='<div class="rc-empty"><p>No data was substituted.</p></div>';console.error(error);}});
  return ()=>{alive=false;if(expanded)document.body.style.overflow=originalBodyOverflow;document.removeEventListener('keydown',keydown);cancelAnimationFrame(frame);observer?.disconnect();canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerleave',leave);container.removeEventListener('click',click);container.removeEventListener('change',change);container.removeEventListener('input',input);};
}
