import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {auditMatches, BENCHMARK_ROUTES, REVIEW_STATES, SOURCE_CHECK_STATES, CONTEXTS} from '../website/relational-v2.js';
import {PERSONAL_TYPES, PERSONAL_DECISIONS, personalRows} from '../website/personal-review.js';

const root = new URL('../', import.meta.url);
const source = readFileSync(new URL('website/app.js', root), 'utf8');
const audit = JSON.parse(readFileSync(new URL('website/data/relational_v2.json', root), 'utf8'));
const packed = JSON.parse(readFileSync(new URL('website/data/records.json', root), 'utf8'));
const records = packed.rows.map(row => Object.fromEntries(packed.columns.map((key, i) => [key, row[i]])));
const blankFilters = {purpose:'', packaging:'', relational_mode:'', confidence:'', benchmark_route:'', review_status:'', source_check:'', context:'', earlier_only:''};
const metadataFilters = {language:'', year:'', family:'', template:'', depth:'', month:'', turnBand:'', flag:''};
const state = {auditFilters:{...blankFilters}, filters:{...metadataFilters}, auditPage:0, chartProbe:null, explorerTab:'length'};
const location = {hash:''};
const dictionary = field => Object.fromEntries([...new Set(audit.rows.map(row => row[field]))].map(key => [key, key]));
let back = 'overview?chart=purpose';
const context = vm.createContext({
  state, location, URLSearchParams,
  D:{audit, records},
  PURPOSE:dictionary('purpose'), PACK:dictionary('packaging'), REL:dictionary('relational_mode'),
  BENCHMARK_ROUTES, REVIEW_STATES, SOURCE_CHECK_STATES, CONTEXTS, PERSONAL_TYPES, PERSONAL_DECISIONS,
  personalRows, overviewOrigin:() => back, fmt:value => Number(value).toLocaleString('en-US'),
  filteredAudit:() => audit.rows.filter(row => auditMatches(row, state.auditFilters)),
});
const helper = source.slice(source.indexOf('function auditRecordURL('), source.indexOf('function auditTable('));
const restore = source.slice(source.indexOf('function restoreViewURL('), source.indexOf('async function copyView('));
assert.ok(helper.includes('state.auditFilters') && restore.includes('state.auditRecord'));
vm.runInContext(helper + '\n' + restore, context);
const run = code => vm.runInContext(code, context);
assert.ok(source.includes('href="${e(auditRecordURL(r.row_index))}"'), 'Rendered record-ID anchors must use the production snapshot helper');

let checks = 0;
for (const filters of [
  {relational_mode:'personal_help'},
  {relational_mode:'social_participation', packaging:'embedded_history'},
  {purpose:'text_work', confidence:'high'},
]) {
  state.auditFilters = {...blankFilters, ...filters};
  const selected = audit.rows.filter(row => auditMatches(row, state.auditFilters));
  assert.ok(selected.length > 15, 'Exercise a later results page');
  const position = Math.min(22, selected.length - 1), target = selected[position];
  state.auditPage = Math.floor(position / 15);
  const expectedPage = state.auditPage;
  const href = run(`auditRecordURL(${target.row_index})`);
  const query = new URLSearchParams(href.split('?')[1]);
  assert.equal(query.get('page'), String(expectedPage + 1));
  assert.equal(query.get('back'), back);
  for (const [key, value] of Object.entries(filters)) assert.equal(query.get(key), value);
  state.auditFilters = {...blankFilters};
  state.auditPage = 0;
  location.hash = href;
  run('restoreViewURL()');
  assert.equal(state.auditRecord, target.row_index, 'The clicked row remains the focus');
  assert.equal(state.auditPage, expectedPage, 'The row opens on its page within the filtered set');
  assert.equal(state.auditView, 'records');
  assert.deepEqual(Object.fromEntries(Object.entries(state.auditFilters).filter(([, value]) => value)), filters);
  assert.equal(audit.rows.filter(row => auditMatches(row, state.auditFilters)).length, selected.length, 'Record navigation must not widen the selection');
  checks++;
}
back = null;
state.auditFilters = {...blankFilters};
state.auditPage = 0;
assert.equal(new URLSearchParams(run('auditRecordURL(1062)').split('?')[1]).has('back'), false, 'No invented return origin');
checks++;

// CSV download is reachable only from Rows. Length → Rows adds a persistent
// English-scope probe; it does not expose the unscoped length population.
const selected = source.split('\n').find(line => line.startsWith('function selectedRecords('));
const selection = source.slice(source.indexOf('function validProbe('), source.indexOf('function exampleRail('));
vm.runInContext(selected + '\n' + selection, context);
assert.ok(source.slice(source.indexOf('function recordTable('), source.indexOf('function filteredAudit(')).includes('data-action="export-records"'));
assert.equal((source.match(/data-action="export-records"/g) || []).length, 1, 'CSV control is only rendered by the Rows table');
for (const language of ['', 'English', 'Russian']) {
  state.filters = {...metadataFilters, language};
  state.chartProbe = null;
  state.explorerTab = 'length';
  const shown = run('explorerRows().length');
  run("setExplorerTab('records')");
  assert.equal(run('probeRecords(selectedRecords()).length'), shown, 'Reachable CSV export matches the displayed length selection');
  checks++;
}
context.D.topics=JSON.parse(readFileSync(new URL('website/data/microsoft_topics.json',root),'utf8'));
context.D.validation=JSON.parse(readFileSync(new URL('website/data/validation.json',root),'utf8'));
context.flagMatch={};state.topicSelected={domain:'',intent:''};state.topicExpanded={domain:false,intent:false};
location.hash='#explorer?snapshot=1&view=topic&label=religion_and_philosophy';run('restoreViewURL()');
assert.equal(state.topicSelected.domain,'religion_and_philosophy');assert.equal(state.topicExpanded.domain,true,'An incoming lower-ranked label stays visible in the data browser');checks++;
console.log(`${checks} navigation/filter regressions passed: filtered record links, page/focus restoration and reachable CSV scope.`);
