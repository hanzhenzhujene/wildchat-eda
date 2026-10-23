"""Validate and summarize the full-release row-random semantic audit.

Primary AI labels define distributions. A blind second AI pass is a diagnostic,
not adjudication or human validation. No raw dialogue is exported.
"""
import collections
import copy
import datetime
import hashlib
import json
import math
import pathlib
import random
import shutil

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'outputs/relational_v2'
RAW = ROOT / 'data/raw/relational_v2/rows'
SITE = ROOT.parent / 'website/data'
FIELDS = ['purpose', 'relational_mode', 'packaging', 'context', 'help_type',
          'frame', 'benchmark_route']
REL = ['personal_help', 'social_participation', 'described_hypothetical', 'none', 'unclear']
DIRECT = ['advice_response', 'communication_draft', 'social_response']


def read(p):
    return json.loads(p.read_text())


def save(p, obj):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n')


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def interval(k, n, population):
    # Pointwise Wilson score interval with finite-population variance factor.
    # Describes row sampling only; does not quantify AI label error.
    z = 1.959963984540054
    p = k / n
    a = z*z*(population-n)/(population-1)/n
    center = (p+a/2)/(1+a)
    half = math.sqrt(a*p*(1-p)+a*a/4)/(1+a)
    return [max(0, center-half), min(1, center+half)]


def validate(label, source):
    for key in ['evidence_message_index', 'earlier_evidence_message_index']:
        index = label[key]
        assert index is None or (type(index) is int and 0 <= index < len(source['conversation'])
                                 and source['conversation'][index]['role'] == 'user'), (source['row_index'], key)
    if label['earlier_relational_request']:
        assert label['earlier_evidence_message_index'] is not None
        assert label['earlier_evidence_message_index'] < max(i for i,m in enumerate(source['conversation']) if m['role']=='user')


