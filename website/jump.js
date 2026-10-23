import {escape as e} from './charts.js?v=topicsOct21b';

// A local index of pages and the six saved examples. No remote search.
export function initJump({pages, examples, openExample}) {
  const dialog = document.querySelector('#jump-dialog');
  const input = dialog.querySelector('input');
  const results = dialog.querySelector('#jump-results');
  const items = [
    ...pages.map(([id, label]) => ({label, type:'Page', id, words:label})),
    ...examples.map(x => ({label:x.title, type:'Example', id:x.id, words:`${x.title} ${x.id} ${x.kind}`})),
  ];
  let selected = 0, matches = [];
  function paint() {
    const terms = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    matches = items.filter(x => terms.every(t => x.words.toLowerCase().includes(t)));
    selected = Math.min(selected, Math.max(0, matches.length - 1));
    results.innerHTML = matches.map((x,i) => `<div id="jump-option-${i}" role="option" aria-selected="${i===selected}" data-jump-index="${i}"><span>${e(x.label)}</span><small>${x.type}</small><span class="jump-enter" aria-hidden="true">↵</span></div>`).join('') || '<p class="jump-empty">No matching page or example.</p>';
    if(matches.length) input.setAttribute('aria-activedescendant', `jump-option-${selected}`);
    else input.removeAttribute('aria-activedescendant');
  }
  function choose(i) {
    const item=matches[i]; if(!item)return;
    dialog.close();
    if(item.type==='Example')openExample(item.id);
    else location.hash=item.id;
  }
  function open() {
    if(document.querySelector('dialog[open]'))return;
    input.value='';selected=0;paint();dialog.showModal();
    input.setAttribute('aria-expanded','true');input.focus();
  }
  document.querySelector('#quick-jump').addEventListener('click',open);
  dialog.querySelector('.jump-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>input.setAttribute('aria-expanded','false'));
  dialog.addEventListener('click',ev=>{if(ev.target===dialog){const r=dialog.getBoundingClientRect();if(ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom)dialog.close()}});
  input.addEventListener('input',()=>{selected=0;paint()});
  input.addEventListener('keydown',ev=>{
    if(ev.key==='ArrowDown'||ev.key==='ArrowUp'){
      ev.preventDefault(); if(!matches.length)return;
      selected=(selected+(ev.key==='ArrowDown'?1:-1)+matches.length)%matches.length;paint();
      results.querySelector('[aria-selected=true]')?.scrollIntoView({block:'nearest'});
    }else if(ev.key==='Enter'){ev.preventDefault();choose(selected)}
  });
  results.addEventListener('click',ev=>{const option=ev.target.closest('[data-jump-index]');if(option)choose(Number(option.dataset.jumpIndex))});
  document.addEventListener('keydown',ev=>{if((ev.metaKey||ev.ctrlKey)&&ev.key.toLowerCase()==='k'){ev.preventDefault();if(dialog.open)dialog.close();else open()}});
  const key=document.querySelector('#quick-jump kbd');key.textContent=/Mac|iPhone|iPad/.test(navigator.platform)?'⌘ K':'Ctrl K';
}
