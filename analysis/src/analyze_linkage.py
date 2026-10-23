"""Aggregate linkage audit, pinned WildChat release; no person identification.

Raw source files are verified, projected without message content, then removed.
Linkage keys and turn IDs remain in ignored local derived storage. Only aggregate
statistics are written to outputs. Exact header strings are preserved in keys.
"""
import argparse
import concurrent.futures
import hashlib
import json
import pathlib
import subprocess
import time
from datetime import timezone

import pyarrow as pa
import pyarrow.parquet as pq

ROOT = pathlib.Path(__file__).resolve().parents[1]
REV = 'c827c6df8fcf008219ffaffa4d1dd77491099367'
N = 3199860
RAW = ROOT / 'data/raw/linkage'
DERIVED = ROOT / 'data/derived/linkage'
OUT = ROOT / 'outputs/linkage'
COLUMNS = ['conversation_hash', 'hashed_ip', 'header', 'timestamp',
           'conversation.list.element.role', 'conversation.list.element.hashed_ip',
           'conversation.list.element.header', 'conversation.list.element.turn_identifier']

def digest_file(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda:f.read(8*1024*1024),b''): h.update(b)
    return h.hexdigest()

def save_json(p,d):
    t=p.with_suffix('.tmp');t.write_text(json.dumps(d,indent=2,default=str));t.replace(p)

