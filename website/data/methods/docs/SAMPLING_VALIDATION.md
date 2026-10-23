# Sampling validation · 2026-10-20

The complete pinned release confirms that most records store one user message:
**83.543%**, compared with **82.995%** in the original block sample. The original
sample has longer English-labeled inputs: median **193 words**, versus **176** in
the census and **178** in the uniform reference. Its largest language-share gap
is French (**−1.212 percentage points**); its largest model-family gap is GPT-3.5
(**−0.944 points**). These are measured differences for the realized samples,
not a single pass/fail judgment of representativeness.

**No human validation is recorded.** This check adds statistical evidence, not
new semantic labels. The original 120-record AI audit, separate 80+40 retrieval
audit, examples and PDF retain their original scope.

## Frame and verification

Source: `allenai/WildChat-4.8M`, `default/train`, revision
`c827c6df8fcf008219ffaffa4d1dd77491099367`.

| Scope | Rows | Selection |
|---|---:|---|
| Whole release | 3,199,860 | All 86 original Parquet shards; every source size and LFS SHA-256 verified. |
| Original block sample | 20,000 | 200 strata × 100 consecutive rows; random starts, seed 20261017. |
| Uniform-row reference | 20,000 | Simple random sampling without replacement over the full release; seed 20261020. |

Neither sample applies language/date/model/content exclusions or deduplication
before selection. The reference does not exclude the original sample. Its
**113 overlapping rows** are retained (expected overlap under uniform sampling:
125.005 rows). All **20,000 original row indices** match the immutable source on
**15 checked fields**, with **0 mismatch rows**. These include conversation hash,
model, language, date, message counts, lengths and base flags; this is not a
byte-for-byte recheck of every original dialogue. All source turn fields agree
with the counted stored user messages.

## Shares of released records

Every cell below is an exact count and its percentage within that scope. Percentages
and differences are rounded to three decimals. `pp` means percentage points.

| Measure | Whole release (n=3,199,860) | Original (n=20,000) | Uniform reference (n=20,000) | Original − release, pp |
|---|---:|---:|---:|---:|
| One stored user message | 2,673,253 (83.543%) | 16,599 (82.995%) | 16,753 (83.765%) | -0.548 |
| English source label | 1,679,371 (52.483%) | 10,636 (53.180%) | 10,632 (53.160%) | +0.697 |
| French source label | 173,167 (5.412%) | 840 (4.200%) | 1,037 (5.185%) | -1.212 |
| GPT-3.5 family | 688,900 (21.529%) | 4,117 (20.585%) | 4,385 (21.925%) | -0.944 |
| March 2024 | 61,851 (1.933%) | 300 (1.500%) | 365 (1.825%) | -0.433 |
| Named group-template rule | 205,438 (6.420%) | 1,259 (6.295%) | 1,284 (6.420%) | -0.125 |
| Source redaction flag | 25,609 (0.800%) | 193 (0.965%) | 175 (0.875%) | +0.165 |
| At least one empty user message | 24,940 (0.779%) | 159 (0.795%) | 143 (0.715%) | +0.016 |
| Hash repeats somewhere in the release | 370,084 (11.566%) | 2,480 (12.400%) | 2,286 (11.430%) | +0.834 |

The whole release contains **76 source-language labels**, including `Nolang`;
each sample contains **70**. The observed date range is **2023-04-09–2025-07-31**
for both the release and uniform reference, versus **2023-04-11–2025-07-25** for
the original sample. These are observed timestamps, not selection filters or
verified conversation-start dates.

The fixed group-template rule remains a format diagnostic. The census has
**2,869,082 distinct conversation hashes** and **330,778 extra rows beyond those
hashes**. Within-scope extra-copy rates cannot be compared directly across a
3.2-million-row census and 20,000-row samples. The final table row instead uses
the same census-defined repeated-hash groups in every scope. Full-corpus hash
equality was not independently checked for byte-identical content.

## English-labeled length distributions

Lengths use non-truncated source-English rows: **1,679,371 census**, **10,636
original**, **10,632 reference**. There is no deduplication. Counts are whitespace
words summed across all stored messages for a role in each record. Quantiles
use linear interpolation at `(n−1)q`; fractional values are expected.

