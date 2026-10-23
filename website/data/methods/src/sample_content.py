"""Seeded content audit, independent of keyword and source-language filters.

Full text is saved only to ignored review packs. No classification is automated here.
"""
import json,pathlib,random,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
SEED=20261019; N=120

def main():
    source=ROOT/'data/raw/sample.jsonl'
    rows=[json.loads(line) for line in source.open()]
    chosen=random.Random(SEED).sample(sorted(r['row_index'] for r in rows),N)
    lookup={r['row_index']:r for r in rows}
    plan={'seed':SEED,'n':N,'sample_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
          'selection':'Simple random sample without replacement from the existing 20,000-record block sample; no keyword or language filter.',
          'unit':'Primary purpose of the final active user request in each record; earlier turns are context, embedded instructions/history are not automatically the current request.',
          'ids':chosen,'a_ids':chosen[:60],'b_ids':chosen[60:],'overlap_ids':random.Random(SEED+1).sample(chosen,20),
          'status':'AI-assisted exploratory coding; not human validation; describe this audit only.'}
    (ROOT/'outputs/content_review_plan.json').write_text(json.dumps(plan,indent=2)+'\n')
    for part,ids in [('a',chosen[:60]),('b',chosen[60:]),('overlap',plan['overlap_ids'])]:
        path=ROOT/'reviews'/f'content_{part}_pack.jsonl'
        with path.open('w') as out:
            for i in ids:
                r=lookup[i]
                out.write(json.dumps({'row_index':i,'source_language':r['language'],
                    'conversation':[{'role':m['role'],'content':m.get('content','')} for m in r['conversation']]},ensure_ascii=False)+'\n')
        print(part,len(ids),path.stat().st_size)
if __name__=='__main__':main()
