"""Retrieve a preselected global row sample for relational-content annotation.

The draw is fixed before labels are assigned. Complete immutable source shards
are temporarily downloaded and checksum-verified, then only the selected rows
are retained with role/content messages and minimal source metadata. Raw text
stays under ignored data/raw/. No content, language or length prefilter is used.
"""
import argparse
import concurrent.futures
import datetime
import hashlib
import json
import pathlib
import random
import subprocess
import time

import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq

ROOT = pathlib.Path(__file__).resolve().parents[1]
REV = "c827c6df8fcf008219ffaffa4d1dd77491099367"
N = 3199860
SAMPLE_N = 2000
SEED = 2026102002
OUT = ROOT / "outputs/relational_v2"
RAW = ROOT / "data/raw/relational_v2"
COLUMNS = [
    "conversation_hash", "model", "timestamp", "turn", "language",
    "toxic", "redacted", "conversation.list.element.role",
    "conversation.list.element.content",
]


def sha(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for part in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            h.update(part)
    return h.hexdigest()


def atomic_json(path, obj):
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n")
    temporary.replace(path)


def text_sha(conversation):
    payload = json.dumps(conversation, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def make_plan():
    ids = sorted(random.Random(SEED).sample(range(N), SAMPLE_N))
    plan = {
        "dataset": "allenai/WildChat-4.8M", "config": "default", "split": "train",
        "revision": REV, "population_rows": N, "sample_rows": SAMPLE_N,
        "seed": SEED,
        "algorithm": "Python random.Random(seed).sample(range(N), n), without replacement; sorted only for retrieval",
        "selection_unit": "One released row across the entire pinned split; not a distinct person or necessarily a unique conversation",
        "filters_before_selection": [], "deduplicated_before_selection": False,
        "old_sample_excluded": False,
        "annotation_unit": "Final active user request, interpreted using stored dialogue; earlier relational segments are recorded separately",
        "row_indices": ids,
    }
    path = OUT / "sample_plan.json"
    if path.exists():
        existing = json.loads(path.read_text())
        assert all(existing[k] == v for k, v in plan.items()), "Existing sample plan differs"
        return existing
    plan["plan_created_at_utc"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    plan["created_before_annotation"] = True
    atomic_json(path, plan)
    return plan


def shard_task(task):
    index, start, count, source, selected = task
    stem = f"{index:05d}"
    checkpoint = OUT / "shards" / f"{stem}.json"
    rows_dir = RAW / "rows"
    if checkpoint.exists():
        saved = json.loads(checkpoint.read_text())
        if (saved.get("complete") and saved.get("source_sha256") == source["sha256"]
                and saved.get("row_start") == start and saved.get("source_rows") == count
                and sorted(r["row_index"] for r in saved["selected_rows"]) == selected
                and all((rows_dir / f'{r["row_index"]}.json').exists()
                        and sha(rows_dir / f'{r["row_index"]}.json') == r["file_sha256"]
                        for r in saved["selected_rows"])):
            return saved
    begun = time.time()
    path = RAW / "shards" / f"{stem}.parquet"
    if not path.exists() or path.stat().st_size != source["size"]:
        temporary = path.with_suffix(".download")
        subprocess.run([
            "curl", "--http1.1", "-L", "--fail", "--silent", "--show-error",
            "--retry", "5", "--retry-all-errors", "--retry-delay", "2",
            "--connect-timeout", "30", "--max-time", "600",
            "--output", str(temporary), source["url"],
        ], check=True)
        assert temporary.stat().st_size == source["size"], f"Wrong source size: {stem}"
        temporary.replace(path)
    digest = sha(path)
    assert digest == source["sha256"], f"Wrong pinned source digest: {stem}"
    pf = pq.ParquetFile(path)
    assert pf.metadata.num_rows == count, f"Wrong source row count: {stem}"
    wanted = set(selected)
    row_index = start
    retained = []
    for batch in pf.iter_batches(batch_size=512, columns=COLUMNS):
        # Avoid converting unselected batches to Python objects.
        batch_end = row_index + batch.num_rows
        if any(row_index <= i < batch_end for i in wanted):
            for offset, row in enumerate(batch.to_pylist()):
                global_index = row_index + offset
                if global_index not in wanted:
                    continue
                conversation = [{"role": m["role"], "content": m["content"] or ""}
                                for m in row["conversation"]]
                output = {
                    "row_index": global_index, "revision": REV,
                    "source_shard": source["path"], "source_shard_sha256": digest,
                    "conversation_hash": row["conversation_hash"],
                    "language": row["language"], "source_language": row["language"],
                    "model": row["model"], "timestamp": str(row["timestamp"]),
                    "source_turn": row["turn"], "toxic": bool(row["toxic"]),
                    "redacted": bool(row["redacted"]), "truncated_cells": [],
                    "conversation": conversation, "text_sha256": text_sha(conversation),
                }
                target = rows_dir / f"{global_index}.json"
                atomic_json(target, output)
                retained.append({
                    "row_index": global_index, "text_sha256": output["text_sha256"],
                    "file_sha256": sha(target), "stored_messages": len(conversation),
                    "user_messages": sum(m["role"] == "user" for m in conversation),
                    "source_language": row["language"],
                })
        row_index = batch_end
    assert row_index == start + count
    assert sorted(r["row_index"] for r in retained) == selected
    result = {
        "complete": True, "revision": REV, "shard": index,
        "source_url": source["url"], "source_sha256": digest,
        "source_bytes": source["size"], "row_start": start, "source_rows": count,
        "source_lfs_digest_verified": True, "selected_rows": retained,
        "retrieved_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "elapsed_seconds": round(time.time() - begun, 2),
    }
    atomic_json(checkpoint, result)
    path.unlink()
    return result


def verify_against_census(checkpoints):
    """Check independently retained census features at every selected row index."""
    checked = 0
    fields = ["conversation_hash", "language", "model", "date", "source_turn",
              "user_turns", "assistant_messages", "stored_messages", "user_words",
              "assistant_words", "empty_user_messages", "redacted", "toxic"]
    for checkpoint in checkpoints:
        stem = f'{checkpoint["shard"]:05d}'
        old_checkpoint = ROOT / "outputs/sampling_validation/shards" / f"{stem}.json"
        census_path = ROOT / "data/derived/validation" / f"{stem}.parquet"
        saved = json.loads(old_checkpoint.read_text())
        assert saved["sha256"] == checkpoint["source_sha256"]
        assert sha(census_path) == saved["feature_sha256"]
        table = pq.read_table(census_path, columns=["row_index"] + fields)
        ids = [r["row_index"] for r in checkpoint["selected_rows"]]
        matches = table.filter(pc.is_in(table["row_index"], value_set=pa.array(ids)))
        assert matches.num_rows == len(ids)
        for previous in matches.to_pylist():
            row = json.loads((RAW / "rows" / f'{previous["row_index"]}.json').read_text())
            users = [m["content"] for m in row["conversation"] if m["role"] == "user"]
            assistants = [m["content"] for m in row["conversation"] if m["role"] == "assistant"]
            current = {key: row[key] for key in ["conversation_hash", "language", "model", "source_turn", "redacted", "toxic"]}
            current.update({
                "date": row["timestamp"][:10], "user_turns": len(users),
                "assistant_messages": len(assistants), "stored_messages": len(row["conversation"]),
                "user_words": len("\n".join(users).split()),
                "assistant_words": sum(len(text.split()) for text in assistants),
                "empty_user_messages": sum(not text.strip() for text in users),
            })
            assert all(current[key] == previous[key] for key in fields), f'Census mismatch: {row["row_index"]}'
            checked += 1
    return {"compared_rows": checked, "fields": fields, "mismatches": 0,
            "census_feature_files_checksum_verified": True}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()
    for path in [OUT, OUT / "shards", RAW / "shards", RAW / "rows"]:
        path.mkdir(parents=True, exist_ok=True)
    plan = make_plan()
    sources = json.loads((ROOT / "outputs/validation_discovery/original_shards.json").read_text())
    assert sources["revision"] == REV and len(sources["files"]) == 86
    tasks = []
    start = 0
    for i, source in enumerate(sources["files"]):
        count = N // 86 + int(i < N % 86)
        selected = [r for r in plan["row_indices"] if start <= r < start + count]
        tasks.append((i, start, count, source, selected))
        start += count
    assert start == N
    failures = []
    with concurrent.futures.ProcessPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(shard_task, task): task[0] for task in tasks}
        for future in concurrent.futures.as_completed(futures):
            index = futures[future]
            try:
                result = future.result()
                print(json.dumps({"shard": index, "selected": len(result["selected_rows"]),
                                  "shards_done": len(list((OUT / "shards").glob("*.json"))),
                                  "seconds": result["elapsed_seconds"]}), flush=True)
            except Exception as error:
                failures.append({"shard": index, "error": str(error)})
                print(json.dumps({"failed": failures[-1]}), flush=True)
    if failures:
        raise RuntimeError(f"Retry the same command; {len(failures)} incomplete shards: {failures}")
    checkpoints = [json.loads(p.read_text()) for p in sorted((OUT / "shards").glob("*.json"))]
    selected = [r for c in checkpoints for r in c["selected_rows"]]
    assert len(checkpoints) == 86 and sum(c["source_rows"] for c in checkpoints) == N
    assert sorted(r["row_index"] for r in selected) == plan["row_indices"]
    assert all(sha(RAW / "rows" / f'{r["row_index"]}.json') == r["file_sha256"] for r in selected)
    census_check = verify_against_census(checkpoints)
    manifest = {
        "complete": True, "dataset": plan["dataset"], "revision": REV,
        "config": "default", "split": "train", "population_rows": N,
        "sample_rows": SAMPLE_N, "seed": SEED,
        "sample_plan_sha256": sha(OUT / "sample_plan.json"),
        "shards_verified": 86, "all_lfs_digests_verified": True,
        "source_columns": COLUMNS,
        "raw_shards_retained": False, "raw_text_path": "data/raw/relational_v2/rows/ (Git-ignored)",
        "excluded_source_fields": "IP, location, headers, device data and moderation details are not retained",
        "temporary_downloads": "Full immutable source shards downloaded for checksum verification, then deleted after selected-row extraction",
        "retrieval_completed_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "census_cross_check": census_check,
        "rows": selected,
    }
    atomic_json(OUT / "retrieval_manifest.json", manifest)
    print(json.dumps({"complete": True, "rows": len(selected), "manifest": str(OUT / "retrieval_manifest.json")}), flush=True)


if __name__ == "__main__":
    main()
