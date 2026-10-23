"""Fetch a reproducible, spread-out block sample without retaining IP/header metadata.

Viewer requests are guarded by a pinned Hub revision before and after retrieval.
If that revision changes, use --pinned-stream (slower; requires datasets) to read
the immutable revision. Raw text stays local and is excluded from Git.
"""
import argparse, concurrent.futures, hashlib, json, pathlib, random, time
import requests

ROOT = pathlib.Path(__file__).resolve().parents[1]
CFG = json.loads((ROOT / 'config/source.json').read_text())
BASE = 'https://datasets-server.huggingface.co'

def get(url, params=None):
    for attempt in range(12):
        try:
            r = requests.get(url, params=params, timeout=90)
            if r.status_code == 429:
                delay=int(r.headers.get('Retry-After','60'))
                print(f'Viewer rate limit; waiting {delay}s before retry.',flush=True)
                time.sleep(delay)
                continue
            r.raise_for_status()
            return r.json()
        except Exception:
            if attempt == 11: raise
            time.sleep(min(2 ** attempt,60))
    raise RuntimeError('Viewer retry budget exhausted')

def offsets():
    rng = random.Random(CFG['seed'])
    n, k, width = CFG['num_rows'], CFG['windows'], CFG['window_size']
    return [rng.randint(i*n//k, (i+1)*n//k-width) for i in range(k)]

def sanitize(row, index, truncated=None):
    keep = ['conversation_hash','model','timestamp','turn','language','toxic','redacted']
    out = {key:row.get(key) for key in keep}
    out['row_index'] = index
    out['truncated_cells'] = truncated or []
    out['conversation'] = [{key:m.get(key) for key in ['role','content','timestamp','language','turn_identifier','redacted']} for m in row['conversation']]
    return out

def fetch_window(offset):
    path = ROOT / 'data/raw/windows' / f'{offset:08d}.json'
    if path.exists(): return json.loads(path.read_text())
    j = get(BASE+'/rows',dict(dataset=CFG['dataset'],config=CFG['config'],split=CFG['split'],offset=offset,length=CFG['window_size']))
    assert j['num_rows_total'] == CFG['num_rows'], 'Dataset size changed'
    assert len(j['rows']) == CFG['window_size'], 'Incomplete window'
    rows = [sanitize(x['row'],x['row_idx'],x.get('truncated_cells')) for x in j['rows']]
    assert [r['row_index'] for r in rows] == list(range(offset,offset+CFG['window_size']))
    path.write_text(json.dumps(rows,ensure_ascii=False))
    return rows

def main():
    p = argparse.ArgumentParser(); p.add_argument('--pinned-stream',action='store_true'); args=p.parse_args()
    outdir=ROOT/'data/raw/windows'; outdir.mkdir(parents=True,exist_ok=True)
    identity={k:CFG[k] for k in ['dataset','revision','config','split','num_rows']}
    identity_path=outdir.parent/'cache_identity.json'
    if identity_path.exists():
        assert json.loads(identity_path.read_text())==identity,'Cache belongs to another source; use a separate cache directory.'
    elif list(outdir.glob('*.json')):
        old_manifest=ROOT/'outputs/sample_manifest.json'
        assert old_manifest.exists(),'Unidentified cache; move it aside before retrieval.'
        saved=json.loads(old_manifest.read_text())
        assert all(saved[k]==v for k,v in identity.items()),'Cached source differs from config.'
        identity_path.write_text(json.dumps(identity,indent=2))
    else:
        identity_path.write_text(json.dumps(identity,indent=2))
    starts=offsets()
    if args.pinned_stream:
        from datasets import load_dataset
        wanted={i for s in starts for i in range(s,s+CFG['window_size'])}
        rows=[]
        for i,row in enumerate(load_dataset(CFG['dataset'],revision=CFG['revision'],split=CFG['split'],streaming=True)):
            if i in wanted: rows.append(sanitize(row,i))
            if i>=max(wanted): break
    else:
        before=get('https://huggingface.co/api/datasets/'+CFG['dataset'])['sha']
        if before!=CFG['revision']: raise RuntimeError('Hub revision changed: use --pinned-stream to reproduce the saved sample.')
        rows=[]
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            for n,batch in enumerate(pool.map(fetch_window,starts),1):
                rows.extend(batch)
                if n%20==0: print(f'{n}/{len(starts)} windows fetched',flush=True)
        after=get('https://huggingface.co/api/datasets/'+CFG['dataset'])['sha']
        assert after==before,'Revision changed during retrieval'
    rows.sort(key=lambda r:r['row_index'])
    assert len(rows)==CFG['sample_size']
    assert len({r['row_index'] for r in rows})==len(rows)
    path=ROOT/'data/raw/sample.jsonl'
    path.write_text(''.join(json.dumps(r,ensure_ascii=False,sort_keys=True,default=str)+'\n' for r in rows))
    manifest={**CFG,'design':'200 equal-size index strata; one seeded random contiguous 100-row block per stratum. Descriptive block sample, not independent random conversations. No population prevalence estimates.',
              'offsets':starts,'actual_rows':len(rows),'truncated_rows':sum(bool(r['truncated_cells']) for r in rows),
              'sample_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
              'metadata_excluded':['hashed_ip','header','country','state','openai_id','system_fingerprint']}
    (ROOT/'outputs/sample_manifest.json').write_text(json.dumps(manifest,indent=2))
    print(json.dumps({k:manifest[k] for k in ['actual_rows','truncated_rows','sample_sha256']}),flush=True)

if __name__=='__main__': main()
