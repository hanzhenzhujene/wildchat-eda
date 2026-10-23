import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validationOverview,validationPanel,validationMethods} from '../website/validation.js';
const read=name=>JSON.parse(readFileSync(new URL(`../website/data/${name}.json`,import.meta.url),'utf8'));
const v=read('validation'),packed=read('records');
const records=packed.rows.map(row=>Object.fromEntries(packed.columns.map((c,i)=>[c,row[i]])));
const proof=read('sampling_validation/comparison');
assert.equal(v.source.n,3199860);
assert.equal(v.source.shards,86);
assert.equal(v.verification.old_rows_checked,20000);
assert.equal(v.verification.mismatches,0);
assert.ok(proof.complete&&proof.checks.all_checksums_match&&proof.checks.old_sample_frame_matches);
for(const s of ['census','original','random']){
  const n=v.scopes[s].n;
  for(const rows of Object.values(v.categories)){
    assert.equal(rows.reduce((a,r)=>a+r[s].count,0),n);
    for(const r of rows){
      assert.equal(r[s].n,n);
      assert.ok(Math.abs(r[s].pct-r[s].count/n*100)<1e-6);
    }
  }
  assert.equal(v.lengths[s].n,v.scopes[s].english_n);
  for(const role of ['user','assistant']){
    const q=v.lengths[s][role];
    assert.ok(q.median<=q.p90&&q.p90<=q.p99);
    const pts=v.lengths[s].ecdf.filter(p=>Number.isFinite(p[`${role}_pct`]));
    assert.equal(pts.at(-1)[`${role}_pct`],100);
  }
}
const predicates={
  single_user:r=>r.user_turns===1,english:r=>r.language==='English',
  wrapper:r=>r.group_template,redacted:r=>r.redacted,empty:r=>r.empty_user_messages>0,
  candidate:r=>r.candidate,code:r=>r.code_flag,creative:r=>r.creative_flag
};
for(const metric of v.comparisons){
  assert.equal(metric.original.count,records.filter(predicates[metric.key]).length);
  assert.equal(metric.original.n,20000);
  if(['candidate','code','creative'].includes(metric.key))assert.equal(metric.census,null);
  if(metric.random.ci95){
    assert.ok(metric.random.ci95[0]<=metric.random.pct&&metric.random.ci95[1]>=metric.random.pct);
  }
}
assert.equal(v.repetition.original.members,records.filter(r=>r.repeat_count>1).length);
assert.equal(v.repetition.original.extra,Math.round(records.reduce((sum,r)=>sum+1-1/r.repeat_count,0)));
for(const view of ['composition','exchange','length','quality','records']){
  const html=validationPanel(v,view);
  assert.ok(!/\b(?:NaN|undefined)\b/.test(html),view);
  assert.ok(!/data-action=/.test(html),'Aggregate charts must not change the sample filters');
}
assert.ok(validationMethods(v).includes('20000')||validationMethods(v).includes('20,000'));
assert.ok(validationOverview(v).includes('Sampling check'));
const audit=read('audit');
assert.equal(audit.rows.length,120,'Census does not expand the semantic audit');
assert.equal(audit.rows.filter(r=>r.relational_mode!=='none_or_unclear').length,9);
console.log('Census denominators, original-sample parity, estimates, length curves, and semantic scope passed.');
