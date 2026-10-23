/** Categorical views derived only from the supplied record selection. */
import {escape as e, fmt, pct, counts} from './charts.js?v=topicsOct21b';

const PURPOSE_DEFAULT={text_work:'Text work',technical_problem:'Technical problem',information_learning:'Information / learning',creative_roleplay:'Creative / roleplay',social_chat:'Social chat',personal_guidance:'Personal guidance',other_unclear:'Other / unclear'};
const PACK_DEFAULT={direct_request:'Direct request',pasted_document:'Supplied document / code',embedded_history:'Embedded dialogue',unclear:'Unclear'};
const palette=['#167b74','#365e5a','#75aaa2','#8c999e','#b6d1cb','#9ebcb5','#c7d7d3','#657d78','#e2e9e7'];
const onColor=color=>['#167b74','#365e5a','#657d78'].includes(color)?'#fff':'#142925';
const purposeColors=Object.fromEntries(Object.keys(PURPOSE_DEFAULT).map((key,i)=>[key,palette[i]]));
const languageColors=Object.fromEntries(['English','Russian','Chinese','French','Vietnamese','Yoruba','Arabic','Indonesian'].map((key,i)=>[key,palette[i]]));
const keyedColor=(key,map)=>map[key]||palette[[...String(key)].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0)%8];
let sequence=0;
const sum=items=>items.reduce((n,x)=>n+x.count,0);

// Weighted binary subdivision. Rectangle areas equal shares, before the 1px outlines.
function rectangles(items,x=0,y=0,w=100,h=100){
  if(items.length===1)return [{...items[0],x,y,w,h}];
  const total=sum(items);let running=0,split=1,distance=Infinity;
  for(let i=1;i<items.length;i++){running+=items[i-1].count;const d=Math.abs(total/2-running);if(d<distance){distance=d;split=i}}
  const a=items.slice(0,split),b=items.slice(split),share=sum(a)/total;
  return w>=h?[...rectangles(a,x,y,w*share,h),...rectangles(b,x+w*share,y,w*(1-share),h)]:[...rectangles(a,x,y,w,h*share),...rectangles(b,x,y+h*share,w,h*(1-share))];
}

/** rows: decoded records containing language. Clicks use the app's action delegation. */
export function languageTreemap(rows,{action='filter-language'}={}){
  if(!rows.length)return '<div class="chart-empty">No matching records.</div>';
  const id=`language-map-${++sequence}`,all=counts(rows,'language'),items=all.slice(0,8).map(([label,count])=>({label,count,value:label,color:keyedColor(label,languageColors)}));
  const remaining=all.slice(8),other=remaining.reduce((n,x)=>n+x[1],0);
  if(other)items.push({label:`Other ${remaining.length} labels`,count:other,value:'__other__',color:palette[8],other:true});
  if(sum(items)!==rows.length)throw new Error('Language treemap counts do not match the selected records.');
  const attrs=item=>item.other?`data-category-other="${id}-other"`:`data-action="${e(action)}" data-value="${e(item.value)}"`;
  const cells=rectangles(items);
  return `<div class="category-viz category-treemap" data-viz="treemap" data-category-root>
    <div class="category-map" role="group" aria-label="Source-language labels; rectangle area represents record count">
    ${cells.map((item,i)=>`<button type="button" tabindex="-1" class="category-map-cell ${item.other?'category-map-other':''}" ${attrs(item)} data-category-key="${e(item.value)}" data-category-readout="${e(item.label)} · ${fmt(item.count)} records · ${pct(item.count,rows.length)}" aria-label="${e(item.label)}: ${fmt(item.count)} records (${pct(item.count,rows.length)})${item.other?'; see individual labels':''}" title="${e(item.label)}: ${fmt(item.count)} (${pct(item.count,rows.length)})" style="left:${item.x}%;top:${item.y}%;width:${item.w}%;height:${item.h}%;--category-color:${item.color};--category-order:${i};color:${onColor(item.color)}">${item.w>=17&&item.h>=16?`<span>${e(item.label)}</span><strong>${pct(item.count,rows.length)}</strong>`:''}</button>`).join('')}
    </div>
    <div class="category-readout" data-category-readout-target aria-live="polite">${fmt(rows.length)} records · area = count</div>
    <div class="category-map-legend">${items.map(item=>`<button type="button" ${attrs(item)} data-category-key="${e(item.value)}" data-category-readout="${e(item.label)} · ${fmt(item.count)} records · ${pct(item.count,rows.length)}" class="category-legend-row"><i style="--category-color:${item.color}" aria-hidden="true"></i><span>${e(item.label)}</span><strong>${fmt(item.count)}</strong><small>${pct(item.count,rows.length)}</small>${item.other?'<span aria-hidden="true">⌄</span>':'<span aria-hidden="true">›</span>'}</button>`).join('')}</div>
    ${other?`<details class="category-details" id="${id}-other"><summary>Other labels (${remaining.length})</summary><div class="category-other-list">${remaining.map(([label,count])=>`<button type="button" data-action="${e(action)}" data-value="${e(label)}"><span>${e(label)}</span><strong>${fmt(count)}</strong><small>${pct(count,rows.length)}</small></button>`).join('')}</div></details>`:''}
    <details class="category-details"><summary>Exact counts</summary><table><thead><tr><th>Source-language label</th><th>Records</th><th>Share</th></tr></thead><tbody>${all.map(([l,n])=>`<tr><th scope="row">${e(l)}</th><td>${fmt(n)}</td><td>${pct(n,rows.length)}</td></tr>`).join('')}</tbody></table></details>
  </div>`;
}

