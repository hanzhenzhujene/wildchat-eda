"""Reproducible descriptive distributions of the cached 20,000-record sample.

No network calls; no conversation text is retained in the outputs. Figures are
sample descriptions, not estimates of population usage or causal comparisons.
"""
import collections
import csv
import gzip
import hashlib
import json
import pathlib

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.ticker import FuncFormatter, PercentFormatter

from supplementary import PATTERNS, family

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs"
FIG = OUT / "figures"
NAVY = "#173854"
BLUE = "#356EB5"
TEAL = "#147D78"
AMBER = "#B16D22"
LIGHT = "#DEE7EE"
GRAY = "#65717B"
plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 13,
    "axes.titlesize": 20, "axes.titleweight": "bold",
    "axes.labelsize": 13, "axes.labelcolor": NAVY,
    "text.color": NAVY, "xtick.color": GRAY, "ytick.color": NAVY,
    "axes.spines.top": False, "axes.spines.right": False,
    "axes.spines.left": False, "axes.spines.bottom": False,
    "axes.axisbelow": True, "savefig.facecolor": "white",
    "svg.hashsalt": "wildchat-distributions-v1",
})


def sha(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def quantiles(values):
    a = np.asarray(values, dtype=float)
    q = np.quantile(a, [0, .1, .25, .5, .75, .9, .95, .99, 1])
    return {k: round(float(v), 3) for k, v in zip(
        ["min", "p10", "p25", "median", "p75", "p90", "p95", "p99", "max"], q)}


def percent(n, d):
    return round(n / d * 100, 3) if d else None


def short(x, _=None):
    return f"{x / 1000:g}k" if x >= 1000 else f"{x:g}"


def save(fig, name):
    # No timestamps in SVG metadata; deterministic report inputs.
    fig.savefig(FIG / f"{name}.png", dpi=180, bbox_inches="tight", pad_inches=.15)
    fig.savefig(FIG / f"{name}.svg", bbox_inches="tight", pad_inches=.15,
                metadata={"Date": None, "Creator": "WildChat relational EDA"})
    # A report already supplies its own headline. Keep explanatory subtitles and
    # legends, but remove only this standalone figure's main headline.
    for label in fig.texts:
        if label.get_position()[1] >= .98:
            label.set_visible(False)
    fig.savefig(FIG / f"{name}_panel.png", dpi=180, bbox_inches="tight", pad_inches=.15)
    svg_path = FIG / f"{name}.svg"
    svg_path.write_text("\n".join(line.rstrip() for line in svg_path.read_text().splitlines()) + "\n")
    plt.close(fig)


def hbar(counts, title, subtitle, name, denominator, highlight=None):
    fig, ax = plt.subplots(figsize=(10.8, 5.3))
    labels, values = list(counts), list(counts.values())
    colors = [TEAL if label == highlight else BLUE for label in labels]
    bars = ax.barh(labels, values, color=colors, height=.62)
    ax.invert_yaxis()
    ax.set_xlim(0, max(values) * 1.27)
    ax.xaxis.set_major_formatter(FuncFormatter(short))
    ax.grid(axis="x", color="#E8EDF1")
    ax.set_xlabel("Records in the sample")
    ax.tick_params(axis="both", length=0)
    for b, n in zip(bars, values):
        ax.text(n + max(values) * .015, b.get_y() + b.get_height() / 2,
                f"{n:,}  ({n / denominator:.1%})", va="center", fontsize=12)
    fig.text(.02, .99, title, ha="left", va="top", fontsize=21, weight="bold")
    fig.text(.02, .91, subtitle, color=GRAY, fontsize=12)
    fig.tight_layout(rect=[0, 0, 1, .85])
    save(fig, name)


def main():
    FIG.mkdir(parents=True, exist_ok=True)
    feature_path = OUT / "conversation_features.csv.gz"
    with gzip.open(feature_path, "rt") as stream:
        rows = list(csv.DictReader(stream))
    integer_fields = ["row_index", "user_turns", "assistant_messages", "user_words",
                      "assistant_words", "empty_user_messages", "context_count"]
    boolean_fields = ["redacted", "truncated", "candidate", "creative_flag", "code_flag", "nonempty_user"]
    for r in rows:
        for k in integer_fields:
            r[k] = int(r[k])
        for k in boolean_fields:
            assert r[k] in {"True", "False"}
            r[k] = r[k] == "True"
        r["year"] = r["date"][:4]
        r["family"] = family(r["model"])
    by_id = {r["row_index"]: r for r in rows}
    manifest = json.loads((OUT / "sample_manifest.json").read_text())
    raw_path = ROOT / "data/raw/sample.jsonl"
    assert sha(raw_path) == manifest["sample_sha256"]
    assert len(rows) == len(by_id) == 20000
    seen = set()
    with raw_path.open() as stream:
        for line in stream:
            raw = json.loads(line)
            r = by_id[raw["row_index"]]
            assert r["row_index"] not in seen
            seen.add(r["row_index"])
            users = [m.get("content") or "" for m in raw["conversation"] if m["role"] == "user"]
            text = "\n".join(users)
            assert len(text.split()) == r["user_words"]
            r["known_wrapper"] = bool(PATTERNS["named_bot_persona"].search(text) and
                                      PATTERNS["group_environment"].search(text))
            lower = text.lower()
            r["known_job_template"] = all(s in lower for s in ["as a recruiter", "summarize the job", "==text=="])
            normalized_dialogue = json.dumps([
                {"role": m["role"], "content": m.get("content") or ""}
                for m in raw["conversation"]], ensure_ascii=False, sort_keys=True)
            r["dialogue_content_hash"] = hashlib.sha256(normalized_dialogue.encode()).hexdigest()
    assert seen == set(by_id)
    n = len(rows)
    english = [r for r in rows if r["language"] == "English" and not r["truncated"]]
    wrapper = [r for r in rows if r["known_wrapper"]]
    job_template = [r for r in rows if r["known_job_template"]]
    english_wrapper = [r for r in english if r["known_wrapper"]]
    english_other = [r for r in english if not r["known_wrapper"]]
    languages = collections.Counter(r["language"] for r in rows)
    families = collections.Counter(r["family"] for r in rows)
    months = dict(sorted(collections.Counter(r["date"][:7] for r in rows).items()))
    turns = dict(sorted(collections.Counter(r["user_turns"] for r in rows).items()))
    turn_ranges = [("1", 1, 1), ("2", 2, 2), ("3", 3, 3), ("4–5", 4, 5),
                   ("6–10", 6, 10), ("11+", 11, float("inf"))]
    turn_buckets = {label: sum(low <= r["user_turns"] <= high for r in rows)
                    for label, low, high in turn_ranges}
    assert sum(turn_buckets.values()) == n
    years = sorted({r["year"] for r in rows})
    year_stats = []
    for year in years:
        subset = [r for r in rows if r["year"] == year]
        year_stats.append({"year": year, "records": len(subset),
            "one_user_message": sum(r["user_turns"] == 1 for r in subset),
            "one_user_message_pct": percent(sum(r["user_turns"] == 1 for r in subset), len(subset)),
            "known_wrapper": sum(r["known_wrapper"] for r in subset),
            "model_family_counts": dict(collections.Counter(r["family"] for r in subset))})

    def length_profile(group):
        return {"records": len(group),
                "user_words": quantiles([r["user_words"] for r in group]),
                "assistant_words": quantiles([r["assistant_words"] for r in group]),
                "user_words_above_1000": sum(r["user_words"] > 1000 for r in group),
                "user_words_above_5000": sum(r["user_words"] > 5000 for r in group),
                "empty_user_text": sum(r["user_words"] == 0 for r in group)}

    hashes = collections.Counter(r["conversation_hash"] for r in rows)
    content_hashes = collections.Counter(r["dialogue_content_hash"] for r in rows)
    source_hash_contents = collections.defaultdict(set)
    for r in rows:
        source_hash_contents[r["conversation_hash"]].add(r["dialogue_content_hash"])
    openings = collections.Counter(r["first_user_hash"] for r in rows if r["first_user_hash"])
    multiplicity = {"1": 0, "2": 0, "3–5": 0, "6+": 0}
    for count in hashes.values():
        label = "1" if count == 1 else "2" if count == 2 else "3–5" if count <= 5 else "6+"
        multiplicity[label] += 1
    quality = {
        "distinct_conversation_hashes": len(hashes),
        "extra_rows_beyond_distinct_conversation_hashes": n - len(hashes),
        "records_in_repeated_conversation_hash_groups": sum(v for v in hashes.values() if v > 1),
        "repeated_conversation_hash_groups": sum(v > 1 for v in hashes.values()),
        "max_conversation_hash_multiplicity": max(hashes.values()),
        "exact_dialogue_content_duplicate_extra_rows": n - len(content_hashes),
        "source_hash_groups_with_different_dialogue_contents": sum(len(v) > 1 for v in source_hash_contents.values()),
        "conversation_hash_multiplicity_group_counts": multiplicity,
        "nonempty_first_message_records": sum(openings.values()),
        "distinct_nonempty_first_message_hashes": len(openings),
        "extra_rows_beyond_distinct_nonempty_opening_hashes": sum(openings.values()) - len(openings),
        "records_in_repeated_opening_hash_groups": sum(v for v in openings.values() if v > 1),
        "max_opening_hash_multiplicity": max(openings.values()),
        "redacted_records": sum(r["redacted"] for r in rows),
        "records_with_an_empty_user_message": sum(r["empty_user_messages"] > 0 for r in rows),
        "truncated_records": sum(r["truncated"] for r in rows),
    }
    lengths = {"source_english": length_profile(english),
               "english_known_template": length_profile(english_wrapper),
               "english_other_records": length_profile(english_other)}
    family_order = ["GPT-3.5", "GPT-4 / GPT-4 Turbo", "GPT-4o", "GPT-4o mini",
                    "GPT-4.1 mini", "o1 mini", "o1 preview"]
    output = {
        "schema_version": 1,
        "scope": "Descriptive EDA of the 20,000-record, 200-block sample; not population prevalence or a time trend.",
        "provenance": {"sample_sha256": manifest["sample_sha256"],
                       "features_sha256": sha(feature_path), "source_revision": manifest["revision"],
                       "code_sha256": sha(pathlib.Path(__file__)),
                       "records": n, "raw_text_written": False},
        "definitions": {
            "record": "One dataset row, not one unique person or necessarily an independent conversation.",
            "stored_user_message": "One stored user-role message; it can contain quoted documents or embedded conversation history.",
            "word_count": "Whitespace-delimited tokens across all user messages or all assistant messages in a record. Length charts use source-English-labeled records only; automatic labels are not independently verified.",
            "known_template": "Both exact persona and group-environment strings from supplementary.py match user text. A template flag does not verify group participation or the current request.",
            "known_job_template": "Post-hoc literal match requiring all three case-insensitive strings: as a recruiter; summarize the job; ==TEXT==. This identifies a specific template, not all job requests or verified automation.",
            "model_family": "Descriptive grouping by model-name prefix, not a comparison of model capability.",
            "repetition": "Repeated source conversation hashes were checked against SHA-256 of the ordered role/content messages. No same-hash group had differing dialogue content; both measures yield 1,370 extra copies. Repeated opening text can be generic greetings. Overlapping counts must not be added.",
            "quantiles": "NumPy linear sample quantiles; p90 means 90% of records have length at or below this value.",
        },
        "language_label_counts": dict(languages.most_common()),
        "language_label_count": len(languages),
        "model_family_counts": dict(families.most_common()),
        "month_counts": months,
        "stored_user_message_counts": turns,
        "stored_user_message_buckets": turn_buckets,
        "stored_user_message_quantiles": quantiles([r["user_turns"] for r in rows]),
        "year_profiles": year_stats,
        "length_profiles": lengths,
        "known_template_records": len(wrapper),
        "known_template_source_language_counts": dict(collections.Counter(r["language"] for r in wrapper).most_common()),
        "known_job_template": {
            "records": len(job_template), "pct_sample": percent(len(job_template), n),
            "source_english_records": sum(r["language"] == "English" for r in job_template),
            "language_counts": dict(collections.Counter(r["language"] for r in job_template).most_common()),
            "year_counts": dict(sorted(collections.Counter(r["year"] for r in job_template).items())),
            "model_counts": dict(collections.Counter(r["model"] for r in job_template).most_common()),
            "stored_user_message_counts": dict(sorted(collections.Counter(r["user_turns"] for r in job_template).items())),
            "overlap_with_group_template": sum(r["known_wrapper"] for r in job_template),
            "english_length_profile": length_profile([r for r in job_template if r["language"] == "English"]),
        },
        "data_quality": quality,
        "figures": {},
    }

    top_languages = dict(languages.most_common(8))
    top_languages[f"Other {len(languages) - 8} labels"] = n - sum(top_languages.values())
    hbar(top_languages, "English accounts for 53% of source language labels",
         "20,000 sampled records · automatic labels, not verified request languages",
         "01_languages", n, "English")
    hbar(dict(families.most_common()), "The sample spans seven OpenAI model families",
         "20,000 sampled records · model-name groups describe coverage, not capability",
         "02_models", n)

    fig, ax = plt.subplots(figsize=(10.8, 5.3))
    arr = np.array([[y["model_family_counts"].get(f, 0) / y["records"] * 100
                     for y in year_stats] for f in family_order])
    image = ax.imshow(arr, cmap="Blues", vmin=0, vmax=60, aspect="auto")
    ax.set_xticks(range(len(years)), [f"{y['year']}\nn = {y['records']:,}" for y in year_stats])
    ax.set_yticks(range(len(family_order)), family_order)
    ax.tick_params(length=0, pad=10)
    for i in range(len(family_order)):
        for j in range(len(years)):
            ax.text(j, i, f"{arr[i, j]:.0f}%" if arr[i, j] else "—",
                    ha="center", va="center", color="white" if arr[i, j] > 38 else NAVY,
                    fontsize=15, weight="bold")
    fig.text(.02, .99, "Model coverage changes sharply across sampled years", ha="left", va="top",
                 fontsize=21, weight="bold")
    fig.text(.02, .91, "Share within each sampled year (rounded) · model and date coverage are coupled", color=GRAY, fontsize=12)
    fig.tight_layout(rect=[0, 0, 1, .85])
    save(fig, "03_models_by_year")

    fig, axes = plt.subplots(1, 2, figsize=(12.1, 5.3), gridspec_kw={"width_ratios": [1.45, 1]})
    ax = axes[0]
    bars = ax.bar(list(turn_buckets), list(turn_buckets.values()), color=BLUE, width=.65)
    for b, count in zip(bars, turn_buckets.values()):
        ax.text(b.get_x() + b.get_width()/2, count + 310, f"{count:,}\n{count / n:.1%}",
                ha="center", fontsize=11.5)
    ax.set_ylim(0, n * .98)
    ax.set_ylabel("Records")
    ax.set_xlabel("Stored user messages per record")
    ax.yaxis.set_major_formatter(FuncFormatter(short))
    ax.grid(axis="y", color="#E8EDF1")
    ax.tick_params(length=0)
    ax = axes[1]
    one = [y["one_user_message_pct"] for y in year_stats]
    ax.barh(years, one, color=BLUE, label="1 stored user message", height=.5)
    ax.barh(years, [100-v for v in one], left=one, color=LIGHT, label="2+ stored user messages", height=.5)
    for j, v in enumerate(one):
        ax.text(v/2, j, f"{v:.0f}%", ha="center", va="center", color="white", weight="bold", fontsize=14)
    ax.set_xlim(0, 100)
    ax.xaxis.set_major_formatter(PercentFormatter())
    ax.invert_yaxis()
    ax.set_title("Single-message share by year", fontsize=14, pad=14)
    ax.tick_params(length=0)
    fig.legend(*ax.get_legend_handles_labels(), loc="lower center", bbox_to_anchor=(.77, .0), frameon=False, fontsize=11)
    fig.text(.02, .99, "83% of records contain one stored user message", ha="left", va="top",
                 fontsize=21, weight="bold")
    fig.text(.02, .91, "All 20,000 records · one stored message can still contain an embedded conversation", color=GRAY, fontsize=12)
    fig.tight_layout(rect=[0, .08, 1, .85], w_pad=3)
    save(fig, "04_stored_turns")

    def ecdf(ax, values, label, color):
        x = np.sort(np.asarray(values))
        y = np.arange(1, len(x) + 1) / len(x)
        ax.plot(x, y, label=label, color=color, linewidth=2.6)

    fig, ax = plt.subplots(figsize=(10.8, 5.3))
    ecdf(ax, [r["user_words"] for r in english], "User input", BLUE)
    ecdf(ax, [r["assistant_words"] for r in english], "AI output", TEAL)
    ax.set_xscale("symlog", linthresh=10)
    ax.set_xticks([0, 10, 100, 1000, 10000, 100000])
    ax.xaxis.set_major_formatter(FuncFormatter(short))
    ax.yaxis.set_major_formatter(PercentFormatter(1))
    ax.set_ylim(0, 1.03)
    ax.set_xlim(0, max(r["user_words"] for r in english) * 1.1)
    ax.set_xlabel("Words per record (log spacing above 10)")
    ax.set_ylabel("Share of records at or below this length")
    ax.grid(color="#E8EDF1")
    ax.tick_params(length=0)
    ax.legend(loc="lower right", frameon=False)
    fig.text(.02, .99, "Input and output lengths have a long tail", ha="left", va="top",
                 fontsize=21, weight="bold")
    med = lengths["source_english"]
    fig.text(.02, .91, f"{len(english):,} English-labeled records · median input {med['user_words']['median']:g} words; output {med['assistant_words']['median']:g} words", color=GRAY, fontsize=12)
    fig.tight_layout(rect=[0, 0, 1, .85])
    save(fig, "05_text_length_ecdf")

    fig, ax = plt.subplots(figsize=(10.8, 5.3))
    max_words = max(r["user_words"] for r in english)
    bins = np.r_[0, np.geomspace(1, max_words+1, 22)]
    for group, label, color in [(english_other, f"Other records (n = {len(english_other):,})", BLUE),
                                (english_wrapper, f"Known template (n = {len(english_wrapper):,})", AMBER)]:
        values = [r["user_words"] for r in group]
        ax.hist(values, bins=bins, weights=np.ones(len(values)) / len(values), histtype="step", linewidth=2.4, color=color, label=label)
    ax.set_xscale("symlog", linthresh=10)
    ax.set_xticks([0, 10, 100, 1000, 10000, 100000])
    ax.xaxis.set_major_formatter(FuncFormatter(short))
    ax.yaxis.set_major_formatter(PercentFormatter(1))
    ax.set_xlabel("User-input words per record (log-spaced bins above 1)")
    ax.set_ylabel("Share of each group in the bin")
    ax.grid(axis="y", color="#E8EDF1")
    ax.tick_params(length=0)
    ax.legend(frameon=False, loc="upper left")
    fig.text(.02, .99, "The known group template forms a separate input-length cluster", ha="left", va="top",
                 fontsize=21, weight="bold")
    fig.text(.02, .91, "English-labeled records · template: bot rules + game-group data + current request", color=GRAY, fontsize=12)
    fig.tight_layout(rect=[0, 0, 1, .85])
    save(fig, "06_template_length")

    fig, axes = plt.subplots(1, 2, figsize=(11.5, 5.3), gridspec_kw={"width_ratios": [1, 1.25]})
    ax = axes[0]
    repeated_sizes = collections.Counter(min(v, 6) for v in hashes.values() if v > 1)
    repeat_labels = ["2", "3", "4", "5", "6+"]
    repeat_vals = [repeated_sizes.get(i, 0) for i in range(2, 7)]
    bars = ax.bar(repeat_labels, repeat_vals, color=BLUE, width=.6)
    for b, val in zip(bars, repeat_vals):
        ax.text(b.get_x()+b.get_width()/2, val+max(repeat_vals)*.02, f"{val:,}", ha="center", fontsize=12)
    ax.set_ylim(0, max(repeat_vals)*1.18)
    ax.set_xlabel("Occurrences of the same conversation hash")
    ax.set_ylabel("Repeated hash groups")
    ax.grid(axis="y", color="#E8EDF1")
    ax.tick_params(length=0)
    ax = axes[1]
    labels = ["Repeated conversation hash", "Repeated opening text", "Redaction flag", "An empty user message"]
    vals = [quality["extra_rows_beyond_distinct_conversation_hashes"],
            quality["extra_rows_beyond_distinct_nonempty_opening_hashes"],
            quality["redacted_records"], quality["records_with_an_empty_user_message"]]
    bars = ax.barh(labels, vals, color=[BLUE, LIGHT, AMBER, AMBER], height=.55)
    ax.invert_yaxis()
    ax.set_xlim(0, max(vals)*1.32)
    for b, val in zip(bars, vals):
        ax.text(val + max(vals)*.025, b.get_y()+b.get_height()/2, f"{val:,}", va="center", fontsize=12)
    ax.xaxis.set_major_formatter(FuncFormatter(short))
    ax.set_xlabel("Records (first two bars count extra copies)")
    ax.grid(axis="x", color="#E8EDF1")
    ax.tick_params(length=0)
    fig.text(.02, .99, "Repeated records matter before sampling benchmark cases", ha="left", va="top",
                 fontsize=21, weight="bold")
    fig.text(.02, .91, "20,000 sampled records · measures overlap; repeated opening text alone does not prove a duplicate conversation", color=GRAY, fontsize=11.5)
    fig.tight_layout(rect=[0, 0, 1, .85], w_pad=3)
    save(fig, "07_repetition_quality")

    fig, ax = plt.subplots(figsize=(10.8, 4.8))
    keys, vals = list(months), list(months.values())
    ax.bar(range(len(keys)), vals, color=BLUE, width=.8)
    ix = list(range(0, len(keys), 3))
    ax.set_xticks(ix, [keys[i] for i in ix], rotation=35, ha="right")
    ax.yaxis.set_major_formatter(FuncFormatter(short))
    ax.set_ylabel("Sampled records")
    ax.set_xlabel("Recorded month")
    ax.grid(axis="y", color="#E8EDF1")
    ax.tick_params(length=0)
    fig.text(.02, .99, "The sample covers 28 months, unevenly", ha="left", va="top",
                 fontsize=21, weight="bold")
    fig.text(.02, .91, "200 sampled blocks of 100 rows · this describes sample coverage, not a platform usage trend", color=GRAY, fontsize=12)
    fig.tight_layout(rect=[0, 0, 1, .85])
    save(fig, "08_month_coverage")

    descriptions = {
        "01_languages": "Source-language counts; eight largest labels plus remainder. All 20,000 records.",
        "02_models": "Model-name family counts. All 20,000 records; all responses from OpenAI models.",
        "03_models_by_year": "Within-year family shares; no causal model or time comparison.",
        "04_stored_turns": "Stored user-message count histogram and within-year one-message share. Includes embedded histories.",
        "05_text_length_ecdf": "English-labeled record-level input/output length ECDF; whitespace words summed across messages.",
        "06_template_length": "Input-length histogram, normalized separately within English known-template and other records.",
        "07_repetition_quality": "Repeated conversation-hash multiplicities and overlapping quality diagnostics.",
        "08_month_coverage": "Monthly composition of the block sample; not a source-population usage trend.",
    }
    output["figures"] = {name: {"png": f"outputs/figures/{name}.png", "svg": f"outputs/figures/{name}.svg",
                              "panel_png": f"outputs/figures/{name}_panel.png", "description": desc}
                         for name, desc in descriptions.items()}
    (OUT / "distributions_summary.json").write_text(json.dumps(output, indent=2) + "\n")
    print(json.dumps({"figures": list(descriptions), "records": n, "language_labels": len(languages),
                      "stored_turns": output["stored_user_message_quantiles"],
                      "lengths": lengths, "quality": quality}, indent=2))


if __name__ == "__main__":
    main()
