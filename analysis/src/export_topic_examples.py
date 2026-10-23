"""Join cached originals to released Microsoft labels and export brief examples.

All example wording comes from the pinned WildChat source caches. Selection is
deliberate and illustrative. Topic labels retain Microsoft's AI-label status.
Raw messages and identifier values are never printed. Outputs stay outside Git.
"""
import argparse
import collections
import datetime
import hashlib
import json
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
REV = "c827c6df8fcf008219ffaffa4d1dd77491099367"
DATASET = "allenai/WildChat-4.8M"
LABEL_REV = "b4e77e44b62ba2ddd0f7b53667b218e345faba09"
LICENSE_URL = "https://opendatacommons.org/licenses/by/1-0/"
REVIEWED_SELECTIONS = {
    ("domain", "adult"): (1092973, "Neutral question about NSFW support; no graphic source wording."),
    ("domain", "gaming"): (220335, "Direct question about a named video game."),
    ("domain", "professional_writing_and_editing"): (657284, "Supplied sentence and requested academic rewrite."),
    ("domain", "law_and_politics"): (1318805, "Specific question about an employer legal obligation."),
    ("domain", "religion_and_philosophy"): (198490, "Direct question about evidence for a religious figure's historical life."),
    ("domain", "food_and_drink"): (197061, "Direct sandwich recipe request and recipe reply."),
    ("domain", "translation_and_language"): (1061296, "English translation instruction with an explicit source phrase."),
    ("domain", "unclassified"): (774161, "Benign image request; no label assigned and reason unknown."),
    ("intent", "information_lookup"): (1494984, "Question asking when a historical invention appeared."),
    ("intent", "summarization"): (82043, "Source description is supplied in the request to summarize it."),
    ("intent", "web_site_navigation"): (6219, "Request for ebook websites; response names two public library sites."),
    ("intent", "unclassified"): (192137, "Scientific paragraph edit with no assigned intent; reason unknown."),
}


