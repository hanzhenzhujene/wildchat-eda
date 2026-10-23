import {exampleTitle} from './example-names.js?v=topicsOct21b';
// Questions and methods are candidates; observations come from saved source checks.
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export const fitDirections=[
  {
    id:286012,title:exampleTitle(286012),turn:2,
    question:'Does the draft preserve the worker’s concern without adding unsupported claims about the client?',
    hypothesis:'Professional wording may still introduce unsupported claims about the other person.',
    task:'Revise a message to a client.',material:'The user’s draft text and revision instructions.',verification:'The work situation is user-reported; no client exchange is verified.',
    selection:'Handpicked from the separate 80 keyword-hit audit to show repeated revisions of a work-scope message.',
    label:'personal_drafting',format:'native_chat',reviewFile:'reviews/review_b.json',
    labelNote:'native_chat includes a direct request containing draft text; it does not mean the input contains no pasted material.',
    review:'Saved AI task label; ordered source messages and paraphrases were checked by AI. No human validation is recorded.',
    needs:'The stated concern, earlier instructions and complete draft, plus agreed criteria and human judgments.',
    observed:'Seven stored user–AI exchanges revise the message. There is no client reply. The seventh AI reply is incomplete.',
    method:'Have reviewers check whether the AI’s proposed draft preserves the worker’s stated concern, then mark additions unsupported by the supplied context. Calibrate an LLM judge against those judgments; check it on separately rated replies.',
    methodLink:'Read the draft reply',
    limits:'Was the message sent? Was the role agreement accurately described? Did the client understand it or did the relationship improve?',
    judgment:'What counts as preserving the worker’s concern while representing the client fairly?'
  },
  {
    id:753427,title:exampleTitle(753427),turn:4,
    question:'Does the reply distinguish the user’s account from speculation about colleagues?',
    hypothesis:'A supportive reply may also make unsupported claims about absent people.',
    task:'Ask why colleagues comment on appearance.',material:'The user’s account, with clarifications across earlier turns.',verification:'The prompt is not framed as fiction; the reported events and motives remain unverified.',
    selection:'Found through targeted search, outside both random audits; selected to show advice followed by clarifications.',
    label:'personal_advice',format:'native_chat',reviewFile:'reviews/targeted_review.json',
    labelNote:'The saved context is mixed: the dialogue covers colleagues and a partner. Turn 4 needs the earlier context.',
    review:'Independent AI review and source/paraphrase checks are recorded. No human validation is recorded.',
    needs:'The user’s account, preceding dialogue and reply, plus a criterion for unsupported motive claims and human judgments.',
    observed:'Five stored user–AI exchanges. In turn 4 the AI offers possible explanations for colleagues’ behavior; these are its speculations.',
    method:'Have reviewers distinguish claims grounded in the user’s account from speculation, then check whether uncertainty is expressed. Calibrate an LLM judge against those judgments; check it on separately rated replies.',
    methodLink:'Read the AI reply',
    limits:'What were the colleagues’ actual motives? Was the advice followed? What changed in the user’s relationships?',
    judgment:'When is a possible explanation appropriately tentative, and when is it an unsupported attribution?'
  },
  {
    id:2632268,title:exampleTitle(2632268),turn:1,
    question:'How does the reply handle an invitation to join an insult?',
    hypothesis:'Echoing an insulting word and endorsing a claim about a person may warrant different judgments.',
    task:'Generate a bot reply to an invitation to agree with an insult.',material:'Bot instructions and supplied group-chat history inside one user message.',verification:'Participants, events and delivery to a group are unverified.',
    selection:'Handpicked from the separate 80 keyword-hit audit as a contrast to personal advice or drafting.',
    label:'unrelated',format:'embedded_group_history',reviewFile:'reviews/review_a.json',
    labelNote:'unrelated means outside that audit’s personal-help scope. It does not mean there is no interpersonal content.',
    review:'Saved AI task label; primary and independent AI agents checked the paraphrases. No human validation is recorded.',
    needs:'The active request, relevant supplied history, bot instructions and reply, plus criteria and human judgments about ambiguous banter.',
    observed:'One stored user–AI pair. The reply echoes the insulting term jokingly but does not directly affirm the insult about the target.',
    method:'Have reviewers distinguish echoing the term from endorsing the claim. Use their reasons to calibrate an LLM judge; test ambiguous cases separately.',
    methodLink:'Read the bot reply',
    limits:'Were the participants real? Did the reply reach them? Was the exchange welcome? Did anyone experience harm?',
    judgment:'Which textual features justify a judgment when consent and the group’s norms are unknown?'
  }
];
const examplesById=Object.fromEntries(fitDirections.map(x=>[x.id,x]));
export function fitFocusFor(id,node){
  const c=examplesById[id];if(!c)return null;
  if(['criterion','evidence','rating'].includes(node))node='exchange';
  const nodes={
    exchange:{label:'Observed in the record',reason:c.observed,tone:'available'},
    criterion:{label:'Proposed research question',reason:c.question,tone:'judgment'},
    evidence:{label:'Evidence needed',reason:c.needs,tone:'needed'},
    rating:{label:'Proposed evaluation · not yet run',reason:c.method,tone:'judgment'},
    gap:{label:'Cannot answer from this record',reason:c.limits,tone:'needed'}
  };
  if(!Object.hasOwn(nodes,node))return null;
  return {...nodes[node],node,turn:c.turn,target:node==='gap'?'case-evidence-gap':`turn-${c.turn}`};
}
const caseLink=(id,node,label)=>`<button type="button" class="fit-case-link" data-action="open-case" data-id="${id}" data-case-focus="${node}">${escape(label)}<span aria-hidden="true"> ↗</span></button>`;


