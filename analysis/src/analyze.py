"""Transparent retrieval rules and descriptive EDA. Tags are NOT validated labels."""
import collections, csv, gzip, hashlib, json, pathlib, random, re, statistics
ROOT=pathlib.Path(__file__).resolve().parents[1]
CONTEXTS={
 'Partner / dating':r'\b(wife|husband|boyfriend|girlfriend|spouse|fiancee?|fiancé|marriage|married|divorce|dating|break.?up|romantic|crush|ex.partner)\b',
 'Family':r'\b(mother|father|mom|mum|dad|parents?|sisters?|brothers?|sons?|daughters?|children|kids?|grandmother|grandfather|grandparents?|siblings?|in.laws?|family)\b',
 'Friends / housemates':r'\b(friends?|friendship|roommates?|housemates?)\b',
 'Work / school':r'\b(coworkers?|co.workers?|colleagues?|boss|manager|employees?|classmates?|teammates?|supervisor|teachers?|students?)\b',
 'Community / strangers':r'\b(neighbou?rs?|strangers?|congregation|church|community|volunteer|homeless)\b'
}
PERSONAL=re.compile(r'\b(i|me|my|mine|we|our|us)\b',re.I)
REQUEST=re.compile(r'\b(advice|help|should|how|what|feel|feeling|worried|worry|upset|angry|conflict|argument|apolog|forgive|deal with|cope|tell|say|respond|support|struggl)',re.I)
CREATIVE=re.compile(r'\b(write|create|generate|continue|compose)\b.{0,80}\b(story|novel|fiction|scene|screenplay|script|character)\b|\b(role.?play|fictional|fanfiction|characters?|narrator)\b',re.I|re.S)
CODE=re.compile(r'```|\b(python|javascript|typescript|html|sql|stack trace|import numpy|def [a-z_]+\()',re.I)

def features(r):
    conv=r['conversation']; users=[m.get('content') or '' for m in conv if m['role']=='user']; text='\n'.join(users)
    tags=[k for k,v in CONTEXTS.items() if re.search(v,text,re.I)]
    english=r['language']=='English'
    candidate=english and bool(tags) and bool(PERSONAL.search(text)) and bool(REQUEST.search(text)) and not r['truncated_cells']
    first=users[0].strip() if users else ''
    return dict(row_index=r['row_index'],conversation_hash=r['conversation_hash'],language=r['language'],model=r['model'],
        date=str(r['timestamp'])[:10],user_turns=len(users),assistant_messages=sum(m['role']=='assistant' for m in conv),
        user_words=len(text.split()),assistant_words=sum(len((m.get('content') or '').split()) for m in conv if m['role']=='assistant'),
        empty_user_messages=sum(not t.strip() for t in users),redacted=bool(r['redacted']),truncated=bool(r['truncated_cells']),
        contexts=' | '.join(tags),context_count=len(tags),candidate=candidate,creative_flag=bool(CREATIVE.search(text)),
        code_flag=bool(CODE.search(text)),first_user_hash=hashlib.sha256(first.encode()).hexdigest() if first else '',
        nonempty_user=bool(text.strip()))

def count(rows,key): return dict(collections.Counter(r[key] for r in rows).most_common())
def pct(n,d): return round(n/d*100,2) if d else 0
def make_pack(rows,features_,ids,name):
    byid={r['row_index']:r for r in rows}; fm={f['row_index']:f for f in features_}
    p=ROOT/'reviews'/f'{name}_pack.jsonl'
    # Full dialogue, no source geographic/device identifiers.
    with p.open('w') as out:
        for i in ids:
            r=byid[i]
            out.write(json.dumps({'row_index':i,'screen':fm[i], 'conversation':[{'role':m['role'],'content':m['content']} for m in r['conversation']]},ensure_ascii=False)+'\n')

