import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {withHubReturn,readHubReturn,validHubReturn,hubReturnHref,hubReturnLabel} from '../website/hub-navigation.js';
const fragments=[
 'overview','content',
 'distributions?chart=domain&label=religion_and_philosophy&all=1',
 'distributions?chart=language&scope=original&compare=1',
 'linkage?view=span&selection=dates3span30',
];
for(const fragment of fragments){
 const linked=withHubReturn('atlas.html#explorer?snapshot=1&view=topic&label=gaming','#'+fragment);
 const u=new URL(linked,'https://example.test/');
 assert.equal(readHubReturn(u.search),fragment);
 assert.equal(u.hash,'#explorer?snapshot=1&view=topic&label=gaming');
 assert.equal(hubReturnHref(readHubReturn(u.search)),'./#'+fragment);
 assert.equal(withHubReturn(linked,fragment),linked,'Rewiring must not duplicate or alter the target');
}
for(const invalid of ['https://evil.test/','//evil.test/','javascript:alert(1)','not-a-page','overview\n',null])assert.equal(validHubReturn(invalid),null);
assert.equal(hubReturnHref('https://evil.test/'),'./#overview');
assert.equal(withHubReturn('https://example.test/data',fragments[1]),'https://example.test/data');
assert.equal(hubReturnLabel(fragments[2]),'topic chart');
assert.equal(hubReturnLabel(fragments[3]),'language chart');
const source=fs.readFileSync(new URL('../website/hub.js',import.meta.url),'utf8');
const topics=JSON.parse(fs.readFileSync(new URL('../website/data/microsoft_topics.json',import.meta.url)));
const readRoute=source.split('\n').find(line=>line.startsWith('function readRoute()'));
const writeState=source.split('\n').find(line=>line.startsWith('function writeDistributionState()'));
assert.ok(readRoute&&writeState);
const state={distribution:'domain',scope:'census',compare:false,label:'',allLabels:false};
const location={hash:'#distributions?chart=domain&label=religion_and_philosophy'};
const context=vm.createContext({state,location,URLSearchParams,D:{topics,figures:[]},pages:[['distributions'],['figures'],['content']],route:'overview',history:{replaceState:(_,__,hash)=>{location.hash=hash;}}});
vm.runInContext(readRoute+'\n'+writeState,context);
vm.runInContext('readRoute()',context);
assert.equal(state.label,'religion_and_philosophy');
assert.equal(state.allLabels,true,'A selected label outside the top 12 must stay visible after reload');
vm.runInContext('writeDistributionState()',context);
assert.ok(location.hash.includes('all=1'));
state.allLabels=false;vm.runInContext('readRoute()',context);assert.equal(state.allLabels,true);
location.hash='#distributions?chart=language&scope=random&compare=1';vm.runInContext('readRoute()',context);
assert.equal(state.scope,'random');assert.equal(state.compare,true);assert.equal(state.allLabels,false);
location.hash='#distributions?chart=intent&label=text_generation';vm.runInContext('readRoute()',context);
assert.equal(state.scope,'census');assert.equal(state.compare,false);
location.hash='#content?dimension=packaging_counts';vm.runInContext('readRoute()',context);assert.equal(state.content,'packaging_counts');
location.hash='#content';vm.runInContext('readRoute()',context);assert.equal(state.content,'relational_mode_counts');
console.log('Hub navigation: safe return links, scope round-trips and lower-ranked selected labels pass.');
