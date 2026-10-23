export const escape = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const fmt = n => Number(n).toLocaleString('en-US');
export const pct = (n,d) => d ? `${(n/d*100).toFixed(1)}%` : '—';
export const colors={blue:'#416eb2',teal:'#167b74',amber:'#b57c3c',gray:'#9caeb0',tealDark:'#155c56',tealMuted:'#6e8c86'};
export function counts(rows,key){const c={};for(const r of rows)c[r[key]]=(c[r[key]]||0)+1;return Object.entries(c).sort((a,b)=>b[1]-a[1]);}
export function quantile(a,q){if(!a.length)return 0;const v=[...a].sort((a,b)=>a-b),p=(v.length-1)*q,l=Math.floor(p),t=p-l;return v[l]+t*((v[l+1]??v[l])-v[l]);}
const svg=(body,w,h,label)=>`<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${escape(label)}">${body}</svg>`;
export function bars(entries,{denominator=entries.reduce((a,b)=>a+b[1],0),limit=12,color=colors.teal,action='',title='Record distribution',percent=true}={}){
 if(!entries.length)return '<div class="chart-empty">No matching records.</div>';
 let e=entries.slice(0,limit);if(entries.length>limit)e.push(['Other',entries.slice(limit).reduce((a,b)=>a+b[1],0)]);
 const w=620,left=166,right=100,h=e.length*31+30,max=Math.max(...e.map(d=>d[1]),1),bw=w-left-right;
 let b='';e.forEach(([label,n],i)=>{const y=8+i*31;const clickable=action&&label!=='Other';b+=`<g ${clickable?`class="interactive" tabindex="0" role="button" data-action="${action}" data-value="${escape(label)}" aria-label="Filter ${escape(label)}: ${fmt(n)} records"`:''}><title>${escape(label)}: ${fmt(n)} (${pct(n,denominator)})</title><text x="${left-9}" y="${y+16}" text-anchor="end">${escape(label)}</text><rect class="bar" x="${left}" y="${y}" width="${n/max*bw}" height="22" rx="3" fill="${color}"/><text class="value" x="${left+n/max*bw+7}" y="${y+16}">${fmt(n)}${percent?' · '+pct(n,denominator):''}</text></g>`});
 return svg(b,w,h,title)+`<details class="chart-table"><summary class="micro">Counts</summary><table><thead><tr><th>Group</th><th>Records</th><th>Share</th></tr></thead><tbody>${entries.map(([l,n])=>`<tr><td>${escape(l)}</td><td>${fmt(n)}</td><td>${pct(n,denominator)}</td></tr>`).join('')}</tbody></table></details>`;
}
export function vertical(entries,{title='Record counts',color=colors.teal}={}){
 if(!entries.length)return '<div class="chart-empty">No matching records.</div>';
 const w=600,h=280,left=45,bottom=45,top=20,cw=w-left-20,ch=h-top-bottom,max=Math.max(...entries.map(d=>d[1]),1),step=cw/entries.length;
 let b='';[0,.25,.5,.75,1].forEach(t=>{const y=top+ch*(1-t);b+=`<line class="grid-line" x1="${left}" y1="${y}" x2="${w-15}" y2="${y}"/><text x="${left-7}" y="${y+4}" text-anchor="end">${max*t>=1000?((max*t)/1000).toFixed(1)+'k':Math.round(max*t)}</text>`});
 entries.forEach(([l,n],i)=>{let x=left+i*step+step*.15,y=top+ch*(1-n/max);b+=`<g><title>${escape(l)}: ${fmt(n)}</title><rect class="bar" x="${x}" y="${y}" width="${step*.7}" height="${ch*n/max}" fill="${color}" rx="2"/><text x="${x+step*.35}" y="${h-bottom+19}" text-anchor="middle" ${entries.length>15?`transform="rotate(-35 ${x+step*.35} ${h-bottom+19})"`:''}>${escape(l)}</text>${entries.length<12?`<text class="value" x="${x+step*.35}" y="${y-5}" text-anchor="middle">${fmt(n)}</text>`:''}</g>`});
 return svg(b,w,h,title);
}
export function ecdf(rows){
 if(!rows.length)return '<div class="chart-empty">No matching English-labeled records.</div>';
 const w=650,h=310,l=48,t=15,cw=580,ch=240,xmax=Math.max(5,Math.log10(1+Math.max(...rows.map(r=>Math.max(r.user_words,r.assistant_words)))));
 let b='';for(let q=0;q<=1.001;q+=.25){const y=t+ch*(1-q);b+=`<line class="grid-line" x1="${l}" y1="${y}" x2="${l+cw}" y2="${y}"/><text x="${l-7}" y="${y+4}" text-anchor="end">${Math.round(q*100)}%</text>`}
 for(const v of [0,10,100,1000,10000,100000]){const x=l+Math.log10(1+v)/xmax*cw;b+=`<text x="${x}" y="${t+ch+21}" text-anchor="middle">${v>=1000?v/1000+'k':v}</text>`}
 for(const [key,col,label]of[['user_words',colors.teal,'User input'],['assistant_words',colors.tealMuted,'AI output']]){
 const a=rows.map(r=>r[key]).sort((a,b)=>a-b);const stride=Math.max(1,Math.floor(a.length/240));let points=[];for(let i=0;i<a.length;i+=stride)points.push(`${(l+Math.log10(1+a[i])/xmax*cw).toFixed(2)},${(t+ch*(1-(i+1)/a.length)).toFixed(2)}`);points.push(`${(l+Math.log10(1+a.at(-1))/xmax*cw).toFixed(2)},${t}`);
 b+=`<polyline points="${points.join(' ')}" fill="none" stroke="${col}" stroke-width="2.7" ${key==='assistant_words'?'stroke-dasharray="7 4"':''}><title>${label}: median ${fmt(Math.round(quantile(a,.5)))} words</title></polyline>`;}
 b+=`<text x="${l+cw/2}" y="${h-7}" text-anchor="middle">Words across messages per record · log scale</text>`;
 return svg(b,w,h,'Cumulative word-length distributions for English-labeled records')+`<div class="chart-legend"><span><i style="display:inline-block;width:18px;border-top:3px solid ${colors.teal};margin-right:5px"></i>User input</span><span><i style="display:inline-block;width:18px;border-top:3px dashed ${colors.tealMuted};margin-right:5px"></i>AI output</span><span>Height = share at or below this word count</span></div>`;
}
export function density(rows){
 if(!rows.length)return '<div class="chart-empty">No matching English-labeled records.</div>';
 const nx=28,ny=18,bins=Array.from({length:ny},()=>Array(nx).fill(0)),maxWords=Math.max(...rows.map(r=>Math.max(r.user_words,r.assistant_words))),domain=Math.max(5,Math.ceil(Math.log10(maxWords+1)));
 rows.forEach(r=>{let x=Math.min(nx-1,Math.floor(Math.log10(r.user_words+1)/domain*nx)),y=Math.min(ny-1,Math.floor(Math.log10(r.assistant_words+1)/domain*ny));bins[y][x]++});
 const w=650,h=325,l=50,t=10,cw=570,ch=255,max=Math.max(...bins.flat(),1);let b='';
 bins.forEach((row,y)=>row.forEach((n,x)=>{if(!n)return;const a=.12+.88*Math.log1p(n)/Math.log1p(max),px=l+x*cw/nx,py=t+ch-(y+1)*ch/ny;const loX=Math.round(10**(x/nx*domain)-1),hiX=Math.round(10**((x+1)/nx*domain)-1),loY=Math.round(10**(y/ny*domain)-1),hiY=Math.round(10**((y+1)/ny*domain)-1);b+=`<rect x="${px}" y="${py}" width="${cw/nx-.6}" height="${ch/ny-.6}" fill="${colors.teal}" opacity="${a}"><title>${fmt(n)} records · input ${fmt(loX)}–${fmt(hiX)} words · output ${fmt(loY)}–${fmt(hiY)} words</title></rect>`}));
 b+=`<line x1="${l}" y1="${t+ch}" x2="${l+cw}" y2="${t}" stroke="#9dadaf" stroke-dasharray="5,5"/>`;
 for(let e=0;e<=domain;e++){const v=e===0?'0':e<3?10**e:10**(e-3)+'k',x=l+e/domain*cw,y=t+ch-e/domain*ch;b+=`<text x="${x}" y="${t+ch+20}" text-anchor="middle">${v}</text><text x="${l-8}" y="${y+4}" text-anchor="end">${v}</text>`}
 b+=`<text x="${l+cw/2}" y="${h-12}" text-anchor="middle">User input words · log(1 + words)</text><text transform="translate(12 ${t+ch/2}) rotate(-90)" text-anchor="middle">AI output words</text>`;
 const occupied=bins.flat().filter(n=>n>0);
 const summary=`${fmt(rows.length)} English-labeled records. Horizontal axis: user input words; vertical axis: AI output words. Both axes use log(1 + words), from 0 to ${fmt(10**domain-1)} words. ${occupied.length} occupied bins contain ${Math.min(...occupied)} to ${fmt(max)} records each; darker bins contain more records. Dashed diagonal: equal input and output length.`;
 return svg(b,w,h,summary)+`<div class="chart-legend"><span>Squares = record counts (darker = more)</span><span>Dashed line = equal word counts</span><span>Hover for word ranges and counts</span></div>`;
}
export function modelHeatmap(rows){
 const ys=[...new Set(rows.map(r=>r.year))].sort(),fs=counts(rows,'model_family');if(!ys.length)return '<div class="chart-empty">No records.</div>';
 return `<div class="horizontal-scroll" data-viz="matrix"><table class="heatmap-table"><thead><tr><th>Source model</th>${ys.map(y=>`<th>${y}<br>n = ${fmt(rows.filter(r=>r.year===y).length)}</th>`).join('')}</tr></thead><tbody>${fs.map(([f])=>`<tr><th>${escape(f)}</th>${ys.map(y=>{const d=rows.filter(r=>r.year===y),n=d.filter(r=>r.model_family===f).length,p=n/d.length;return `<td><button class="heatmap-cell" data-action="filter-model-year" data-family="${escape(f)}" data-year="${y}" style="background:rgba(22,123,116,${p*.68+.04});color:#132f2b" aria-label="Filter ${escape(f)} in ${y}: ${fmt(n)} of ${fmt(d.length)} records">${pct(n,d.length)}<small>${fmt(n)}</small></button></td>`}).join('')}</tr>`).join('')}</tbody></table></div>`;
}
