import contextlib,hashlib,io,json,pathlib,sys,tempfile,unittest
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
from analyze import features
import analyze
from fetch_sample import CFG,offsets

def row(messages,**kwargs):
    return dict(row_index=1,conversation_hash='x',language='English',model='test',timestamp='2026-01-01',turn=1,redacted=False,truncated_cells=[],conversation=messages,**kwargs)

class EDAIntegrity(unittest.TestCase):
    def test_analysis_runs_with_only_source_cache_in_fresh_checkout(self):
        with tempfile.TemporaryDirectory() as directory:
            root=pathlib.Path(directory)
            (root/'data/raw').mkdir(parents=True)
            source=row([{'role':'user','content':'How should I help my mother?'},
                        {'role':'assistant','content':'Ask what she needs.'}])
            source['language']='English'
            (root/'data/raw/sample.jsonl').write_text(json.dumps(source)+'\n')
            with patch.object(analyze,'ROOT',root),contextlib.redirect_stdout(io.StringIO()):
                analyze.main()
            summary=json.loads((root/'outputs/summary.json').read_text())
            self.assertEqual(summary['sample_rows'],1)
            self.assertEqual(summary['candidate_rows'],1)
            self.assertTrue((root/'data/derived/features.csv').exists())
            self.assertTrue((root/'reviews/review_a_pack.jsonl').exists())

    def test_assistant_words_do_not_trigger_user_retrieval(self):
        r=row([{'role':'user','content':'Hello'}, {'role':'assistant','content':'How can I help my friend and family?'}])
        self.assertFalse(features(r)['candidate'])

    def test_truncated_dialogue_not_silently_screened(self):
        r=row([{'role':'user','content':'How should I help my mother?'}]);r['truncated_cells']=['conversation']
        self.assertFalse(features(r)['candidate'])

    def test_sample_windows_are_valid_and_disjoint(self):
        starts=offsets(); indices=[i for s in starts for i in range(s,s+CFG['window_size'])]
        self.assertEqual(len(indices),CFG['sample_size'])
        self.assertEqual(len(indices),len(set(indices)))
        self.assertGreaterEqual(min(indices),0);self.assertLess(max(indices),CFG['num_rows'])

    def test_summary_denominators(self):
        p=ROOT/'outputs/summary.json'
        if not p.exists(): self.skipTest('Run analysis first')
        s=json.loads(p.read_text())
        self.assertEqual(sum(s['language_counts'].values()),s['sample_rows'])
        self.assertEqual(sum(s['turn_buckets'].values()),s['sample_rows'])
        self.assertLessEqual(s['candidate_rows'],s['english_rows'])

    def test_review_coverage(self):
        p=ROOT/'outputs/annotations.json'
        if not p.exists():self.skipTest('Review not complete')
        a=json.loads(p.read_text()); plan=json.loads((ROOT/'outputs/review_plan.json').read_text())
        self.assertEqual({x['row_index'] for x in a},set(plan['candidate_ids']+plan['negative_ids']))
        self.assertEqual(len(a),len({x['row_index'] for x in a}))

    def test_content_audit_partitions_and_cross_tab(self):
        a=json.loads((ROOT/'outputs/content_annotations.json').read_text())
        plan=json.loads((ROOT/'outputs/content_review_plan.json').read_text())
        summary=json.loads((ROOT/'outputs/content_audit_summary.json').read_text())
        self.assertEqual(len(a),len({r['row_index'] for r in a}))
        self.assertEqual({r['row_index'] for r in a},set(plan['ids']))
        for field in ['purpose','packaging','relational_mode']:
            self.assertEqual(sum(summary[field+'_counts'].values()),len(a))
        tab=summary['purpose_packaging_matrix']
        for i,purpose in enumerate(tab['rows']):
            for j,packaging in enumerate(tab['columns']):
                self.assertEqual(tab['counts'][i][j],sum(r['purpose']==purpose and r['packaging']==packaging for r in a))

    def test_distributions_match_independent_sample_summary(self):
        d=json.loads((ROOT/'outputs/distributions_summary.json').read_text())
        s=json.loads((ROOT/'outputs/summary.json').read_text())
        m=json.loads((ROOT/'outputs/sample_manifest.json').read_text())
        self.assertEqual(d['provenance']['sample_sha256'],m['sample_sha256'])
        self.assertEqual(sum(d['stored_user_message_counts'].values()),s['sample_rows'])
        self.assertEqual(d['language_label_counts'],s['language_counts'])
        self.assertEqual(d['stored_user_message_buckets']['1'],s['turn_buckets']['1'])
        self.assertEqual(sum(d['model_family_counts'].values()),s['sample_rows'])

    def test_cached_sample_checksum(self):
        p=ROOT/'data/raw/sample.jsonl'
        if not p.exists():self.skipTest('Local cache not available')
        m=json.loads((ROOT/'outputs/sample_manifest.json').read_text())
        self.assertEqual(hashlib.sha256(p.read_bytes()).hexdigest(),m['sample_sha256'])

if __name__=='__main__': unittest.main()
