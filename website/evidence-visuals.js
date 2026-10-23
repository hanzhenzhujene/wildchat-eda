/** Interactive evidence diagrams. Sizes encode structure, never sample proportions. */
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = value => Number(value).toLocaleString('en-US');
const arrow = (label = '', direction = 'down') => `<div class="ev-arrow ev-arrow-${direction}" aria-hidden="true">${label ? `<span>${escape(label)}</span>` : ''}<b>${direction === 'right' ? '→' : '↓'}</b></div>`;
const detail = (id, title, body, extra = '') => `<div class="ev-detail" id="${id}" data-ev-detail role="status" aria-live="polite"><strong>${escape(title)}</strong><p>${escape(body)}</p>${extra}</div>`;
const node = (id, count, label, tone = 'blue', active = false) => `<button type="button" class="ev-node ev-${tone}" data-ev-select="${id}" aria-pressed="${active}"><strong>${escape(count)}</strong><span>${escape(label)}</span></button>`;

const samplingDetails = {
  source: ['Dataset snapshot', 'WildChat-4.8M contains 3,199,860 public rows in this snapshot. The original paper described an earlier, one-million-conversation release.'],
  sample: ['20,000 profiled records', '200 index sections × one seeded, consecutive 100-row block each. Counts describe this block sample, not all AI users.'],
  random: ['120 records, final inputs', 'Randomly drawn from the 20,000 records, without a language or keyword filter. AI reviewers labeled one final input per record (including empty or unclear inputs); 20 records received a second AI review. These are AI labels, without human validation.'],
  english: ['10,636 English-labeled records', 'This separate retrieval check starts with the sample’s English source-language label. Labels are automatic; a record may contain several languages.'],
  hits: ['1,747 keyword hits', 'A rule searched for relationship, first-person and help markers. A hit is a candidate, not a confirmed relational case.'],
  nonhits: ['8,889 non-hits', 'These English-labeled records did not match the keyword rule. Non-matches can still contain relational material.'],
  reviewedHits: ['80 AI-labeled hits', 'A random selection from the 1,747 hits, labeled by AI. This audit checks what the rule retrieves; it is separate from the 120-record content audit.'],
  reviewedNonhits: ['40 AI-labeled non-hits', 'A separate sample of non-matches checks what the rule may miss. These small, AI-reviewed groups do not establish validated recall or topic prevalence.'],
  examples: ['Six selected examples', 'Three selected from the 120-record audit, two from the 80-hit audit, and one from targeted search. These six are handpicked illustrations, not a random sample.'],
};

const samplingLinks={sample:['#explorer?snapshot=1&view=composition','View record metadata'],random:['#methods?source=pilot','Earlier labels & methods'],english:['#explorer?snapshot=1&language=English&view=composition','View English records'],hits:['#explorer?snapshot=1&language=English&flag=keyword&view=quality','View keyword hits'],nonhits:['#fit','See retrieval results'],reviewedHits:['#fit','See retrieval results'],reviewedNonhits:['#fit','See retrieval results'],examples:['#methods?source=examples','See how examples were selected']};
const samplingExtra=key=>samplingLinks[key]?`<a class="ev-inline-link" href="${samplingLinks[key][0]}">${samplingLinks[key][1]} →</a>`:'';
export function samplingMap(meta = {}) {
  const sourceRows = meta.source?.num_rows ?? 3199860;
  const sampleRows = meta.sampling?.actual_rows ?? 20000;
  return `<section class="ev-visual ev-sampling" data-viz="provenance" data-ev-diagram="sampling" aria-label="Sampling paths and separate evidence sets">
    <header class="ev-head"><h2>Earlier audits within the original sample</h2><span>Select a step</span></header>
    <div class="ev-origin">${node('source', number(sourceRows), 'public source rows')}${arrow('Block sample', 'right')}${node('sample', number(sampleRows), 'profiled records', 'blue', true)}</div>
    <div class="ev-fork" aria-label="The 20,000-row sample branches into two separate analyses"><i class="ev-fork-trunk"></i><i class="ev-fork-bridge"></i><i class="ev-fork-left"></i><i class="ev-fork-right"></i><span>Separate analyses</span></div>
    <div class="ev-branches">
      <div class="ev-branch ev-random"><span class="ev-route-label">Earlier content pilot</span>${arrow('Random selection')}${node('random', '120', 'records AI-labeled', 'amber')}<span class="ev-branch-note">No keyword or language filter</span></div>
      <div class="ev-branch ev-search"><span class="ev-route-label">Retrieval check</span>${arrow('English source label')}${node('english', '10,636', 'English-labeled records')}
        <div class="ev-retrieval-split"><div>${arrow('Keyword rule')}${node('hits', '1,747', 'hits')}${arrow('Sample for review')}${node('reviewedHits', '80', 'AI-labeled hits', 'amber')}</div><div>${arrow('No match')}${node('nonhits', '8,889', 'non-hits')}${arrow('Sample for review')}${node('reviewedNonhits', '40', 'AI-labeled non-hits', 'amber')}</div></div>
      </div>
    </div>
    <div class="ev-independent">${node('examples', '6', 'selected examples', 'neutral')}<span>3 content-audit + 2 hit-audit + 1 targeted<br><small>Handpicked illustrations; not category frequencies.</small></span></div>
    ${detail('sampling-detail', ...samplingDetails.sample, samplingExtra('sample'))}
    <p class="ev-footnote">Boxes show paths, not proportional sizes. Labels come from AI; no human validation is recorded.</p>
  </section>`;
}

