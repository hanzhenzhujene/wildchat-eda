// Inspect saved aggregate counts. The two views are independent, not joint filters.
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt = value => Number(value).toLocaleString('en-US');
const percent = (count, denominator) => {
  const share = count / denominator * 100;
  return share > 0 && share < 0.1 ? '<0.1%' : `${share.toFixed(1)}%`;
};
const countValue = value => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid saved linkage count');
  return value;
};

export function linkageExplorerData(data) {
  const totals = data?.totals, repeated = data?.repeated_key_groups;
  if (!totals || !repeated || !Array.isArray(data.span_distribution) || !Array.isArray(data.records_per_key_distribution)) {
    throw new Error('Saved linkage aggregates are unavailable');
  }
  const all = countValue(totals.complete_keys), repeatedCount = countValue(repeated.groups);
  const completeRows = countValue(totals.complete_key_rows);
  if (!all || !repeatedCount || repeatedCount > all) throw new Error('Invalid linkage denominator');
  const spanBins = Object.fromEntries(data.span_distribution.map(row => [row.band, countValue(row.groups)]));
  if (Object.values(spanBins).reduce((sum, count) => sum + count, 0) !== repeatedCount) {
    throw new Error('Saved span bins do not sum to repeated combinations');
  }
  const span = [
    {id:'all', label:'Any span', count:repeatedCount, detail:'At least two stored records, regardless of the time between them.'},
    {id:'day1', label:'1+ day', count:countValue(repeated.span_ge_1day), detail:'First and last record timestamps are at least one day apart.'},
    {id:'day7', label:'7+ days', count:countValue(repeated.span_ge_7days), detail:'First and last record timestamps are at least seven days apart.'},
    {id:'day30', label:'30+ days', count:countValue(repeated.span_ge_30days), detail:'First and last record timestamps are at least 30 days apart.'},
    {id:'day90', label:'90+ days', count:countValue(repeated.span_ge_90days), detail:'First and last record timestamps are at least 90 days apart.'},
    {id:'day365', label:'365+ days', count:countValue(spanBins['365+ days']), detail:'First and last record timestamps are at least 365 days apart.'},
  ];
  const suffix = ['1–6 days', '7–29 days', '30–89 days', '90–364 days', '365+ days'];
  span.slice(1).forEach((preset, index) => {
    const sum = suffix.slice(index).reduce((total, band) => total + countValue(spanBins[band]), 0);
    if (preset.count !== sum) throw new Error('Saved threshold disagrees with span distribution');
  });
  if (repeated.dates3_span30 !== undefined) {
    const count = countValue(repeated.dates3_span30);
    if (count > repeated.span_ge_30days) throw new Error('Active-date count exceeds the 30-day subset');
    span.push({id:'dates3span30', label:'30+ days · 3+ dates', count,
      detail:'At least 30 days apart, with records on at least three UTC dates. This is a saved descriptive rule, not a validated longitudinal threshold.'});
  }
  const order = ['1', '2–5', '6–20', '21–100', '101+'];
  const source = new Map(data.records_per_key_distribution.map(row => [row.band, row]));
  const volume = order.map(band => {
    const row = source.get(band);
    if (!row) throw new Error('Saved record-count bin is missing');
    return {id:band, label:`${band} record${band === '1' ? '' : 's'}`, count:countValue(row.groups), rows:countValue(row.rows),
      detail:band === '1' ? 'One stored record has this complete metadata combination.' : `Each combination appears in ${band} stored records.`};
  });
  if (volume.reduce((sum, row) => sum + row.count, 0) !== all || volume.reduce((sum, row) => sum + row.rows, 0) !== completeRows) {
    throw new Error('Saved record-count bins do not sum to their denominators');
  }
  return {span, volume, denominators:{span:repeatedCount, volume:all}, completeRows};
}