def read(path):
    return json.loads(path.read_text())


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def file_sha(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def text_sha(messages):
    return hashlib.sha256(json.dumps(messages, ensure_ascii=False,
                                    separators=(",", ":")).encode()).hexdigest()


def timestamp(value):
    if not isinstance(value, datetime.datetime):
        value = datetime.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if value.tzinfo is None:
        value = value.replace(tzinfo=datetime.timezone.utc)
    return value.astimezone(datetime.timezone.utc).isoformat(timespec="microseconds")


def key(row):
    return (row["conversation_hash"], row["model"], timestamp(row["timestamp"]),
            int(row.get("source_turn", row.get("turn"))), row["language"])


def cache_rows(root):
    manifest = read(root / "outputs/sample_manifest.json")
    path = root / "data/raw/sample.jsonl"
    assert file_sha(path) == manifest["sample_sha256"] and manifest["revision"] == REV
    rows = {}
    with path.open() as stream:
        for line in stream:
            row = json.loads(line)
            row["_cache_kind"] = "original_20000"
            rows[row["row_index"]] = row
    for path in (root / "data/raw/relational_v2/rows").glob("*.json"):
        row = read(path)
        assert row["revision"] == REV and text_sha(row["conversation"]) == row["text_sha256"]
        row["_cache_kind"] = "random_2000"
        rows[row["row_index"]] = row
    return rows


def join_labels(rows, path):
    import pyarrow as pa
    import pyarrow.compute as pc
    import pyarrow.parquet as pq
    by_key = collections.defaultdict(list)
    for row in rows.values():
        by_key[key(row)].append(row["row_index"])
    wanted_hashes = pa.array(sorted({row["conversation_hash"] for row in rows.values()}))
    matched = collections.defaultdict(list)
    hash_counts = collections.Counter()
    paired_sources = sorted(path.glob("*-domain.parquet")) if path.is_dir() else []
    def tables():
        if paired_sources:
            full_keys = ["conversation_hash", "model", "timestamp", "turn", "language", "hashed_ip", "state", "country"]
            for source in paired_sources:
                partner = source.with_name(source.name.replace("-domain.parquet", "-intent.parquet"))
                if not partner.exists():
                    continue
                domain = pq.read_table(source, columns=full_keys + ["conversation_domain"])
                intent = pq.read_table(partner, columns=full_keys + ["user_intent"])
                assert domain.select(full_keys).equals(intent.select(full_keys)), "Domain/intent source keys differ"
                shard = int(re.search(r"-(\d{5})-domain", source.name)[1])
                count = 3199860 // 86 + int(shard < 3199860 % 86)
                start = shard * (3199860 // 86) + min(shard, 3199860 % 86)
                assert domain.num_rows == count
                base = domain.select(full_keys[:5])
                normalize = lambda value: "unclassified" if value in [None, "None"] else value.split(".")[-1].lower()
                base = base.append_column("domain_id", pa.array([normalize(v) for v in domain["conversation_domain"].to_pylist()]))
                base = base.append_column("intent_id", pa.array([normalize(v) for v in intent["user_intent"].to_pylist()]))
                yield base.append_column("candidate_row_index", pa.array(range(start, start + count)))
        else:
            sources = sorted(path.glob("*.parquet")) if path.is_dir() else [path]
            for source in sources:
                for batch in pq.ParquetFile(source).iter_batches(batch_size=65536):
                    yield pa.Table.from_batches([batch])
    for table in tables():
        filtered = table.filter(pc.is_in(table["conversation_hash"], value_set=wanted_hashes))
        for label in filtered.to_pylist():
            hash_counts[label["conversation_hash"]] += 1
            label_key = key(label)
            if label_key in by_key:
                matched[label_key].append(label)
    joined, excluded = {}, collections.Counter()
    for row_key, ids in by_key.items():
        candidates = matched[row_key]
        if len(ids) != 1:
            excluded["duplicate_source_compound_key"] += len(ids)
        elif len(candidates) != 1:
            excluded["ambiguous_label_compound_key" if candidates else "no_label_match"] += 1
        else:
            label = candidates[0]
            candidate_index = label.get("candidate_row_index", label.get("row_index"))
            if candidate_index is not None and int(candidate_index) != ids[0]:
                excluded["source_row_order_mismatch"] += 1
            else:
                joined[ids[0]] = label
    report = {"cached_rows": len(rows), "joined_rows": len(joined), "excluded": dict(excluded),
              "join_fields": ["conversation_hash", "model", "timestamp_UTC_microseconds", "turn", "language"],
              "uniqueness": "Exactly one source row and one label row per compound key required.",
              "source_row_index_checked": True,
              "cached_hashes_with_multiple_label_rows": sum(n > 1 for n in hash_counts.values())}
    return joined, report


def eligibility(row):
    messages = row["conversation"]
    if row["row_index"] in {133179, 2606561, 2632268, 2691198, 2772529}:
        return None  # Existing marked-redaction exports must never be overwritten.
    if row.get("language") != "English" or row.get("toxic") or row.get("redacted") or row.get("truncated_cells"):
        return None
    if [m["role"] for m in messages] != ["user", "assistant"]:
        return None
    question, answer = (m["content"] for m in messages)
    if not (20 <= len(question) <= 500 and 50 <= len(answer) <= 1800):
        return None
    text = question + "\n" + answer
    reject = [
        r"https?://|www\.|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?<!\d)\d{8,}(?!\d)",
        r"\b(?:phone number|passport|social security|bank account|routing number|credit card number|home address|date of birth)\b",
        r"\b(?:my name is|I live at|my (?:wife|husband|girlfriend|boyfriend|mother|father|son|daughter|friend|doctor|therapist|patient))\b",
        r"\b(?:suicide|kill myself|self.harm|porn\w*|rape|penis|vagina|fucking|bomb.make|racial slur)\b",
        r"\b(?:system prompt|ignore (?:all )?previous|jailbreak|DAN mode)\b",
    ]
    if any(re.search(pattern, text, re.I) for pattern in reject):
        return None
    return abs(len(question.split()) - 20) + abs(len(answer.split()) - 85) / 2


def retrieve_reviewed_sources(root, extra, existing):
    """Reproduce the few reviewed additions from complete checksum-verified shards."""
    import pyarrow.parquet as pq
    extra.mkdir(parents=True, exist_ok=True)
    wanted = {idx for idx, _ in REVIEWED_SELECTIONS.values()
              if idx not in existing and not (extra / f"{idx}.json").exists()}
    sources = read(root / "outputs/validation_discovery/original_shards.json")["files"]
    start = 0
    for shard, source in enumerate(sources):
        count = 3199860 // 86 + int(shard < 3199860 % 86)
        selected = {idx for idx in wanted if start <= idx < start + count}
        if selected:
            path = extra / f"temporary-{shard:05d}.parquet"
            subprocess.run(["curl", "--http1.1", "-L", "--fail", "--silent", "--show-error",
                            "--retry", "3", "--output", str(path), source["url"]], check=True)
            assert path.stat().st_size == source["size"] and file_sha(path) == source["sha256"]
            position = start
            columns = ["conversation_hash", "model", "timestamp", "turn", "language", "redacted", "toxic",
                       "conversation.list.element.role", "conversation.list.element.content"]
            for batch in pq.ParquetFile(path).iter_batches(batch_size=512, columns=columns):
                if any(position <= idx < position + batch.num_rows for idx in selected):
                    for offset, row in enumerate(batch.to_pylist()):
                        idx = position + offset
                        if idx not in selected:
                            continue
                        row.update(row_index=idx, timestamp=str(row["timestamp"]), revision=REV,
                                   source_shard=source["path"], source_shard_sha256=source["sha256"], truncated_cells=[])
                        write(extra / f"{idx}.json", row)
                position += batch.num_rows
            assert position == start + count
            path.unlink()
        start += count
    assert all(idx in existing or (extra / f"{idx}.json").exists() for idx, _ in REVIEWED_SELECTIONS.values())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", type=pathlib.Path, default=ROOT)
    parser.add_argument("--labels", type=pathlib.Path, required=True)
    parser.add_argument("--output-dir", type=pathlib.Path, required=True)
    parser.add_argument("--domains", type=pathlib.Path, help="Optional JSON array or {domains:[{id,name}]} taxonomy")
    parser.add_argument("--extra-cache", type=pathlib.Path, help="Additional checksum-verified pinned source rows; defaults to output-dir/source-rows")
    args = parser.parse_args()
    assert args.source_root.resolve() not in args.output_dir.resolve().parents
    rows = cache_rows(args.source_root)
    original_cache_ids = set(rows)
    extra = args.extra_cache or args.output_dir / "source-rows"
    retrieve_reviewed_sources(args.source_root, extra, rows)
    source_shas = {item["path"]: item["sha256"] for item in read(args.source_root / "outputs/validation_discovery/original_shards.json")["files"]}
    if extra.exists():
        for path in extra.glob("*.json"):
            row = read(path)
            assert row["revision"] == REV
            assert row["source_shard_sha256"] == source_shas[row["source_shard"]]
            rows[row["row_index"]] = row
    joined, report = join_labels(rows, args.labels)
    groups = collections.defaultdict(list)
    existing = {255498, 1671993, 2606561, 286012, 753427, 2632268}
    for idx, label in joined.items():
        if idx not in original_cache_ids:
            continue  # Additional retrievals enter only through reviewed selections.
        score = eligibility(rows[idx])
        if score is None:
            continue
        for kind in ["domain", "intent"]:
            value = label.get(kind + "_id")
            if value is not None:
                groups[(kind, str(value))].append((score - 30 * (idx in existing), idx, label))
    names = {}
    if args.domains:
        data = read(args.domains)
        for domain in data.get("domains", data) if isinstance(data, dict) else data:
            names[str(domain["id"])] = domain.get("name", domain.get("label", str(domain["id"])))
    records, examples, candidates = {}, [], []
    for (kind, value), (idx, reason) in REVIEWED_SELECTIONS.items():
        assert idx in joined, f"Reviewed source row unavailable or ambiguous: {idx}"
        assert joined[idx][kind + "_id"] == value, f"Released label differs from reviewed selection: {idx}"
        row = rows[idx]
        assert not row.get("toxic") and not row.get("redacted") and not row.get("truncated_cells")
        assert [m["role"] for m in row["conversation"]] == ["user", "assistant"]
        groups[(kind, value)].append((-1000000, idx, joined[idx]))
    for (kind, domain), options in sorted(groups.items()):
        options.sort(key=lambda item: (item[0], item[1]))
        score, idx, label = options[0]
        row = rows[idx]
        messages = [{"role": m["role"], "content": m["content"]} for m in row["conversation"]]
        digest = text_sha(messages)
        record = {"row_index": idx, "messages": messages, "source_text_sha256": digest,
                  "display_text_sha256": digest, "source_redacted": False, "redactions": [],
                  "source_language": row["language"], "model": row["model"],
                  "text_status": "Original source text, unchanged.", "revision": REV}
        for field in ["source_shard", "source_shard_sha256"]:
            if field in row:
                record[field] = row[field]
        records[idx] = record
        selection_note = "Deliberately selected original exchange. Released AI label; recorded reply, not a reference answer."
        if domain == "unclassified":
            selection_note = "No released label assigned. The reason is unknown; this example is deliberately selected."
        examples.append({"kind": kind, "id": domain, "row_index": idx,
                         "user_message_index": 0, "reply_message_index": 1,
                         "title": names.get(domain, label.get(kind + "_name", domain.replace("_", " ").title())),
                         "intent_id": label.get("intent_id"),
                         "selection_review": REVIEWED_SELECTIONS.get((kind, domain), (None, None))[1],
                         "selection_note": selection_note})
        candidates.append({"kind": kind, "id": domain, "eligible_candidates": len(options),
                           "alternatives": [{"row_index": option[1], "score": option[0]} for option in options[:8]]})
    metadata = {"source_dataset": DATASET, "source_revision": REV, "label_revision": LABEL_REV,
                "label_status": "Released Microsoft AI-generated topic annotations, not human ground truth.",
                "selection": "Source-English-labeled two-message exchanges, deliberately selected rather than representative. Explicit AI-reviewed overrides improve category clarity and benign unclassified examples. Source labels and counts are unchanged.",
                "joined_candidate_rows": len(joined), "categories_covered": dict(collections.Counter(x["kind"] for x in examples))}
    output = args.output_dir
    write(output / "examples.json", {"metadata": metadata, "examples": examples})
    write(output / "source_texts_public.json", {
        "dataset": DATASET, "revision": REV, "source_url": f"https://huggingface.co/datasets/{DATASET}/tree/{REV}",
        "license": {"name": "ODC-BY-1.0", "url": LICENSE_URL},
        "attribution": "Contains information from allenai/WildChat-4.8M, made available under the ODC Attribution License.",
        "records": [records[idx] for idx in sorted(records)]})
    write(output / "join-verification.json", report)
    write(output / "candidate-selection.json", candidates)
    print(json.dumps({**report, "categories_covered": metadata["categories_covered"], "selected_rows": sorted(records)}))


if __name__ == "__main__":
    main()
