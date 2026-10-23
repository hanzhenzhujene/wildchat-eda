"""Resumable, source-linked AI labels for a global row sample.

Raw dialogues stay in ignored data/raw. Output includes deidentified paraphrases,
AI model IDs and exact protocol/settings, not human validation. A second model
labels a recorded subset blind to the first labels; disagreements are preserved.
"""
import argparse, concurrent.futures, datetime, hashlib, json, os, pathlib, random, time
import requests

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'outputs/relational_v2'
RAW = ROOT / 'data/raw/relational_v2/rows'
CFG = ROOT / 'config/relational_v2'
PRIMARY_MODEL = 'gpt-5.4-mini-2026-03-17'
SECONDARY_MODEL = 'gpt-4.1-2025-04-14'
ENDPOINT = 'https://api.openai.com/v1/chat/completions'
MAX_CHARS = 250000
ENUMS = {
 'purpose': ['text_work','technical_problem','information_learning','creative_roleplay','social_chat','personal_guidance','other_unclear'],
 'relational_mode': ['personal_help','social_participation','described_hypothetical','none','unclear'],
 'packaging': ['direct_request','pasted_document','embedded_history','unclear'],
 'context': ['partner','family','friends','work_school','community','mixed','none','unclear'],
 'help_type': ['advice','drafting','none'],
 'frame': ['apparently_personal','explicit_hypothetical','fiction_roleplay','supplied_material','presented_social_exchange','general_or_none','unclear'],
 'benchmark_route': ['advice_response','communication_draft','social_response','scenario_seed','not_candidate','uncertain'],
 'confidence': ['high','medium','low'],
}
PROPERTIES = {k: {'type':'string','enum':v} for k,v in ENUMS.items()}
PROPERTIES.update({
 'evidence_message_index': {'type':['integer','null']},
 'earlier_relational_request': {'type':'boolean'},
 'earlier_evidence_message_index': {'type':['integer','null']},
 'reason': {'type':'string'},
 'uncertainty': {'type':['string','null']},
 'human_check': {'type':['string','null']},
})
SCHEMA = {'type':'object','properties':PROPERTIES,'required':list(PROPERTIES),'additionalProperties':False}

def digest(data): return hashlib.sha256(data).hexdigest()
def atomic(path, value):
 path.parent.mkdir(parents=True, exist_ok=True)
 p=path.with_suffix('.tmp'); p.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n'); p.replace(path)
def read(path): return json.loads(path.read_text())
def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def settings(model):
 spec={'model':model,'store':False,'response_format':{'type':'json_schema','json_schema':{'name':'relational_label','strict':True,'schema':SCHEMA}}}
 if model.startswith('gpt-5'):
  spec.update(reasoning_effort='medium',max_completion_tokens=4000)
 else:spec.update(temperature=0,max_completion_tokens=1200)
 return spec
def saved_settings(model):return {k:v for k,v in settings(model).items() if k not in ['model','response_format']}
def source_payload(row):
 users=[i for i,m in enumerate(row['conversation']) if m['role']=='user']
 return {'row_index':row['row_index'],'final_user_message_index':users[-1] if users else None,'valid_user_message_indices':users,'messages':[{'index':i,'role':m['role'],'content':m.get('content','')} for i,m in enumerate(row['conversation'])]}
def validate(label,row):
 assert set(label)==set(PROPERTIES), 'Schema keys'
 for k,vals in ENUMS.items(): assert label[k] in vals, 'Enum'
 for k in ['evidence_message_index','earlier_evidence_message_index']:
  idx=label[k]
  assert idx is None or (isinstance(idx,int) and 0<=idx<len(row['conversation']) and row['conversation'][idx]['role']=='user'), 'Evidence index'
 users=[i for i,m in enumerate(row['conversation']) if m['role']=='user']
 if label['earlier_relational_request']:
  assert label['earlier_evidence_message_index'] is not None and users and label['earlier_evidence_message_index']<users[-1], 'Earlier index'
 else: assert label['earlier_evidence_message_index'] is None, 'Unexpected earlier index'
 assert isinstance(label['reason'],str) and label['reason'].strip(), 'Missing reason'
 mode=label['relational_mode']; route=label['benchmark_route']
 if mode=='none':
  assert route=='not_candidate' and label['context']=='none' and label['help_type']=='none' and label['human_check'] is None, 'No relational focus requires not_candidate, context none, help_type none and human_check null'
 if mode=='unclear': assert route=='uncertain', 'Unclear relevance requires uncertain route'
 if route=='advice_response': assert mode=='personal_help' and label['frame']=='apparently_personal' and label['help_type']=='advice', 'Advice candidate requires apparently personal interpersonal help with advice requested'
 if route=='communication_draft': assert mode in ['personal_help','described_hypothetical'] and label['help_type']=='drafting', 'Drafting candidate requires interpersonal content and drafting requested'
 if route=='social_response': assert mode=='social_participation', 'Social-response candidate requires social participation'
 if route=='scenario_seed': assert mode=='described_hypothetical', 'Scenario seed requires described or hypothetical interpersonal content'
 if route!='not_candidate': assert label['human_check'] and label['human_check'].strip(), 'Candidate and uncertain routes require a specific nonempty human_check'