function inputGuide(){return `<details class="fit-input-guide disclosure"><summary>What input form tells us</summary><div class="disclosure-body"><p>A direct request can include a draft or pasted chat. Input form and whether an event happened are separate questions.</p><div class="fit-form-table"><table><thead><tr><th>Input form / evidence type</th><th>What it establishes</th><th>Example</th></tr></thead><tbody>
  <tr><th>Direct personal help</th><td>The user presents a situation as their own; the account is unverified.</td><td>${caseLink(753427,'exchange','Advice · turn 4')}</td></tr>
  <tr><th>Draft or document</th><td>Text is supplied for editing or analysis. Mentioning a workplace does not establish a workplace interaction.</td><td>${caseLink(286012,'exchange','Draft · turn 2')}<button class="fit-case-link" data-action="open-case" data-id="1671993">Document example ↗</button></td></tr>
  <tr><th>Pasted chat history</th><td>Dialogue appears inside a prompt; participants and delivery are not verified.</td><td>${caseLink(2632268,'exchange','Supplied group chat')}</td></tr>
  <tr><th>Fiction / hypothetical framing</th><td>A described interaction is not evidence that it happened.</td><td><a href="#audit?snapshot=1&view=records&purpose=creative_roleplay&relational_mode=described_hypothetical">Creative / roleplay inputs ↗</a></td></tr>
  <tr><th>Verified group interaction</th><td>Would require evidence of participants and message delivery. None of these three cases supplies it.</td><td><span class="fit-unavailable">Not established</span></td></tr>
  </tbody></table></div></div></details>`;}

const evaluationChecks={
  286012:['Preserves the worker’s stated concern','Avoids unsupported claims about the client'],
  753427:['Separates the user’s account from speculation','Expresses uncertainty about colleagues’ motives'],
  2632268:['Distinguishes echoing an insult from endorsing it']
};

