// Message boundaries come only from the stored array, never from role-like text.
const escape = value => String(value ?? '').replace(/[&<>"'\r]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','\r':'&#13;'}[c]));
let records = new Map();

export function setSourceTexts(payload) {
  if (!Array.isArray(payload?.records)) throw new TypeError('Source text payload must contain a records array.');
  const next = new Map();
  for (const record of payload.records) {
    if (record?.row_index === undefined || record.row_index === null || !Array.isArray(record.messages)) throw new TypeError('Each source record needs a row_index and messages array.');
    const key = String(record.row_index);
    if (next.has(key)) throw new Error(`Duplicate source record: ${key}`);
    next.set(key, record);
  }
  records = next;
}

export function getSourceRecord(id) { return records.get(String(id)) ?? null; }

const unavailable = message => `<p class="source-unavailable">${escape(message)}</p>`;
const sourceUnavailable = () => unavailable('Original source text is unavailable for this record.');
const isIndex = (index, messages) => Number.isInteger(index) && index >= 0 && index < messages.length;
const isRedacted = record => Array.isArray(record.redactions) && record.redactions.length > 0;
const provenance = record => `<p class="source-provenance">${isRedacted(record) ? 'Source text · identifiers hidden' : 'Original dataset text'}${record.source_redacted ? '<span>Redactions already present in the dataset are retained.</span>' : ''}</p>`;

function selectedMessages(record, options) {
  const messages = record.messages;
  const users = messages.flatMap((message, index) => message?.role === 'user' ? [index] : []);
  let userIndex;
  if (options.userIndex !== undefined) userIndex = options.userIndex;
  else if (options.turn !== undefined) userIndex = Number.isInteger(options.turn) && options.turn > 0 ? users[options.turn - 1] : undefined;
  else userIndex = users.at(-1);
  if (!isIndex(userIndex, messages) || messages[userIndex]?.role !== 'user') return {};
  const nextUser = users.find(index => index > userIndex) ?? messages.length;
  let replyIndex = options.replyIndex;
  if (replyIndex === undefined) {
    replyIndex = messages.findIndex((message, index) => index > userIndex && index < nextUser && message?.role === 'assistant');
  }
  if (!isIndex(replyIndex, messages) || replyIndex <= userIndex || replyIndex >= nextUser || messages[replyIndex]?.role !== 'assistant') replyIndex = undefined;
  return {userIndex, replyIndex};
}

function textPreview(content, limit) {
  let prefix = '', count = 0;
  for (const character of content) {
    if (count === limit) return {prefix, truncated: true};
    prefix += character;
    count++;
  }
  return {prefix, truncated: false};
}

function messageBody(message, kind, limit) {
  if (typeof message?.content !== 'string') return unavailable(`The stored ${kind} text is unavailable.`);
  const {prefix, truncated} = textPreview(message.content, limit);
  const full = `<div class="source-text" data-source-content="full" dir="auto">${escape(message.content)}</div>`;
  if (!truncated) return full + (message.content === '' ? '<p class="source-empty">This stored message is empty.</p>' : '');
  return `<details class="source-expand"><summary><span class="source-prefix"><span class="source-text" data-source-content="preview" dir="auto">${escape(prefix)}</span><span class="source-ellipsis" aria-hidden="true">…</span></span><span class="source-expand-label">Show full ${kind}</span><span class="source-collapse-label">Collapse ${kind}</span></summary>${full}</details>`;
}

// Preview and pair markup deliberately have no IDs, so repeated cards cannot collide.
export function sourcePair(id, options = {}) {
  const record = getSourceRecord(id);
  if (!record) return sourceUnavailable();
  const {userIndex, replyIndex} = selectedMessages(record, options);
  const limit = Number.isFinite(options.limit) ? Math.max(1, Math.floor(options.limit)) : 320;
  const label = isRedacted(record) ? 'source text' : 'original text';
  const question = userIndex === undefined ? unavailable('No matching stored user question is available.') : messageBody(record.messages[userIndex], 'question', limit);
  const response = replyIndex === undefined ? unavailable('No stored response is available for this question.') : messageBody(record.messages[replyIndex], 'response', limit);
  return `<section class="source-pair" data-source-row="${escape(record.row_index)}">${provenance(record)}<div class="source-pair-messages"><div class="source-message source-question"><div class="source-message-label">Question · ${label}${userIndex === undefined ? '' : `<span>Stored message ${userIndex + 1}</span>`}</div>${question}</div><div class="source-message source-response"><div class="source-message-label">Response · ${label}${replyIndex === undefined ? '' : `<span>Stored message ${replyIndex + 1}</span>`}</div>${response}</div></div></section>`;
}

// Explicit IDs are reserved for the one main case, whose existing navigation uses them.
export function sourceConversation(id, {id: contextId, turnIds = false} = {}) {
  const record = getSourceRecord(id);
  if (!record) return sourceUnavailable();
  let turn = 0;
  const messages = record.messages.map((message, index) => {
    if (message?.role === 'user') turn++;
    const anchor = turnIds && message?.role === 'user' ? ` id="turn-${turn}" tabindex="-1"` : '';
    const text = typeof message?.content === 'string' ? `<div class="source-text" data-source-content="full" dir="auto">${escape(message.content)}</div>${message.content === '' ? '<p class="source-empty">This stored message is empty.</p>' : ''}` : unavailable('This stored message text is unavailable.');
    return `<section class="source-context-message" data-source-message-index="${index}"${anchor}><div class="source-message-label">Stored message ${index + 1} · ${escape(message?.role ?? 'role unavailable')}</div>${text}</section>`;
  }).join('');
  return `<details class="source-conversation"${contextId ? ` id="${escape(contextId)}"` : ''}><summary>Show full context · ${record.messages.length} stored message${record.messages.length === 1 ? '' : 's'}</summary><div class="source-context-body">${provenance(record)}<p class="source-context-note">Messages appear in their stored order. Any dialogue pasted inside a message remains part of that message.</p>${messages || unavailable('This record contains no stored messages.')}</div></details>`;
}

export function sourcePreview(id, options = {}) {
  if (!getSourceRecord(id)) return sourceUnavailable();
  return `<div class="source-preview">${sourcePair(id, options)}${options.context === false ? '' : sourceConversation(id, {id: options.contextId, turnIds: options.turnIds})}</div>`;
}
