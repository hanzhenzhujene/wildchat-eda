# Figure catalog

This catalog contains **12 current figures** and **12 historical figures**. The [manifest](../website/data/public-hub/figures.json) records the scope, denominator, source and takeaway for every chart.

## Current figures

The census describes all 3,199,860 records in the pinned release. Microsoft topic/task labels use the same record denominator but are AI classifications from a separate source. The 2,000-row content sample labels the final active request; its labels have not been human-validated. Metadata matches identify technical combinations, not verified people.

| Figure | Scope | Denominator | Files |
| --- | --- | ---: | --- |
| English is just over half of released records | All 86 source shards; no additional filters | 3,199,860 | [PNG](../website/assets/public-hub/census_languages.png) · [SVG](../website/assets/public-hub/census_languages.svg) |
| Model versions are mixed across the release | All 86 source shards; model family aggregation | 3,199,860 | [PNG](../website/assets/public-hub/census_models.png) · [SVG](../website/assets/public-hub/census_models.svg) |
| Collection volume varies strongly over time | All records; month of source timestamp | 3,199,860 | [PNG](../website/assets/public-hub/census_dates.png) · [SVG](../website/assets/public-hub/census_dates.svg) |
| Most records contain one user message | All source records; counted stored user messages | 3,199,860 | [PNG](../website/assets/public-hub/census_turns.png) · [SVG](../website/assets/public-hub/census_turns.svg) |
| English records have a long text-length tail | English-labeled records; total words per role per record | 1,679,371 | [PNG](../website/assets/public-hub/english_lengths.png) · [SVG](../website/assets/public-hub/english_lengths.svg) |
| A row-random sample is closer to the census | Two separate 20,000-record samples compared with the full release | 20,000 | [PNG](../website/assets/public-hub/sampling_comparison.png) · [SVG](../website/assets/public-hub/sampling_comparison.svg) |
| Writing and information lookup lead task labels | Microsoft released classifications aligned row-by-row to the pinned release | 3,199,860 | [PNG](../website/assets/public-hub/task_distribution.png) · [SVG](../website/assets/public-hub/task_distribution.svg) |
| Topic labels span many domains | Microsoft released classifications aligned row-by-row to the pinned release | 3,199,860 | [PNG](../website/assets/public-hub/topic_distribution.png) · [SVG](../website/assets/public-hub/topic_distribution.svg) |
| Interpersonal content has several distinct forms | 2,000 rows sampled uniformly without replacement; final request classified using stored history | 2,000 | [PNG](../website/assets/public-hub/request_content.png) · [SVG](../website/assets/public-hub/request_content.svg) |
| Text work also dominates the 2,000-request sample | 2,000 uniformly selected records; final active request is the annotation unit | 2,000 | [PNG](../website/assets/public-hub/request_purpose.png) · [SVG](../website/assets/public-hub/request_purpose.svg) |
| Most exact metadata combinations occur once | Exact hashed IP + accept-language + user-agent; all three components nonblank | 1,921,755 | [PNG](../website/assets/public-hub/linkage_records.png) · [SVG](../website/assets/public-hub/linkage_records.svg) |
| Most repeated combinations have short spans | Repeated complete metadata combinations only; latest minus earliest record timestamp | 156,930 | [PNG](../website/assets/public-hub/linkage_span.png) · [SVG](../website/assets/public-hub/linkage_span.svg) |

## Historical figures

These original charts remain available for provenance. Figures 1-8 use the original 20,000-record block sample or a stated subset; figures 9-11 use a separate 120-input AI-label pilot. Figure 12 uses the English-labeled subset of the block sample. These scopes are not pooled, and selected examples do not establish population prevalence.

| Figure | Original scope | Denominator | File |
| --- | --- | ---: | --- |
| Language labels | 20,000-record original block sample | 20,000 | [PNG](../website/assets/figures/01_languages.png) |
| Model mix | 20,000-record original block sample | 20,000 | [PNG](../website/assets/figures/02_models.png) |
| Model mix by year | 20,000-record original block sample | 20,000 | [PNG](../website/assets/figures/03_models_by_year.png) |
| Stored user-message counts | 20,000-record original block sample | 20,000 | [PNG](../website/assets/figures/04_stored_turns.png) |
| Text-length ECDF | English-labeled subset of original block sample | 10,636 | [PNG](../website/assets/figures/05_text_length_ecdf.png) |
| Template text lengths | English-labeled subset of original block sample; see chart subgroups | 10,636 | [PNG](../website/assets/figures/06_template_length.png) |
| Repeated content and source flags | 20,000-record original block sample | 20,000 | [PNG](../website/assets/figures/07_repetition_quality.png) |
| Month coverage | 20,000-record original block sample | 20,000 | [PNG](../website/assets/figures/08_month_coverage.png) |
| Request purpose | 120-input AI-label pilot; not a population sample | 120 | [PNG](../website/assets/figures/09_request_purpose.png) |
| Purpose and supplied material | 120-input AI-label pilot; not a population sample | 120 | [PNG](../website/assets/figures/10_purpose_packaging.png) |
| Interpersonal content modes | 120-input AI-label pilot; not a population sample | 120 | [PNG](../website/assets/figures/11_relational_modes.png) |
| Input and response lengths | English-labeled subset of original block sample | 10,636 | [PNG](../website/assets/figures/12_joint_lengths.png) |

## PDF and rebuilding

The [10-page visual catalog](../website/assets/WildChat_Relational_EDA.pdf) pairs the current charts and retains all twelve historical figures in an appendix. It describes the dataset and measurement limits; it contains no proposed research plan.

Rebuild the current figures, aggregate linkage export and PDF from saved aggregates:

```sh
python scripts/build_public_figures.py
```

Inputs are `website/data/validation.json`, `website/data/microsoft_topics.json`, `website/data/relational_v2.json` and `analysis/outputs/linkage/summary.json`. Historical images must already exist under `website/assets/figures/`. The script does not download source conversations or make model API calls. It updates the PDF checksum in `website/data/source_metadata.json` after rebuilding.

The figure script sorts monthly counts by their date key before plotting. Counts describe released records or the stated sample, not unique users. AI labels do not establish real-life events, relationship outcomes or causal effects.

Sources: [pinned WildChat release](https://huggingface.co/datasets/allenai/WildChat-4.8M/tree/c827c6df8fcf008219ffaffa4d1dd77491099367), [Microsoft classifications](https://github.com/microsoft/adopt-adapt-wildchat/tree/b4e77e44b62ba2ddd0f7b53667b218e345faba09).
