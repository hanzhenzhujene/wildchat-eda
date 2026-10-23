/** Inline topic/task definitions and selected original-source exchanges.
 * This module reads saved labels only. It never runs a model or treats selected
 * illustrations as a probability sample. No source file is fetched on import.
 */
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = value => Number(value).toLocaleString('en-US');
const normalizeKind = kind => kind === 'topic' ? 'domain' : kind === 'task' ? 'intent' : kind;
const safeIndex = value => Number.isSafeInteger(Number(value)) && Number(value) >= 0;
const selectionKey = (kind, id) => `${normalizeKind(kind)}:${id}`;
const preview = (text, max = 240) => {
  const chars = Array.from(String(text));
  return {text:chars.slice(0,max).join(''), clipped:chars.length > max};
};

/** Attributes for a native <button type="button"> used as a chart bar. */
export function chartLabelAttributes(kind, labelId) {
  kind = normalizeKind(kind);
  if (!['domain','intent'].includes(kind)) throw new TypeError('Chart kind must be domain or intent.');
  return `data-chart-kind="${kind}" data-chart-label="${escapeHTML(labelId)}" aria-pressed="false"`;
}

/** Pure source resolution. Passing a source registry never fetches or rewrites text. */
export function resolveChartSelection(topics, kind, labelId, sourceRegistry = new Map()) {
  kind = normalizeKind(kind);
  const rows = kind === 'domain' ? topics?.domains : kind === 'intent' ? topics?.intents : [];
  const label = rows?.find(row => row.id === labelId);
  if (!label) return null;
  const example = topics.examples?.find(row => row.kind === kind && row.id === labelId) ?? null;
  const record = example ? sourceRegistry.get(Number(example.row_index)) ?? null : null;
  const question = record?.messages?.[Number(example?.user_message_index)];
  const response = record?.messages?.[Number(example?.reply_message_index)];
  const validPair = question?.role === 'user' && response?.role === 'assistant' && typeof question.content === 'string' && typeof response.content === 'string';
  const denominator = Number(topics.scope?.denominator ?? topics.scope?.rows ?? 0);
  return {kind,labelId,label,denominator,example,record,question:validPair ? question.content : null,response:validPair ? response.content : null};
}

function messageHTML(title, content, messageIndex, role) {
  const p = preview(content);
  return `<div class="chart-detail-message ${role === 'assistant' ? 'ai' : ''}"><h4>${title} <span>Original dataset text${p.clipped ? ' · excerpt' : ''}</span></h4><p class="chart-detail-quote">${escapeHTML(p.text)}${p.clipped ? '…' : ''}</p>${p.clipped ? `<details><summary>Read full ${role === 'assistant' ? 'response' : 'request'}</summary><div class="chart-detail-full">${escapeHTML(content)}</div></details>` : ''}</div>`;
}

/**
 * Usage:
 * const details = createChartDetailController({topics});
 * html += '<div data-chart-detail>'+details.renderHTML('domain', id)+'</div>';
 * details.bind(main, {onSelect:({kind,labelId}) => updateHash(kind,labelId)});
 * await details.load('domain', id); // optional for a label from a shared URL
 *
 * bind is idempotent for the same container and returns a cleanup function.
 */
