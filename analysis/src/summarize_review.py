"""Validate agent annotations and produce report-ready aggregate counts."""
import collections,json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
LABELS={'personal_advice','personal_drafting','fiction_or_general','unrelated','unclear'}
CONTEXTS={'partner','family','friends','work_school','community','mixed','none'}
FOLLOW={'none','clarification','reaction','topic_shift','reported_action','other'}

def validate(rows,expected):
    ids=[r['row_index'] for r in rows]
    assert len(ids)==len(set(ids)), 'Duplicate annotation IDs'
    assert set(ids)==set(expected), f'Missing/extra IDs: {set(ids)^set(expected)}'
    for r in rows:
        assert r['label'] in LABELS,(r['row_index'],r['label'])
        assert r['context'] in CONTEXTS,(r['row_index'],r['context'])
        assert r['followup'] in FOLLOW,(r['row_index'],r['followup'])
        assert r['reason']
        assert 'missing_context' in r
    return rows

def counter(rows,key):return dict(collections.Counter(r[key] for r in rows).most_common())

def main():
    plan=json.loads((ROOT/'outputs/review_plan.json').read_text())
    allrows=[]
    for name in ['review_a','review_b']:
        allrows.extend(json.loads((ROOT/'reviews'/f'{name}.json').read_text()))
    validate(allrows,plan['candidate_ids']+plan['negative_ids'])
    primary={r['row_index']:r for r in allrows}
    overlap=validate(json.loads((ROOT/'reviews/overlap.json').read_text()),plan['overlap_ids'])
    conflicts=[{'row_index':r['row_index'],'primary_label':primary[r['row_index']]['label'],'second_label':r['label']} for r in overlap if primary[r['row_index']]['label']!=r['label']]
    adjudication_path=ROOT/'reviews/adjudication.json'
    if adjudication_path.exists():
        changes=json.loads(adjudication_path.read_text())
        for r in changes:
            assert r['row_index'] in primary
            primary[r['row_index']]=r
    final=sorted(primary.values(),key=lambda x:x['row_index'])
    cand=[r for r in final if r['row_index'] in plan['candidate_ids']]
    neg=[r for r in final if r['row_index'] in plan['negative_ids']]
    useful=[r for r in cand if r['label'] in ['personal_advice','personal_drafting']]
    neg_useful=[r for r in neg if r['label'] in ['personal_advice','personal_drafting']]
    result={'review_type':'AI-assisted close reading. No human labels or validation.',
      'candidate_review_n':len(cand),'candidate_labels':counter(cand,'label'),
      'negative_review_n':len(neg),'negative_labels':counter(neg,'label'),
      'candidate_personal_n':len(useful),'negative_personal_n':len(neg_useful),
      'candidate_formats':counter(cand,'format'),'negative_formats':counter(neg,'format'),
      'personal_contexts':counter(useful,'context'),'personal_followups':counter(useful,'followup'),
      'overlap_review_n':len(overlap),'initial_label_disagreement_n':len(conflicts),
      'initial_disagreements':conflicts,'adjudicated':adjudication_path.exists(),
      'scope':'Counts describe the seeded audit, not dataset prevalence, recall, or human-validated precision.'}
    (ROOT/'outputs/annotations.json').write_text(json.dumps(final,indent=2,ensure_ascii=False))
    (ROOT/'outputs/review_summary.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result,indent=2))

if __name__=='__main__':main()
