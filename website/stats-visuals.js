/** Interactive distributions over saved record metadata. No inferred labels. */
import {escape as e, fmt, pct, quantile, colors} from './charts.js?v=topicsOct21b';
const registry = new Map();
const selectSubset = detail => document.dispatchEvent(new CustomEvent('atlas-selection',{detail}));
const dims = {w:640,h:308,l:54,t:20,cw:558,ch:230};
const short = n => n>=1000?`${n/1000}k`:String(n);
const tickCount = n => n>=1000?`${(n/1000).toFixed(1).replace(/\.0$/,'')}k`:String(Math.round(n));
const values = (rows,key) => rows.map(r=>Number(r[key])).filter(Number.isFinite).sort((a,b)=>a-b);
const logDomain = a => Math.max(5,Math.ceil(Math.log10(Math.max(0,...a)+1)));
const upperBound = (a,x) => {let l=0,r=a.length;while(l<r){const m=(l+r)>>1;if(a[m]<=x)l=m+1;else r=m;}return l;};
const empty = message => `<div class="chart-empty">${e(message||'No matching records.')}</div>`;
const svg = (body,label,{h=308,attrs=''}={}) => `<svg class="chart stats-svg" viewBox="0 0 640 ${h}" role="group" aria-label="${e(label)}" ${attrs}>${body}</svg>`;
const axis = (domain,{l=54,t=20,cw=558,ch=230,ylabel=''}={}) => {
 let b='';for(const v of [0,10,100,1000,10000,100000,1000000].filter(v=>Math.log10(v+1)<=domain)){const x=l+Math.log10(v+1)/domain*cw;b+=`<line class="stats-tick" x1="${x}" y1="${t+ch}" x2="${x}" y2="${t+ch+4}"/><text x="${x}" y="${t+ch+21}" text-anchor="middle">${short(v)}</text>`;}
 if(ylabel)b+=`<text x="${l+cw/2}" y="${t+ch+48}" text-anchor="middle">${e(ylabel)}</text>`;return b;
};
const output = (id,text) => `<output id="${id}-readout" class="stats-readout" aria-live="polite">${text}</output>`;
const exactCounts = (entries,label='Exact counts') => `<details class="stats-exact"><summary>${label}</summary><table><thead><tr><th scope="col">Group</th><th scope="col">Records</th></tr></thead><tbody>${entries.map(([l,n])=>`<tr><th scope="row">${e(l)}</th><td>${fmt(n)}</td></tr>`).join('')}</tbody></table></details>`;

export function turnHistogram(rows){
 if(!rows.length)return empty();
 const entries=Array.from({length:11},(_,i)=>[i===10?'11+':String(i+1),rows.filter(r=>i===10?r.user_turns>10:r.user_turns===i+1).length]);
 const {l,t,cw,ch}=dims,max=Math.max(...entries.map(x=>x[1]),1),step=cw/entries.length;let b='';
 for(const q of [0,.5,1]){const y=t+ch*(1-q);b+=`<line class="grid-line" x1="${l}" y1="${y}" x2="${l+cw}" y2="${y}"/><text x="${l-8}" y="${y+4}" text-anchor="end">${tickCount(max*q)}</text>`;}
 for(let i=0;i<entries.length;i++){const [label,n]=entries[i],x=l+i*step,y=t+ch*(1-n/max),tip=`${label} stored user message${label==='1'?'':'s'} · ${fmt(n)} records (${pct(n,rows.length)})`;
 b+=`<g class="stats-bar-hit" tabindex="0" role="button" data-action="stat-filter" data-field="turnBand" data-value="${i===10?'11plus':i+1}" data-stat-tip="${e(tip)}" aria-label="Filter to ${e(tip)}"><rect class="stats-hit" x="${x}" y="${t}" width="${step}" height="${ch+30}"/><rect class="stats-bar" x="${x+step*.12}" y="${y}" width="${step*.76}" height="${ch*n/max}" rx="3" fill="${colors.teal}"/>${n?`<text class="stats-bar-count" x="${x+step/2}" y="${Math.max(12,y-7)}" text-anchor="middle">${tickCount(n)}</text>`:''}<text x="${x+step/2}" y="${t+ch+20}" text-anchor="middle">${label}</text></g>`;}
 b+=`<text x="${l+cw/2}" y="302" text-anchor="middle">Stored user messages per record</text>`;
 return `<div class="stats-visual" data-viz="histogram" data-stat="turns">${svg(b,'Histogram of stored user messages; select a bar to filter records.')}${output('turns',`<strong>${pct(entries[0][1],rows.length)}</strong> have one stored user message. Select a bar to filter.`)}${exactCounts(entries)}</div>`;
}