def digest(x):
    return hashlib.sha256(json.dumps(x,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()

def valid(x):
    return isinstance(x,str) and bool(x.strip())

def header_parts(h):
    h=h or {};return (h.get('accept-language'),h.get('user-agent'))

def scan(task):
    i,start,s=task;target=DERIVED/f'{i:05d}.parquet';cp=OUT/'shards'/f'{i:05d}.json'
    if cp.exists() and target.exists():
        old=json.loads(cp.read_text())
        if old['revision']==REV and old['feature_sha256']==digest_file(target): return old
    begin=time.time();p=RAW/f'{i:05d}.parquet'
    if not p.exists() or p.stat().st_size!=s['size']:
        subprocess.run(['curl','-L','--fail','--silent','--show-error','--retry','4',
          '--retry-all-errors','--output',str(p),s['url']],check=True)
    assert p.stat().st_size==s['size'] and digest_file(p)==s['sha256']
    pf=pq.ParquetFile(p);expected=N//86+(i<N%86);assert pf.metadata.num_rows==expected
    writer=None;count=0
    try:
        for batch in pf.iter_batches(batch_size=1024,columns=COLUMNS):
            rows=[]
            for r in batch.to_pylist():
                ip=r['hashed_ip'];lang,ua=header_parts(r['header'])
                complete=all(valid(x) for x in (ip,lang,ua))
                users=[m for m in r['conversation'] if m['role']=='user']
                turn_ids=sorted(set(m['turn_identifier'] for m in users if m['turn_identifier'] is not None))
                ips={m['hashed_ip'] for m in users if valid(m['hashed_ip'])}
                heads={header_parts(m['header']) for m in users}
                ts=r['timestamp'];ts=ts.replace(tzinfo=timezone.utc) if ts is not None and ts.tzinfo is None else ts
                row={'row_index':start+count,'key':digest([ip,lang,ua]) if complete else None,
                     'ip_key':digest(ip) if valid(ip) else None,
                     'header_key':digest([lang,ua]) if valid(lang) and valid(ua) else None,
                     'content_hash':r['conversation_hash'],'timestamp':ts,
                     'missing_ip':not valid(ip),'missing_language_header':not valid(lang),
                     'missing_user_agent':not valid(ua),'turn_ids':turn_ids,
                     'user_turns':len(users),'ids_complete':len(users)>0 and all(m['turn_identifier'] is not None for m in users),
                     'turn_ip_count':len(ips),'turn_ip_matches_top':len(ips)==1 and ip in ips,
                     'turn_header_matches_top':len(heads)==1 and (lang,ua) in heads,
                     'turn_ip_complete':len(users)>0 and all(valid(m['hashed_ip']) for m in users)}
                rows.append(row);count+=1
            tab=pa.Table.from_pylist(rows)
            if writer is None:writer=pq.ParquetWriter(target.with_suffix('.tmp'),tab.schema,compression='zstd')
            writer.write_table(tab)
    finally:
        if writer:writer.close()
    assert count==expected;target.with_suffix('.tmp').replace(target);p.unlink()
    result={'revision':REV,'shard':i,'rows':count,'row_start':start,'source_sha256':s['sha256'],
            'feature_sha256':digest_file(target),'seconds':round(time.time()-begin,2)}
    save_json(cp,result);return result

def aggregate():
    import duckdb
    import numpy as np
    con=duckdb.connect(str(DERIVED/'analysis.duckdb'))
    con.execute("SET memory_limit='3GB'")
    con.execute("SET TimeZone='UTC'")
    con.execute('SET threads=4')
    con.execute(f"CREATE OR REPLACE VIEW rows AS SELECT * FROM read_parquet('{DERIVED}/*.parquet')")
    def one(sql):
        c=con.execute(sql);return dict(zip([x[0] for x in c.description],c.fetchone()))
    totals=one('''SELECT count(*) AS "rows", count(key) complete_key_rows, count(DISTINCT key) complete_keys,
      count(DISTINCT ip_key) ip_keys,count(DISTINCT header_key) header_keys,
      count(*) FILTER(WHERE missing_ip) missing_ip_rows,
      count(*) FILTER(WHERE missing_language_header) missing_language_header_rows,
      count(*) FILTER(WHERE missing_user_agent) missing_user_agent_rows,
      count(*) FILTER(WHERE timestamp IS NULL) missing_timestamp_rows,
      count(*) FILTER(WHERE turn_ip_count>1) mixed_turn_ip_rows,
      count(*) FILTER(WHERE NOT turn_ip_matches_top) top_ip_not_single_turn_ip_rows,
      count(*) FILTER(WHERE NOT turn_header_matches_top) turn_header_not_equal_top_rows,
      count(*) FILTER(WHERE NOT ids_complete) incomplete_turn_id_rows,
      min(timestamp) min_timestamp,max(timestamp) max_timestamp FROM rows''')
    assert totals['rows']==N
    con.execute('''CREATE OR REPLACE TABLE groups AS SELECT key,count(*) n,
      count(DISTINCT content_hash) distinct_contents,
      count(DISTINCT CAST(timestamp AS DATE)) active_dates,
      min(timestamp) first_seen,max(timestamp) last_seen,
      epoch(max(timestamp)-min(timestamp))/86400.0 span_days
      FROM rows WHERE key IS NOT NULL GROUP BY key''')
    def group_summary(table='groups',where='n>=2'):
        return one(f'''SELECT count(*) AS "groups",sum(n) AS "rows", min(n) min_rows,median(n) median_rows,
        quantile_cont(n,0.9) p90_rows,quantile_cont(n,0.99) p99_rows,max(n) max_rows,
        median(span_days) median_span_days,quantile_cont(span_days,0.9) p90_span_days,
        quantile_cont(span_days,0.99) p99_span_days,max(span_days) max_span_days,
        median(active_dates) median_active_dates,
        count(*) FILTER(WHERE span_days>=1) span_ge_1day,
        count(*) FILTER(WHERE span_days>=7) span_ge_7days,
        count(*) FILTER(WHERE span_days>=30) span_ge_30days,
        count(*) FILTER(WHERE span_days>=90) span_ge_90days,
        count(*) FILTER(WHERE active_dates>=3 AND span_days>=30) dates3_span30
        FROM {table} WHERE {where}''')
    raw=group_summary();content=group_summary(where='distinct_contents>=2')
    con.execute('''CREATE OR REPLACE TABLE ip_groups AS SELECT ip_key AS "key",count(*) n,
      count(DISTINCT CAST(timestamp AS DATE)) active_dates,
      epoch(max(timestamp)-min(timestamp))/86400.0 span_days FROM rows WHERE ip_key IS NOT NULL GROUP BY ip_key''')
    ip=group_summary('ip_groups')
    ip['population']='All source rows with nonblank hashed_ip; includes incomplete-header rows'
    con.execute('''CREATE OR REPLACE TABLE ip_complete_groups AS SELECT ip_key AS "key",count(*) n,
      count(DISTINCT CAST(timestamp AS DATE)) active_dates,
      epoch(max(timestamp)-min(timestamp))/86400.0 span_days FROM rows WHERE key IS NOT NULL GROUP BY ip_key''')
    ip_complete=group_summary('ip_complete_groups')
    ip_complete['population']='Same complete-key rows as the main exact-key analysis'
    con.execute('''CREATE OR REPLACE TABLE strict_groups AS SELECT key,count(*) n,
      count(DISTINCT CAST(timestamp AS DATE)) active_dates,
      epoch(max(timestamp)-min(timestamp))/86400.0 span_days FROM rows
      WHERE key IS NOT NULL AND turn_ip_matches_top AND turn_header_matches_top AND turn_ip_complete GROUP BY key''')
    strict=group_summary('strict_groups')
    # Shared turn IDs detect reused stored identifiers, not all text overlap.
    # Collapse overlaps globally before counting lineages within a technical key.
    parent=np.arange(N,dtype=np.int32)
    def root(x):
        while parent[x]!=x:
            parent[x]=parent[parent[x]];x=int(parent[x])
        return x
    seen={};shared=0;missing=0
    q=con.execute('SELECT row_index,turn_ids FROM rows')
    while True:
        chunk=q.fetchmany(20000)
        if not chunk:break
        for idx,ids in chunk:
            if not ids:missing+=1
            for tid in ids:
                prev=seen.get(tid)
                if prev is None:seen[tid]=idx
                else:
                    shared+=1;a=root(idx);b=root(prev)
                    if a!=b:parent[a]=b
    unique_turns=len(seen);del seen
    roots=np.fromiter((root(i) for i in range(N)),dtype=np.int32,count=N)
    components=pa.table({'row_index':np.arange(N,dtype=np.int32),'component':roots})
    con.register('components',components)
    con.execute('''CREATE OR REPLACE TABLE lineage_groups AS SELECT r.key,count(DISTINCT c.component) lineages,
      count(*) n,count(DISTINCT CAST(timestamp AS DATE)) active_dates,
      epoch(max(timestamp)-min(timestamp))/86400.0 span_days
      FROM rows r JOIN components c USING(row_index) WHERE r.key IS NOT NULL GROUP BY r.key''')
    lineages=group_summary('lineage_groups','lineages>=2')
    # A stricter span uses one last-observed timestamp per lineage, preventing
    # a long shared history from by itself producing a long between-lineage span.
    con.execute('''CREATE OR REPLACE TABLE lineage_dates AS SELECT r.key,c.component,max(timestamp) observed
      FROM rows r JOIN components c USING(row_index) WHERE r.key IS NOT NULL GROUP BY r.key,c.component''')
    con.execute('''CREATE OR REPLACE TABLE lineage_activity AS SELECT key,count(*) n,
      count(DISTINCT CAST(observed AS DATE)) active_dates,
      epoch(max(observed)-min(observed))/86400.0 span_days FROM lineage_dates GROUP BY key''')
    lineage_activity=group_summary('lineage_activity')
    for name in ['rows','min_rows','median_rows','p90_rows','p99_rows','max_rows']:
        lineage_activity[name.replace('rows','lineages')]=lineage_activity.pop(name)
    lineage_activity['count_unit']='shared-turn lineages, not source rows'
    content['interpretation']='Eligibility sensitivity: at least two content hashes; other metrics retain source rows and their timestamps'
    cross_key_components=one('''SELECT count(*) components_with_multiple_complete_keys FROM
      (SELECT c.component FROM rows r JOIN components c USING(row_index) WHERE r.key IS NOT NULL
      GROUP BY c.component HAVING count(DISTINCT r.key)>1)''')
    distribution=con.execute('''SELECT CASE WHEN span_days IS NULL THEN 'missing timestamp' WHEN span_days=0 THEN '0 days' WHEN span_days<1 THEN '<1 day'
      WHEN span_days<7 THEN '1–6 days' WHEN span_days<30 THEN '7–29 days'
      WHEN span_days<90 THEN '30–89 days' WHEN span_days<365 THEN '90–364 days' ELSE '365+ days' END band,
      count(*) AS "groups" FROM groups WHERE n>=2 GROUP BY band''').fetchall()
    countdist=con.execute('''SELECT CASE WHEN n=1 THEN '1' WHEN n<=5 THEN '2–5' WHEN n<=20 THEN '6–20'
      WHEN n<=100 THEN '21–100' ELSE '101+' END band,count(*) AS "groups",sum(n) AS "rows" FROM groups GROUP BY band''').fetchall()
    concentration=one('''SELECT sum(n) FILTER(WHERE rank<=10) top10_rows,
      sum(n) FILTER(WHERE rank<=100) top100_rows FROM (SELECT n,row_number() OVER(ORDER BY n DESC) rank FROM groups)''')
    result={'dataset':'allenai/WildChat-4.8M','revision':REV,'split':'train','scope':'All 86 pinned source shards',
      'group_key':'Exact tuple (hashed_ip, header.accept-language, header.user-agent); all components nonblank',
      'unit':'Technical-key groups, NOT people','span_definition':'Difference between latest and earliest row timestamps (UTC last-turn timestamps)',
      'totals':totals,'repeated_key_groups':raw,'at_least_two_distinct_contents':content,
      'ip_only_sensitivity':ip,'ip_only_complete_rows_sensitivity':ip_complete,
      'consistent_turn_metadata_sensitivity':strict,
      'shared_turn_lineages':{'unique_user_turn_ids':unique_turns,'shared_turn_occurrences_across_rows':shared,
        'rows_without_turn_ids':missing,'components':int(len(np.unique(roots))),**cross_key_components,
        'groups_with_multiple_lineages':lineages,'one_last_timestamp_per_lineage':lineage_activity,
        'interpretation':'No shared IDs does not establish absence of copied or overlapping text'},
      'span_distribution':[{'band':a,'groups':b} for a,b in distribution],
      'records_per_key_distribution':[{'band':a,'groups':b,'rows':c} for a,b,c in countdist],
      'concentration':concentration,'source_fields':COLUMNS,'raw_text_read':False,
      'raw_text_read_definition':'Message content was not projected or analyzed; full source shards were temporarily downloaded for metadata extraction',
      'raw_shards_retained':False,'linkage_keys_published':False}
    save_json(OUT/'summary.json',result)
    con.execute(f"COPY (SELECT n,span_days,active_dates,distinct_contents FROM groups) TO '{DERIVED}/group_distribution.csv' (HEADER, DELIMITER ',')")
    print(json.dumps(result,default=str),flush=True)

def main():
    p=argparse.ArgumentParser();p.add_argument('--workers',type=int,default=4);p.add_argument('--limit',type=int);p.add_argument('--aggregate-only',action='store_true');a=p.parse_args()
    for x in [RAW,DERIVED,OUT/'shards']:x.mkdir(parents=True,exist_ok=True)
    if not a.aggregate_only:
        files=json.loads((ROOT/'outputs/validation_discovery/original_shards.json').read_text())['files']
        tasks=[];start=0
        for i,s in enumerate(files):
            tasks.append((i,start,s));start+=N//86+(i<N%86)
        with concurrent.futures.ProcessPoolExecutor(max_workers=a.workers) as pool:
            fs=[pool.submit(scan,t) for t in (tasks[:a.limit] if a.limit else tasks)]
            for f in concurrent.futures.as_completed(fs):
                r=f.result();print(json.dumps({'shard':r['shard'],'done':len(list((OUT/'shards').glob('*.json'))),'seconds':r['seconds']}),flush=True)
    if not a.limit:aggregate()

if __name__=='__main__':main()