def main():
    for directory in ['data/derived', 'outputs', 'reviews']:
        (ROOT/directory).mkdir(parents=True,exist_ok=True)
    # File iteration splits JSONL at LF only; str.splitlines also splits legal
    # Unicode U+2028/U+0085 characters inside JSON strings.
    with (ROOT/'data/raw/sample.jsonl').open() as f:
        rows=[json.loads(l) for l in f]
    fs=[features(r) for r in rows]
    with (ROOT/'data/derived/features.csv').open('w') as out:
        w=csv.DictWriter(out,fieldnames=list(fs[0]));w.writeheader();w.writerows(fs)
    # Share metadata/features without conversation text or identifying headers.
    (ROOT/'outputs/conversation_features.csv.gz').write_bytes(gzip.compress((ROOT/'data/derived/features.csv').read_bytes(),mtime=0))
    eng=[f for f in fs if f['language']=='English' and not f['truncated']]
    candidates=[f for f in eng if f['candidate']]
    noncandidate=[f for f in eng if not f['candidate']]
    turns=collections.Counter('1' if f['user_turns']==1 else '2-3' if f['user_turns']<=3 else '4+' for f in fs)
    summary={'sample_rows':len(fs),'english_rows':len(eng),'candidate_rows':len(candidates),
       'candidate_pct_english':pct(len(candidates),len(eng)),'language_counts':count(fs,'language'),'model_counts':count(fs,'model'),
       'date_min':min(f['date'] for f in fs),'date_max':max(f['date'] for f in fs),'month_counts':dict(sorted(collections.Counter(f['date'][:7] for f in fs).items())),
       'turn_buckets':dict(turns),'median_user_turns':statistics.median(f['user_turns'] for f in fs),
       'multi_turn_rows':sum(f['user_turns']>=2 for f in fs),'median_user_words':statistics.median(f['user_words'] for f in fs),
       'candidate_multi_turn_rows':sum(f['user_turns']>=2 for f in candidates),'candidate_turn_buckets':dict(collections.Counter('1' if f['user_turns']==1 else '2-3' if f['user_turns']<=3 else '4+' for f in candidates)),
       'context_keyword_counts':{k:sum(k in f['contexts'] for f in candidates) for k in CONTEXTS},
       'candidate_overlapping_contexts':sum(f['context_count']>=2 for f in candidates),
       'candidate_creative_flag':sum(f['creative_flag'] for f in candidates),'candidate_code_flag':sum(f['code_flag'] for f in candidates),
       'redacted_rows':sum(f['redacted'] for f in fs),'truncated_rows':sum(f['truncated'] for f in fs),
       'empty_user_message_rows':sum(f['empty_user_messages']>0 for f in fs),
       'duplicate_hash_extra_rows':len(fs)-len(set(f['conversation_hash'] for f in fs)),
       'repeated_first_prompt_extra_rows':len([f for f in fs if f['first_user_hash']])-len(set(f['first_user_hash'] for f in fs if f['first_user_hash'])),
       'source':'sample_manifest.json','screen_label':'Keyword retrieval candidates, NOT confirmed personal advice or taxonomy categories.'}
    (ROOT/'outputs/summary.json').write_text(json.dumps(summary,indent=2))
    rng=random.Random(20261018)
    chosen=rng.sample([f['row_index'] for f in candidates],min(80,len(candidates)))
    controls=rng.sample([f['row_index'] for f in noncandidate],min(40,len(noncandidate)))
    review_plan={'seed':20261018,'candidate_ids':chosen,'negative_ids':controls,'review_status':'AI-assisted qualitative coding; no human validation','overlap_ids':chosen[:20]}
    (ROOT/'outputs/review_plan.json').write_text(json.dumps(review_plan,indent=2))
    make_pack(rows,fs,chosen[:40]+controls[:20],'review_a')
    make_pack(rows,fs,chosen[40:]+controls[20:],'review_b')
    make_pack(rows,fs,chosen[:20],'overlap')
    print(json.dumps(summary,indent=2))

if __name__=='__main__': main()