export function monthCoverage(rows){
 if(!rows.length)return empty();
 const c={};for(const r of rows){const m=String(r.date).slice(0,7);c[m]=(c[m]||0)+1;}
 const present=Object.keys(c).sort(),first=new Date(`${present[0]}-01T00:00:00Z`),last=new Date(`${present.at(-1)}-01T00:00:00Z`),entries=[];
 for(let d=new Date(first);d<=last;d.setUTCMonth(d.getUTCMonth()+1)){const m=d.toISOString().slice(0,7);entries.push([m,c[m]||0]);}
 const {l,t,cw,ch}=dims,max=Math.max(...entries.map(x=>x[1]),1),x=i=>l+(entries.length===1?.5:i/(entries.length-1))*cw,y=n=>t+ch*(1-n/max);let b='';
 for(const q of [0,.5,1]){const py=y(max*q);b+=`<line class="grid-line" x1="${l}" y1="${py}" x2="${l+cw}" y2="${py}"/><text x="${l-8}" y="${py+4}" text-anchor="end">${tickCount(max*q)}</text>`;}
 if(entries.length>1)b+=`<polyline class="stats-line" points="${entries.map(([,n],i)=>`${x(i)},${y(n)}`).join(' ')}" fill="none" stroke="${colors.teal}" stroke-width="2.5"/>`;
 entries.forEach(([m,n],i)=>{const tip=`${m} · ${fmt(n)} sampled records`;b+=`<g class="stats-point-hit" tabindex="0" role="button" data-action="stat-filter" data-field="month" data-value="${m}" data-stat-tip="${e(tip)}" aria-label="Filter to ${e(tip)}"><circle class="stats-hit" cx="${x(i)}" cy="${y(n)}" r="13"/><circle class="stats-point" cx="${x(i)}" cy="${y(n)}" r="4.2" fill="${colors.teal}"/></g>`;if(i===0||i===entries.length-1||(entries.length>8&&i%6===0))b+=`<text x="${x(i)}" y="${t+ch+23}" text-anchor="middle">${m}</text>`;});
 b+=`<text x="${l+cw/2}" y="302" text-anchor="middle">Source month</text>`;
 return `<div class="stats-visual" data-viz="line" data-stat="months">${svg(b,'Monthly coverage of sampled records; select a month to filter.')}${output('months','Select a month to see its count. Counts describe this sample, not traffic growth.')}${exactCounts(entries)}</div>`;
}

