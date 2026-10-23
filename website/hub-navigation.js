// Carry a local hub view across a visit to the separate data browser.
const pages=new Set(['overview','distributions','content','linkage','figures','datasets','sources']);
export function validHubReturn(value){
 if(typeof value!=='string'||value.length>4096||/[\u0000-\u001f\u007f]/.test(value))return null;
 const fragment=value.replace(/^#/,'');
 return pages.has(fragment.split('?')[0])?fragment:null;
}
export function withHubReturn(href,fragment){
 const target=validHubReturn(fragment);
 const match=String(href).match(/^(\/?atlas\.html)(?:\?([^#]*))?(#.*)?$/);
 if(!target||!match)return href;
 const query=new URLSearchParams(match[2]||'');query.set('hub',target);
 return `${match[1]}?${query}${match[3]||''}`;
}
export function readHubReturn(search){return validHubReturn(new URLSearchParams(search).get('hub'));}
export function hubReturnHref(fragment){return './#'+(validHubReturn(fragment)||'overview');}
export function hubReturnLabel(fragment){
 const value=validHubReturn(fragment);if(!value)return 'EDA hub';
 const [page,query='']=value.split('?'),p=new URLSearchParams(query);
 if(page==='distributions')return ({domain:'topic chart',intent:'task chart',language:'language chart',model_family:'model chart',turn_bucket:'turn-count chart',month:'date chart',length:'length chart',sampling:'sample comparison'})[p.get('chart')]||'distributions';
 return ({overview:'EDA overview',content:'request categories',linkage:'cross-conversation counts',figures:'chart library',datasets:'dataset comparison',sources:'hub methods'})[page];
}
