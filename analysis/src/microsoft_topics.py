"""Aggregate pinned, already released Microsoft labels without new inference.

Raw labels and record keys remain in ignored data directories. Public outputs
contain aggregate counts, provenance, taxonomy definitions and audit results.
No paper-specific IP, date, language or template filters are applied.
"""
import argparse
import ast
import collections
import concurrent.futures
import datetime
import hashlib
import json
import pathlib
import re
import sqlite3
import time

import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq
import requests

ROOT = pathlib.Path(__file__).resolve().parents[1]
REPO = "microsoft/adopt-adapt-wildchat"
REV = "b4e77e44b62ba2ddd0f7b53667b218e345faba09"
UPSTREAM = "allenai/WildChat-4.8M"
UPSTREAM_REV = "c827c6df8fcf008219ffaffa4d1dd77491099367"
N = 3199860
RAW = ROOT / "data/raw/microsoft_topics" / REV
DERIVED = ROOT / "data/derived/microsoft_topics"
OUT = ROOT / "outputs/microsoft_topics"
KEYS = ["conversation_hash", "model", "timestamp", "turn", "language", "hashed_ip", "state", "country"]
PUBLIC_KEYS = KEYS[:5]
KINDS = {"domain": ("conversation_domain", "DomainLabel", "domain_prompt"),
         "intent": ("user_intent", "IntentLabel", "intent_prompt")}


