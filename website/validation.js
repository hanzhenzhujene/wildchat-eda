/* Aggregate views stay independent of the original-sample filters. */
const SCOPES = ['census', 'original', 'random'];
const LABELS = {census: 'Whole release', original: 'Original blocks', random: 'Row-random'};
const COLORS = {census: '#3569b5', original: '#8290a4', random: '#227c6d'};
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const finite = value => typeof value === 'number' && Number.isFinite(value);
const fmt = value => finite(value) ? value.toLocaleString('en-US', {maximumFractionDigits: 1}) : '—';
const percent = value => finite(value) ? `${value.toLocaleString('en-US', {maximumFractionDigits: 2})}%` : '—';
const clamp = value => finite(value) ? Math.max(0, Math.min(100, value)) : 0;
const compact = value => value >= 1000 ? `${fmt(value / 1000)}k` : fmt(value);
const available = V => V && V.source && V.scopes;
const scopeN = (V, key) => V?.scopes?.[key]?.n;
const note = text => `<p class="vc-note">${escape(text)}</p>`;

function legend(V, counts = true) {
  return `<div class="vc-legend" aria-label="Comparison scopes">${SCOPES.map(key =>
    `<span class="vc-scope-${key}"><i aria-hidden="true"></i>${LABELS[key]}${counts ? `<small>n = ${fmt(scopeN(V, key))}</small>` : ''}</span>`
  ).join('')}</div>`;
}

function header(V, subtitle) {
  return `<header class="vc-heading"><div><h2>Whole release vs samples</h2><p>Unaffected by filters below${subtitle ? ` · ${escape(subtitle)}` : ''}</p></div><a href="#methods?source=validation">Method & source ↗</a></header>${legend(V)}`;
}

function interval(stat) {
  const ci = stat?.ci95;
  return Array.isArray(ci) && ci.length === 2 && ci.every(finite)
    ? `${percent(ci[0])}–${percent(ci[1])}` : '—';
}

function tableCell(stat) {
  return stat && finite(stat.pct)
    ? `<strong>${percent(stat.pct)}</strong><small>${fmt(stat.count)} / ${fmt(stat.n)}</small>`
    : '<span class="vc-unavailable">Not scanned</span>';
}

function exactTable(rows, title) {
  return `<div class="vc-table-scroll"><table class="vc-exact"><caption>${escape(title)}</caption><thead><tr><th scope="col">Measure</th>${SCOPES.map(key => `<th scope="col" class="vc-scope-${key}">${LABELS[key]}</th>`).join('')}<th scope="col">Random 95% CI</th></tr></thead><tbody>${rows.map(row =>
    `<tr><th scope="row">${escape(row.label || row.key)}</th>${SCOPES.map(key => `<td>${tableCell(row[key])}</td>`).join('')}<td>${escape(interval(row.random))}</td></tr>`
  ).join('')}</tbody></table></div>`;
}

function aggregateOther(rows) {
  const other = {label: 'Other categories'};
  for (const key of SCOPES) {
    const cells = rows.map(row => row[key]);
    if (!cells.length || cells.some(cell => !cell || !finite(cell.count) || !finite(cell.n))) {
      other[key] = null;
      continue;
    }
    const n = cells[0].n;
    if (!cells.every(cell => cell.n === n)) {
      other[key] = null;
      continue;
    }
    const count = cells.reduce((total, cell) => total + cell.count, 0);
    other[key] = {n, count, pct: n ? count / n * 100 : 0};
  }
  return other;
}

function previewRows(rows, preserveOrder = false) {
  if (rows.length <= 7) return rows;
  const sorted = [...rows].sort((a, b) =>
    (b.census?.pct ?? b.original?.pct ?? 0) - (a.census?.pct ?? a.original?.pct ?? 0)
  );
  const chosen = sorted.slice(0, 6);
  if (preserveOrder) chosen.sort((a, b) => rows.indexOf(a) - rows.indexOf(b));
  return [...chosen, aggregateOther(sorted.slice(6))];
}

