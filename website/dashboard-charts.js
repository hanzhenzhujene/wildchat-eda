/** Compact dashboard visuals. No data inference or external dependencies. */
import {escape as e, fmt, pct, colors} from './charts.js?v=topicsOct21b';

const defaults = [colors.teal, '#8c999e', '#a6c9c2', '#446d66', '#c6d9d4', '#e2e9e7'];
const colorValue = (value, fallback) => typeof value === 'string' && /^(#[a-f\d]{3,8}|rgba?\([\d\s,.%]+\)|hsla?\([\d\s,.%]+\))$/i.test(value) ? value : fallback;
const entriesOf = entries => entries.map((entry, i) => {
  const item = Array.isArray(entry) ? {label: entry[0], count: entry[1], value: entry[0]} : entry;
  return {...item, label: String(item.label ?? ''), count: Math.max(0, Number(item.count) || 0), value: item.value ?? item.label, color: colorValue(item.color, defaults[i % defaults.length])};
});
const buttonAttrs = (item, action, prefix = /^(select-|open-(purpose|relational)$)/.test(action)?'Show':'Filter') => action ? `data-action="${e(action)}" data-value="${e(item.value)}" aria-label="${e(prefix)} ${e(item.label)}: ${fmt(item.count)}"` : '';
const countTable = (items, denominator, unit = 'Records') => `<details class="dashboard-counts" style="margin-top:9px;font-size:12px"><summary style="cursor:pointer">Exact counts</summary><table style="width:100%;margin-top:8px;font-size:12px"><thead><tr><th scope="col">Group</th><th scope="col">${e(unit)}</th><th scope="col">Share</th></tr></thead><tbody>${items.map(item => `<tr><th scope="row" style="font-weight:400;text-align:left">${e(item.label)}</th><td>${fmt(item.count)}</td><td>${pct(item.count, denominator)}</td></tr>`).join('')}</tbody><tfoot><tr><th scope="row" style="text-align:left">Denominator</th><td>${fmt(denominator)}</td><td>100%</td></tr></tfoot></table></details>`;
const scopeLine = (denominator, scope, unit) => scope===false?'':`<div class="dashboard-chart-scope" style="font-size:12px;line-height:1.5;color:#596b72;margin-bottom:9px">${e(scope || `${fmt(denominator)} ${unit.toLowerCase()}`)}${scope ? ` · n = ${fmt(denominator)}` : ''}</div>`;

/**
 * Segmented bar for mutually exclusive groups.
 * entries: [label,count][] OR {label,count,value?,color?}[]
 * options: denominator, title, scope, unit, action, palette, table, remainderLabel.
 * Buttons use the existing app's data-action/data-value delegation.
 * When counts exceed the denominator, show separate bars instead of a false stack.
 */
export function segmentedBar(entries, {
  denominator, title = 'Composition', scope = '', unit = 'Records', action = '',
  palette = defaults, table = true, remainderLabel = 'Not shown',
} = {}) {
  const items = entriesOf(entries).map((x, i) => ({...x, color: colorValue(entries[i]?.color, palette[i % palette.length] || x.color)}));
  const total = items.reduce((n, x) => n + x.count, 0);
  const d = denominator === undefined ? total : Math.max(0, Number(denominator) || 0);
  if (!d) return '<div class="chart-empty">No matching records.</div>';
  if (total > d) return `<div class="dashboard-chart-note" style="font-size:12px;margin-bottom:8px">Groups overlap; each share uses the same denominator.</div>${miniDistribution(items, {denominator:d,title,scope,unit,action,table})}`;
  const shown = total < d ? [...items, {label:remainderLabel,count:d-total,value:'',color:'#d9e1e3',remainder:true}] : items;
  return `<div class="dashboard-segmented" data-viz="stacked-bar" aria-label="${e(title)}">${scopeLine(d,scope,unit)}<div class="dashboard-segment-track" style="display:flex;width:100%;height:22px;gap:2px;border-radius:4px;overflow:hidden" role="group" aria-label="${e(title)}: ${fmt(d)} ${e(unit.toLowerCase())}">${shown.filter(x => x.count > 0).map(x => {
    const clickable = action && !x.remainder && x.interactive !== false;
    const tag = clickable ? 'button' : 'span';
    return `<${tag} ${clickable ? `type="button" ${buttonAttrs(x,action)}` : `role="img" aria-label="${e(x.label)}: ${fmt(x.count)} (${pct(x.count,d)})"`} title="${e(x.label)}: ${fmt(x.count)} (${pct(x.count,d)})" style="flex:${x.count} 1 0;min-width:0;border:0;padding:0;background:${x.color};${clickable?'cursor:pointer':''}"></${tag}>`;
  }).join('')}</div><div class="dashboard-segment-legend" style="display:grid;gap:6px;margin-top:11px">${shown.map(x => {
    const clickable = action && !x.remainder && x.interactive !== false, tag = clickable ? 'button' : 'div';
    return `<${tag} ${clickable ? `type="button" ${buttonAttrs(x,action)}` : ''} class="dashboard-legend-item" style="display:grid;grid-template-columns:8px minmax(0,1fr) auto;gap:8px;align-items:baseline;width:100%;text-align:left;border:0;background:transparent;padding:0;font:inherit;font-size:13px;line-height:1.35;color:inherit;${clickable?'cursor:pointer':''}"><span style="width:8px;height:8px;background:${x.color};border-radius:2px" aria-hidden="true"></span><span>${e(x.label)}</span><span style="font-variant-numeric:tabular-nums;white-space:nowrap">${fmt(x.count)} <span style="color:#66777d">(${pct(x.count,d)})</span></span></${tag}>`;
  }).join('')}</div>${table?countTable(shown,d,unit):''}</div>`;
}

/**
 * Horizontal distributions with HTML-sized text (not scaled SVG labels).
 * options: denominator, title, scope, unit, action, color, max, limit, percent,
 * table, mode ('bar' | 'dot'). No automatic 'Other' aggregation.
 * Percentage bars use the full denominator as their track; count-only bars use max.
 * An item with interactive:false is rendered as a non-clickable aggregate.
 * Values omitted by limit stay in the exact-count table.
 */
export function miniDistribution(entries, {
  denominator, title = 'Distribution', scope = '', unit = 'Records', action = '',
  color = colors.teal, max, limit = 10, percent = true, table = true, mode = 'bar',
} = {}) {
  const items = entriesOf(entries), d = denominator === undefined ? items.reduce((n,x)=>n+x.count,0) : Math.max(0,Number(denominator)||0);
  if (!items.length || !d) return '<div class="chart-empty">No matching records.</div>';
  const visible = items.slice(0,limit), domain = percent ? d : Math.max(Number(max)||0,...items.map(x=>x.count),1), fill=colorValue(color,colors.teal);
  return `<div class="dashboard-distribution" data-viz="ranked-bar" aria-label="${e(title)}">${scopeLine(d,scope,unit)}<div style="display:grid;gap:11px">${visible.map(x=>{
    const clickable=!!action && x.interactive !== false,tag=clickable?'button':'div',share=Math.min(100,x.count/domain*100),ownColor=entries.find(z=>!Array.isArray(z)&&String(z.label)===x.label)?.color,col=colorValue(ownColor,fill);
    return `<${tag} ${clickable?`type="button" ${buttonAttrs(x,action)}`:''} class="dashboard-distribution-row" style="display:block;width:100%;text-align:left;background:transparent;border:0;padding:0;color:inherit;font:inherit;${clickable?'cursor:pointer':''}"><span style="display:flex;justify-content:space-between;gap:12px;font-size:13px;line-height:1.35;margin-bottom:5px"><span style="min-width:0;overflow-wrap:anywhere">${e(x.label)}</span><span style="white-space:nowrap;font-variant-numeric:tabular-nums">${fmt(x.count)}${percent?` <span style="font-size:12px;color:#66777d">${pct(x.count,d)}</span>`:''}${clickable?'<span class="chart-row-arrow" aria-hidden="true">›</span>':''}</span></span><span aria-hidden="true" style="display:block;position:relative;height:${mode==='dot'?10:7}px;background:${mode==='dot'?'linear-gradient(transparent 4px,#e4ebed 4px,#e4ebed 6px,transparent 6px)':'#e9eff0'};border-radius:3px">${mode==='dot'?`<span style="position:absolute;left:calc(${share}% - ${share===0?0:share===100?10:5}px);top:0;width:10px;height:10px;border-radius:50%;background:${col}"></span>`:`<span style="display:block;width:${share}%;height:100%;border-radius:3px;background:${col}"></span>`}</span></${tag}>`;
  }).join('')}</div>${items.length>visible.length?`<p style="font-size:12px;color:#66777d;margin:9px 0 0">${visible.length} of ${items.length} groups shown.${table?' All groups are in the counts table.':''}</p>`:''}${table?countTable(items,d,unit):''}</div>`;
}

/**
 * One stored exchange, with metadata displayed as context (not a causal node).
 * {metadata: string | [{label,value}], request, suppliedContext?, reply,
 *  requestLabel?, replyLabel?, caption?}. Strings are always escaped.
 * No source quote or factual claim is inserted by this function.
 */
export function recordAnatomy({
  metadata = [], request = 'The active request', suppliedContext = '',
  reply = 'The stored model response', requestLabel = 'User message',
  replyLabel = 'Stored AI reply', caption = '',
} = {}) {
  const meta = Array.isArray(metadata) ? metadata.map(x=>`<span><span style="color:#66777d">${e(x.label)}</span> <strong style="font-weight:600">${e(x.value)}</strong></span>`).join('<span aria-hidden="true" style="color:#a5b1b5">·</span>') : e(metadata);
  return `<figure class="dashboard-record-anatomy" style="margin:0;min-width:0"><div class="anatomy-meta" style="display:flex;flex-wrap:wrap;gap:6px 10px;font-size:12px;line-height:1.5;margin-bottom:10px">${meta}</div><div class="anatomy-exchange" style="display:grid;grid-template-columns:minmax(0,1fr) 20px minmax(0,1fr);gap:8px;align-items:stretch"><div class="anatomy-message" style="min-width:0;border:1px solid #cbd6d3;border-top:3px solid ${colors.tealMuted};border-radius:5px;padding:10px;background:#f5f8f7"><div style="font-size:11px;font-weight:700;letter-spacing:.035em;color:#526c66;margin-bottom:7px">${e(requestLabel)}</div><div style="font-size:13px;line-height:1.5;overflow-wrap:anywhere">${e(request)}</div>${suppliedContext?`<div class="anatomy-supplied" style="font-size:12px;line-height:1.45;border:1px dashed #aebecb;border-radius:3px;padding:7px;margin-top:8px;color:#526777">${e(suppliedContext)}</div>`:''}</div><div aria-hidden="true" style="align-self:center;font-size:20px;color:#768a94;text-align:center">→</div><div class="anatomy-message" style="min-width:0;border:1px solid #c7ddda;border-top:3px solid ${colors.teal};border-radius:5px;padding:10px;background:#f5faf8"><div style="font-size:11px;font-weight:700;letter-spacing:.035em;color:#216f67;margin-bottom:7px">${e(replyLabel)}</div><div style="font-size:13px;line-height:1.5;overflow-wrap:anywhere">${e(reply)}</div></div></div>${caption?`<figcaption style="font-size:12px;line-height:1.45;color:#61747c;margin-top:9px">${e(caption)}</figcaption>`:''}</figure>`;
}