const evidenceRows = [
  {key:'account', label:'User’s account', state:'Text recorded', tone:'blue', column:1, title:'What the user says', body:'The request may describe a conflict or include pasted material. The events and the other person’s perspective are not independently verified.', example:286012, link:'Read the client-message example'},
  {key:'reply', label:'AI’s reply', state:'Text recorded', tone:'teal', column:1, title:'What the model wrote', body:'The record stores the model’s reply. Its presence does not establish that the reply is correct.', example:2632268, link:'Read the group-reply example'},
  {key:'other', label:'Other person’s account', state:'Not verified', tone:'neutral', column:3, title:'An account is not independent confirmation', body:'A user may quote another person, but this export does not verify their identity or account.'},
  {key:'action', label:'Action after the chat', state:'Not measured', tone:'neutral', column:3, title:'Whether the advice was followed', body:'These data do not establish what the user did after the conversation.'},
  {key:'outcome', label:'Relationship outcome', state:'Not measured', tone:'neutral', column:3, title:'Whether the relationship improved', body:'The record does not track changes in the relationship after the chat.'},
];
const evidenceExtra = row => row.example ? `<button type="button" class="ev-inline-link" data-action="open-case" data-id="${row.example}">${escape(row.link)} <span aria-hidden="true">↗</span></button>` : '';

export function evidenceMatrix() {
  return `<section class="ev-visual ev-evidence" data-viz="evidence-matrix" data-ev-diagram="evidence" aria-label="What this dataset can and cannot establish">
    <header class="ev-head"><h2>What the evidence supports</h2><span>Select an evidence type</span></header>
    <div class="ev-status-head"><span>Evidence</span><span>Status in this EDA</span></div>
    <div class="ev-status-list">${evidenceRows.map((row,i)=>`<button type="button" class="ev-status-row ev-${row.tone}" data-ev-select="${row.key}" aria-label="${escape(row.label)}: ${row.state}" aria-pressed="${i===0}"><span>${escape(row.label)}</span><strong class="ev-status-tag">${escape(row.state)}</strong><span aria-hidden="true">→</span></button>`).join('')}</div>
    ${detail('evidence-detail', evidenceRows[0].title, evidenceRows[0].body, evidenceExtra(evidenceRows[0]))}
  </section>`;
}

const reviewSteps = [
  {id:'prepare', label:'Prepare cases', owner:'Data preparation', title:'Prepare the material', body:'Select about 10 contrasting examples with the request, context and reply. Keep the source and missing evidence visible.'},
  {id:'review', label:'Check which concepts apply', owner:'Domain expertise', title:'Which concepts apply to AI replies?', body:'Review which relational concepts apply to an AI reply and what evidence would support a judgment.'},
  {id:'revise', label:'Refine selection', owner:'Data preparation', title:'Refine the selection rules', body:'Use the reasons for inclusion and exclusion to improve retrieval. A small review clarifies the target; it does not validate the final rubric.'},
];