function shareRows(rows) {
  if (!rows.length) return note('Comparison values are unavailable.');
  return `<div class="vc-share-list">${rows.map(row => `<div class="vc-share-row">
    <span class="vc-category-name" title="${escape(row.label || row.key)}">${escape(row.label || row.key)}</span>
    <div class="vc-tracks" aria-hidden="true">${SCOPES.map(key => `<span><i class="vc-fill-${key}" style="width:${clamp(row[key]?.pct)}%"></i></span>`).join('')}</div>
    <div class="vc-share-values">${SCOPES.map(key => `<span class="vc-scope-${key}"><span class="vc-sr">${LABELS[key]}: </span>${percent(row[key]?.pct)}</span>`).join('')}</div>
  </div>`).join('')}</div>`;
}

function categoryGroup(rows, title, preserveOrder = false) {
  rows = Array.isArray(rows) ? rows : [];
  return `<section class="vc-chart-group"><div class="vc-chart-heading"><h3>${escape(title)}</h3><span>${rows.length > 7 ? 'Largest six + remainder' : 'All categories'} · 0–100%</span></div>${shareRows(previewRows(rows, preserveOrder))}</section>`;
}

function monthChart(rows) {
  rows = [...rows].sort((a, b) => String(a.key).localeCompare(String(b.key)));
  if (!rows.length) return '';
  const max = Math.max(1, ...rows.flatMap(row => SCOPES.map(scope => row[scope]?.pct || 0)));
  const top = Math.ceil(max / 5) * 5;
  const x = i => 42 + i / Math.max(1, rows.length - 1) * 486;
  const y = pct => 216 - pct / top * 184;
  return `<section class="vc-chart-group"><div class="vc-chart-heading"><h3>Record months</h3><span>Share of each scope · all months</span></div>
    <svg class="vc-month-chart" viewBox="0 0 560 270" role="img" aria-label="All record months compared across the release and both samples. Each line uses its own scope denominator.">
    ${[0,top/2,top].map(pct=>`<line x1="42" x2="528" y1="${y(pct)}" y2="${y(pct)}" class="vc-grid-line"/><text x="35" y="${y(pct)+4}" text-anchor="end">${fmt(pct)}%</text>`).join('')}
    ${SCOPES.map(scope=>`<path d="${rows.map((row,i)=>`${i?'L':'M'}${x(i)},${y(row[scope]?.pct||0)}`).join(' ')}" fill="none" stroke="${COLORS[scope]}" stroke-width="${scope==='census'?2.4:1.8}" ${scope==='original'?'stroke-dasharray="5 3"':''}/>${rows.map((row,i)=>`<circle cx="${x(i)}" cy="${y(row[scope]?.pct||0)}" r="3" fill="${COLORS[scope]}"><title>${escape(row.label)} · ${LABELS[scope]}: ${percent(row[scope]?.pct)} (${fmt(row[scope]?.count)} rows)</title></circle>`).join('')}`).join('')}
    ${rows.filter((r,i)=>i%6===0||i===rows.length-1).map(row=>`<text x="${x(rows.indexOf(row))}" y="242" text-anchor="middle">${escape(row.label)}</text>`).join('')}
    </svg></section>`;
}

function largestGap(rows, title) {
  const ranked = rows.filter(r => r.census && r.original && r.random)
    .sort((a,b)=>Math.abs(b.original.pct-b.census.pct)-Math.abs(a.original.pct-a.census.pct));
  const r = ranked[0];
  if (!r) return '';
  const diff = scope => `${r[scope].pct-r.census.pct >= 0 ? '+' : ''}${(r[scope].pct-r.census.pct).toFixed(2)}`;
  return `<p class="vc-comparison-finding"><strong>${escape(title)}: ${escape(r.label)}</strong> has the largest original-sample gap (${diff('original')} percentage points). Row-random gap for the same category: ${diff('random')}.</p>`;
}