/** Audit rows are the selected subset; each record has one purpose and one input format. */
export function purposeFlow(auditRows,{PURPOSE=PURPOSE_DEFAULT,PACK=PACK_DEFAULT}={}){
  if(!auditRows.length)return '<div class="chart-empty">No matching inputs.</div>';
  const id=`purpose-flow-${++sequence}`,total=auditRows.length;
  const ordered=(mapping,key)=>[...Object.keys(mapping),...[...new Set(auditRows.map(r=>r[key]))].filter(k=>!(k in mapping))].filter(k=>auditRows.some(r=>r[key]===k));
  const purposes=ordered(PURPOSE,'purpose'),packs=ordered(PACK,'packaging');
  const matrix=purposes.flatMap(p=>packs.map(k=>({purpose:p,packaging:k,count:auditRows.filter(r=>r.purpose===p&&r.packaging===k).length,color:keyedColor(p,purposeColors)}))).filter(x=>x.count);
  const left=purposes.map(key=>({key,label:PURPOSE[key]||key,count:matrix.filter(r=>r.purpose===key).reduce((n,r)=>n+r.count,0),color:keyedColor(key,purposeColors)}));
  const right=packs.map(key=>({key,label:PACK[key]||key,count:matrix.filter(r=>r.packaging===key).reduce((n,r)=>n+r.count,0),color:'#8c999e'}));
  if(sum(matrix)!==total||sum(left)!==total||sum(right)!==total)throw new Error('Purpose-flow node and ribbon counts must equal the selected audit rows.');
  const h=420,gap=30,scale=(h-gap*(Math.max(left.length,right.length)-1))/total;
  const place=nodes=>{let y=(h-(total*scale+gap*(nodes.length-1)))/2;nodes.forEach(n=>{n.y=y;n.height=n.count*scale;n.offset=0;y+=n.height+gap})};place(left);place(right);
  const ribbon=matrix.map(flow=>{const a=left.find(n=>n.key===flow.purpose),b=right.find(n=>n.key===flow.packaging),y1=a.y+a.offset,y2=b.y+b.offset,thick=flow.count*scale;a.offset+=thick;b.offset+=thick;return {...flow,path:`M 12 ${y1} C 140 ${y1}, 260 ${y2}, 388 ${y2} L 388 ${y2+thick} C 260 ${y2+thick}, 140 ${y1+thick}, 12 ${y1+thick} Z`}});
  const labels=(nodes,side)=>`<div class="category-flow-labels category-flow-${side}">${nodes.map(n=>`<div class="category-flow-label" style="top:${(n.y+n.height/2)/h*100}%" data-category-${side}="${e(n.key)}"><i aria-hidden="true" style="--category-color:${n.color}"></i><span>${e(n.label)} <strong>${fmt(n.count)}</strong></span></div>`).join('')}</div>`;
  return `<div class="category-viz category-flow" data-viz="alluvial" data-category-root>
    <div class="category-flow-headings"><span>Request purpose</span><span>Input format</span></div>
    <div class="category-flow-canvas">${labels(left,'purpose')}<svg viewBox="0 0 400 ${h}" preserveAspectRatio="none" role="group" aria-label="Request purpose to input format. Ribbon width equals number of final inputs. Choose a purpose and input format below to see counts and matching requests.">
    ${ribbon.map((r,i)=>`<path class="category-ribbon" d="${r.path}" fill="${r.color}" role="button" tabindex="-1" data-action="audit-cell" data-purpose="${e(r.purpose)}" data-packaging="${e(r.packaging)}" data-flow-count="${r.count}" data-category-readout="${e(PURPOSE[r.purpose]||r.purpose)} → ${e(PACK[r.packaging]||r.packaging)} · ${fmt(r.count)} of ${fmt(total)} (${pct(r.count,total)})" aria-label="${e(PURPOSE[r.purpose]||r.purpose)} to ${e(PACK[r.packaging]||r.packaging)}; final inputs: ${r.count}; show matching requests" style="--category-order:${i}"><title>${e(PURPOSE[r.purpose]||r.purpose)} → ${e(PACK[r.packaging]||r.packaging)}: ${fmt(r.count)}</title></path>`).join('')}
    ${left.map(n=>`<rect class="category-flow-node" x="0" y="${n.y}" width="12" height="${n.height}" fill="${n.color}"/>`).join('')}${right.map(n=>`<rect class="category-flow-node" x="388" y="${n.y}" width="12" height="${n.height}" fill="${n.color}"/>`).join('')}</svg>${labels(right,'packaging')}</div>
    <div class="category-readout" data-category-readout-target aria-live="polite">${fmt(total)} selected inputs · ribbon width = count</div>
    <div class="category-flow-controls"><label for="${id}-purpose">Purpose<select id="${id}-purpose" data-flow-select="purpose">${left.map(n=>`<option value="${e(n.key)}">${e(n.label)}</option>`).join('')}</select></label><label for="${id}-packaging">Input format<select id="${id}-packaging" data-flow-select="packaging">${right.map(n=>`<option value="${e(n.key)}">${e(n.label)}</option>`).join('')}</select></label><button type="button" data-flow-view data-action="audit-cell" data-purpose="${e(left[0].key)}" data-packaging="${e(right[0].key)}">Show final inputs →</button></div>
    <details class="category-details"><summary>Exact counts</summary><div class="category-table-scroll"><table><thead><tr><th>Request purpose</th>${right.map(n=>`<th>${e(n.label)}</th>`).join('')}<th>Total</th></tr></thead><tbody>${left.map(n=>`<tr><th scope="row">${e(n.label)}</th>${right.map(k=>{const count=matrix.find(r=>r.purpose===n.key&&r.packaging===k.key)?.count||0;return `<td>${count?`<button type="button" data-action="audit-cell" data-purpose="${e(n.key)}" data-packaging="${e(k.key)}" aria-label="${e(n.label)}, ${e(k.label)}: ${count} inputs">${count}</button>`:'0'}</td>`}).join('')}<td>${n.count}</td></tr>`).join('')}</tbody><tfoot><tr><th scope="row">Total</th>${right.map(n=>`<td>${n.count}</td>`).join('')}<td>${total}</td></tr></tfoot></table></div></details>
  </div>`;
}