function ecdfPath(a,domain){
 const {l,t,cw,ch}=dims;let p=`M ${l} ${t+ch}`;let i=0;
 while(i<a.length){const v=a[i];let j=i+1;while(j<a.length&&a[j]===v)j++;const x=l+Math.log10(v+1)/domain*cw,y=t+ch*(1-j/a.length);p+=` H ${x.toFixed(2)} V ${y.toFixed(2)}`;i=j;}return p+` H ${l+cw}`;
}
function ecdfState(c,step){const threshold=Math.round(10**(step/1000*c.domain)-1),user=upperBound(c.user,threshold),ai=upperBound(c.ai,threshold);return {threshold,user,ai,x:dims.l+Math.log10(threshold+1)/c.domain*dims.cw};}
export function ecdfExplorer(rows,probe=null){
 if(!rows.length)return empty('No matching English-labeled records.');
 const c={user:values(rows,'user_words'),ai:values(rows,'assistant_words')};c.domain=logDomain([...c.user,...c.ai]);registry.set('ecdf',c);
 const saved=probe?.kind==='ecdf'&&probe.field==='user_words'&&Number.isFinite(probe.max)&&probe.max>=0?Math.min(probe.max,10**c.domain-1):null;
 const {l,t,cw,ch}=dims,step=Math.round(Math.log10((saved??quantile(c.user,.5))+1)/c.domain*1000),s=ecdfState(c,step);let b='';
 for(const q of [0,.25,.5,.75,1]){const y=t+ch*(1-q);b+=`<line class="grid-line" x1="${l}" y1="${y}" x2="${l+cw}" y2="${y}"/><text x="${l-8}" y="${y+4}" text-anchor="end">${q*100}%</text>`;}
 b+=axis(c.domain,{ylabel:'Words per record · log scale'});
 b+=`<path d="${ecdfPath(c.user,c.domain)}" stroke="${colors.teal}" stroke-width="2.6" fill="none"/><path d="${ecdfPath(c.ai,c.domain)}" stroke="${colors.tealMuted}" stroke-width="2.6" stroke-dasharray="7 4" fill="none"/>`;
 b+=`<line class="stats-probe-line" data-ecdf-line x1="${s.x}" y1="${t}" x2="${s.x}" y2="${t+ch}"/><circle data-ecdf-user cx="${s.x}" cy="${t+ch*(1-s.user/c.user.length)}" r="5" fill="${colors.teal}"/><circle data-ecdf-ai cx="${s.x}" cy="${t+ch*(1-s.ai/c.ai.length)}" r="5" fill="${colors.tealMuted}"/>`;
 return `<div class="stats-visual" data-viz="ecdf" data-stat="ecdf">${svg(b,'Cumulative word lengths. Move the threshold to compare the share of user inputs and AI outputs at or below it.',{attrs:'data-ecdf-chart'})}<label class="stats-slider-label" for="stats-word-threshold">Word threshold <strong data-ecdf-threshold>${fmt(s.threshold)}</strong></label><input class="stats-range" id="stats-word-threshold" type="range" min="0" max="1000" value="${step}" aria-valuetext="${fmt(s.threshold)} words" data-stat-control="ecdf"/>${output('ecdf',ecdfReadout(c,s))}<p class="stats-hint">Word counts sum each role’s messages within a record. Percentages use the English-labeled records in this selection.</p></div>`;
}
function ecdfReadout(c,s){return `<span><i class="stats-key user"></i>User input <strong>${pct(s.user,c.user.length)}</strong></span><span><i class="stats-key ai"></i>AI output <strong>${pct(s.ai,c.ai.length)}</strong></span><small>at or below ${fmt(s.threshold)} words</small>`;}

