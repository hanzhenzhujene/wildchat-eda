const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n).toLocaleString('en-US');
const names={original:'Original blocks',random:'Random rows'};

export function comparisonRows(validation,dimension,scope){
 if(!['original','random'].includes(scope))throw new Error('Choose one of the two samples.');
 if(!['language','model_family','turn_bucket'].includes(dimension))throw new Error('Comparison unavailable for this measure.');
 return validation.categories[dimension].map(r=>{
  const samplePct=100*r[scope].count/validation.scopes[scope].n;
  const censusPct=100*r.census.count/validation.scopes.census.n;
  return {key:r.key,label:r.label,count:r[scope].count,censusCount:r.census.count,samplePct,censusPct,delta:samplePct-censusPct};
 });
}
export function scopeComparison(validation,dimension,scope,{all=false,href=()=>''}={}){
 const rows=comparisonRows(validation,dimension,scope);
 const shown=all?rows:rows.slice(0,12);
 return `<div class="comparison-legend"><span><i class="comparison-swatch"></i>${names[scope]} · ${fmt(validation.scopes[scope].n)} records</span><span><i class="comparison-marker"></i>Full release · ${fmt(validation.scopes.census.n)} records</span></div>
 <div class="comparison-head"><span>Category</span><span>Share of each scope</span><span>Difference<br><span title="Sample share minus full-release share, in percentage points">(pp)</span></span></div>
 <div class="comparison-rows">${shown.map(r=>`<a class="comparison-row" href="${esc(href(r))}" title="${esc(r.label)}: sample ${r.samplePct.toFixed(2)}%; full release ${r.censusPct.toFixed(2)}%; difference ${r.delta.toFixed(2)} percentage points. Open original-sample records."><span>${esc(r.label)}<small>${fmt(r.count)} sampled records</small></span><span class="comparison-track"><span style="width:${r.samplePct}%"></span><i style="left:${r.censusPct}%"></i></span><span class="comparison-value">${r.samplePct.toFixed(1)}%<small class="${r.delta>=0?'positive':'negative'}">${r.delta>=0?'+':''}${r.delta.toFixed(2)} pp</small></span></a>`).join('')}</div><div class="comparison-head comparison-axis"><span></span><span><b>0</b><b>100%</b></span><span></span></div>`;
}