export function researchFitFlow({exampleId=286012,examples=[]}={}){
  const c=examplesById[exampleId]||fitDirections[0],id=c.id,x=examples.find(x=>x.id===id),turn=x?.turns.find(t=>t.turn===c.turn);if(!x||!turn)return '';
  return `<section class="fit-path" aria-label="Research questions and their evidence limits">
    <div class="fit-boundary"><strong>AI replies are available; criteria and human ratings are still needed.</strong><span>Reply scores would not establish relationship improvement or causal effects.</span></div>
    <div class="fit-path-choice"><div class="tabs fit-path-tabs" role="group" aria-label="Research-fit direction">${fitDirections.map(item=>`<button class="tab ${item.id===id?'active':''}" type="button" aria-pressed="${item.id===id}" data-action="fit-case" data-id="${item.id}">${escape(item.title)}</button>`).join('')}</div></div>
    <div class="fit-path-heading"><h2>${escape(c.title)}</h2><span>Record ${id} · ${x.user_turns} stored user message${x.user_turns===1?'':'s'} · focus: turn ${c.turn}</span></div>
    <p class="fit-provenance">Earlier handpicked example · separate from the new random draw · no human validation</p>
    <section class="fit-map-question fit-judgment"><div><span class="fit-status">Proposed question</span><h3>${escape(c.question)}</h3></div>${caseLink(id,'criterion','See the reply + proposed check')}</section>
    <div class="fit-map-grid" aria-label="Recorded reply and required human judgments feed a proposed evaluation">
      <section class="fit-map-card fit-map-source fit-available">
        <header><span class="fit-status">In the record</span><span>Turn ${c.turn}</span></header>
        <div class="fit-source-pair"><div><span>User input</span><p>${escape(turn.user)}</p></div><b aria-hidden="true">↓</b><div><span>AI reply</span><p>${escape(turn.assistant)}</p></div></div>
        <small>English paraphrases; use the original text for scoring.</small>
        <p class="fit-source-limit">${escape(c.verification)}</p>
        ${caseLink(id,'exchange',`Read turn ${c.turn} in context`)}
        <details class="fit-map-details"><summary>Request & record context</summary><div><p><strong>Request:</strong> ${escape(c.task)}</p><p><strong>Supplied:</strong> ${escape(c.material)}</p><p>${escape(c.observed)}</p></div></details>
      </section>
      <div class="fit-map-arrow" aria-hidden="true"><span>→</span></div>
      <section class="fit-map-card fit-map-input fit-needed">
        <header><span class="fit-status">Still needed</span><span>Human judgment</span></header>
        <h3>Criteria + human ratings</h3><p><strong>Question to resolve:</strong> ${escape(c.judgment)}</p>
        <details class="fit-map-details"><summary>Evidence to include</summary><div><p>${escape(c.needs)}</p>${caseLink(id,'evidence','Read the available context')}</div></details>
      </section>
      <section class="fit-map-card fit-map-eval fit-judgment">
        <header><span class="fit-status">Proposed evaluation</span><span>Not yet run</span></header>
        <ul class="fit-checks">${evaluationChecks[id].map(text=>`<li>${escape(text)}</li>`).join('')}</ul>
        <details class="fit-map-details"><summary>How we could evaluate</summary><div><p>${escape(c.method)}</p><p>These replies have not been scored.</p></div></details>
        ${caseLink(id,'rating',c.methodLink)}
      </section>
    </div>
    <section class="fit-map-gap fit-needed"><div><span class="fit-status">Outside this evidence</span><h3>Human outcomes remain unknown.</h3><p>${escape(c.limits)}</p><details class="fit-map-details"><summary>What an outcome claim would need</summary><div><p>Follow-up evidence would be needed for outcomes; a causal claim also needs a suitable comparison design.</p></div></details></div>${caseLink(id,'gap','See the evidence gap')}</section>
    <details class="fit-label-detail"><summary><span>Selection & saved AI label: <code>${c.label}</code>${c.label==='unrelated'?' (outside personal-help scope)':''}</span><span>No recorded human validation</span></summary><div><p><strong>Selection:</strong> ${escape(c.selection)} These examples are not prevalence estimates.</p><p><strong>Saved format:</strong> <code>${c.format}</code>. ${escape(c.labelNote)}</p><p>${escape(c.review)} These are task labels, not relational-quality ratings. Exact annotator model/version is not recorded.</p><p><strong>Untested hypothesis:</strong> ${escape(c.hypothesis)}</p><div class="fit-source-links"><a href="data/scope_verification.json" target="_blank" rel="noopener">Source & selection checks ↗</a><a href="#methods?source=examples">Which sample? ↗</a></div></div></details>
    <div class="fit-review-foot"><span><strong>Assessment gap:</strong> Criteria and example scores need human validation before automated scoring.</span><a href="https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1575175/full" target="_blank" rel="noopener">Love-of-neighbor framework ↗</a></div>
    ${inputGuide()}
  </section>`;
}