function binRange(i,n,domain){const lo=Math.max(0,Math.ceil(10**(i/n*domain)-1-1e-9));const hi=i===n-1?Math.round(10**domain-1):Math.ceil(10**((i+1)/n*domain)-1-1e-9)-1;return [lo,hi];}
function densityReadout(c,x,y){const a=binRange(x,c.nx,c.domain),b=binRange(y,c.ny,c.domain),n=c.bins[y][x];return `<strong>${fmt(n)} record${n===1?'':'s'} (${pct(n,c.n)})</strong><span>User input: ${fmt(a[0])}–${fmt(a[1])} words</span><span>AI output: ${fmt(b[0])}–${fmt(b[1])} words</span>`;}
function densityData(rows){
 const c={n:rows.length,nx:28,ny:18,domain:logDomain(rows.flatMap(r=>[r.user_words,r.assistant_words])),bins:Array.from({length:18},()=>Array(28).fill(0)),x:0,y:0};
 rows.forEach(r=>{const x=Math.min(c.nx-1,Math.floor(Math.log10(r.user_words+1)/c.domain*c.nx)),y=Math.min(c.ny-1,Math.floor(Math.log10(r.assistant_words+1)/c.domain*c.ny));c.bins[y][x]++;});
 c.bins.forEach((row,y)=>row.forEach((n,x)=>{if(n>c.bins[c.y][c.x]){c.x=x;c.y=y;}}));
 c.mode={x:c.x,y:c.y};c.max=Math.max(...c.bins.flat(),1);return c;
}
const densityOpacity=(n,max)=>n?.15+.85*Math.log1p(n)/Math.log1p(max):0;
function densityLegend(c){const marks=[1,Math.max(1,Math.round(Math.sqrt(c.max))),c.max].filter((n,i,a)=>a.indexOf(n)===i);return `<div class="stats-density-legend" aria-label="Color represents records per bin on a logarithmic scale"><span>Records per square</span><span class="stats-density-key"><i class="empty"></i>0</span>${marks.map(n=>`<span class="stats-density-key"><i style="--density-opacity:${densityOpacity(n,c.max)}"></i>${fmt(n)}</span>`).join('')}<small>Log color scale</small></div>`;}
export function densityExplorer(rows,probe=null){
 if(!rows.length)return empty('No matching English-labeled records.');
 const c=densityData(rows);
 if(probe?.kind==='density'){
  const x=Array.from({length:c.nx},(_,i)=>binRange(i,c.nx,c.domain)).findIndex(([lo,hi])=>lo===probe.userMin&&hi===probe.userMax),y=Array.from({length:c.ny},(_,i)=>binRange(i,c.ny,c.domain)).findIndex(([lo,hi])=>lo===probe.aiMin&&hi===probe.aiMax);
  if(x>=0&&y>=0){c.x=x;c.y=y;}
 }
 const {l,t,cw,ch}=dims;let b='';
 c.bins.forEach((row,y)=>row.forEach((n,x)=>{b+=`<rect class="stats-density-cell" data-density-x="${x}" data-density-y="${y}" x="${l+x*cw/c.nx}" y="${t+ch-(y+1)*ch/c.ny}" width="${cw/c.nx}" height="${ch/c.ny}" fill="${n?colors.teal:'white'}" fill-opacity="${n?densityOpacity(n,c.max):1}"/>`;}));
 b+=`<line x1="${l}" y1="${t+ch}" x2="${l+cw}" y2="${t}" stroke="#8b9da4" stroke-dasharray="5 5" pointer-events="none"/>`;
 b+=axis(c.domain,{ylabel:'User input words per record · log scale'});
 for(const v of [0,10,100,1000,10000,100000,1000000].filter(v=>Math.log10(v+1)<=c.domain)){const py=t+ch-Math.log10(v+1)/c.domain*ch;b+=`<text x="${l-8}" y="${py+4}" text-anchor="end">${short(v)}</text>`;}
 b+=`<text class="stats-density-ylabel" transform="translate(12 ${t+ch/2}) rotate(-90)" text-anchor="middle">AI output words per record</text><rect data-density-probe x="${l+c.x*cw/c.nx}" y="${t+ch-(c.y+1)*ch/c.ny}" width="${cw/c.nx}" height="${ch/c.ny}" fill="none" stroke="#155c56" stroke-width="2.5" pointer-events="none"/>`;
 registry.set('density',c);
 return `<div class="stats-visual" data-viz="density" data-stat="density">${svg(b,`${fmt(rows.length)} English-labeled records. Each square groups records by total user input and AI output words. Both axes use log scales. White means zero records. Tap a square or use arrow keys.`,{attrs:'tabindex="0" data-density-chart aria-describedby="density-readout"'})}${densityLegend(c)}${output('density',densityReadout(c,c.x,c.y))}<div class="stats-density-controls"><button type="button" data-density-reset>Highest-count square</button><span>Tap a square or use arrow keys.</span></div><p class="stats-hint">Dashed line: input and output have equal word counts. Both axes use log scales.</p></div>`;
}

