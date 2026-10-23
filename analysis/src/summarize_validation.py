"""Compare the original block sample with a pinned census and uniform-row SRS.

Only writes outputs/sampling_validation/comparison.json. All 86 completed,
checksum-verified shard checkpoints are required. Input text is read only to
recover the original sample's existing literal flags; no text or hashes are
included in the output.

Run:
    .venv/bin/python src/summarize_validation.py --self-check
    .venv/bin/python src/summarize_validation.py --status
    .venv/bin/python src/summarize_validation.py
"""
import argparse
import bisect
import collections
import csv
import datetime
import gzip
import hashlib
import json
import math
import pathlib
import random
import sys

import pyarrow.parquet as pq

from supplementary import PATTERNS, family

ROOT = pathlib.Path(__file__).resolve().parents[1]
DERIVED = ROOT / "data/derived/validation"
OUT = ROOT / "outputs/sampling_validation"
REVISION = "c827c6df8fcf008219ffaffa4d1dd77491099367"
POPULATION_N = 3199860
SHARDS = 86
REFERENCE_N = 20000
REFERENCE_SEED = 20261020
SCOPES = ("census", "original", "random")
CATEGORICAL = ("language", "model", "model_family", "month", "year", "turn_bucket")
LENGTH_FIELDS = ("user_words", "assistant_words")
LENGTH_GROUPS = ("english", "english_template", "english_other")
QUANTILES = (
    ("min", 0), ("p10", .1), ("p25", .25), ("median", .5), ("p75", .75),
    ("p90", .9), ("p95", .95), ("p99", .99), ("max", 1),
)
# Common bins in log10(1 + words); the final bin is open-ended.
LENGTH_EDGES = tuple(sorted({0, *(math.ceil(10 ** (i / 4) - 1) for i in range(25))}))
BASE_FLAGS = (
    "known_group_wrapper", "redacted", "toxic", "empty_user_message",
    "zero_user_words", "source_turn_mismatch", "other_role_messages",
)
RICH_FLAGS = ("candidate", "code_flag", "creative_flag", *PATTERNS)
VERIFY_FIELDS = (
    "conversation_hash", "model", "language", "date", "source_turn",
    "user_turns", "assistant_messages", "stored_messages", "other_messages",
    "user_words", "assistant_words", "empty_user_messages", "redacted", "toxic",
    "known_group_wrapper",
)
CI_METHOD = (
    "Approximate pointwise 95% Wilson score interval with finite-population variance "
    "correction, conditional on the stated denominator; SRS without replacement "
    "only. No uncertainty interval is assigned to census or original block-sample counts."
)


def read_json(path):
    return json.loads(path.read_text())