def sha(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for part in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            h.update(part)
    return h.hexdigest()


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
    temp.replace(path)


def get(url):
    for attempt in range(6):
        try:
            r = requests.get(url, timeout=120)
            r.raise_for_status()
            return r
        except requests.RequestException:
            if attempt == 5:
                raise
            time.sleep(min(2 ** attempt, 20))


def taxonomy(source):
    tree = ast.parse(source)
    constants = {}
    enums = {}
    for node in tree.body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            try:
                constants[node.targets[0].id] = ast.literal_eval(node.value)
            except (ValueError, TypeError):
                pass
        if isinstance(node, ast.ClassDef) and node.name in {"DomainLabel", "IntentLabel"}:
            enums[node.name] = {a.targets[0].id: ast.literal_eval(a.value)
                                for a in node.body if isinstance(a, ast.Assign)}
    result = {}
    for kind, (_, enum, prompt) in KINDS.items():
        definitions = dict(re.findall(r"^- ([a-z_]+): (.+)$", constants[prompt], re.M))
        result[kind] = [{"raw_label": f"{enum}.{name}", "id": value,
                         "label": value.replace("_", " ").title().replace(" And ", " and ").replace(" Or ", " or "),
                         "definition": definitions.get(value, "")}
                        for name, value in enums[enum].items()]
    return constants, result


def prepare():
    for p in [RAW, DERIVED, DERIVED / "partitions", OUT / "source"]:
        p.mkdir(parents=True, exist_ok=True)
    source = {}
    for filename in ["README.md", "LICENSE", "classify.py", "wildchat_metrics.py", "worker_pool.py"]:
        path = OUT / "source" / filename
        if not path.exists():
            path.write_bytes(get(f"https://raw.githubusercontent.com/{REPO}/{REV}/{filename}").content)
        source[filename] = sha(path)
    tree_path = OUT / "source_tree.json"
    if tree_path.exists():
        tree = json.loads(tree_path.read_text())
    else:
        tree = get(f"https://api.github.com/repos/{REPO}/git/trees/{REV}?recursive=1").json()
        write(tree_path, tree)
    assert tree["sha"] == REV
    files = [item for item in tree["tree"] if "/no-content/" in item["path"]
             and re.search(r"-(domain|intent)\.parquet$", item["path"])]
    assert len(files) == 172
    return source, files


def fetch(item):
    path = item["path"]
    name = pathlib.Path(path).name
    pointer_path = RAW / (name + ".lfs")
    if not pointer_path.exists():
        pointer_path.write_bytes(get(f"https://raw.githubusercontent.com/{REPO}/{REV}/{path}").content)
    pointer = pointer_path.read_text()
    digest = re.search(r"oid sha256:([0-9a-f]{64})", pointer)[1]
    size = int(re.search(r"^size (\d+)$", pointer, re.M)[1])
    local = RAW / name
    url = f"https://media.githubusercontent.com/media/{REPO}/{REV}/{path}"
    if not local.exists() or local.stat().st_size != size:
        content = get(url).content
        assert len(content) == size and hashlib.sha256(content).hexdigest() == digest
        temp = local.with_suffix(".download")
        temp.write_bytes(content)
        temp.replace(local)
    assert sha(local) == digest, f"LFS digest mismatch: {name}"
    pf = pq.ParquetFile(local)
    kind = name.rsplit("-", 1)[1].split(".")[0]
    shard = int(name.rsplit("-", 2)[1])
    return {"path": path, "name": name, "url": url, "sha256": digest,
            "bytes": size, "rows": pf.metadata.num_rows, "kind": kind,
            "shard": shard, "schema": str(pf.schema_arrow.remove_metadata())}


def normalized_label(raw, mapping):
    return mapping.get(raw, "unclassified")


def fingerprint(values):
    # Serialization is unambiguous and preserves null versus empty string.
    normalized = [v.isoformat(timespec="microseconds") if isinstance(v, datetime.datetime) else v for v in values]
    return hashlib.sha256(json.dumps(normalized, ensure_ascii=False, separators=(",", ":")).encode()).digest()


def aggregate(manifest, tax):
    counts = {kind: collections.Counter() for kind in KINDS}
    missing_raw = {kind: collections.Counter() for kind in KINDS}
    mappings = {kind: {row["raw_label"]: row["id"] for row in tax[kind]} for kind in KINDS}
    index = {(f["shard"], f["kind"]): f for f in manifest}
    database = DERIVED / "key_audit.sqlite"
    if database.exists():
        database.unlink()
    db = sqlite3.connect(database)
    db.execute("PRAGMA journal_mode=OFF")
    db.execute("PRAGMA synchronous=OFF")
    db.execute("CREATE TABLE keys (key8 BLOB, key5 BLOB, content_hash TEXT, domain_id TEXT, intent_id TEXT)")
    offset = 0
    census_rows = 0
    partition_audit = []
    writer = None
    target = DERIVED / "labels.parquet"
    tmp = target.with_suffix(".tmp")
    language = collections.Counter()
    min_date = None
    max_date = None
    for shard in range(86):
        tables = {kind: pq.read_table(RAW / index[(shard, kind)]["name"], columns=KEYS + [col])
                  for kind, (col, _, _) in KINDS.items()}
        domain, intent = tables["domain"], tables["intent"]
        assert domain.select(KEYS).equals(intent.select(KEYS), check_metadata=False), f"Unaligned label keys: {shard}"
        rows = len(domain)
        census_path = ROOT / f"data/derived/validation/{shard:05d}.parquet"
        checkpoint = json.loads((ROOT / f"outputs/sampling_validation/shards/{shard:05d}.json").read_text())
        assert checkpoint["revision"] == UPSTREAM_REV and checkpoint["complete"]
        assert sha(census_path) == checkpoint["feature_sha256"]
        census = pq.read_table(census_path,
                              columns=["row_index", "conversation_hash", "model", "language", "date", "source_turn"])
        assert rows == len(census), f"Source row count mismatch: {shard}"
        for label_key, source_key in [("conversation_hash", "conversation_hash"), ("model", "model"),
                                      ("language", "language"), ("turn", "source_turn")]:
            assert domain[label_key].equals(census[source_key]), f"Source row order mismatch: {shard}:{label_key}"
        dates = pc.strftime(domain["timestamp"], format="%Y-%m-%d")
        assert dates.equals(census["date"]), f"Source date mismatch: {shard}"
        assert census["row_index"].to_pylist() == list(range(offset, offset + rows))
        census_rows += rows
        outputs = {}
        for kind, (col, _, _) in KINDS.items():
            raw_values = tables[kind][col].to_pylist()
            values = [normalized_label(value, mappings[kind]) for value in raw_values]
            counts[kind].update(values)
            missing_raw[kind].update(str(value) for value in raw_values if value not in mappings[kind])
            outputs[kind] = pa.array(values)
        key_rows = domain.select(KEYS).to_pylist()
        domain_ids, intent_ids = outputs["domain"].to_pylist(), outputs["intent"].to_pylist()
        db.executemany("INSERT INTO keys VALUES (?,?,?,?,?)", [
            (fingerprint([r[k] for k in KEYS]), fingerprint([r[k] for k in PUBLIC_KEYS]),
             r["conversation_hash"], domain_ids[i], intent_ids[i])
            for i, r in enumerate(key_rows)])
        db.commit()
        language.update(domain["language"].to_pylist())
        limits = pc.min_max(domain["timestamp"]).as_py()
        min_date = min(min_date, limits["min"]) if min_date else limits["min"]
        max_date = max(max_date, limits["max"]) if max_date else limits["max"]
        selected = domain.select(PUBLIC_KEYS)
        selected = selected.append_column("source_shard", pa.array([shard] * rows, type=pa.int16()))
        selected = selected.append_column("row_in_shard", pa.array(range(rows), type=pa.int32()))
        selected = selected.append_column("row_index", pa.array(range(offset, offset + rows), type=pa.int64()))
        selected = selected.append_column("domain_id", outputs["domain"])
        selected = selected.append_column("intent_id", outputs["intent"])
        partition = DERIVED / "partitions" / f"{shard:05d}.parquet"
        pq.write_table(selected, partition, compression="zstd")
        if writer is None:
            writer = pq.ParquetWriter(tmp, selected.schema, compression="zstd")
        writer.write_table(selected)
        partition_audit.append({"shard": shard, "rows": rows, "row_start": offset,
                                "source_order_validated": True, "derived_sha256": sha(partition)})
        offset += rows
        if shard % 10 == 0:
            print(f"Aggregated and source-aligned {shard + 1}/86 shards ({offset:,} records)", flush=True)
    writer.close()
    tmp.replace(target)
    assert offset == N and census_rows == N
    duplicates = {}
    for key in ["key8", "key5", "content_hash"]:
        result = db.execute(f"SELECT COUNT(*), COALESCE(SUM(n),0), COALESCE(SUM(n-1),0) FROM (SELECT COUNT(*) n FROM keys GROUP BY {key} HAVING n>1)").fetchone()
        duplicates[key] = {"duplicate_groups": result[0], "rows_in_duplicate_groups": result[1], "extra_rows": result[2]}
        conflicts = db.execute(f"SELECT COUNT(*) FROM (SELECT 1 FROM keys GROUP BY {key} HAVING COUNT(DISTINCT domain_id)>1 OR COUNT(DISTINCT intent_id)>1)").fetchone()[0]
        duplicates[key]["groups_with_conflicting_labels"] = conflicts
    db.close()
    write(OUT / "partitions.json", partition_audit)
    return {"total_rows": offset, "counts": counts, "missing_raw": missing_raw,
            "duplicates": duplicates, "source_aligned_rows": census_rows,
            "date_min": min_date.isoformat(), "date_max": max_date.isoformat(),
            "language_counts": dict(language), "derived_sha256": sha(target)}


def finalize(result, tax, source_hashes, manifest):
    total = result["total_rows"]
    source_url = f"https://github.com/{REPO}/tree/{REV}"
    summary = {
        "schema_version": 1,
        "source": {"name": "Adopt ≠ Adapt: released WildChat classifications", "repo": REPO,
                   "revision": REV, "url": source_url, "paper_url": "https://arxiv.org/abs/2605.29018v2",
                   "upstream_dataset": UPSTREAM, "upstream_revision": UPSTREAM_REV,
                   "authors_upstream_revision": None, "matched_atlas_revision": UPSTREAM_REV,
                   "upstream_revision_note": "Microsoft names the public release but does not pin its Hugging Face revision. upstream_revision is the Atlas reference validated by this audit, not a revision declared by Microsoft.",
                   "upstream_url": f"https://huggingface.co/datasets/{UPSTREAM}/tree/{UPSTREAM_REV}",
                   "classifier_model": "gpt-4o-mini", "classification_unit": "conversation",
                   "label_status": "AI labels; these released labels have not been human-checked here.",
                   "code_license": "MIT", "original_conversation_license": "ODC-BY",
                   "label_license_note": "The repository releases these outputs publicly and carries an MIT software license. It does not separately declare a license specific to the annotation files.",
                   "validation_note": "The paper adapts English intent/domain prompts previously evaluated against human consensus (reported Cohen's kappa 0.57/0.70 with GPT-4). This does not establish accuracy of every released GPT-4o-mini label or its multilingual performance.",
                   "validation_url": "https://arxiv.org/html/2605.29018v2#S4.SS2",
                   "input_scope": "All stored user and assistant messages; each message of at least 5,000 characters retains its first 2,500 and last 2,500 characters."},
        "scope": {"rows": total, "total_rows": total, "unit": "released conversation records",
                  "filters_applied": [], "deduplication_applied": False,
                  "coverage": "All 86 public WildChat-4.8M source shards; row count/order checked against the pinned source census.",
                  "denominator": total, "weighting": "One vote per released record, not per user or per unique text.",
                  "classification": "One domain and one intent per record. Missing or invalid labels remain as unclassified.",
                  "date_min": result["date_min"], "date_max": result["date_max"]},
        "quality": {"duplicate_keys": result["duplicates"], "source_aligned_rows": result["source_aligned_rows"],
                    "join_status": "Domain and intent full eight-field keys align in every shard. Each row matches pinned census hash/model/language/turn/date and row position.",
                    "validation_status": "The paper adapts previously validated English prompts. No human validation of these released domain/intent labels is recorded here; multilingual accuracy is not established."},
        "caveats": ["This public release already excludes toxicity-flagged content.",
                    "No additional IP, time, language, repetition or template filters were applied here.",
                    "This aggregation differs from the paper's filtered longitudinal study.",
                    "Repeated records, templated usage and prolific users contribute repeatedly.",
                    "Conversation_hash alone is not a unique record key."]}
    special_labels = {"machine_learning_and_ai": "Machine Learning and AI", "shopping_and_ecommerce": "Shopping and eCommerce",
                      "open_ended_discovery": "Open-Ended Discovery", "web_site_navigation": "Website Navigation"}
    for kind, plural in [("domain", "domains"), ("intent", "intents")]:
        rows = [{**row, "label": special_labels.get(row["id"], row["label"]), "count": result["counts"][kind][row["id"]],
                 "share_pct": 100 * result["counts"][kind][row["id"]] / total} for row in tax[kind]]
        for row in rows:
            row.pop("raw_label")
        unknown = result["counts"][kind]["unclassified"]
        rows.append({"id": "unclassified", "label": "Unclassified", "count": unknown,
                     "share_pct": 100 * unknown / total, "definition": "No valid released classifier label; retained in the denominator."})
        rows.sort(key=lambda row: (-row["count"], row["id"]))
        assert sum(row["count"] for row in rows) == total
        summary[plural] = rows
        summary["scope"][f"labeled_{kind}_rows"] = total - unknown
        summary["scope"][f"missing_{kind}_rows"] = unknown
        summary["quality"][f"missing_{kind}_values"] = dict(result["missing_raw"][kind])
    write(OUT / "summary.json", summary)
    audit = {"generated_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
             "script_sha256": sha(pathlib.Path(__file__)), "source_hashes": source_hashes,
             "label_files": len(manifest), "label_bytes": sum(f["bytes"] for f in manifest),
             "result": {k: v for k, v in result.items() if k not in {"counts", "missing_raw"}},
             "join_keys_full": KEYS, "join_keys_available_in_existing_cache": PUBLIC_KEYS,
             "fingerprint_method": "SHA-256 over canonical JSON of typed keys; timestamps normalized to microseconds, null preserved.",
             "source_census": "outputs/sampling_validation/shards/*.json and data/derived/validation/*.parquet",
             "source_census_validation": "All per-shard row counts and hash/model/language/turn/date columns match label row order. Existing cached text requires exact five-key timestamp match and row index agreement.",
             "paper_filters_not_applied": ["hashed IP conversation-count and location/language restrictions", "before September 2024", "template filtering"],
             "license_note": "Repository LICENSE grants MIT for software. Original conversation data is ODC-BY. Cite both the dataset and downstream classification paper; retain notices when copying code."}
    write(OUT / "audit.json", audit)
    text = ["# Microsoft topic and task label audit", "", f"Pinned repository: `{REPO}@{REV}`.",
            f"Source: `{UPSTREAM}@{UPSTREAM_REV}`; {total:,} released conversation records.", "",
            "No classifier was run. Existing public domain and intent label files were downloaded and their Git LFS SHA-256 checksums verified.",
            f"Downloaded {len(manifest)} files, {audit['label_bytes']:,} bytes. Domain/intent keys align row-for-row.",
            "All 86 shards align with the earlier immutable-source census on hash, model, language, turn, date and row order.", "",
            "Counts include every released row. No paper-specific IP, date, language or template filters and no deduplication were applied.",
            f"Valid domain labels: {summary['scope']['labeled_domain_rows']:,}; missing/invalid: {summary['scope']['missing_domain_rows']:,}.",
            f"Valid intent labels: {summary['scope']['labeled_intent_rows']:,}; missing/invalid: {summary['scope']['missing_intent_rows']:,}.",
            "Every percentage uses all 3,199,860 records as denominator, including the unclassified bucket.", "",
            "Model: GPT-4o-mini. All stored messages are supplied, with long messages shortened to their first/last 2,500 characters.",
            "One topical-domain label and one task-intent label are assigned per conversation. Labels are automated and not a human gold standard.",
            "The classifier prompts were developed/validated in English. Performance across the multilingual source is not established.", "",
            "The repository software license is MIT; source conversations use ODC-BY. Saved label metadata and aggregate counts are publicly released by the authors.",
            "Keep the raw label explanations, IP hashes and exact record join keys out of the public site.", "",
            "See audit.json, manifest.json and partitions.json for reproducible sizes, checksums, schemas, alignment and duplicate-key counts.", ""]
    (OUT / "audit.md").write_text("\n".join(text))
    print(json.dumps({"rows": total, "scope": summary["scope"], "top_domains": summary["domains"][:5],
                      "top_intents": summary["intents"][:5], "duplicates": result["duplicates"]}, indent=2), flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=6)
    args = parser.parse_args()
    source_hashes, files = prepare()
    constants, tax = taxonomy((OUT / "source/classify.py").read_text())
    assert constants["MODEL"] == "gpt-4o-mini"
    assert len(tax["domain"]) == 30 and len(tax["intent"]) == 9
    write(OUT / "taxonomy.json", tax)
    manifest = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        for i, item in enumerate(pool.map(fetch, files), 1):
            manifest.append(item)
            if i % 20 == 0:
                print(f"Verified {i}/{len(files)} label files", flush=True)
    write(OUT / "manifest.json", manifest)
    result = aggregate(manifest, tax)
    finalize(result, tax, source_hashes, manifest)


if __name__ == "__main__":
    main()
