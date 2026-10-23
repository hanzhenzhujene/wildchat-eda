"""Census of pinned released rows; independent uniform-row reference.

Download one immutable shard per worker, project only needed columns, save
text-free features locally, then delete the downloaded shard. Per-shard outputs
are resumable. Complete shards exist temporarily during extraction. Derived
outputs contain no conversation text; completed raw shards are deleted.
Run with .venv/bin/python src/validate_sampling.py --workers 4
"""
import argparse
import concurrent.futures
import csv
import gzip
import hashlib
import json
import pathlib
import random
import subprocess
import time

import pyarrow as pa
import pyarrow.parquet as pq

from analyze import features
from supplementary import PATTERNS

ROOT = pathlib.Path(__file__).resolve().parents[1]
REV = "c827c6df8fcf008219ffaffa4d1dd77491099367"
N = 3199860
SEED = 20261020
SAMPLE_N = 20000
RAW = ROOT / "data/raw/validation/shards"
DERIVED = ROOT / "data/derived/validation"
OUT = ROOT / "outputs/sampling_validation"
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
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(obj, indent=2))
    temp.replace(path)


def shard_task(task):
    i, start, expected_rows, size, expected_hash = task
    stem = f"{i:05d}"
    checkpoint = OUT / "shards" / f"{stem}.json"
    target = DERIVED / f"{stem}.parquet"
    ref_target = DERIVED / f"{stem}-random.json"
    if checkpoint.exists() and target.exists() and ref_target.exists():
        saved = json.loads(checkpoint.read_text())
        expected_ids = sorted(x for x in random.Random(SEED).sample(range(N), SAMPLE_N)
                              if start <= x < start + expected_rows)
        cached_ids = sorted(r["row_index"] for r in json.loads(ref_target.read_text()))
        if (saved["complete"] and saved["revision"] == REV
                and saved["row_start"] == start and saved["rows"] == expected_rows
                and saved["sha256"] == expected_hash and cached_ids == expected_ids
                and sha(target) == saved["feature_sha256"]
                and sha(ref_target) == saved["reference_sha256"]):
            return saved
    begun = time.time()
    path = RAW / f"{stem}.parquet"
    url = f"https://huggingface.co/datasets/allenai/WildChat-4.8M/resolve/{REV}/data/train-{stem}-of-00086.parquet"
    if not path.exists() or path.stat().st_size != size:
        temp = path.with_suffix(".download")
        subprocess.run([
            "curl", "-L", "--fail", "--silent", "--show-error", "--retry", "4", "--retry-all-errors",
            "--retry-delay", "2", "--output", str(temp), url,
        ], check=True)
        assert temp.stat().st_size == size, f"Wrong shard size {i}"
        temp.replace(path)
    digest = sha(path)
    if expected_hash:
        assert digest == expected_hash, f"Wrong immutable shard digest {i}"
    pf = pq.ParquetFile(path)
    assert pf.metadata.num_rows == expected_rows
    selected = set(random.Random(SEED).sample(range(N), SAMPLE_N))
    ref = []
    writer = None
    row_index = start
    mismatches = 0
    rows_written = 0
    try:
        for batch in pf.iter_batches(batch_size=512, columns=COLUMNS):
            computed = []
            for r in batch.to_pylist():
                conv = r["conversation"]
                users = [m["content"] or "" for m in conv if m["role"] == "user"]
                assistants = [m["content"] or "" for m in conv if m["role"] == "assistant"]
                user_text = "\n".join(users)
                u = len(users)
                mismatches += u != r["turn"]
                f = {
                    "row_index": row_index,
                    "conversation_hash": r["conversation_hash"],
                    "model": r["model"],
                    "language": r["language"],
                    "date": str(r["timestamp"])[:10],
                    "source_turn": r["turn"],
                    "user_turns": u,
                    "assistant_messages": len(assistants),
                    "stored_messages": len(conv),
                    "other_messages": len(conv) - u - len(assistants),
                    "user_words": len(user_text.split()),
                    "assistant_words": sum(len(t.split()) for t in assistants),
                    "empty_user_messages": sum(not t.strip() for t in users),
                    "redacted": bool(r["redacted"]),
                    "toxic": bool(r["toxic"]),
                    "known_group_wrapper": bool(PATTERNS["named_bot_persona"].search(user_text))
                    and bool(PATTERNS["group_environment"].search(user_text)),
                }
                computed.append(f)
                if row_index in selected:
                    r["row_index"] = row_index
                    r["truncated_cells"] = []
                    rf = features(r)
                    rf.update({key: bool(pattern.search(user_text)) for key, pattern in PATTERNS.items()})
                    rf["known_group_wrapper"] = f["known_group_wrapper"]
                    rf["stored_messages"] = len(conv)
                    ref.append(rf)
                row_index += 1
            table = pa.Table.from_pylist(computed)
            if writer is None:
                writer = pq.ParquetWriter(target.with_suffix(".tmp"), table.schema, compression="zstd")
            writer.write_table(table)
            rows_written += len(computed)
    finally:
        if writer:
            writer.close()
    assert rows_written == expected_rows
    target.with_suffix(".tmp").replace(target)
    atomic_json(ref_target, ref)
    result = {
        "complete": True, "revision": REV, "shard": i, "url": url,
        "row_start": start, "rows": rows_written, "bytes": size,
        "sha256": digest, "lfs_digest_verified": bool(expected_hash),
        "source_turn_mismatches": mismatches, "reference_rows": len(ref),
        "elapsed_seconds": round(time.time() - begun, 2),
        "feature_sha256": sha(target), "reference_sha256": sha(ref_target),
    }
    atomic_json(checkpoint, result)
    path.unlink()
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--limit", type=int)
    args = parser.parse_args()
    for p in [RAW, DERIVED, OUT / "shards"]:
        p.mkdir(parents=True, exist_ok=True)
    shards_path = ROOT / "outputs/validation_discovery/original_shards.json"
    assert shards_path.exists(), "Need immutable original shard manifest first"
    manifest = json.loads(shards_path.read_text())
    shards = manifest["files"]
    assert len(shards) == 86
    selected = sorted(random.Random(SEED).sample(range(N), SAMPLE_N))
    atomic_json(OUT / "random_sample_plan.json", {
        "dataset": "allenai/WildChat-4.8M", "config": "default", "split": "train",
        "revision": REV, "population_rows": N, "sample_rows": SAMPLE_N,
        "seed": SEED, "algorithm": "Python random.Random(seed).sample(range(N), n), without replacement",
        "selection_unit": "One released row, across the entire pinned split",
        "filters_before_selection": [], "old_sample_excluded": False,
        "row_indices": selected,
    })
    tasks = []
    start = 0
    # Hugging Face contiguous sharding uses quotient + remainder. Each count is
    # checked against the actual Parquet footer before assigning row indices.
    for i, s in enumerate(shards):
        count = N // 86 + (i < N % 86)
        tasks.append((i, start, count, s["size"], s["sha256"]))
        start += count
    assert start == N
    if args.limit:
        tasks = tasks[:args.limit]
    with concurrent.futures.ProcessPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(shard_task, t): t[0] for t in tasks}
        for future in concurrent.futures.as_completed(futures):
            r = future.result()
            done = len(list((OUT / "shards").glob("*.json")))
            print(json.dumps({"shard": r["shard"], "done": done, "total": 86,
                              "rows": r["rows"], "seconds": r["elapsed_seconds"]}), flush=True)
    if args.limit:
        return
    results = [json.loads(p.read_text()) for p in sorted((OUT / "shards").glob("*.json"))]
    assert len(results) == 86 and sum(r["rows"] for r in results) == N
    reference = []
    for p in sorted(DERIVED.glob("*-random.json")):
        reference.extend(json.loads(p.read_text()))
    assert len(reference) == SAMPLE_N
    assert sorted(r["row_index"] for r in reference) == selected
    with gzip.open(OUT / "random_features.csv.gz", "wt") as stream:
        w = csv.DictWriter(stream, fieldnames=list(reference[0]))
        w.writeheader()
        w.writerows(reference)
    atomic_json(OUT / "scan_manifest.json", {
        "complete": True, "dataset": "allenai/WildChat-4.8M",
        "config": "default", "split": "train", "revision": REV,
        "population_rows": N, "rows_processed": sum(r["rows"] for r in results),
        "shards_processed": len(results), "source_columns": COLUMNS,
        "all_lfs_digests_verified": all(r["lfs_digest_verified"] for r in results),
        "source_turn_mismatches": sum(r["source_turn_mismatches"] for r in results),
        "random_sample_rows": len(reference), "seed": SEED,
        "retrieval_date": time.strftime("%Y-%m-%d"),
        "excluded_columns": "IP, geographic, device/header fields and moderation details were not projected",
        "raw_shards_retained": False, "raw_text_in_derived_outputs": False,
        "temporary_downloads": "Complete source shards were downloaded, projected, then deleted after each completed shard.",
    })
    print("COMPLETE", flush=True)


if __name__ == "__main__":
    main()