export function mountCategoryInteractions(root=document){
  root.querySelectorAll('[data-category-root]').forEach(chart=>{
    if(chart.dataset.categoryMounted)return;chart.dataset.categoryMounted='true';
    const output=chart.querySelector('[data-category-readout-target]'),initial=output.textContent;
    const clear=()=>{chart.classList.remove('category-inspecting');chart.querySelectorAll('.category-active').forEach(n=>n.classList.remove('category-active'));output.textContent=initial};
    const inspect=target=>{const item=target.closest('[data-category-readout]');if(!item||!chart.contains(item))return;chart.classList.add('category-inspecting');chart.querySelectorAll('.category-active').forEach(n=>n.classList.remove('category-active'));output.textContent=item.dataset.categoryReadout;if(item.dataset.categoryKey)chart.querySelectorAll('[data-category-key]').forEach(n=>n.classList.toggle('category-active',n.dataset.categoryKey===item.dataset.categoryKey));else item.classList.add('category-active')};
    chart.addEventListener('pointerover',event=>inspect(event.target));chart.addEventListener('pointerleave',clear);chart.addEventListener('focusin',event=>inspect(event.target));chart.addEventListener('focusout',event=>{if(!chart.contains(event.relatedTarget))clear()});
    chart.addEventListener('click',event=>{const other=event.target.closest('[data-category-other]');if(!other)return;const details=chart.querySelector(`#${other.dataset.categoryOther}`);if(details){details.open=true;details.querySelector('summary').focus({preventScroll:true});details.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}});
    const choose=()=>{const p=chart.querySelector('[data-flow-select="purpose"]'),k=chart.querySelector('[data-flow-select="packaging"]'),button=chart.querySelector('[data-flow-view]');if(!p||!k||!button)return;const paths=[...chart.querySelectorAll('[data-flow-count]')],path=paths.find(n=>n.dataset.purpose===p.value&&n.dataset.packaging===k.value),count=Number(path?.dataset.flowCount||0);button.dataset.purpose=p.value;button.dataset.packaging=k.value;button.disabled=!count;button.textContent=count?`Show ${fmt(count)} final inputs →`:'No matching inputs';if(path)inspect(path);else{clear();output.textContent=`${p.selectedOptions[0].textContent} → ${k.selectedOptions[0].textContent} · 0 inputs`}};
    chart.querySelectorAll('[data-flow-select]').forEach(select=>select.addEventListener('change',choose));
    if(chart.matches('.category-flow')){choose();clear()}
  });
}
