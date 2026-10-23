"""Joint input/output length distribution, using the cached EDA sample.

The two panels partition source-English-labeled records by the existing literal
group-template flag. Counts describe records, not independent people. No raw
conversation text or record identifiers are written to the outputs.
"""
import csv
import gzip
import json
import pathlib

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap, LogNorm
import numpy as np

from distributions import BLUE, GRAY, NAVY, TEAL, sha
from supplementary import PATTERNS

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs"
FIG = OUT / "figures"


def main():
    feature_path = OUT / "conversation_features.csv.gz"
    raw_path = ROOT / "data/raw/sample.jsonl"
    manifest = json.loads((OUT / "sample_manifest.json").read_text())
    assert sha(raw_path) == manifest["sample_sha256"]
    with gzip.open(feature_path, "rt") as stream:
        rows = [r for r in csv.DictReader(stream)
                if r["language"] == "English" and r["truncated"] == "False"]
    by_id = {int(r["row_index"]): r for r in rows}
    assert len(rows) == len(by_id) == 10636
    seen = set()
    with raw_path.open() as stream:
        for line in stream:
            raw = json.loads(line)
            row = by_id.get(raw["row_index"])
            if row is None:
                continue
            users = "\n".join(m.get("content") or "" for m in raw["conversation"]
                              if m["role"] == "user")
            assistants = "\n".join(m.get("content") or "" for m in raw["conversation"]
                                   if m["role"] == "assistant")
            assert len(users.split()) == int(row["user_words"])
            assert len(assistants.split()) == int(row["assistant_words"])
            row["known_template"] = bool(PATTERNS["named_bot_persona"].search(users)
                                         and PATTERNS["group_environment"].search(users))
            seen.add(raw["row_index"])
    assert seen == set(by_id)

    groups = {
        "other_english": [r for r in rows if not r["known_template"]],
        "known_group_template": [r for r in rows if r["known_template"]],
    }
    profiles = {}
    for name, subset in groups.items():
        x = np.array([int(r["user_words"]) for r in subset])
        y = np.array([int(r["assistant_words"]) for r in subset])
        long_short = int(np.sum((x > 1000) & (y < 100)))
        profiles[name] = {
            "records": len(subset),
            "median_input_words": float(np.median(x)),
            "median_output_words": float(np.median(y)),
            "input_above_1000_output_below_100_records": long_short,
            "input_above_1000_output_below_100_pct": round(100 * long_short / len(subset), 3),
            "input_longer_than_output_records": int(np.sum(x > y)),
            "zero_input_records": int(np.sum(x == 0)),
            "zero_output_records": int(np.sum(y == 0)),
        }
    assert profiles["known_group_template"]["records"] == 704
    assert profiles["other_english"]["records"] == 9932

    fig, axes = plt.subplots(1, 2, figsize=(13.1, 4.7), sharex=True, sharey=True)
    fig.subplots_adjust(left=.075, right=.88, bottom=.20, top=.76, wspace=.16)
    cmap = LinearSegmentedColormap.from_list("sample_counts", ["#DCE8F2", BLUE, NAVY])
    panels = []
    extent = (0, 5, 0, 5)
    headings = ["Other records  ·  n = 9,932", "Known group template  ·  n = 704"]
    for ax, (name, subset), title, color in zip(
            axes, groups.items(), headings, [BLUE, TEAL]):
        x = np.array([int(r["user_words"]) for r in subset])
        y = np.array([int(r["assistant_words"]) for r in subset])
        panel = ax.hexbin(np.log10(x + 1), np.log10(y + 1),
                          gridsize=(36, 24), extent=extent, mincnt=1,
                          linewidths=0, cmap=cmap)
        panels.append(panel)
        ax.plot([0, 5], [0, 5], color="#82919C", ls=(0, (4, 4)), lw=1, zorder=3)
        ax.set_title(title, loc="left", color=color, fontsize=15, pad=9)
        ticks = [0, 10, 100, 1000, 10000, 100000]
        ax.set_xticks(np.log10(np.array(ticks) + 1))
        ax.set_yticks(np.log10(np.array(ticks) + 1))
        ax.set_xticklabels(["0", "10", "100", "1k", "10k", "100k"], fontsize=11)
        ax.set_yticklabels(["0", "10", "100", "1k", "10k", "100k"], fontsize=11)
        ax.set_xlim(0, 5.04)
        ax.set_ylim(0, 5.04)
        ax.tick_params(length=0)
        ax.set_xlabel("User input (words)", fontsize=12, labelpad=9)
        ax.set_facecolor("#FAFCFD")
    axes[0].set_ylabel("Assistant output (words)", fontsize=12, labelpad=9)
    max_count = max(float(p.get_array().max()) for p in panels)
    norm = LogNorm(vmin=1, vmax=max_count)
    for p in panels:
        p.set_norm(norm)
    cax = fig.add_axes([.903, .235, .018, .45])
    cb = fig.colorbar(panels[0], cax=cax)
    cb.set_ticks([v for v in [1, 10, 100, 1000] if v <= max_count])
    cb.set_ticklabels([str(v) for v in [1, 10, 100, 1000] if v <= max_count])
    cb.ax.tick_params(labelsize=11, length=0)
    cb.set_label("Records per hexagon", fontsize=11, labelpad=11)
    cb.outline.set_visible(False)
    # A compact footer describes the diagonal rather than placing text over data.
    fig.text(.075, .035,
             "Dashed line: equal word counts.  Below it: the AI output is shorter than the input.",
             fontsize=11, color=GRAY)
    headline = fig.text(.025, .985, "Long inputs can produce very short AI replies",
                        ha="left", va="top", fontsize=21, weight="bold", color=NAVY)
    subtitle = fig.text(.025, .885,
                        "10,636 English-labeled records · totals per role per record · identical log(1 + words) axes",
                        fontsize=12, color=GRAY)
    FIG.mkdir(parents=True, exist_ok=True)
    stem = "12_joint_lengths"
    fig.savefig(FIG / f"{stem}.png", dpi=180, bbox_inches="tight", pad_inches=.15)
    fig.savefig(FIG / f"{stem}.svg", bbox_inches="tight", pad_inches=.15,
                metadata={"Date": None, "Creator": "WildChat relational EDA"})
    headline.set_visible(False)
    subtitle.set_position((.025, .875))
    fig.savefig(FIG / f"{stem}_panel.png", dpi=180, bbox_inches="tight", pad_inches=.15)
    plt.close(fig)
    svg = FIG / f"{stem}.svg"
    svg.write_text("\n".join(line.rstrip() for line in svg.read_text().splitlines()) + "\n")

    result = {
        "schema_version": 1,
        "scope": "Joint length distribution in 10,636 source-English-labeled records from the 20,000-record block sample.",
        "provenance": {
            "source_revision": manifest["revision"],
            "sample_sha256": manifest["sample_sha256"],
            "features_sha256": sha(feature_path),
            "code_sha256": sha(pathlib.Path(__file__)),
            "raw_text_written": False,
        },
        "definitions": {
            "length": "Whitespace-delimited word count across all stored messages of each role in one record; not model tokens.",
            "template": "Both the pre-existing named_bot_persona and group_environment literal patterns match user text. This does not establish authentic group interaction.",
            "panels": "Disjoint partition: 704 known group-template records and 9,932 other English-labeled records.",
            "axes": "log10(1 + word count), with tick labels in original word counts; zero lengths remain included.",
            "color": "Number of records per hexagon, shared logarithmic color scale. Panels have unequal sample sizes; intensity is not a normalized share.",
            "interpretation": "Descriptive shapes only. Model, time, and task mix differ across panels. No causal or population claim.",
        },
        "profiles": profiles,
        "figure": {"name": stem, "gridsize": [36, 24], "max_bin_records": max_count},
    }
    (OUT / "joint_lengths_summary.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(profiles, indent=2))


if __name__ == "__main__":
    main()