def main():
    plan = read(OUT/'sample_plan.json')
    ids = plan['row_indices']
    n, N = plan['sample_rows'], plan['population_rows']
    assert len(ids) == len(set(ids)) == n == 2000
    assert ids == sorted(random.Random(plan['seed']).sample(range(N), n))
    retrieval = read(OUT/'retrieval_manifest.json')
    assert retrieval['complete'] and retrieval['sample_rows']==n
    assert retrieval['revision']==plan['revision']
    assert retrieval['sample_plan_sha256']==sha(OUT/'sample_plan.json')
    assert retrieval['shards_verified']==86 and retrieval['all_lfs_digests_verified']
    second_plan = read(OUT/'secondary_plan.json')
    second_ids = set(second_plan['row_indices'])
    checks = read(OUT/'agent_source_checks.json')
    checks_by_id = {r['row_index']: r for r in checks['rows']}
    examples = read(OUT/'selected_examples.json')
    examples_by_id = {r['row_index']: r for r in examples['examples']}
    personal_path = OUT/'personal31_assessment.json'
    personal = read(personal_path) if personal_path.exists() else None
    personal_by_id = {r['row_index']:r for r in personal['rows']} if personal else {}
    edits = read(OUT/'public_summary_translations.json')['entries']
    edits_by_id = collections.defaultdict(list)
    for edit in edits:
        assert edit['field'] in ['reason','uncertainty','human_check']
        edits_by_id[(edit['phase'],edit['row_index'])].append(edit)
    rows = []
    raw_hashes = {}
    runs = []
    for i in ids:
        source_path = RAW/f'{i}.json'
        source = read(source_path)
        primary = read(OUT/'primary'/f'{i}.json')
        assert primary['row_index'] == source['row_index'] == i
        assert primary['source_file_sha256'] == sha(source_path)
        assert primary['human_review_status'] == 'not_reviewed'
        p = copy.deepcopy(primary['label'])
        validate(p, source)
        secondary = read(OUT/'secondary'/f'{i}.json') if i in second_ids else None
        if secondary:
            assert secondary['source_file_sha256'] == sha(source_path)
            validate(secondary['label'], source)
        secondary_display = copy.deepcopy(secondary['label']) if secondary else None
        display_edits=[]
        for phase, label in [('primary',p),('secondary',secondary_display)]:
            for edit in edits_by_id.get((phase,i),[]):
                assert label is not None and label[edit['field']]==edit['original']
                assert edit['source_label_file_sha256']==sha(OUT/phase/f'{i}.json')
                label[edit['field']]=edit['english']
                display_edits.append({'phase':phase,'field':edit['field'],'change_type':edit['change_type']})
        usable_second = secondary if secondary and secondary['status'] == 'labeled' and primary['status']=='labeled' else None
        disagreements = [k for k in FIELDS if usable_second and p[k] != usable_second['label'][k]]
        user_n = sum(m['role']=='user' for m in source['conversation'])
        row = {'row_index': i, 'language': source['language'], 'model': source['model'],
               'date': source['timestamp'][:10], 'user_turns': user_n,
               'stored_messages': len(source['conversation']),
               **p, 'primary': p, 'secondary': secondary_display,
               'display_edits':display_edits,
               'human_review_status': 'not_reviewed', 'input_complete': primary['input_complete'],
               'primary_status': primary['status'],
               'secondary_status': secondary['status'] if secondary else 'not_selected',
               'disagreement_fields': disagreements,
               'review_priority': 'AI disagreement' if disagreements else
                   'Unresolved input' if primary['status'] != 'labeled' or p['relational_mode']=='unclear' else
                   'Candidate inclusion' if p['benchmark_route'] != 'not_candidate' else 'Not human-reviewed',
               'source_text_sha256': source['text_sha256']}
        rows.append(row)
        if i in personal_by_id:
            review = personal_by_id[i]
            assert p['relational_mode'] == 'personal_help'
            assert review['source_file_sha256'] == sha(source_path)
            assert review['primary_label_sha256'] == sha(OUT/'primary'/f'{i}.json')
            assert review['human_review_status'] == 'not_reviewed'
            row['personal_review'] = {k:v for k,v in review.items() if k!='row_index'}
        if i in checks_by_id:
            check = checks_by_id[i]
            assert check['source_file_sha256'] == sha(source_path)
            assert check['primary_label_sha256'] == sha(OUT/'primary'/f'{i}.json')
            row['agent_source_check'] = {k:check[k] for k in ['assessment','suggested_changes','reason','human_question']}
        if i in examples_by_id:
            ex = examples_by_id[i]
            assert ex['source_file_sha256'] == sha(source_path)
            assert source['conversation'][ex['source_message_index']]['role']=='user'
            assert source['conversation'][ex['source_reply_message_index']]['role']=='assistant'
            row['example'] = {k:v for k,v in examples_by_id[i].items() if k!='row_index'}
            example_order = [2971191,3044625,133179,592735,2021747,239414,21520,2107796]
            row['example']['display_order'] = example_order.index(i) if i in example_order else len(example_order)
        raw_hashes[i] = source['conversation_hash']
        runs.append(primary)
        if secondary: runs.append(secondary)
    assert set(p.stem for p in (OUT/'primary').glob('*.json')) == set(map(str,ids))
    assert set(p.stem for p in (OUT/'secondary').glob('*.json')) == set(map(str,second_ids))
    counts = lambda field, data=rows: dict(collections.Counter(r[field] for r in data))
    modes = counts('relational_mode')
    routes = counts('benchmark_route')
    confirmed_two = [r for r in rows if r['secondary_status']=='labeled']
    comparable_two = [r for r in confirmed_two if r['primary_status']=='labeled']
    direct = [r for r in rows if r['benchmark_route'] in DIRECT]
    direct_agreement = [r for r in direct if r['secondary_status']=='labeled' and
                        r['secondary']['benchmark_route']==r['benchmark_route'] and
                        r['secondary']['relational_mode']==r['relational_mode']]
    primary = [r for r in runs if r['phase']=='primary']
    secondary_runs = [r for r in runs if r['phase']=='secondary']
    old = read(ROOT/'outputs/content_annotations.json')
    old_modes = collections.Counter(r['relational_mode'] for r in old)
    comparable = ['personal_help','social_participation','described_hypothetical','none_or_unclear']
    new_comparable = {k:modes.get(k,0) for k in comparable}
    new_comparable['none_or_unclear'] = modes.get('none',0)+modes.get('unclear',0)
    model_counts = {phase:dict(collections.Counter(r.get('returned_model') or r['status'] for r in rr))
                    for phase,rr in [('primary',primary),('secondary',secondary_runs)]}
    summary = {
        'n':n, 'population_rows':N, 'purpose_counts':counts('purpose'),
        'relational_mode_counts':modes, 'packaging_counts':counts('packaging'),
        'context_counts':counts('context'), 'frame_counts':counts('frame'),
        'benchmark_route_counts':routes, 'confidence_counts':counts('confidence'),
        'primary_status_counts':dict(collections.Counter(r['status'] for r in primary)),
        'source_language_counts':counts('language'),
        'interpersonal_n':sum(modes.get(k,0) for k in REL[:3]),
        'direct_candidate_n':len(direct), 'direct_candidate_distinct_hashes':len({raw_hashes[r['row_index']] for r in direct}),
        'direct_candidate_context_counts':counts('context',direct),
        'direct_candidate_route_counts':counts('benchmark_route',direct),
        'direct_candidate_two_ai_agree_n':len(direct_agreement),
        'scenario_seed_n':routes.get('scenario_seed',0),
        'earlier_relational_n':sum(r['earlier_relational_request'] for r in rows),
        'earlier_only_clear_n':sum(r['earlier_relational_request'] and r['relational_mode']=='none' for r in rows),
        'human_validated_n':0,
        'agent_source_checks':{'n':checks['n'],'selection':checks['selection'],
          'assessment_counts':dict(collections.Counter(r['assessment'] for r in checks['rows'])),
          'status':'AI source checks only; not human validation, not a random accuracy estimate.'},
        'secondary':{'selected_n':len(second_ids),'completed_n':len(confirmed_two),
          'comparable_n':len(comparable_two),
          'status_counts':dict(collections.Counter(r['status'] for r in secondary_runs)),
          'rows_with_any_semantic_disagreement':sum(bool(r['disagreement_fields']) for r in confirmed_two),
          'field_disagreement_counts':{k:sum(k in r['disagreement_fields'] for r in confirmed_two) for k in FIELDS},
          'earlier_request_disagreement_n':sum(r['earlier_relational_request']!=r['secondary']['earlier_relational_request'] for r in comparable_two),
          'scope':'All primary candidates/unclear/low-confidence/earlier-relational records, plus 200 seeded random clear negatives. Targeted diagnostic; not a population accuracy estimate.'},
        'model_counts':model_counts,
        'sampling_intervals':{k:{'n':modes.get(k,0),'denominator':n,'share':modes.get(k,0)/n,
                                    'interval95':interval(modes.get(k,0),n,N)} for k in REL},
        'interval_limit':'Pointwise Wilson intervals with finite-population correction cover row sampling only, not AI label error. Rows are not unique people.',
        'pilot_comparison':{'old_n':len(old),'new_n':n,'old_mode_counts':dict(old_modes),
            'new_comparable_mode_counts':new_comparable,
            'changes':[{'mode':k,'old_n':old_modes.get(k,0),'new_n':new_comparable[k],
                        'old_share':old_modes.get(k,0)/len(old),'new_share':new_comparable[k]/n,
                        'difference_pp':100*(new_comparable[k]/n-old_modes.get(k,0)/len(old))} for k in comparable],
            'limit':'Sampling frame, sample size and annotators differ. Differences cannot be attributed to sampling alone; do not pool the two audits.'},
        'overlap_with_pilot_n':len(set(ids)&{r['row_index'] for r in old}),
        'distinct_conversation_hashes':len(set(raw_hashes.values())),
        'complete_input_n':sum(r['input_complete'] for r in rows),
        'provenance':{'sample_plan_sha256':sha(OUT/'sample_plan.json'),
                       'retrieval_manifest_sha256':sha(OUT/'retrieval_manifest.json'),
                       'secondary_plan_sha256':sha(OUT/'secondary_plan.json')},
    }
    protocol_ids = {r['protocol_sha256'] for r in runs}
    assert len(protocol_ids)==1, 'Mixed annotation protocols; complete the rerun first'
    assert len({r['requested_model'] for r in primary})==1
    summary['provenance']['protocol_sha256']=next(iter(protocol_ids))
    if personal:
        assert set(personal_by_id)=={r['row_index'] for r in rows if r['relational_mode']=='personal_help'}
        summary['personal_review'] = personal['summary']
        summary['personal_review']['by_request_type'] = {
            kind:dict(collections.Counter(r['personal_review']['decision'] for r in rows
                       if r.get('personal_review') and r['help_type']==kind))
            for kind in ['drafting','advice']}
        summary['provenance']['personal_review_sha256'] = sha(personal_path)
    # The sampled clear negatives have their own explicit denominator.
    neg_ids = set(second_plan.get('random_negative_ids', second_plan.get('negative_sample_ids', [])))
    if neg_ids:
        negative = [r for r in confirmed_two if r['row_index'] in neg_ids]
        summary['secondary']['random_negatives'] = {'selected_n':len(neg_ids),'completed_n':len(negative),
            'relational_disagreement_n':sum(r['secondary']['relational_mode']!=r['relational_mode'] for r in negative),
            'new_direct_candidate_n':sum(r['secondary']['benchmark_route'] in DIRECT for r in negative),
            'limit':'Incomplete second-pass coverage is not a random subsample of the selected negatives; these are diagnostic counts, not an error-rate estimate.'}
    metadata = {'n':n,'population_rows':N,'seed':plan['seed'],'revision':plan['revision'],
        'dataset':plan['dataset'],'selection':plan['algorithm'],
        'unit':plan['annotation_unit'],'filters_before_selection':[],
        'primary_model':primary[0]['requested_model'],'secondary_model':secondary_runs[0]['requested_model'],
        'secondary_selection':summary['secondary']['scope'],
        'secondary_completion_note':f'Second AI pass stopped after the API account reported exhausted credit. {len(confirmed_two)} of {len(second_ids)} selected records have completed second labels; other statuses remain visible. No human validation was performed.',
        'annotation_date':' to '.join(sorted({r['created_at_utc'][:10] for r in primary if r.get('created_at_utc')})),
        'human_review_status':'No human validation performed.',
        'label_policy':'Charts retain primary AI labels. Independent second AI labels and disagreements remain visible; no automatic adjudication.',
        'evidence_index':'Zero-based stored message index. Includes user and assistant messages; not a turn number.',
        'reason_text':'AI-written summaries, not quotations or verified life events. Selected example paraphrases remove names.',
        'display_translations':f'{len(edits)} summary fields translated into English or edited to remove a name. Semantic labels unchanged; original AI outputs retained in the research archive.',
        'language_policy':'Models read source languages directly; no separate human translation validation.',
        'historical_scopes':'Old 120-label pilot, 80-hit/40-non-hit retrieval audit and six handpicked examples remain separate.'}
    if personal: metadata['personal_review'] = personal['metadata']
    output={'metadata':metadata,'summary':summary,'rows':rows}
    save(OUT/'summary.json',summary)
    save(OUT/'atlas.json',output)
    SITE.mkdir(exist_ok=True)
    save(SITE/'relational_v2.json',output)
    downloads=SITE/'relational_v2'
    downloads.mkdir(exist_ok=True)
    for name in ['sample_plan.json','retrieval_manifest.json','secondary_plan.json','summary.json','primary_run_summary.json','secondary_run_summary.json','agent_source_checks.json','selected_examples.json','personal31_assessment.json']:
        if (OUT/name).exists(): shutil.copy2(OUT/name,downloads/name)
    for name in ['system_prompt.txt','schema.json']:
        shutil.copy2(ROOT/'config/relational_v2'/name,downloads/name)
    shutil.copy2(ROOT/'docs/RELATIONAL_V2_PROTOCOL.md',downloads/'protocol.md')
    print(json.dumps({k:summary[k] for k in ['n','interpersonal_n','relational_mode_counts','benchmark_route_counts','direct_candidate_n','human_validated_n','secondary','primary_status_counts']}))


if __name__=='__main__': main()