def unknown(reason):
 return {'purpose':'other_unclear','relational_mode':'unclear','packaging':'unclear','context':'unclear','help_type':'none','frame':'unclear','benchmark_route':'uncertain','confidence':'low','evidence_message_index':None,'earlier_relational_request':False,'earlier_evidence_message_index':None,'reason':reason,'uncertainty':reason,'human_check':'Read the complete source before deciding inclusion.'}

def label_one(row_id,phase,model,prompt,protocol_sha,retry_failed=False):
 source_path=RAW/f'{row_id}.json'; row=read(source_path)
 output_path=OUT/phase/f'{row_id}.json'
 src_sha=digest(source_path.read_bytes())
 if output_path.exists():
  saved=read(output_path)
  if saved.get('protocol_sha256')==protocol_sha and saved.get('source_file_sha256')==src_sha and saved.get('requested_model')==model and saved.get('settings')==saved_settings(model) and (saved.get('status')=='labeled' or not retry_failed): return saved
 payload=json.dumps(source_payload(row),ensure_ascii=False,separators=(',',':'))
 base={'row_index':row_id,'phase':phase,'requested_model':model,'protocol_sha256':protocol_sha,'source_file_sha256':src_sha,'dialogue_sha256':row.get('text_sha256'),'input_sha256':digest(payload.encode()),'input_characters':len(payload),'input_complete':True,'source_language':row.get('language',row.get('source_language')),'source_model':row.get('model'),'source_user_messages':sum(m['role']=='user' for m in row['conversation']),'created_at_utc':now(),'human_review_status':'not_reviewed','reviewer_type':'AI','settings':saved_settings(model),'attempts':0,'attempt_usage':[],'validation_feedback':[]}
 if len(payload)>MAX_CHARS:
  base.update(status='input_limit',input_complete=False,returned_model=None,usage=None,label=unknown('Complete dialogue exceeds the documented annotation input limit; not classified.'))
  atomic(output_path,base);return base
 body={**settings(model),'messages':[{'role':'system','content':prompt},{'role':'user','content':'SOURCE_RECORD\n'+payload}]}
 headers={'Authorization':'Bearer '+os.environ['OPENAI_API_KEY'].strip(),'Content-Type':'application/json'}
 start=time.monotonic();last_error='unknown'
 for attempt in range(1,6):
  base['attempts']=attempt
  try:
   response=requests.post(ENDPOINT,headers=headers,json=body,timeout=180)
   if response.status_code!=200:
    last_error='http_'+str(response.status_code)
    if response.status_code in [401,403]: break
    if response.status_code==429:
     # Requests can exceed the per-minute token budget even at low concurrency.
     # Do not print response bodies or headers containing credentials.
     time.sleep(60);continue
    if response.status_code in [500,502,503,504]: time.sleep(min(2**attempt,30));continue
    break
   data=response.json();choice=data['choices'][0];message=choice['message']
   base['attempt_usage'].append({'attempt':attempt,'usage':data.get('usage'),'returned_model':data.get('model'),'finish_reason':choice.get('finish_reason')})
   if choice.get('finish_reason')!='stop' or message.get('refusal'):
    last_error='refusal_or_incomplete';break
   label=json.loads(message['content'])
   try: validate(label,row)
   except AssertionError as exc:
    base['validation_feedback'].append({'attempt':attempt,'constraint':str(exc)})
    body['messages'][1]['content']='SOURCE_RECORD\n'+payload+'\nVALIDATION NOTE: The previous response violated this structural constraint: '+str(exc)+'. Re-read the source. Do not invent interpersonal content to satisfy a route; use not_candidate if there is no interpersonal assessment target. Return the complete corrected JSON.'
    atomic(ROOT/'tmp/relational_invalid'/f'{phase}_{row_id}_{attempt}.json',label)
    raise
   base.update(status='labeled',returned_model=data.get('model'),usage=data.get('usage'),response_id=data.get('id'),system_fingerprint=data.get('system_fingerprint'),latency_seconds=round(time.monotonic()-start,3),label=label)
   atomic(output_path,base);return base
  except Exception as exc:
   # Never print raw exceptions: they can contain headers or source text.
   last_error=type(exc).__name__+((':'+str(exc)) if isinstance(exc,AssertionError) else '');time.sleep(min(2**attempt,15))
 base.update(status='failed',returned_model=None,usage=None,error_type=last_error,latency_seconds=round(time.monotonic()-start,3),label=unknown('AI annotation did not complete; retained as unresolved.'))
 atomic(output_path,base);return base