export function reviewSwimlane() {
  return `<section class="ev-visual ev-review" data-viz="swimlane" data-ev-diagram="review" aria-label="Case preparation and conceptual review">

    <div class="ev-swimlane">
      <div class="ev-lane-label ev-blue">Data preparation</div><div class="ev-lane-step ev-step-prepare">${node('prepare', '1', 'Prepare cases', 'blue', true)}</div><div class="ev-lane-blank"></div><div class="ev-lane-step ev-step-revise">${node('revise', '3', 'Refine selection')}</div>
      <div class="ev-lane-label ev-amber">Domain expertise</div><div class="ev-lane-blank"></div><div class="ev-lane-step ev-step-review">${node('review', '2', 'Check which concepts apply', 'amber')}</div><div class="ev-lane-blank"></div>
      <svg class="ev-swim-arrows" aria-hidden="true"><path data-review-arrow="1"/><path data-review-arrow="2"/></svg>
    </div>
    <div class="ev-review-mobile">${reviewSteps.map((step, i) => `${i ? arrow() : ''}<div class="ev-mobile-step"><span class="ev-route-label">${escape(step.owner)}</span>${node(step.id, String(i + 1), step.label, i === 1 ? 'amber' : 'blue', i === 0)}</div>`).join('')}</div>
    ${detail('review-detail', reviewSteps[0].title, reviewSteps[0].body)}
  </section>`;
}

let swimObserver;
function alignReviewArrows(lane) {
  const box=lane.getBoundingClientRect();
  if(!box.width)return;
  const svg=lane.querySelector('.ev-swim-arrows');
  svg.setAttribute('viewBox',`0 0 ${box.width} ${box.height}`);
  for(const [i,from,to] of [[1,'prepare','review'],[2,'review','revise']]) {
    const a=lane.querySelector(`.ev-step-${from}`).getBoundingClientRect();
    const b=lane.querySelector(`.ev-step-${to}`).getBoundingClientRect();
    const x1=a.right-box.left,y1=a.top+a.height/2-box.top;
    const x2=b.left-box.left-3,y2=b.top+b.height/2-box.top,mid=(x1+x2)/2;
    svg.querySelector(`[data-review-arrow="${i}"]`).setAttribute('d',`M ${x1} ${y1} H ${mid} V ${y2} H ${x2} M ${x2-6} ${y2-4} L ${x2} ${y2} L ${x2-6} ${y2+4}`);
  }
}
export function mountEvidenceInteractions(root = document) {
  swimObserver?.disconnect();
  const lane=root.querySelector('.ev-swimlane');
  if(lane){alignReviewArrows(lane);swimObserver=new ResizeObserver(()=>alignReviewArrows(lane));swimObserver.observe(lane);}
  root.querySelectorAll('[data-ev-diagram]').forEach(diagram => {
    if (diagram.dataset.evMounted) return;
    diagram.dataset.evMounted = 'true';
    const detailPanel = diagram.querySelector('[data-ev-detail]');
    diagram.querySelectorAll('[data-ev-select]').forEach(button => button.setAttribute('aria-controls', detailPanel.id));
    diagram.addEventListener('click', event => {
      const button = event.target.closest('button[data-ev-select]');
      if (!button || !diagram.contains(button)) return;
      const key = button.dataset.evSelect;
      let content;
      if (diagram.dataset.evDiagram === 'sampling') content = [...samplingDetails[key],samplingExtra(key)];
      if (diagram.dataset.evDiagram === 'evidence') {
        const row = evidenceRows.find(item => item.key === key);
        if (row) content = [row.title, row.body, evidenceExtra(row)];
      }
      if (diagram.dataset.evDiagram === 'review') {
        const step = reviewSteps.find(item => item.id === key);
        if (step) content = [step.title, step.body];
      }
      if (!content) return;
      diagram.querySelectorAll('[data-ev-select]').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.evSelect === key)));
      const panel = diagram.querySelector('[data-ev-detail]');
      panel.innerHTML = `<strong>${escape(content[0])}</strong><p>${escape(content[1])}</p>${content[2] || ''}`;
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && panel.animate) {
        panel.animate([{opacity:.45, transform:'translateY(3px)'},{opacity:1, transform:'translateY(0)'}], {duration:180,easing:'ease-out'});
      }
    });
  });
}