function categoryPanel(V, view) {
  const composition = view === 'composition';
  const a = V.categories?.[composition ? 'language' : 'turn_bucket'] || [];
  const b = V.categories?.[composition ? 'model_family' : 'month'] || [];
  const titleA = composition ? 'Source-language labels' : 'Stored user messages';
  const titleB = composition ? 'Model families' : 'Record months';
  return `${header(V, composition ? 'Language & model mix' : 'Stored depth & date coverage')}
    <div class="vc-chart-grid">${categoryGroup(a, titleA, !composition)}${composition?categoryGroup(b,titleB):monthChart(b)}</div>
    ${largestGap(a,composition?'Language':'Stored depth')}${largestGap(b,composition?'Model family':'Month')}
    <details class="vc-details"><summary>Exact counts, shares & random-sample intervals</summary>${exactTable(a, titleA)}${exactTable(b, titleB)}${note('Each share uses its own scope denominator. The interval quantifies uncertainty in the uniform row sample; the original block sample has no row-random interval.')}</details>`;
}

function quantileCard(V, scope) {
  const data = V.lengths?.[scope];
  return `<section class="vc-quantile-card vc-scope-${scope}"><h3>${LABELS[scope]}</h3><p>n = ${fmt(data?.n)} English-labeled rows</p>
    <table class="vc-quantiles"><caption class="vc-sr">${LABELS[scope]} words per record</caption><thead><tr><th scope="col">Words</th><th scope="col">Median</th><th scope="col">90th</th><th scope="col">99th</th></tr></thead><tbody>${[['user', 'User'], ['assistant', 'AI']].map(([key, label]) =>
      `<tr><th scope="row">${label}</th>${['median', 'p90', 'p99'].map(q => `<td>${fmt(data?.[key]?.[q])}</td>`).join('')}</tr>`
    ).join('')}</tbody></table></section>`;
}

function ecdfChart(V, role) {
  const data = SCOPES.map(scope => ({
    scope,
    points: (V.lengths?.[scope]?.ecdf || [])
      .filter(point => finite(point.words) && point.words >= 0 && finite(point[`${role}_pct`]))
      .sort((a, b) => a.words - b.words)
  }));
  const max = Math.max(1, ...data.flatMap(series => series.points.map(point => point.words)));
  const x = words => 44 + Math.log10(words + 1) / Math.log10(max + 1) * 494;
  const y = pct => 158 - clamp(pct) / 100 * 136;
  const ticks = [0, 10, 100, 1000, 10000, 100000, 1000000].filter(tick => tick <= max);
  const title = `${role === 'user' ? 'User input' : 'AI output'} length`;
  const curves = data.map(({scope, points}) => {
    if (!points.length) return '';
    const path = points.map((point, index) =>
      `${index ? 'H' : 'M'}${x(point.words).toFixed(2)}${index ? 'V' : ','}${y(point[`${role}_pct`]).toFixed(2)}`
    ).join(' ');
    return `<path d="${path}" fill="none" stroke="${COLORS[scope]}" stroke-width="${scope === 'census' ? 2.4 : 1.8}" ${scope === 'original' ? 'stroke-dasharray="5 3"' : ''}><title>${LABELS[scope]}</title></path>`;
  }).join('');
  return `<figure class="vc-ecdf"><figcaption>${title}</figcaption><svg viewBox="0 0 560 202" role="img" aria-label="${title}: percentage of English-labeled records at or below each word count. Colors identify the three scopes; the original sample is also dashed.">
    <desc>Word counts use a log scale. Higher curves mean more records have short messages. Numerical values are in the downloadable comparison data.</desc>
    ${[0, 50, 100].map(value => `<line x1="44" x2="538" y1="${y(value)}" y2="${y(value)}" class="vc-grid-line"/><text x="36" y="${y(value) + 4}" text-anchor="end">${value}%</text>`).join('')}
    ${curves}${ticks.map(value => `<text x="${x(value)}" y="176" text-anchor="middle">${compact(value)}</text>`).join('')}
    <text x="291" y="197" text-anchor="middle">Whitespace-separated words · log scale</text>
    </svg></figure>`;
}

