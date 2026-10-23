"""Verify Atlas scope from saved inputs; never emit conversation text.

Run from any directory. --check compares with the committed JSON without writing.
The raw local cache is required and remains outside Git.
"""
import argparse
import collections
import hashlib
import json
import pathlib
import random

from analyze import features

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "outputs/scope_verification.json"


def read(name):
    return json.loads((ROOT / name).read_text())


def sha(name):
    return hashlib.sha256((ROOT / name).read_bytes()).hexdigest()


def verify():
    manifest = read("outputs/sample_manifest.json")
    config = read("config/source.json")
    with (ROOT / "data/raw/sample.jsonl").open() as stream:
        rows = [json.loads(line) for line in stream]
    by_id = {row["row_index"]: row for row in rows}
    ids = sorted(by_id)
    checks = {}

    def check(name, condition):
        checks[name] = bool(condition)
        if not condition:
            raise AssertionError(name)

    check("manifest_matches_config", all(manifest[k] == v for k, v in config.items()))
    check("sample_checksum_matches", sha("data/raw/sample.jsonl") == manifest["sample_sha256"])
    check("sample_row_count_matches", len(rows) == manifest["actual_rows"] == config["sample_size"])
    check("source_row_indices_are_unique", len(ids) == len(rows))
    rng = random.Random(config["seed"])
    n, k, width = config["num_rows"], config["windows"], config["window_size"]
    offsets = [rng.randint(i * n // k, (i + 1) * n // k - width) for i in range(k)]
    check("block_seed_reproduces_offsets", offsets == manifest["offsets"])
    check("block_offsets_reproduce_sample", ids == [i for start in offsets for i in range(start, start + width)])
    check("sample_ids_within_source_split", all(0 <= i < n for i in ids))

    languages = collections.Counter(row["language"] for row in rows)
    timestamps = [str(row["timestamp"]) for row in rows]
    roles = collections.Counter(message["role"] for row in rows for message in row["conversation"])
    summary = read("outputs/summary.json")
    distributions = read("outputs/distributions_summary.json")
    check("language_counts_match_summary", dict(languages) == summary["language_counts"])
    check("language_counts_match_distributions", dict(languages) == distributions["language_label_counts"])
    check("language_label_count_matches", len(languages) == distributions["language_label_count"])
    check("date_range_matches_summary", [min(timestamps)[:10], max(timestamps)[:10]] == [summary["date_min"], summary["date_max"]])
    check("month_denominator_matches", sum(summary["month_counts"].values()) == len(rows))

    content_plan = read("outputs/content_review_plan.json")
    content_ids = set(content_plan["ids"])
    labels = read("outputs/content_annotations.json")
    content_summary = read("outputs/content_audit_summary.json")
    check("content_seed_reproduces_selection", random.Random(content_plan["seed"]).sample(ids, content_plan["n"]) == content_plan["ids"])
    check("content_sample_checksum_matches", content_plan["sample_sha256"] == manifest["sample_sha256"])
    check("content_has_one_annotation_per_record", len(labels) == len(content_ids) == content_plan["n"] and {x["row_index"] for x in labels} == content_ids)
    check("content_overlap_seed_matches", random.Random(content_plan["seed"] + 1).sample(content_plan["ids"], 20) == content_plan["overlap_ids"])
    for field in ["purpose", "relational_mode", "packaging", "confidence"]:
        check(f"content_{field}_counts_match", dict(collections.Counter(x[field] for x in labels)) == content_summary[field + "_counts"])
    empty_final_inputs = []
    for i in content_plan["ids"]:
        inputs = [m.get("content") or "" for m in by_id[i]["conversation"] if m["role"] == "user"]
        if inputs and not inputs[-1].strip():
            empty_final_inputs.append(i)
    check("one_empty_final_input_retained", len(empty_final_inputs) == 1)

    fs = [features(row) for row in rows]
    eligible = [row for row in fs if row["language"] == "English" and not row["truncated"]]
    hit_ids = [row["row_index"] for row in eligible if row["candidate"]]
    nonhit_ids = [row["row_index"] for row in eligible if not row["candidate"]]
    retrieval_plan = read("outputs/review_plan.json")
    rng = random.Random(retrieval_plan["seed"])
    expected_hits = rng.sample(hit_ids, min(80, len(hit_ids)))
    expected_nonhits = rng.sample(nonhit_ids, min(40, len(nonhit_ids)))
    check("retrieval_seed_reproduces_hits", expected_hits == retrieval_plan["candidate_ids"])
    check("retrieval_seed_reproduces_nonhits", expected_nonhits == retrieval_plan["negative_ids"])
    retrieval_ids = set(expected_hits + expected_nonhits)
    retrieval_labels = read("outputs/annotations.json")
    check("retrieval_has_one_annotation_per_record", len(retrieval_labels) == len(retrieval_ids) and {x["row_index"] for x in retrieval_labels} == retrieval_ids)
    check("content_and_retrieval_audits_are_disjoint", not (content_ids & retrieval_ids))

    structures = read("outputs/recovered_examples.json")["all_six_examples_structure_check"]
    example_ids = sorted(item["id"] for item in structures)
    targeted = read("outputs/targeted_search_summary.json")
    selected = []
    for i in example_ids:
        group = "content_audit" if i in content_ids else "retrieval_audit" if i in retrieval_ids else "targeted_discovery"
        selected.append({"row_index": i, "origin": group})
        check(f"example_{i}_is_in_cached_sample", i in by_id)
        if group == "targeted_discovery":
            check(f"example_{i}_has_targeted_discovery_record", i in targeted["row_indices"])
    origins = dict(collections.Counter(item["origin"] for item in selected))
    check("six_examples_have_documented_3_2_1_membership", len(example_ids) == len(set(example_ids)) == 6 and origins == {"content_audit": 3, "retrieval_audit": 2, "targeted_discovery": 1})

    evidence_files = [
        "config/source.json", "outputs/sample_manifest.json", "outputs/summary.json",
        "outputs/distributions_summary.json", "outputs/content_review_plan.json",
        "outputs/content_annotations.json", "outputs/content_audit_summary.json",
        "outputs/review_plan.json", "outputs/annotations.json",
        "outputs/recovered_examples.json", "outputs/targeted_search_summary.json",
        "docs/CONTENT_AUDIT_PROTOCOL.md", "src/fetch_sample.py", "src/sample_content.py",
        "src/analyze.py", "src/verify_scope.py",
    ]
    return {
        "schema_version": 1,
        "source": {k: manifest[k] for k in ["dataset", "config", "split", "revision", "num_rows", "retrieval_date"]},
        "metadata_sample": {
            "records": len(rows), "source_split_records": n,
            "selection": "200 index strata; one seeded random contiguous 100-row block per stratum.",
            "seed": config["seed"], "windows": k, "window_size": width,
            "local_filters_before_profiling": "None. No language/date/content filter or deduplication.",
            "truncated_records": sum(bool(row["truncated_cells"]) for row in rows),
            "distinct_conversation_hashes": len({row["conversation_hash"] for row in rows}),
            "stored_message_count": sum(roles.values()), "stored_message_role_counts": dict(roles),
            "sample_sha256": manifest["sample_sha256"],
            "scope": "Describes sampled source rows; not distinct people, independent conversations, or population prevalence.",
        },
        "source_language_labels": {
            "distinct_values": len(languages), "denominator_records": len(rows),
            "counts": dict(sorted(languages.items())), "nolang_records": languages["Nolang"],
            "verification": "Publisher-provided automatic row labels; no independent language validation recorded.",
        },
        "sample_dates": {
            "denominator_records": len(rows), "field": "row.timestamp",
            "minimum": min(timestamps), "maximum": max(timestamps),
            "meaning": "Observed range of sampled record timestamps; not a date filter or full collection period.",
        },
        "content_audit": {
            "records": len(content_ids), "eligible_records": len(rows), "seed": content_plan["seed"],
            "selection": content_plan["selection"],
            "unit": "One final active user input per sampled record, interpreted with prior context; not every request in the conversation.",
            "empty_final_inputs_retained": len(empty_final_inputs),
            "second_ai_review_records": len(content_plan["overlap_ids"]),
            "label_status": "AI-assisted exploratory labels; no human validation recorded.",
        },
        "retrieval_audit": {
            "records": len(retrieval_ids), "seed": retrieval_plan["seed"],
            "source_english_eligible_records": len(eligible),
            "keyword_hit_pool": len(hit_ids), "reviewed_hits": len(expected_hits),
            "keyword_nonhit_pool": len(nonhit_ids), "reviewed_nonhits": len(expected_nonhits),
            "selection": "Separate seeded samples without replacement: 80 hits and 40 non-hits from source-English, non-truncated records.",
            "overlap_with_content_audit": len(content_ids & retrieval_ids),
            "scope": "A separate retrieval check; its deliberately enriched composition is not the 120-record content distribution.",
        },
        "display_examples": {
            "total": len(example_ids), "origin_counts": origins, "membership": selected,
            "selection": "Purpose-selected illustrations from existing reviews and post-hoc discovery, not a random six-record sample.",
            "display": "Deidentified English paraphrases, not quotations or reference answers.",
        },
        "not_recorded_or_not_verified": {
            "fetch_mode": "The manifest does not record Dataset Viewer versus pinned-stream retrieval.",
            "viewer_conversion_revision": "Viewer mode checks the Hub revision before/after; its conversion commit is not directly attested.",
            "timestamp_semantics": "Whether row.timestamp denotes conversation start/end is not verified.",
            "timestamp_timezone": "Timezone is not documented in the saved scope materials; cached strings contain no offset.",
            "ai_annotator_model_version": "Exact annotator model/version is not recorded in the saved plans or annotation schema.",
            "ai_annotator_prompts": "A coding protocol is saved; exact run prompts and generation settings are not recorded.",
            "example_selection_protocol": "Origins and source checks are saved; no random selection method for the six display examples is recorded.",
        },
        "checks": checks,
        "input_sha256": {name: sha(name) for name in evidence_files},
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Compare with saved verification; do not write.")
    args = parser.parse_args()
    report = verify()
    if args.check:
        if not OUTPUT.exists() or json.loads(OUTPUT.read_text()) != report:
            raise AssertionError("Saved scope verification differs; regenerate and inspect it.")
    else:
        OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"status": "passed", "checks": len(report["checks"]), "records": report["metadata_sample"]["records"], "content_audit_records": report["content_audit"]["records"], "display_examples": report["display_examples"]["total"], "output": str(OUTPUT.relative_to(ROOT))}))


if __name__ == "__main__":
    main()
