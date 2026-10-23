// One display name per saved record, shared by navigation and research views.
const names={
  286012:'Drafting a work message',
  753427:'Advice about colleagues',
  2632268:'Asked to join an insult',
  255498:'Learning JavaScript',
  1671993:'Summarizing a job advert',
  2606561:'A bot with pasted group history'
};
export const exampleTitle=(id,fallback='Example')=>names[id]||fallback;