function lengthPanel(V) {
  const oldGap=V.length_differences?.user_words?.original_vs_census?.ecdf?.max_ecdf_gap_pp;
  const randomGap=V.length_differences?.user_words?.random_vs_census?.ecdf?.max_ecdf_gap_pp;
  return `${header(V, 'English-labeled records')}
    <div class="vc-quantile-grid">${SCOPES.map(scope => quantileCard(V, scope)).join('')}</div>
    <p class="vc-comparison-finding"><strong>${escape(V.findings[0])}</strong></p>
    ${note('Words are separated by whitespace and summed across all messages for each role in a record. Only source-English, non-truncated records enter these length comparisons.')}
    <details class="vc-details" open><summary>Cumulative length curves</summary><div class="vc-chart-grid">${ecdfChart(V, 'user')}${ecdfChart(V, 'assistant')}</div>${note(`Largest user-length cumulative-share gap from the full release: ${Number(oldGap).toFixed(2)} percentage points for the original sample; ${Number(randomGap).toFixed(2)} for the row-random sample.`)}${note('Values are exact at plotted thresholds; the steps between them simplify the curve. Maximum differences use all observed lengths. The original sample is dashed.')}</details>`;
}

function repetition(V) {
  if (!V.repetition) return '';
  return `<details class="vc-details"><summary>Repeated conversation hashes: compare counts with care</summary>
    ${note('Hashes are grouped separately within each scope. A larger set has more opportunities to contain repeats, so these percentages are not comparable prevalence estimates. Repeated hashes also do not identify people.')}
    <div class="vc-table-scroll"><table class="vc-exact"><caption>Within-scope hash repetition</caption><thead><tr><th scope="col">Scope</th><th scope="col">Rows</th><th scope="col">Distinct hashes</th><th scope="col">Extra rows</th><th scope="col">Rows in repeated groups</th></tr></thead><tbody>${SCOPES.map(scope => {
      const r = V.repetition[scope] || {};
      return `<tr><th scope="row" class="vc-scope-${scope}">${LABELS[scope]}</th>${['n', 'unique', 'extra', 'members'].map(key => `<td>${fmt(r[key])}</td>`).join('')}</tr>`;
    }).join('')}</tbody></table></div>${note('Extra rows = rows minus distinct hashes. Rows in repeated groups includes every occurrence of a hash seen at least twice.')}</details>`;
}

function qualityPanel(V) {
  const keys = ['wrapper', 'redacted', 'empty', 'candidate', 'code', 'creative'];
  const rows = keys.map(key => V.comparisons?.find(row => row.key === key)).filter(Boolean);
  return `${header(V, 'Literal flags & retrieval rules')}
    <div class="vc-table-scroll"><table class="vc-quality"><caption class="vc-sr">Flag comparison by scope</caption><thead><tr><th scope="col">Flag</th>${SCOPES.map(scope => `<th scope="col" class="vc-scope-${scope}">${LABELS[scope]}</th>`).join('')}</tr></thead><tbody>${rows.map(row =>
      `<tr><th scope="row">${escape(row.label || row.key)}</th>${SCOPES.map(scope => `<td>${row[scope] ? percent(row[scope].pct) : '<span class="vc-unavailable">Not scanned</span>'}</td>`).join('')}</tr>`
    ).join('')}</tbody></table></div>
    ${note('Each rate uses all rows in its scope. These wording matches do not establish personal interpersonal help. “Not scanned” is not zero.')}
    <details class="vc-details"><summary>Exact flag counts & random-sample intervals</summary>${exactTable(rows, 'Literal flags and retrieval rules')}${note('Denominators appear under each share. Candidate flags require source-English labels and non-truncated text. Regex flags are not semantic labels.')}</details>
    ${repetition(V)}`;
}

export function validationOverview(V) {
  if (!available(V)) return '';
  const finding = V.findings?.find(value => typeof value === 'string' && value.trim());
  return `<aside class="vc-overview" aria-label="Sample validation"><div><span class="vc-kicker">Sampling check</span><p>${escape(finding || `The ${fmt(V.source.n)} released rows now provide a full comparison for both samples.`)}</p></div><a href="#explorer?snapshot=1&view=length">Compare the samples <span aria-hidden="true">→</span></a></aside>`;
}