def secondary_plan(ids):
 rows=[read(OUT/'primary'/f'{i}.json') for i in ids]
 focus=[];negative=[]
 for r in rows:
  a=r['label']
  if (r['status']!='labeled' or a['relational_mode']!='none' or a['benchmark_route']!='not_candidate' or a['confidence']=='low' or a['earlier_relational_request']):focus.append(r['row_index'])
  else:negative.append(r['row_index'])
 draw=sorted(random.Random(2026102003).sample(sorted(negative),min(200,len(negative))))
 plan={'created_at_utc':now(),'seed':2026102003,'primary_n':len(ids),'focus_ids':sorted(focus),'random_negative_ids':draw,'negative_pool_n':len(negative),'row_indices':sorted(set(focus+draw)),'selection':'All primary relational/uncertain/candidate/low-confidence/earlier-relational or incomplete records, plus a simple random sample of up to 200 remaining none/noncandidate records.','blind':True,'human_validation':False,'note':'Second AI receives source and identical protocol; no primary label. Not a random subset overall; no overall agreement rate presented as accuracy.'}
 path=OUT/'secondary_plan.json'
 if path.exists():
  old=read(path)
  assert all(old[k]==plan[k] for k in ['seed','primary_n','focus_ids','random_negative_ids','negative_pool_n','row_indices']), 'Secondary plan changed'
  return old
 atomic(path,plan);return plan

def run():
 p=argparse.ArgumentParser();p.add_argument('--phase',choices=['primary','secondary'],default='primary');p.add_argument('--workers',type=int,default=8);p.add_argument('--limit',type=int);p.add_argument('--available',action='store_true');p.add_argument('--retry-failed',action='store_true');p.add_argument('--ids-file');args=p.parse_args()
 prompt=(CFG/'system_prompt.txt').read_text();schema_path=CFG/'schema.json';atomic(schema_path,SCHEMA)
 protocol_sha=digest((prompt+json.dumps(SCHEMA,sort_keys=True)).encode())
 manifest={'protocol_sha256':protocol_sha,'prompt_sha256':digest(prompt.encode()),'schema_sha256':digest(json.dumps(SCHEMA,sort_keys=True).encode()),'primary_model':PRIMARY_MODEL,'secondary_model':SECONDARY_MODEL,'endpoint':ENDPOINT,'primary_settings':saved_settings(PRIMARY_MODEL),'secondary_settings':saved_settings(SECONDARY_MODEL),'input_character_limit':MAX_CHARS,'input_limit_policy':'Do not truncate; retain row as unresolved and requiring full-source review.','source_payload':'Full stored role/content messages with zero-based message indexes. No source model/language passed to annotator.','review_type':'AI labels and blind second AI labels only. No human validation.'}
 atomic(OUT/'annotation_manifest.json',manifest)
 ids=read(OUT/'sample_plan.json')['row_indices']
 if args.phase=='secondary':
  assert all((OUT/'primary'/f'{i}.json').exists() for i in ids),'Primary incomplete'
  ids=secondary_plan(ids)['row_indices']
 if args.ids_file:
  selected=read(pathlib.Path(args.ids_file));assert set(selected)<=set(ids);ids=selected
 if args.available:ids=[i for i in ids if (RAW/f'{i}.json').exists()]
 if args.limit:ids=ids[:args.limit]
 assert ids,'No raw records ready'
 model=PRIMARY_MODEL if args.phase=='primary' else SECONDARY_MODEL
 successes=0;counts={};usage={'prompt_tokens':0,'completion_tokens':0,'total_tokens':0}
 print(json.dumps({'phase':args.phase,'selected':len(ids),'model':model,'protocol_sha256':protocol_sha}),flush=True)
 with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
  futures={pool.submit(label_one,i,args.phase,model,prompt,protocol_sha,args.retry_failed):i for i in ids}
  for future in concurrent.futures.as_completed(futures):
   try:r=future.result()
   except Exception as exc:
    print(json.dumps({'row_index':futures[future],'error_type':type(exc).__name__}),flush=True);continue
   successes+=1;counts[r['status']]=counts.get(r['status'],0)+1
   for key in usage:usage[key]+=(r.get('usage') or {}).get(key,0)
   if successes%25==0 or successes==len(ids):print(json.dumps({'phase':args.phase,'done':successes,'total':len(ids),'status_counts':counts,'usage':usage}),flush=True)
 atomic(OUT/f'{args.phase}_run_summary.json',{'completed_at_utc':now(),'requested_n':len(ids),'written_n':successes,'status_counts':counts,'usage':usage,'protocol_sha256':protocol_sha,'model':model})
 if successes!=len(ids):raise SystemExit('Incomplete files; resume required')

if __name__=='__main__':run()
