"""Aggregate cached-sample context without saving text or row identifiers.

Run: python3 src/supplementary.py

This makes no network requests. Wrapper flags are literal-string heuristics;
they do not establish actual group dialogue, speaker identity, or request type.
The existing review is summarized, not re-annotated.
"""
import collections
import hashlib
import json
import pathlib
import re
import statistics

from analyze import features

ROOT = pathlib.Path(__file__).resolve().parents[1]
PATTERNS = {
    "known_bot_token": re.compile(r"\b(Blockman|Zexy)\b", re.I),
    "named_bot_persona": re.compile(r"\bYou are an AI named Zexy\b", re.I),
    "group_environment": re.compile(r"\bcurrently chatting in a Blockman Go group\b", re.I),
    "history_instruction": re.compile(r"\bsystem data of last 100 group messages\b", re.I),
}
PERSONAL_LABELS = {"personal_advice", "personal_drafting"}


def sha256(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def pct(n, denominator):
    return round(n / denominator * 100, 2) if denominator else None


def counts(rows, key):
    return dict(sorted(collections.Counter(r[key] for r in rows).items()))


def turn_bucket(n):
    return "0" if n == 0 else "1" if n == 1 else "2-3" if n <= 3 else "4+"


def family(model):
    # These are descriptive name-prefix groups, not capability equivalence.
    for prefix, label in [
        ("gpt-4.1-mini", "GPT-4.1 mini"),
        ("gpt-4o-mini", "GPT-4o mini"),
        ("gpt-4o", "GPT-4o"),
        ("gpt-3.5", "GPT-3.5"),
        ("gpt-4-", "GPT-4 / GPT-4 Turbo"),
        ("o1-mini", "o1 mini"),
        ("o1-preview", "o1 preview"),
    ]:
        if model.startswith(prefix):
            return label
    return "Other / unknown"


def profile(rows):
    n = len(rows)
    english_n = sum(r["language"] == "English" and not r["truncated"] for r in rows)
    candidate_n = sum(r["candidate"] for r in rows)
    signatures = {
        flag: {"rows": sum(r[flag] for r in rows),
               "pct_population": pct(sum(r[flag] for r in rows), n)}
        for flag in [*PATTERNS, "known_group_wrapper"]
    }
    return {
        "rows": n,
        "source_label_english_rows": english_n,
        "source_label_english_pct": pct(english_n, n),
        "source_language_label_counts": counts(rows, "language"),
        "keyword_candidate_rows": candidate_n,
        "keyword_candidate_pct": pct(candidate_n, n),
        "year_counts": counts(rows, "year"),
        "model_family_counts": counts(rows, "model_family"),
        "model_counts": counts(rows, "model"),
        "user_turn_buckets": counts(rows, "user_turn_bucket"),
        "median_stored_user_turns": statistics.median(r["user_turns"] for r in rows) if n else None,
        "total_stored_user_turns": sum(r["user_turns"] for r in rows),
        "multi_user_turn_rows": sum(r["user_turns"] >= 2 for r in rows),
        "date_min": min((r["date"] for r in rows), default=None),
        "date_max": max((r["date"] for r in rows), default=None),
        "wrapper_string_flags": signatures,
    }


def grouped_table(rows, group_keys):
    groups = collections.defaultdict(list)
    for r in rows:
        groups[tuple(r[k] for k in group_keys)].append(r)
    result = []
    for group, members in sorted(groups.items()):
        n = len(members)
        en = sum(r["language"] == "English" and not r["truncated"] for r in members)
        candidates = sum(r["candidate"] for r in members)
        wrappers = sum(r["known_group_wrapper"] for r in members)
        result.append({
            **dict(zip(group_keys, group)),
            "rows": n,
            "pct_all_sample_rows": pct(n, len(rows)),
            "source_label_english_rows": en,
            "source_label_english_pct_within_group": pct(en, n),
            "keyword_candidate_rows": candidates,
            "keyword_candidate_pct_within_english": pct(candidates, en),
            "user_turn_buckets": counts(members, "user_turn_bucket"),
            "known_group_wrapper_rows": wrappers,
            "known_group_wrapper_pct_within_group": pct(wrappers, n),
        })
    return result


def review_summary(records):
    annotations = json.loads((ROOT / "outputs/annotations.json").read_text())
    plan = json.loads((ROOT / "outputs/review_plan.json").read_text())
    ids = set(plan["candidate_ids"])
    reviewed = [a for a in annotations if a["row_index"] in ids]
    assert len(reviewed) == len(ids) == 80
    assert {a["row_index"] for a in reviewed} == ids
    by_id = {r["row_index"]: r for r in records}
    assert all(by_id[a["row_index"]]["candidate"] for a in reviewed)
    personal = [a for a in reviewed if a["label"] in PERSONAL_LABELS]
    formats = []
    for fmt in sorted({a["format"] for a in reviewed}):
        subset = [a for a in reviewed if a["format"] == fmt]
        formats.append({
            "format": fmt,
            "rows": len(subset),
            "label_counts": counts(subset, "label"),
            "known_group_wrapper_rows": sum(by_id[a["row_index"]]["known_group_wrapper"] for a in subset),
        })
    return {
        "review_type": "Saved AI-assisted labels, not human-validated labels; no new semantic coding.",
        "candidate_review_rows": len(reviewed),
        "label_counts": counts(reviewed, "label"),
        "format_counts": counts(reviewed, "format"),
        "format_by_label_and_wrapper": formats,
        "personal_label_rows": len(personal),
        "personal_label_pct_reviewed_candidates": pct(len(personal), len(reviewed)),
        "personal_label_format_counts": counts(personal, "format"),
        "personal_label_followup_counts": counts(personal, "followup"),
        "relevant_message_index_present_rows": sum(a.get("relational_user_turn") is not None for a in reviewed),
        "relevant_message_index_present_label_counts": counts(
            [a for a in reviewed if a.get("relational_user_turn") is not None], "label"),
        "reported_action_followup_rows": sum(a["followup"] == "reported_action" for a in reviewed),
        "direct_current_request_evidence_count": None,
        "direct_current_request_evidence_status": (
            "Unavailable: saved annotations have no separate current-request-versus-embedded-history evidence field. "
            "Do not infer that count from reason text, format, or a non-null relevant-message index. "
            "Personal labels and follow-up labels above are the available narrower evidence."
        ),
        "scope": "Counts describe 80 seeded retrieval candidates only; not all 1,747 candidates, all English records, or population prevalence.",
    }


def main():
    manifest_path = ROOT / "outputs/sample_manifest.json"
    manifest = json.loads(manifest_path.read_text())
    sample_path = ROOT / "data/raw/sample.jsonl"
    observed_sha = sha256(sample_path)
    assert observed_sha == manifest["sample_sha256"], "Raw cache does not match the pinned sample manifest"
    records = []
    # Preserve literal LF record splitting; Unicode line separators can be in text.
    with sample_path.open() as stream:
        for line in stream:
            raw = json.loads(line)
            f = features(raw)
            user_text = "\n".join(m.get("content") or "" for m in raw["conversation"] if m["role"] == "user")
            f.update({key: bool(pattern.search(user_text)) for key, pattern in PATTERNS.items()})
            # Require both exact persona and group-environment phrases. Matching
            # records may still contain quoted, synthetic, or historical text.
            f["known_group_wrapper"] = f["named_bot_persona"] and f["group_environment"]
            f["year"] = f["date"][:4]
            f["model_family"] = family(f["model"])
            f["user_turn_bucket"] = turn_bucket(f["user_turns"])
            records.append(f)
    assert len(records) == manifest["actual_rows"] == 20000
    assert len({r["row_index"] for r in records}) == len(records)
    english = [r for r in records if r["language"] == "English" and not r["truncated"]]
    candidates = [r for r in english if r["candidate"]]
    existing = json.loads((ROOT / "outputs/summary.json").read_text())
    assert [len(records), len(english), len(candidates)] == [existing[k] for k in ["sample_rows", "english_rows", "candidate_rows"]]
    populations = {"all_sample": records, "source_label_english": english, "keyword_candidates": candidates}
    wrappers = [r for r in records if r["known_group_wrapper"]]
    linked_paths = ["src/analyze.py", "src/supplementary.py", "outputs/annotations.json", "outputs/review_plan.json", "outputs/summary.json"]
    output = {
        "schema_version": 1,
        "purpose": "Whole-sample context and known wrapper-string diagnostics using only the existing local cache.",
        "scope": "Descriptive counts of a 200-block, 20,000-row sample. Rows are not users; no prevalence inference or new human validation.",
        "provenance": {
            **{k: manifest[k] for k in ["dataset", "config", "split", "revision", "num_rows", "retrieval_date", "design"]},
            "sample_sha256": observed_sha,
            "sample_manifest_sha256": sha256(manifest_path),
            "raw_checksum_matches_manifest": True,
            "linked_input_sha256": {p: sha256(ROOT / p) for p in linked_paths},
            "raw_text_or_row_identifiers_written": False,
        },
        "definitions": {
            "source_label_english": "Source language equals English, excluding truncated rows. Automatic source label, not verified request language.",
            "keyword_candidates": "Unchanged src/analyze.py English/user-message retrieval rule; not validated relational requests.",
            "user_turn": "One stored message whose role is user. A message can contain many embedded speakers or turns.",
            "model_family": "Descriptive grouping by model-name prefix; GPT-4 and GPT-4 Turbo combined. No equivalence claim.",
            "wrapper_flag_unit": "Record with a match in at least one stored user message; assistant text excluded.",
            "known_bot_token": "Broad named-bot/game token component of the existing post-hoc search.",
            "known_group_wrapper": "Both specific named-bot persona and group-environment phrase flags occur in the record's user text.",
            "wrapper_limit": "String flags identify a known template, not verified group conversation, actual multiple people, current request, or relational relevance. Other templates can be missed.",
            "pattern_registry": {k: {"regex": p.pattern, "case_insensitive": True} for k, p in PATTERNS.items()},
        },
        "populations": {name: profile(rows) for name, rows in populations.items()},
        "whole_sample_by_year": grouped_table(records, ["year"]),
        "whole_sample_by_model_family": grouped_table(records, ["model_family"]),
        "whole_sample_by_year_and_model_family": grouped_table(records, ["year", "model_family"]),
        "known_group_wrapper_profile": profile(wrappers),
        "known_group_wrapper_month_counts": dict(sorted(collections.Counter(r["date"][:7] for r in wrappers).items())),
        "known_group_wrapper_by_population": {
            name: profile([r for r in rows if r["known_group_wrapper"]]) for name, rows in populations.items()
        },
        "without_known_group_wrapper_profile": profile([r for r in records if not r["known_group_wrapper"]]),
        "saved_candidate_audit": review_summary(records),
    }
    destination = ROOT / "outputs/supplementary_summary.json"
    destination.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"output": str(destination.relative_to(ROOT)),
                      "populations": {k: v["rows"] for k, v in output["populations"].items()},
                      "known_group_wrapper_rows": len(wrappers),
                      "checksum_matches_manifest": True}, indent=2))


if __name__ == "__main__":
    main()