export function validationPanel(V, view = 'composition') {
  if (!available(V)) return '';
  if (view === 'records') return `<p class="vc-record-scope">The table below contains the original ${fmt(scopeN(V, 'original'))} sampled rows. Whole-release and row-random comparisons are aggregate views. <a href="#methods?source=validation">Scope & verification ↗</a></p>`;
  const body = view === 'length' ? lengthPanel(V)
    : view === 'quality' ? qualityPanel(V)
    : categoryPanel(V, view === 'exchange' ? 'exchange' : 'composition');
  return `<section class="vc-panel" data-validation-view="${escape(view)}" aria-label="Whole-release and sample comparison">${body}</section>`;
}

export function validationMethods(V) {
  if (!available(V)) return '';
  const source = V.source;
  const verify = V.verification || {};
  const datasetPath = String(source.dataset || '').split('/').map(encodeURIComponent).join('/');
  const sourceUrl = `https://huggingface.co/datasets/${datasetPath}/tree/${encodeURIComponent(source.revision || '')}`;
  const descriptions = {
    census: 'Every row in the released split, read from the original Parquet files at a fixed revision.',
    original: '200 row-index strata × one randomly started, consecutive 100-row block. Seed: 20261017.',
    random: '20,000 individual rows, sampled uniformly without replacement. Seed: 20261020. Original-sample rows remained eligible.'
  };
  return `<div class="vc-methods">
    <div class="vc-method-grid">${SCOPES.map(scope => {
      const s = V.scopes[scope] || {};
      return `<section class="vc-method-card vc-scope-${scope}"><h3>${LABELS[scope]}</h3><strong>${fmt(s.n)} <small>rows</small></strong><p>${descriptions[scope]}</p><span>${escape(s.date_min || 'Unknown')} → ${escape(s.date_max || 'Unknown')}</span></section>`;
    }).join('')}</div>
    <p class="vc-verification">Checked <strong>${fmt(verify.old_rows_checked)}</strong> original row identities against the pinned source: <strong>${fmt(verify.mismatches)}</strong> mismatches. The two samples share <strong>${fmt(verify.overlap)}</strong> rows.</p>
    ${note('The census supplies exact counts for the measured fields of this release. Random-sample intervals describe row-sampling uncertainty; they do not measure label accuracy. Neither scope identifies unique people.')}
    <details class="vc-details"><summary>Coverage & interpretation</summary>
      <ul class="vc-method-list"><li>No language, date or topic filter, and no deduplication, precedes either 20,000-row selection. The publisher's filtering already defines this release.</li><li>Full-scan metrics include source metadata, stored messages, whitespace word counts, and the literal wrapper rule. Richer retrieval, code, and creative regex flags are compared across the two samples.</li><li>Length comparisons use source-English, non-truncated records. Automatic language labels are not independently verified.</li><li>The original sample’s clustered selection remains relevant even when a particular proportion is close to the census.</li><li>Hash-repetition counts are calculated within each scope; their proportions change with sample size.</li><li>This metadata check does not establish relational prevalence. A separate 2,000-record random content sample now has AI labels; none are human-validated.</li></ul>
    </details>
    <div class="vc-source"><span>${escape(source.dataset)} · ${fmt(source.shards)} shards · checked ${escape(source.date || '')}</span><a href="${escape(sourceUrl)}" target="_blank" rel="noopener">Pinned source ↗</a><a href="./data/validation.json" download="wildchat-sampling-validation.json">Comparison data ↓</a><a href="./data/sampling_validation/scan_manifest.json" download>Scan manifest ↓</a><a href="./data/sampling_validation/random_sample_plan.json" download>Random draw & row IDs ↓</a><a href="./data/sampling_validation/comparison.json" download>Full statistics ↓</a><code>${escape(source.revision)}</code></div>
  </div>`;
}
