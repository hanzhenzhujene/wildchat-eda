# Atlas numbers: source and denominator

All scopes use `allenai/WildChat-4.8M`, `default/train`, revision
`c827c6df8fcf008219ffaffa4d1dd77491099367`. The public release has
**3,199,860 rows in 86 original Parquet shards**. Its publisher filtering is
separate from our sampling ([pinned source card](https://huggingface.co/datasets/allenai/WildChat-4.8M/blob/c827c6df8fcf008219ffaffa4d1dd77491099367/README.md)).

## Three statistical scopes

| Scope | Selection | What is measured |
|---|---|---|
| **Whole release: 3,199,860** | All 86 source shards; retrieved 2026-10-20, with byte sizes and pinned LFS SHA-256 checks. | Metadata, stored message counts, whitespace lengths, literal group-template and base flags. |
| **Original block sample: 20,000** | 200 strata × one 100-row block; seed **20261017**; retrieved 2026-10-17. | Original metadata, regex diagnostics, PDF, record browser and parent set for both review audits. |
| **Uniform-row reference: 20,000** | Simple random sample without replacement across the full release; seed **20261020**. | Same base fields and recomputed original regex diagnostics. No new semantic coding. |

There are no language/date/content exclusions or deduplication before either
sample draw. The reference retains natural overlap with the original sample.
Only reference-sample proportions receive sampling intervals. See the
[measured comparison and verification](SAMPLING_VALIDATION.md).

Atlas aggregate comparisons use fixed scopes and are unaffected by filters.
Filters, record details, joint length density and template boxplots below them
operate on the original sample. The aggregate ECDF display is exact at its
plotted thresholds; steps between thresholds simplify the curve. Saved maximum
ECDF gaps use every observed length. The downloadable comparison also includes
full-scope joint histograms and template-specific lengths.

**The PDF and its existing figures remain original-sample results.** The 120-record
AI audit and the separate retrieval audit have not been enlarged or relabeled.

## Original-sample headline numbers

| Displayed number | What it counts | Selection / denominator |
|---|---|---|
| **20,000 records profiled** | Source rows, including repeated conversation content. | 200 index strata × one 100-row block per stratum; random start, seed **20261017**. Source pool: **3,199,860 rows**. No local language/date/content filter or deduplication before profiling. |
| **120 records AI-coded** | One final active user input per selected record, using prior messages as context. One empty final input is retained. | Simple random sample without replacement from the **20,000 rows**, seed **20261019**; no language or keyword filter. |
| **70 source-language labels** | Distinct values of the source row-level `language` field, including `Nolang` (**66 rows**). | All **20,000 rows**. Automatic labels, not 70 independently verified request languages. |
| **Apr 2023–Jul 2025** | Observed minimum/maximum sampled row timestamps: **2023-04-11 → 2025-07-25**. | All **20,000 rows**. This was not a date filter and is not the full collection period. |

The block sample is not 20,000 independent draws. Neighbouring rows are sampled together, and stratum-edge positions have lower selection probability. Counts describe the realized sample, not all WildChat users.

## Units

**Record** = one source row. **Conversation** = its ordered stored message list (content can repeat across rows). **Message** = one role/content entry. **Request** = the task being asked; here the content audit codes only the final active user input, not every task in the conversation. A single message can contain pasted dialogue, so stored message count is not natural conversation depth.

The 20,000 records contain **66,700 stored messages** (33,350 user + 33,350 assistant) and **18,630 distinct conversation hashes**. None of these is a count of distinct people.

## Review sets and selected examples

| Set | Selection | How it is used |
|---|---|---|
| **Content audit: 120** | Random from all 20,000 rows. | Request-purpose, relational-mode and packaging charts. AI-coded; **no human validation recorded**. Twenty records received a second AI review; further AI checks are described in the [coding protocol](CONTENT_AUDIT_PROTOCOL.md). |
| **Retrieval audit: 80 + 40** | Seed **20261018**: 80 from **1,747 keyword hits**, 40 from **8,889 non-hits**, within **10,636 source-English, non-truncated rows**. | Checks the keyword screen. This deliberately enriched set is separate from the content audit; the two sets share **0 records**. |
| **Six display examples** | Purpose-selected: **3** from the content audit, **2** from the retrieval audit, **1** from post-hoc targeted discovery. | Illustrations, not a random sample or a prevalence estimate. Display text is deidentified English paraphrase. |

Example membership: content audit **255498, 1671993, 2606561**; retrieval audit **286012, 2632268**; targeted discovery **753427**. “Separately reviewed” does not mean an independent representative sample or human review.

## Not recorded / not verified

- **Original retrieval route:** the original manifest does not say whether Dataset Viewer or pinned-stream mode produced the cache. Viewer mode checks the Hub revision before/after; this alone does not attest the Viewer conversion commit. The new row-offset/base-feature comparison checks the retained sample against immutable source rows, without reconstructing the original retrieval route.
- **Timestamp meaning:** conversation start/end semantics and timezone are not verified in the saved scope materials.
- **AI coding runs:** the coding protocol and labels are saved, but exact annotator model/version, full run prompts and generation settings are not recorded.
- **Display selection:** example origins are recorded; no random selection method for the six illustrations is recorded.

## Reproduce the checks

Run `python src/verify_scope.py --check` with the ignored local raw cache present. It verifies seeded selections, checksums, counts, timestamps and review-set membership without printing conversation text. The saved result is [scope_verification.json](../outputs/scope_verification.json).

For the census and reference, use the commands and saved artifacts in
[SAMPLING_VALIDATION.md](SAMPLING_VALIDATION.md). Metadata agreement does not
validate content labels. **No human validation is recorded.**

Source evidence: [source configuration](../config/source.json), [sample manifest](../outputs/sample_manifest.json), [sampling method](SAMPLING.md), [content review plan](../outputs/content_review_plan.json), [retrieval review plan](../outputs/review_plan.json), [example source checks](../outputs/recovered_examples.json), [targeted discovery](../outputs/targeted_search_summary.json).