def sha(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for part in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            digest.update(part)
    return digest.hexdigest()


def atomic_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(".json.tmp")
    with temp.open("w") as stream:
        json.dump(data, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write("\n")
    temp.replace(path)


def percent(count, denominator):
    return 100 * count / denominator if denominator else None


def rounded(value):
    return round(value, 8) if value is not None else None


def finite_population_ci(count, n, population_n):
    """Wilson score inversion with FPC-adjusted binomial variance."""
    assert 0 <= count <= n <= population_n
    if not n:
        return None
    p = count / n
    if n == population_n:
        return [rounded(100 * p), rounded(100 * p)]
    z = 1.959963984540054
    fpc = (population_n - n) / (population_n - 1)
    effective_n = n / fpc
    denom = 1 + z * z / effective_n
    center = (p + z * z / (2 * effective_n)) / denom
    radius = z * math.sqrt(p * (1 - p) / effective_n + z * z / (4 * effective_n ** 2)) / denom
    return [rounded(100 * max(0, center - radius)),
            rounded(100 * min(1, center + radius))]


def cell(count, denominator, scope, population_n=None):
    result = {"denominator": denominator, "count": count,
              "pct": rounded(percent(count, denominator))}
    if scope == "random":
        result["ci95_pct"] = finite_population_ci(count, denominator, population_n)
    return result


def turn_bucket(n):
    return ("0" if n == 0 else "1" if n == 1 else "2" if n == 2 else
            "3" if n == 3 else "4–5" if n <= 5 else "6–10" if n <= 10 else "11+")


def category_key(value):
    return "(missing)" if value is None or value == "" else str(value)


def word_bin(value):
    return bisect.bisect_right(LENGTH_EDGES, value) - 1


def weighted_quantiles(histogram):
    n = sum(histogram.values())
    if not n:
        return {key: None for key, _ in QUANTILES}
    values = sorted(histogram)
    cumulative, running = [], 0
    for value in values:
        running += histogram[value]
        cumulative.append(running)

    def at(rank):
        return values[bisect.bisect_right(cumulative, rank)]

    result = {}
    for key, q in QUANTILES:
        position = (n - 1) * q
        lo = math.floor(position)
        hi = math.ceil(position)
        result[key] = rounded(at(lo) + (position - lo) * (at(hi) - at(lo)))
    return result


def fixed_histogram(histogram):
    n = sum(histogram.values())
    bins = [0] * len(LENGTH_EDGES)
    for value, count in histogram.items():
        bins[word_bin(value)] += count
    assert sum(bins) == n
    return [
        {"lower": lo,
         "upper_exclusive": LENGTH_EDGES[i + 1] if i + 1 < len(LENGTH_EDGES) else None,
         "count": bins[i], "pct": rounded(percent(bins[i], n))}
        for i, lo in enumerate(LENGTH_EDGES)
    ]


def ecdf_points(histogram, thresholds):
    n = sum(histogram.values())
    values = iter(sorted(histogram.items()))
    next_value = next(values, None)
    cumulative = 0
    result = []
    for threshold in thresholds:
        while next_value is not None and next_value[0] <= threshold:
            cumulative += next_value[1]
            next_value = next(values, None)
        result.append({"words": threshold, "count_at_or_below": cumulative,
                       "pct": rounded(percent(cumulative, n))})
    return result


def ecdf_gap(left, right):
    nl, nr = sum(left.values()), sum(right.values())
    if not nl or not nr:
        return None
    cl = cr = 0
    maximum = -1.0
    threshold = 0
    signed = 0.0
    for value in sorted(left.keys() | right.keys()):
        cl += left.get(value, 0)
        cr += right.get(value, 0)
        difference = cl / nl - cr / nr
        if abs(difference) > maximum:
            maximum, threshold, signed = abs(difference), value, difference
    return {"max_ecdf_gap": rounded(maximum), "max_ecdf_gap_pp": rounded(100 * maximum),
            "at_words": threshold, "signed_difference_pp": rounded(100 * signed)}


def repetition_profile(hashes, n):
    observed = sum(hashes.values())
    repeated_groups = sum(v > 1 for v in hashes.values())
    members = sum(v for v in hashes.values() if v > 1)
    extras = observed - len(hashes)
    return {
        "denominator": n, "nonmissing_hash_rows": observed, "missing_hash_rows": n - observed,
        "distinct_conversation_hashes": len(hashes),
        "repeated_hash_groups": repeated_groups,
        "rows_in_repeated_hash_groups": members,
        "rows_in_repeated_hash_groups_pct": rounded(percent(members, n)),
        "extra_rows_beyond_distinct_hashes": extras,
        "extra_rows_pct": rounded(percent(extras, n)),
        "max_multiplicity": max(hashes.values(), default=0),
        "group_multiplicity_counts": dict(sorted(collections.Counter(hashes.values()).items())),
    }


class Profile:
    def __init__(self, name):
        self.name = name
        self.n = 0
        self.categories = {key: collections.Counter() for key in CATEGORICAL}
        self.flags = collections.Counter()
        self.english_flags = collections.Counter()
        self.lengths = {
            group: {key: collections.Counter() for key in LENGTH_FIELDS}
            for group in LENGTH_GROUPS
        }
        self.joint_bins = {group: collections.Counter() for group in LENGTH_GROUPS}
        self.hashes = collections.Counter()
        self.english_n = 0
        self.stored_messages = self.user_messages = self.assistant_messages = 0
        self.other_messages = 0
        self.minimum_date = None
        self.maximum_date = None
        self.template_models = collections.Counter()
        self.template_months = collections.Counter()
        self.template_languages = collections.Counter()
        self.model_month_counts = collections.Counter()
        self.user_turn_counts = collections.Counter()
        self.source_turn_counts = collections.Counter()
        self._families = {}

    def add(self, row):
        self.n += 1
        model = category_key(row["model"])
        model_family = self._families.get(model)
        if model_family is None:
            model_family = self._families[model] = family(model)
        date = category_key(row["date"])
        category_values = {
            "language": category_key(row["language"]), "model": model,
            "model_family": model_family, "month": date[:7], "year": date[:4],
            "turn_bucket": turn_bucket(row["user_turns"]),
        }
        for key, value in category_values.items():
            self.categories[key][value] += 1
        self.model_month_counts[(date[:7], model)] += 1
        self.user_turn_counts[row["user_turns"]] += 1
        self.source_turn_counts[row.get("source_turn", row["user_turns"])] += 1
        if date != "(missing)":
            self.minimum_date = date if self.minimum_date is None else min(self.minimum_date, date)
            self.maximum_date = date if self.maximum_date is None else max(self.maximum_date, date)
        conv_hash = row["conversation_hash"]
        if conv_hash:
            self.hashes[conv_hash] += 1
        self.user_messages += row["user_turns"]
        self.assistant_messages += row["assistant_messages"]
        self.stored_messages += row["stored_messages"]
        self.other_messages += row.get("other_messages", row["stored_messages"] -
                                       row["user_turns"] - row["assistant_messages"])
        flags = {
            "known_group_wrapper": bool(row["known_group_wrapper"]),
            "redacted": bool(row["redacted"]),
            "toxic": bool(row.get("toxic", False)),
            "empty_user_message": row["empty_user_messages"] > 0,
            "zero_user_words": row["user_words"] == 0,
            "source_turn_mismatch": row.get("source_turn", row["user_turns"]) != row["user_turns"],
            "other_role_messages": row.get("other_messages", 0) > 0,
        }
        flags.update({key: bool(row[key]) for key in RICH_FLAGS if key in row})
        self.flags.update(key for key, matched in flags.items() if matched)
        if flags["known_group_wrapper"]:
            self.template_models[model] += 1
            self.template_months[date[:7]] += 1
            self.template_languages[category_values["language"]] += 1
        if row["language"] == "English" and not row.get("truncated", False):
            self.english_n += 1
            self.english_flags.update(key for key, matched in flags.items() if matched)
            groups = ("english", "english_template" if flags["known_group_wrapper"] else "english_other")
            pair = (word_bin(row["user_words"]), word_bin(row["assistant_words"]))
            for group in groups:
                for key in LENGTH_FIELDS:
                    self.lengths[group][key][row[key]] += 1
                self.joint_bins[group][pair] += 1

    def check(self):
        assert all(sum(counts.values()) == self.n for counts in self.categories.values())
        assert self.user_messages + self.assistant_messages + self.other_messages == self.stored_messages
        assert all(sum(self.lengths["english"][key].values()) == self.english_n for key in LENGTH_FIELDS)
        for key in LENGTH_FIELDS:
            assert (sum(self.lengths["english_template"][key].values()) +
                    sum(self.lengths["english_other"][key].values())) == self.english_n
        for group in LENGTH_GROUPS:
            assert sum(self.joint_bins[group].values()) == sum(self.lengths[group]["user_words"].values())
        assert sum(self.template_models.values()) == self.flags["known_group_wrapper"]
        assert sum(self.template_months.values()) == self.flags["known_group_wrapper"]
        assert sum(self.template_languages.values()) == self.flags["known_group_wrapper"]
        assert sum(self.model_month_counts.values()) == self.n
        assert sum(self.user_turn_counts.values()) == self.n
        assert sum(self.source_turn_counts.values()) == self.n

    def summary(self):
        return {
            "records": self.n, "english_nontruncated_records": self.english_n,
            "date_min": self.minimum_date, "date_max": self.maximum_date,
            "stored_messages": self.stored_messages, "user_messages": self.user_messages,
            "assistant_messages": self.assistant_messages, "other_messages": self.other_messages,
            "minimum_user_turns": min(self.user_turn_counts, default=None),
            "maximum_user_turns": max(self.user_turn_counts, default=None),
            "stored_user_message_counts": dict(sorted(self.user_turn_counts.items())),
            "source_turn_counts": dict(sorted(self.source_turn_counts.items())),
            "model_by_month": [
                {"month": month, "model": model, "count": count,
                 "pct_all_rows": rounded(percent(count, self.n))}
                for (month, model), count in sorted(self.model_month_counts.items())
            ],
            "counts": {key: dict(sorted(value.items())) for key, value in self.categories.items()},
            "known_group_wrapper": {
                "count": self.flags["known_group_wrapper"],
                "pct": rounded(percent(self.flags["known_group_wrapper"], self.n)),
                "by_model": dict(sorted(self.template_models.items())),
                "by_month": dict(sorted(self.template_months.items())),
                "by_language": dict(sorted(self.template_languages.items())),
            },
        }


def readiness():
    complete, missing, invalid = [], [], []
    for i in range(SHARDS):
        stem = f"{i:05d}"
        checkpoint = OUT / "shards" / f"{stem}.json"
        feature_path = DERIVED / f"{stem}.parquet"
        reference_path = DERIVED / f"{stem}-random.json"
        if not all(path.exists() for path in (checkpoint, feature_path, reference_path)):
            missing.append(i)
            continue
        try:
            saved = read_json(checkpoint)
            assert saved["complete"] is True and saved["revision"] == REVISION
            assert saved["shard"] == i and saved["lfs_digest_verified"] is True
            complete.append(saved)
        except (AssertionError, KeyError, ValueError) as error:
            invalid.append({"shard": i, "reason": str(error) or "Checkpoint identity/completeness assertion"})
    return {"ready": len(complete) == SHARDS and not missing and not invalid,
            "complete_shards": len(complete), "required_shards": SHARDS,
            "missing_shards": missing, "invalid_shards": invalid}, complete


def load_original():
    manifest_path = ROOT / "outputs/sample_manifest.json"
    manifest = read_json(manifest_path)
    assert manifest["revision"] == REVISION and manifest["num_rows"] == POPULATION_N
    feature_path = ROOT / "outputs/conversation_features.csv.gz"
    integer_keys = {"row_index", "user_turns", "assistant_messages", "user_words",
                    "assistant_words", "empty_user_messages", "context_count"}
    boolean_keys = {"redacted", "truncated", "candidate", "creative_flag", "code_flag", "nonempty_user"}
    rows = {}
    with gzip.open(feature_path, "rt") as stream:
        for source in csv.DictReader(stream):
            row = dict(source)
            for key in integer_keys:
                row[key] = int(row[key])
            for key in boolean_keys:
                assert row[key] in {"True", "False"}
                row[key] = row[key] == "True"
            assert row["row_index"] not in rows
            rows[row["row_index"]] = row
    assert len(rows) == manifest["actual_rows"] == 20000
    raw_path = ROOT / "data/raw/sample.jsonl"
    assert sha(raw_path) == manifest["sample_sha256"], "Original cache checksum mismatch"
    seen = set()
    with raw_path.open() as stream:
        for line in stream:
            raw = json.loads(line)
            row = rows[raw["row_index"]]
            assert raw["row_index"] not in seen
            seen.add(raw["row_index"])
            assert row["conversation_hash"] == raw["conversation_hash"]
            text = "\n".join(message.get("content") or "" for message in raw["conversation"]
                             if message["role"] == "user")
            assert len(text.split()) == row["user_words"]
            row.update({key: bool(pattern.search(text)) for key, pattern in PATTERNS.items()})
            row["known_group_wrapper"] = row["named_bot_persona"] and row["group_environment"]
            row["source_turn"] = raw["turn"]
            row["stored_messages"] = len(raw["conversation"])
            row["other_messages"] = row["stored_messages"] - row["user_turns"] - row["assistant_messages"]
            row["toxic"] = bool(raw["toxic"])
    assert seen == rows.keys()
    return rows, {
        "manifest_sha256": sha(manifest_path), "features_sha256": sha(feature_path),
        "sample_sha256": manifest["sample_sha256"], "revision": manifest["revision"],
        "selection": manifest["design"], "seed": manifest["seed"],
    }


def comparison_row(metric, label, profiles, counts, denominator_kind="all", available=SCOPES):
    population_n = profiles["census"].english_n if denominator_kind == "english" else profiles["census"].n
    result = {"metric": metric, "label": label, "denominator_scope": denominator_kind}
    for scope in SCOPES:
        if scope not in available:
            result[scope] = None
            continue
        p = profiles[scope]
        denominator = p.english_n if denominator_kind == "english" else p.n
        result[scope] = cell(counts[scope], denominator, scope, population_n)
    result["delta_pp"] = {}
    for left, right in (("original", "census"), ("random", "census"), ("original", "random")):
        l, r = result[left], result[right]
        result["delta_pp"][f"{left}_minus_{right}"] = (
            rounded(l["pct"] - r["pct"])
            if l and r and l["pct"] is not None and r["pct"] is not None else None)
    return result


def categorical_comparisons(profiles):
    result, flattened = {}, []
    for metric in CATEGORICAL:
        labels = set().union(*(p.categories[metric] for p in profiles.values()))
        labels = sorted(labels, key=lambda label: (-profiles["census"].categories[metric][label], label))
        if metric == "turn_bucket":
            labels = [label for label in ("0", "1", "2", "3", "4–5", "6–10", "11+") if label in labels]
        rows = [comparison_row(metric, label, profiles,
                               {scope: profiles[scope].categories[metric][label] for scope in SCOPES})
                for label in labels]
        distances = {}
        for left, right in (("original", "census"), ("random", "census"), ("original", "random")):
            distances[f"{left}_vs_{right}"] = rounded(
                sum(abs(row[left]["pct"] - row[right]["pct"]) for row in rows) / 200)
        for scope in SCOPES:
            assert sum(row[scope]["count"] for row in rows) == profiles[scope].n
        result[metric] = {"rows": rows, "total_variation_distance": distances}
        flattened.extend(rows)
    return result, flattened


def flag_comparisons(profiles):
    result = {}
    for flag in BASE_FLAGS:
        result[flag] = comparison_row("flag", flag, profiles,
                                     {scope: profiles[scope].flags[flag] for scope in SCOPES})
    result["known_group_wrapper_english"] = comparison_row(
        "flag", "known_group_wrapper_english", profiles,
        {scope: profiles[scope].english_flags["known_group_wrapper"] for scope in SCOPES}, "english")
    for flag in RICH_FLAGS:
        result[flag] = comparison_row("regex_flag", flag, profiles,
                                     {scope: profiles[scope].flags[flag] for scope in SCOPES},
                                     available=("original", "random"))
    result["candidate_english"] = comparison_row(
        "regex_flag", "candidate_english", profiles,
        {scope: profiles[scope].english_flags["candidate"] for scope in SCOPES},
        "english", ("original", "random"))
    return result


def length_comparisons(profiles):
    result = {
        "definition": "Whitespace-delimited words summed over all stored messages of each role per row.",
        "eligibility": "Source-English-labeled rows with no truncated cells; no deduplication.",
        "quantile_method": "Linear interpolation at (n - 1) × q, identical to NumPy's default linear quantiles.",
        "histogram_definition": "Shared integer bins from quarter-decades of log10(1 + words); lower inclusive, upper exclusive; final bin unbounded.",
        "histogram_edges": list(LENGTH_EDGES),
        "ecdf_definition": "Exact cumulative counts at common plotted thresholds; maximum ECDF gaps use every distinct observed word count.",
        "groups": {},
    }
    for group in LENGTH_GROUPS:
        scope_data = {scope: {"records": sum(profiles[scope].lengths[group]["user_words"].values())}
                      for scope in SCOPES}
        comparisons = {}
        for field in LENGTH_FIELDS:
            hists = {scope: profiles[scope].lengths[group][field] for scope in SCOPES}
            maximum = max((max(hist, default=0) for hist in hists.values()), default=0)
            log_limit = max(1, math.ceil(math.log10(maximum + 1)))
            thresholds = {0, maximum}
            thresholds.update(math.floor(10 ** (i / 40) - 1) for i in range(40 * log_limit + 1))
            quants = {scope: weighted_quantiles(hist) for scope, hist in hists.items()}
            thresholds.update(int(q) for values in quants.values() for q in values.values() if q is not None)
            thresholds = sorted(thresholds)
            for scope, hist in hists.items():
                n = sum(hist.values())
                scope_data[scope][field] = {
                    "denominator": n, "quantiles": quants[scope],
                    "word_count_frequencies": [[words, count] for words, count in sorted(hist.items())],
                    "mean": rounded(sum(value * count for value, count in hist.items()) / n) if n else None,
                    "histogram": fixed_histogram(hist),
                    "ecdf_points": ecdf_points(hist, thresholds),
                    "above_1000": cell(sum(count for words, count in hist.items() if words > 1000),
                                       n, scope, sum(hists["census"].values())),
                    "above_5000": cell(sum(count for words, count in hist.items() if words > 5000),
                                       n, scope, sum(hists["census"].values())),
                }
                assert not scope_data[scope][field]["ecdf_points"] or (
                    scope_data[scope][field]["ecdf_points"][-1]["count_at_or_below"] == n)
            comparisons[field] = {}
            for left, right in (("original", "census"), ("random", "census"), ("original", "random")):
                comparisons[field][f"{left}_vs_{right}"] = {
                    "ecdf": ecdf_gap(hists[left], hists[right]),
                    "quantile_differences_words": {
                        key: rounded(quants[left][key] - quants[right][key])
                        if quants[left][key] is not None and quants[right][key] is not None else None
                        for key, _ in QUANTILES},
                }
        for scope in SCOPES:
            n = scope_data[scope]["records"]
            scope_data[scope]["joint_histogram"] = [
                {"input_bin": i, "output_bin": j, "count": count,
                 "pct": rounded(percent(count, n))}
                for (i, j), count in sorted(profiles[scope].joint_bins[group].items())
            ]
            assert sum(b["count"] for b in scope_data[scope]["joint_histogram"]) == n
        result["groups"][group] = {"scopes": scope_data, "comparisons": comparisons}
    return result


def model_year_comparisons(profiles, joint_counts):
    years = sorted(set().union(*(p.categories["year"] for p in profiles.values())))
    families = sorted(set().union(*(p.categories["model_family"] for p in profiles.values())))
    rows = []
    for year in years:
        for model_family in families:
            if not any(joint_counts[scope][(year, model_family)] for scope in SCOPES):
                continue
            row = {"year": year, "model_family": model_family}
            for scope in SCOPES:
                count = joint_counts[scope][(year, model_family)]
                row[scope] = {
                    "within_year": cell(count, profiles[scope].categories["year"][year], scope,
                                        profiles["census"].categories["year"][year]),
                    "all_rows": cell(count, profiles[scope].n, scope, profiles["census"].n),
                }
            row["delta_pp"] = {}
            for basis in ("within_year", "all_rows"):
                row["delta_pp"][basis] = {}
                for left, right in (("original", "census"), ("random", "census")):
                    l, r = row[left][basis]["pct"], row[right][basis]["pct"]
                    row["delta_pp"][basis][f"{left}_minus_{right}"] = rounded(l - r) if l is not None and r is not None else None
            rows.append(row)
    for scope in SCOPES:
        assert sum(row[scope]["all_rows"]["count"] for row in rows) == profiles[scope].n
    return {"rows": rows, "definition": "Each cell supplies both within-year family share and joint year/family share of all rows."}


def summarize(checkpoints):
    plan_path = OUT / "random_sample_plan.json"
    plan = read_json(plan_path)
    expected_ids = sorted(random.Random(REFERENCE_SEED).sample(range(POPULATION_N), REFERENCE_N))
    selected_ids = set(expected_ids)
    assert plan["revision"] == REVISION and plan["population_rows"] == POPULATION_N
    assert plan["sample_rows"] == REFERENCE_N and plan["seed"] == REFERENCE_SEED
    assert plan["row_indices"] == expected_ids and plan["old_sample_excluded"] is False
    original, original_provenance = load_original()
    profiles = {scope: Profile(scope) for scope in SCOPES}
    joint_counts = {scope: collections.Counter() for scope in SCOPES}

    def add(scope, row):
        profiles[scope].add(row)
        model_family = profiles[scope]._families[category_key(row["model"])]
        joint_counts[scope][(category_key(row["date"])[:4], model_family)] += 1

    for row in original.values():
        add("original", row)
    verification_counts = collections.Counter()
    mismatch_examples = {field: [] for field in VERIFY_FIELDS}
    matched_original_ids, any_mismatch_ids, reference_ids = set(), set(), set()
    reference_by_id = {}
    reference_source_by_id = {}
    reference_base_checks = 0
    start = 0
    verified_shards = []
    for checkpoint in checkpoints:
        i = checkpoint["shard"]
        expected_rows = POPULATION_N // SHARDS + (i < POPULATION_N % SHARDS)
        assert checkpoint["row_start"] == start and checkpoint["rows"] == expected_rows
        feature_path = DERIVED / f"{i:05d}.parquet"
        ref_path = DERIVED / f"{i:05d}-random.json"
        assert sha(feature_path) == checkpoint["feature_sha256"], f"Feature checksum mismatch: shard {i}"
        assert sha(ref_path) == checkpoint["reference_sha256"], f"Reference checksum mismatch: shard {i}"
        file = pq.ParquetFile(feature_path)
        assert file.metadata.num_rows == expected_rows
        row_index = start
        for batch in file.iter_batches(batch_size=32768):
            for row in batch.to_pylist():
                assert row["row_index"] == row_index, f"Non-contiguous row index in shard {i}"
                row_index += 1
                add("census", row)
                if row["row_index"] in selected_ids:
                    reference_source_by_id[row["row_index"]] = {key: row[key] for key in VERIFY_FIELDS}
                old = original.get(row["row_index"])
                if old is not None:
                    matched_original_ids.add(row["row_index"])
                    for field in VERIFY_FIELDS:
                        if old[field] != row[field]:
                            verification_counts[field] += 1
                            any_mismatch_ids.add(row["row_index"])
                            if len(mismatch_examples[field]) < 10:
                                mismatch_examples[field].append(row["row_index"])
        assert row_index == start + expected_rows
        reference = read_json(ref_path)
        assert len(reference) == checkpoint["reference_rows"]
        for row in reference:
            assert all(key in row and type(row[key]) is bool for key in RICH_FLAGS), (
                f"Missing or non-boolean random-reference regex flag in shard {i}")
            assert not row["candidate"] or (row["language"] == "English" and not row["truncated"])
            assert start <= row["row_index"] < row_index
            assert row["row_index"] not in reference_ids
            reference_ids.add(row["row_index"])
            reference_by_id[row["row_index"]] = row
            source = reference_source_by_id.pop(row["row_index"])
            for field in VERIFY_FIELDS:
                if field in row:
                    assert row[field] == source[field], f"Reference base feature mismatch: {field}, row {row['row_index']}"
                    reference_base_checks += 1
                else:
                    row[field] = source[field]
        verified_shards.append({
            "shard": i, "rows": expected_rows, "sha256": checkpoint["sha256"],
            "feature_sha256": checkpoint["feature_sha256"],
            "reference_sha256": checkpoint["reference_sha256"],
        })
        start = row_index
        print(f"Verified and aggregated {i + 1}/{SHARDS} shards; {start:,} rows", flush=True)
    assert start == POPULATION_N and matched_original_ids == original.keys()
    assert sorted(reference_ids) == expected_ids
    assert not reference_source_by_id
    for row in reference_by_id.values():
        assert "source_turn" in row and "toxic" in row
        add("random", row)
    assert profiles["census"].n == POPULATION_N and profiles["random"].n == REFERENCE_N
    assert profiles["census"].flags["source_turn_mismatch"] == sum(c["source_turn_mismatches"] for c in checkpoints)
    for profile in profiles.values():
        profile.check()
    categorical, flattened = categorical_comparisons(profiles)
    flags = flag_comparisons(profiles)
    flattened.extend(flags.values())
    full_hashes = profiles["census"].hashes
    global_repeated = {
        scope: sum(count for key, count in profiles[scope].hashes.items() if full_hashes[key] > 1)
        for scope in SCOPES
    }
    repetition = {
        "definition": "Source conversation_hash equality; no assertion that all full-corpus equal-hash rows were checked for byte-identical dialogue.",
        "within_scope": {scope: repetition_profile(profiles[scope].hashes, profiles[scope].n) for scope in SCOPES},
        "census_known_repeated_group_membership": comparison_row(
            "repetition", "row_belongs_to_hash_repeated_in_census", profiles, global_repeated),
        "warning": "Within-scope duplicate fractions depend on sample size and selection design. They are not directly comparable estimates of corpus duplication.",
    }
    flattened.append(repetition["census_known_repeated_group_membership"])
    overlap = sorted(set(original) & reference_ids)
    long_rows = []
    for comparison in flattened:
        for scope in SCOPES:
            value = comparison[scope]
            if value is None:
                continue
            reference_scope = "census" if comparison["census"] is not None else "random"
            long_rows.append({
                "metric": comparison["metric"], "label": comparison["label"], "scope": scope,
                **value, "reference_scope": reference_scope,
                "delta_pp": (0.0 if scope == reference_scope else
                             comparison["delta_pp"].get(f"{scope}_minus_{reference_scope}")),
            })
    verification = {
        "expected_original_rows": len(original), "matched_row_indices": len(matched_original_ids),
        "mismatch_rows_any_field": len(any_mismatch_ids),
        "mismatch_counts": {field: verification_counts[field] for field in VERIFY_FIELDS},
        "mismatch_example_row_indices": {field: ids for field, ids in mismatch_examples.items() if ids},
        "same_frame_confirmed": not any_mismatch_ids,
        "meaning": "Original cached row offsets are compared with the immutable shard rows, including conversation hash and base features. Zero mismatches supports using this census as the original sample's frame.",
    }
    return {
        "schema_version": 1, "complete": True,
        "generated_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source": {"dataset": plan["dataset"], "config": plan["config"], "split": plan["split"],
                   "revision": REVISION, "population_rows": POPULATION_N,
                   "shards": SHARDS, "all_lfs_digests_verified": True,
                   "feature_and_reference_checksums_verified": True},
        "scopes": {
            "census": {"label": "Whole pinned release", "kind": "exact_census", "records": profiles["census"].n},
            "original": {"label": "Original 20,000-row block sample", "kind": "descriptive_block_sample",
                         "records": profiles["original"].n, **original_provenance},
            "random": {"label": "Uniform 20,000-row reference", "kind": "srs_without_replacement",
                       "records": profiles["random"].n, "seed": REFERENCE_SEED,
                       "plan_sha256": sha(plan_path), "population_rows": POPULATION_N,
                       "old_sample_excluded": False},
        },
        "definitions": {
            "unit": "One released row; not a distinct person or a deduplicated conversation.",
            "percentage_points": "Original minus census, random minus census, or original minus random as labeled.",
            "total_variation_distance": "One half of the summed absolute category-proportion differences; range 0 to 1.",
            "interval_method": CI_METHOD,
            "exact_vs_estimated": "Census metadata, word lengths and literal group-template flags are exact for this pinned release. Rich regex flags were recomputed only in the random reference; original flags are retained.",
            "sampling_uncertainty": "Only random-reference proportions have intervals. Classification validity, dataset selection, and original block-sample dependence are separate issues.",
            "comparison_policy": "No p-value or arbitrary effect-size threshold determines whether the original sample is representative. Inspect magnitude and changes to the substantive interpretation.",
        },
        "profiles": {scope: profile.summary() for scope, profile in profiles.items()},
        "categorical": categorical, "model_by_year": model_year_comparisons(profiles, joint_counts),
        "flags": flags, "lengths": length_comparisons(profiles), "repetition": repetition,
        "largest_differences": {
            "original_minus_census_by_category": {
                metric: sorted(info["rows"], key=lambda r: abs(r["delta_pp"]["original_minus_census"]), reverse=True)[:5]
                for metric, info in categorical.items()
            },
            "original_minus_random_regex_flags": sorted(
                (row for row in flags.values() if row["census"] is None),
                key=lambda r: abs(r["delta_pp"]["original_minus_random"])
                if r["delta_pp"]["original_minus_random"] is not None else -1,
                reverse=True),
            "meaning": "Largest observed percentage-point differences; no claim of proven sampling bias or statistical significance.",
        },
        "old_sample_verification": verification,
        "overlap": {"original_random_rows": len(overlap), "row_indices": overlap,
                    "expected_under_uniform_sampling": REFERENCE_N * len(original) / POPULATION_N,
                    "interpretation": "Natural overlap is retained; the reference was sampled from the entire release."},
        "comparisons": flattened, "comparison_rows": long_rows,
        "checkpoints": verified_shards,
        "checks": {
            "all_86_complete_checkpoints": True, "all_checksums_match": True,
            "census_row_indices_contiguous": True, "all_category_totals_match": True,
            "length_and_joint_histogram_totals_match": True,
            "random_seed_reproduces_all_row_ids": True,
            "source_turn_mismatch_totals_match_checkpoints": True,
            "random_base_features_match_census": True,
            "random_base_field_comparisons": reference_base_checks,
            "old_sample_frame_matches": not any_mismatch_ids,
            "raw_text_or_conversation_hashes_exported": False,
        },
    }


def self_check():
    histogram = collections.Counter({0: 1, 1: 2, 10: 1})
    quantiles = weighted_quantiles(histogram)
    assert quantiles["median"] == 1 and quantiles["p75"] == 3.25 and quantiles["max"] == 10
    assert sum(b["count"] for b in fixed_histogram(histogram)) == 4
    assert ecdf_points(histogram, [0, 1, 10])[-1]["pct"] == 100
    assert ecdf_gap(histogram, histogram)["max_ecdf_gap"] == 0
    assert ecdf_gap(collections.Counter({0: 2}), collections.Counter({1: 2}))["max_ecdf_gap"] == 1
    assert finite_population_ci(2, 4, 4) == [50, 50]
    assert finite_population_ci(0, 20, 100)[1] > 0
    assert finite_population_ci(20, 20, 100)[0] < 100
    assert finite_population_ci(0, 0, 100) is None
    counts = repetition_profile(collections.Counter({"a": 3, "b": 1}), 5)
    assert counts["extra_rows_beyond_distinct_hashes"] == 2
    assert counts["rows_in_repeated_hash_groups"] == 3 and counts["missing_hash_rows"] == 1
    assert [turn_bucket(n) for n in (0, 1, 2, 3, 4, 6, 11)] == ["0", "1", "2", "3", "4–5", "6–10", "11+"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--status", action="store_true", help="Report readiness without reading full features or writing output.")
    parser.add_argument("--self-check", action="store_true", help="Check calculations using small synthetic inputs; write nothing.")
    args = parser.parse_args()
    self_check()
    if args.self_check:
        print("Calculation self-checks passed; no output files written.")
        return 0
    status, checkpoints = readiness()
    if args.status or not status["ready"]:
        print(json.dumps(status, indent=2))
        if not status["ready"] and not args.status:
            print("Census incomplete: comparison.json was not written.", file=sys.stderr)
        return 0 if args.status else 2
    result = summarize(checkpoints)
    target = OUT / "comparison.json"
    atomic_json(target, result)
    print(json.dumps({"output": str(target.relative_to(ROOT)), "complete": True,
                      "census_rows": result["source"]["population_rows"],
                      "original_random_overlap": result["overlap"]["original_random_rows"],
                      "old_sample_mismatch_rows": result["old_sample_verification"]["mismatch_rows_any_field"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