function body(model, view, selected) {
  const items = model[view], denominator = model.denominators[view];
  const current = items.find(item => item.id === selected) || items[0];
  const isSpan = view === 'span';
  const denominatorLabel = isSpan ? 'combinations appearing in 2+ records' : 'complete IP/browser combinations';
  return `<div class="segmented linkage-explorer-tabs" role="group" aria-label="Aggregate view">
    ${[['span','Time span'],['volume','Record count']].map(([id,label]) => `<button type="button" data-linkage-view="${id}" aria-pressed="${view === id}" class="${view === id ? 'active' : ''}">${label}</button>`).join('')}
  </div>
  <p class="linkage-explorer-question">${isSpan ? 'How many repeated combinations remain at each time span?' : 'How many combinations fall in each record-count band?'}</p>
  <div class="linkage-explorer-options" role="group" aria-label="${isSpan ? 'Saved time-span thresholds' : 'Saved record-count bands'}">
    ${items.map(item => `<button type="button" class="linkage-preset ${item.id === current.id ? 'active' : ''}" data-linkage-preset="${esc(item.id)}" aria-pressed="${item.id === current.id}"><span>${esc(item.label)}</span><strong>${fmt(item.count)}</strong></button>`).join('')}
  </div>
  <div class="linkage-explorer-result" role="status" aria-live="polite" aria-atomic="true">
    <div><span class="eyebrow">${esc(current.label)}</span><div class="big-take">${fmt(current.count)} <span class="linkage-result-unit">combinations</span></div><p><strong>${esc(percent(current.count, denominator))}</strong> of ${fmt(denominator)} ${denominatorLabel}.</p></div>
    <div class="linkage-explorer-meter" aria-hidden="true"><span style="width:${current.count / denominator * 100}%"></span></div>
    <p class="linkage-explorer-detail">${esc(current.detail)}</p>
    ${isSpan ? '' : `<p class="linkage-explorer-detail">These combinations contain <strong>${fmt(current.rows)} records</strong> (${esc(percent(current.rows, model.completeRows))} of ${fmt(model.completeRows)} complete-metadata records).</p>`}
  </div>
  <div class="foot">${isSpan ? 'Thresholds overlap. A long span does not establish continuous use or the same person.' : 'Bands do not overlap. Counts refer to technical combinations, not people.'} <a href="data/public-hub/linkage.json" target="_blank" rel="noopener">Saved counts ↗</a></div>`;
}

export function linkageExplorer(data, options = {}) {
  const model = linkageExplorerData(data);
  const view = options.view === 'volume' ? 'volume' : 'span';
  const selected = options.selected || (view === 'span' ? 'day30' : '2–5');
  return `<section class="card linkage-explorer" data-linkage-explorer aria-label="Inspect cross-conversation aggregate counts"><div class="card-head"><h3>Time span & record count</h3><span class="chip">Saved counts only</span></div>${body(model, view, selected)}</section>`;
}

export function mountLinkageExplorer(container, data, {onChange} = {}) {
  if (!container || container.dataset.linkageMounted === 'true') return () => {};
  const model = linkageExplorerData(data);
  let view = container.querySelector('[data-linkage-view][aria-pressed="true"]')?.dataset.linkageView || 'span';
  const selected = {span:'day30', volume:'2–5'};
  selected[view] = container.querySelector('[data-linkage-preset][aria-pressed="true"]')?.dataset.linkagePreset || selected[view];
  const paint = focus => {
    const title = '<div class="card-head"><h3>Time span & record count</h3><span class="chip">Saved counts only</span></div>';
    container.innerHTML = title + body(model, view, selected[view]);
    onChange?.({view,selected:selected[view]});
    if (focus) container.querySelector(focus)?.focus({preventScroll:true});
  };
  const click = event => {
    const tab = event.target.closest('[data-linkage-view]');
    if (tab && container.contains(tab) && ['span','volume'].includes(tab.dataset.linkageView)) {
      view = tab.dataset.linkageView;
      paint(`[data-linkage-view="${view}"]`);
      return;
    }
    const preset = event.target.closest('[data-linkage-preset]');
    if (!preset || !container.contains(preset)) return;
    const id = preset.dataset.linkagePreset;
    if (!model[view].some(item => item.id === id)) return;
    selected[view] = id;
    paint('[data-linkage-preset][aria-pressed="true"]');
  };
  container.addEventListener('click', click);
  container.dataset.linkageMounted = 'true';
  return () => {container.removeEventListener('click', click);delete container.dataset.linkageMounted;};
}