| Quantile, words | Whole release | Original | Uniform reference |
|---|---:|---:|---:|
| User median | 176 | 193 | 178 |
| User p90 | 1,490 | 1,649 | 1,449.8 |
| User p99 | 8,076.3 | 9,047.2 | 7,941.9 |
| Assistant median | 173 | 170 | 175 |
| Assistant p90 | 786 | 813.5 | 774.9 |
| Assistant p99 | 3,314 | 3,451.65 | 3,052.49 |

The maximum user-length ECDF gap from the release is **4.137 pp** for the original
sample and **0.776 pp** for the reference. For the English template-matched
subset, the original gap is **9.642 pp** (reference: **2.542 pp**); the input
medians are **1,907**, **2,005.5** and **1,899.5** words respectively, with
**108,643**, **704** and **688** records. Thus a similar overall template-match
rate does not guarantee the same within-template length distribution.

The saved comparison includes exact word-count frequencies, shared-bin joint
input/output histograms and template-specific comparisons. Atlas aggregate ECDF
values are exact at the displayed thresholds; the intervening steps simplify
the curve. Maximum ECDF gaps use all observed lengths. The interactive density
and template boxplots below the aggregate panel remain original-sample views.

## Regex diagnostics: samples only

These richer rules were recomputed for the uniform reference, not the full
release. Original flags are retained. They do not estimate validated request
purpose or relational relevance.

| Rule and denominator | Original | Uniform reference | Original − reference, pp |
|---|---:|---:|---:|
| Keyword retrieval hit, all rows | 1,747/20,000 (8.735%) | 1,708/20,000 (8.540%) | +0.195 |
| Keyword retrieval hit, eligible English | 1,747/10,636 (16.425%) | 1,708/10,632 (16.065%) | +0.361 |
| Code markers, all rows | 1,831/20,000 (9.155%) | 1,703/20,000 (8.515%) | +0.640 |
| Creative-writing markers, all rows | 1,369/20,000 (6.845%) | 1,373/20,000 (6.865%) | -0.020 |

The original PDF's **16.425%** keyword-screen rate uses eligible English rows;
the atlas comparison's **8.735%** uses all original rows. The numerator is the
same 1,747 records.

Only uniform-reference proportions have approximate pointwise **95% Wilson
score intervals with finite-population variance correction**, conditional on
the stated denominator. They are saved in `ci95_pct` fields in the comparison.
For example, the reference English share is 53.160% with interval
**[52.470%, 53.849%]**. Census values have no row-sampling uncertainty; the
original block sample is not assigned IID intervals. The intervals do not
account for classification validity or how the publisher collected and filtered
the release. No p-value or arbitrary effect-size threshold defines
“representative.”

## Reproduce and inspect

From the repository root, with the original ignored cache available (see the
[original retrieval commands](../README.md#reproduce)):

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-lock.txt
python src/validate_sampling.py --workers 4
python src/summarize_validation.py --status
python src/summarize_validation.py --self-check
python src/summarize_validation.py
python src/verify_scope.py --check
```

The scan also requires `curl`. It downloads about **15.3 GB compressed** in total.
Complete source shards exist temporarily on disk, are projected, and are deleted
after each completed shard. Resuming checks the source identity, derived-file
checksums and selected reference IDs before reusing a checkpoint. Retained census
features contain no conversation text. The aggregator refuses to write a final
comparison until all 86 checkpoints are complete and its consistency checks pass.

- [Full comparison](../../validation.json): every category, flag, length distribution, interval, overlap and verification result.
- [Completed scan manifest](../../sampling_validation/scan_manifest.json): 86 shards, 3,199,860 rows and source checks.
- [Uniform draw and row indices](../../sampling_validation/random_sample_plan.json): seed, algorithm and no-exclusion design.
- [Immutable source-file manifest](../outputs/validation_discovery/original_shards.json): pinned URLs, byte sizes and LFS SHA-256 values.
- [Sampling definitions](SAMPLING.md) and [scope history](STATISTICAL_SCOPE.md): original sample, review sets and interpretation limits.

Hugging Face Viewer `/statistics` was not used as the population benchmark: the
saved response is partial (781,368 rows) and reports a different revision.
The [endpoint discovery record](../outputs/validation_discovery/findings.md)
explains why the immutable-source census was needed.