const boxGroups=[['other','No template match','#8c999e'],['matched','Template match',colors.teal]];
function boxSummary(a){return {n:a.length,p10:quantile(a,.1),p25:quantile(a,.25),p50:quantile(a,.5),p75:quantile(a,.75),p90:quantile(a,.9)};}
function boxReadout(c){const s=c.stats[c.key][c.group],label=boxGroups.find(x=>x[0]===c.group)[1];return s.n?`<strong>${label} · n = ${fmt(s.n)}</strong><span>Median ${fmt(Math.round(s.p50))} words</span><span>Middle 50%: ${fmt(Math.round(s.p25))}–${fmt(Math.round(s.p75))}</span>`:`<strong>${label}</strong><span>No matching records.</span>`;}
function boxChart(c){
 const l=184,cw=426,t=14,ch=146,domain=c.domain,x=n=>l+Math.log10(n+1)/domain*cw;let b='';
 for(const [i,[key,label,col]] of boxGroups.entries()){const s=c.stats[c.key][key],y=t+26+i*67;b+=`<g data-stat-box-group="${key}" class="stats-box-group ${c.group===key?'selected':''}" tabindex="0" role="button" aria-label="Inspect ${label}"><rect class="stats-hit" x="0" y="${y-27}" width="632" height="55"/><text x="${l-12}" y="${y+4}" text-anchor="end"><tspan x="${l-12}" dy="-7">${key==='matched'?'Template':'No template'}</tspan><tspan x="${l-12}" dy="22">match</tspan></text>`;
 if(s.n)b+=`<line x1="${x(s.p10)}" y1="${y}" x2="${x(s.p90)}" y2="${y}" stroke="${col}" stroke-width="2"/><path d="M ${x(s.p10)} ${y-9} V ${y+9} M ${x(s.p90)} ${y-9} V ${y+9}" stroke="${col}" stroke-width="2"/><rect x="${x(s.p25)}" y="${y-17}" width="${Math.max(1,x(s.p75)-x(s.p25))}" height="34" rx="3" fill="${col}" fill-opacity=".22" stroke="${col}" stroke-width="2"/><line x1="${x(s.p50)}" y1="${y-17}" x2="${x(s.p50)}" y2="${y+17}" stroke="${col}" stroke-width="3"/>`;
 else b+=`<text x="${l}" y="${y+4}">No records</text>`;b+='</g>';}
 b+=axis(domain,{l,t,cw,ch,ylabel:`${c.key==='user_words'?'User input':'AI output'} words · log scale`});
 return svg(b,'Word length by known template match. Box = middle 50%; central line = median; whiskers = 10th to 90th percentiles.',{h:214});
}
export function templateBoxplot(rows,probe=null){
 if(!rows.length)return empty('No matching English-labeled records.');
 const group=probe?.kind==='template'&&typeof probe.matched==='boolean'?(probe.matched?'matched':'other'):(rows.some(r=>r.group_template)?'matched':'other');
 const c={key:'user_words',group,stats:{}};
 for(const key of ['user_words','assistant_words']){c.stats[key]={};for(const [group]of boxGroups)c.stats[key][group]=boxSummary(values(rows.filter(r=>group==='matched'?r.group_template:!r.group_template),key));}
 c.domain=logDomain(rows.flatMap(r=>[r.user_words,r.assistant_words]));registry.set('boxplot',c);
 return `<div class="stats-visual" data-viz="boxplot" data-stat="boxplot"><div class="stats-mode" role="group" aria-label="Word length role"><button type="button" class="selected" aria-pressed="true" data-stat-box-key="user_words">User input</button><button type="button" aria-pressed="false" data-stat-box-key="assistant_words">AI output</button></div><div data-box-chart>${boxChart(c)}</div>${output('boxplot',boxReadout(c))}<p class="stats-hint"><span class="stats-inline-key"><i style="background:#8c999e"></i>No template match</span><span class="stats-inline-key"><i style="background:${colors.teal}"></i>Template match</span><br>Box: middle 50% · line: median · whiskers: 10th–90th percentiles</p></div>`;
}