export function createChartDetailController({topics, fetchImpl = globalThis.fetch?.bind(globalThis), dataBase = 'data/', atlasBase = 'atlas.html'} = {}) {
  if (!topics) throw new TypeError('Saved topic/task metadata is required.');
  const records = new Map(), requests = new Map(), errors = new Map(), bindings = new WeakMap();
  let selected = null;
  const path = name => `${dataBase.replace(/\/?$/, '/')}${name}`;
  const atlasURL = s => `${atlasBase}#explorer?snapshot=1&view=${s.kind === 'domain' ? 'topic' : 'task'}&label=${encodeURIComponent(s.labelId)}`;
  async function readSource(name) {
    if (requests.has(name)) return requests.get(name);
    const pending = (async () => {
      if (typeof fetchImpl !== 'function') throw new Error('Data loading is unavailable.');
      const response = await fetchImpl(path(name));
      if (!response.ok) throw new Error('Original text could not load.');
      const payload = await response.json();
      if (!Array.isArray(payload.records)) throw new Error('Original text file has an unexpected format.');
      for (const record of payload.records) {
        if (safeIndex(record.row_index) && Array.isArray(record.messages)) records.set(Number(record.row_index), record);
      }
      return payload;
    })();
    requests.set(name,pending);
    try { return await pending; } catch (err) { requests.delete(name); throw err; }
  }
  function get(kind, labelId) { return resolveChartSelection(topics,kind,labelId,records); }
  async function load(kind, labelId) {
    kind = normalizeKind(kind);
    const s = get(kind,labelId);
    if (!s) return null;
    selected = {kind,labelId}; errors.delete(selectionKey(kind,labelId));
    if (!s.example || s.question !== null) return s;
    try {
      await readSource('topic_source_texts.json');
      if (!records.has(Number(s.example.row_index))) await readSource('source_texts.json');
      const resolved = get(kind,labelId);
      if (resolved.question === null) throw new Error('No original request-response pair is available for this label.');
      return resolved;
    } catch (err) { errors.set(selectionKey(kind,labelId),err.message); throw err; }
  }
  function renderHTML(kind = selected?.kind, labelId = selected?.labelId) {
    const s = get(kind,labelId);
    if (!s) return '<div class="chart-detail-empty"><span aria-hidden="true">↖</span> Select a bar to see its definition and an original exchange.</div>';
    const share = s.denominator > 0 ? 100 * s.label.count / s.denominator : 0;
    const shareText = share > 0 && share < .1 ? '<0.1%' : `${share.toFixed(1)}%`;
    const header = `<div class="chart-detail-heading"><div><span class="chart-detail-kind">${s.kind === 'domain' ? 'Topic' : 'Task'} · Microsoft AI label</span><h3>${escapeHTML(s.label.label)}</h3></div><div class="chart-detail-stat"><strong>${escapeHTML(shareText)}</strong><span>${number(s.label.count)} / ${number(s.denominator)} records</span></div></div><p class="chart-detail-definition">${escapeHTML(s.label.definition || 'No definition was released for this label.')}</p>`;
    let body;
    const failure = errors.get(selectionKey(kind,labelId));
    if (!s.example) body = '<p class="chart-detail-note">No original example is published for this label.</p>';
    else if (failure) body = `<p class="chart-detail-error" role="status">${escapeHTML(failure)} <button type="button" data-chart-retry="true" data-chart-kind="${s.kind}" data-chart-label="${escapeHTML(s.labelId)}">Try again</button></p><a class="card-link" href="${escapeHTML(atlasURL(s))}">Open the label in the data browser →</a>`;
    else if (s.question === null) body = '<p class="chart-detail-loading" role="status">Loading original request and response…</p>';
    else {
      const record = s.record;
      const changed = Boolean(record.source_redacted || record.redactions?.length || record.source_text_sha256 && record.display_text_sha256 && record.source_text_sha256 !== record.display_text_sha256);
      const textStatus = changed ? 'Dataset text with marked redactions.' : 'Original dataset text, unchanged.';
      body = `<div class="chart-detail-example-title"><strong>One selected exchange</strong><span>Deliberately chosen; not a random sample.</span></div><div class="chart-detail-exchange">${messageHTML('User request',s.question,s.example.user_message_index,'user')}<div class="chart-detail-arrow" aria-hidden="true">↓</div>${messageHTML('Recorded AI response',s.response,s.example.reply_message_index,'assistant')}</div><div class="chart-detail-source"><span>Record ${s.example.row_index} · ${escapeHTML(record.source_language || 'Language not recorded')} · ${escapeHTML(record.model || 'Model not recorded')}</span><span>${textStatus} Recorded output; not a reference answer.</span></div><a class="card-link" href="${escapeHTML(atlasURL(s))}">Open example in the data browser →</a>`;
    }
    return `<section class="chart-detail-panel" aria-label="Selected ${s.kind === 'domain' ? 'topic' : 'task'}" aria-live="polite"><button type="button" class="chart-detail-back plain-button" data-hub-action="back-to-chart">↑ Categories</button>${header}${body}<p class="chart-detail-note">Labels describe whole records. This selected exchange illustrates the label; it does not validate its accuracy or represent every matching record.</p></section>`;
  }
  function bind(container,{targetSelector = '[data-chart-detail]',onSelect} = {}) {
    if (!container?.addEventListener) throw new TypeError('A DOM container is required.');
    const existing = bindings.get(container);
    if (existing) { existing.options = {targetSelector,onSelect}; existing.sync(); return existing.cleanup; }
    const binding = {options:{targetSelector,onSelect},token:0};
    function sync() {
      for (const control of container.querySelectorAll('[data-chart-kind][data-chart-label]:not([data-chart-retry])')) {
        const active = Boolean(selected && normalizeKind(control.dataset.chartKind) === selected.kind && control.dataset.chartLabel === selected.labelId);
        control.setAttribute('aria-pressed',String(active));control.classList.toggle('selected',active);
      }
    }
    async function onClick(event) {
      const control = event.target?.closest?.('[data-chart-kind][data-chart-label]');
      if (!control || !container.contains(control)) return;
      const kind = normalizeKind(control.dataset.chartKind), labelId = control.dataset.chartLabel;
      if (!get(kind,labelId)) return;
      event.preventDefault();
      selected = {kind,labelId}; const token = ++binding.token; sync();
      const target = () => container.querySelector(binding.options.targetSelector);
      if (target()) target().innerHTML = renderHTML(kind,labelId);
      binding.options.onSelect?.({kind,labelId});
      try { await load(kind,labelId); } catch (_) { /* Render the explicit loading error. */ }
      if (token !== binding.token || selected?.kind !== kind || selected?.labelId !== labelId) return;
      if (target()) target().innerHTML = renderHTML(kind,labelId);
      sync();
    }
    binding.sync = sync;
    binding.cleanup = () => { container.removeEventListener('click',onClick); binding.token++; bindings.delete(container); };
    bindings.set(container,binding);container.addEventListener('click',onClick);sync();
    return binding.cleanup;
  }
  return {renderHTML,load,bind,clearSelection:()=>{selected=null;},getSelection:() => selected ? {...selected} : null};
}