function updateECDF(wrapper,step){const c=registry.get('ecdf');if(!c)return;const s=ecdfState(c,step),input=wrapper.querySelector('[data-stat-control="ecdf"]');input.value=step;input.setAttribute('aria-valuetext',`${fmt(s.threshold)} words`);wrapper.querySelector('[data-ecdf-threshold]').textContent=fmt(s.threshold);for(const key of ['user','ai']){const dot=wrapper.querySelector(`[data-ecdf-${key}]`);dot.setAttribute('cx',s.x);dot.setAttribute('cy',dims.t+dims.ch*(1-s[key]/c[key].length));}const line=wrapper.querySelector('[data-ecdf-line]');line.setAttribute('x1',s.x);line.setAttribute('x2',s.x);wrapper.querySelector('output').innerHTML=ecdfReadout(c,s);}
function updateDensity(wrapper,x,y){const c=registry.get('density');if(!c)return;c.x=Math.max(0,Math.min(c.nx-1,x));c.y=Math.max(0,Math.min(c.ny-1,y));const r=wrapper.querySelector('[data-density-probe]');r.setAttribute('x',dims.l+c.x*dims.cw/c.nx);r.setAttribute('y',dims.t+dims.ch-(c.y+1)*dims.ch/c.ny);wrapper.querySelector('output').innerHTML=densityReadout(c,c.x,c.y);}
function updateBox(wrapper,key,group){const c=registry.get('boxplot');if(!c)return;if(key)c.key=key;if(group)c.group=group;wrapper.querySelector('[data-box-chart]').innerHTML=boxChart(c);wrapper.querySelectorAll('[data-stat-box-key]').forEach(b=>{const selected=b.dataset.statBoxKey===c.key;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});wrapper.querySelector('output').innerHTML=boxReadout(c);}
const emitECDF = step => {const c=registry.get('ecdf');if(c)selectSubset({kind:'ecdf',field:'user_words',max:ecdfState(c,step).threshold});};
const emitDensity = () => {const c=registry.get('density');if(!c)return;const [userMin,userMax]=binRange(c.x,c.nx,c.domain),[aiMin,aiMax]=binRange(c.y,c.ny,c.domain);selectSubset({kind:'density',userMin,userMax,aiMin,aiMax});};
const mounted=new WeakSet();
export function mountStatsInteractions(root=document){
 if(mounted.has(root))return;mounted.add(root);
 const inspect=event=>{const target=event.target.closest?.('[data-stat-tip]');if(target)target.closest('.stats-visual').querySelector('output').textContent=target.dataset.statTip;};
 root.addEventListener('pointerover',inspect);root.addEventListener('focusin',inspect);
 root.addEventListener('input',event=>{const input=event.target.closest?.('[data-stat-control="ecdf"]');if(input)updateECDF(input.closest('.stats-visual'),Number(input.value));});
 root.addEventListener('change',event=>{const input=event.target.closest?.('[data-stat-control="ecdf"]');if(input)emitECDF(Number(input.value));});
 root.addEventListener('click',event=>{
  const reset=event.target.closest?.('[data-density-reset]');if(reset){const c=registry.get('density');if(c){updateDensity(reset.closest('.stats-visual'),c.mode.x,c.mode.y);emitDensity();}return;}
  const cell=event.target.closest?.('[data-density-x]');if(cell){updateDensity(cell.closest('.stats-visual'),Number(cell.dataset.densityX),Number(cell.dataset.densityY));emitDensity();return;}
  const key=event.target.closest?.('[data-stat-box-key]'),group=event.target.closest?.('[data-stat-box-group]');if(key||group){updateBox((key||group).closest('.stats-visual'),key?.dataset.statBoxKey,group?.dataset.statBoxGroup);if(group)selectSubset({kind:'template',matched:group.dataset.statBoxGroup==='matched'});return;}
  const chart=event.target.closest?.('[data-ecdf-chart]');if(chart){const p=chart.createSVGPoint();p.x=event.clientX;p.y=event.clientY;const ctm=chart.getScreenCTM();if(ctm){const pos=p.matrixTransform(ctm.inverse());const step=Math.max(0,Math.min(1000,Math.round((pos.x-dims.l)/dims.cw*1000)));updateECDF(chart.closest('.stats-visual'),step);emitECDF(step);}}
 });
 root.addEventListener('keydown',event=>{
  const chart=event.target.closest?.('[data-density-chart]');if(chart&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();const c=registry.get('density');updateDensity(chart.closest('.stats-visual'),c.x+(event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0),c.y+(event.key==='ArrowUp'?1:event.key==='ArrowDown'?-1:0));emitDensity();return;}
  const group=event.target.closest?.('[data-stat-box-group]');if(group&&['Enter',' '].includes(event.key)){event.preventDefault();const key=group.dataset.statBoxGroup;updateBox(group.closest('.stats-visual'),null,key);selectSubset({kind:'template',matched:key==='matched'});root.querySelector(`[data-stat-box-group="${key}"]`)?.focus();}
 });
}
export const statsTest = {upperBound,binRange,boxSummary,ecdfState,densityData,densityOpacity};
