# Sampling and scope

All three scopes use the released rows of `allenai/WildChat-4.8M`,
`default/train`, revision `c827c6df8fcf008219ffaffa4d1dd77491099367`.
The frame has **3,199,860 rows in 86 original Parquet shards**, after publisher
filtering. A row is a stored record, not a distinct person.

| Scope | Selection | Interpretation |
|---|---|---|
| Whole release | Every row of all 86 immutable source shards. | Census values for the fields actually scanned. |
| Original sample | 200 index strata, one 100-row consecutive block per stratum; **20,000 rows**, seed **20261017**. | Descriptive block sample used by the PDF, record browser and content audits. |
| Uniform-row reference | **20,000 rows** drawn without replacement from the entire frame; seed **20261020**. | Simple random sample of released rows, with sampling intervals for proportions. |

Neither sample excludes rows by language, date, model or content before selection.
Neither sample is deduplicated. The new reference does **not** exclude original
sample members; natural overlap is retained. Results, observed overlap and
source checks are in [sampling validation](SAMPLING_VALIDATION.md).

## Original block sample

The 200 non-overlapping strata have near-equal sizes along the row index. Within
each stratum, a seeded random start defines a consecutive 100-row block. This
spreads coverage while keeping Dataset Viewer requests manageable. Neighbouring
rows are sampled together, and stratum-edge positions have lower inclusion
probability. It is not 20,000 independent, equally probable row draws.

Original-sample percentages describe the realized sample. No IID confidence
intervals are assigned to them. Comparing them with census values shows observed
differences for this draw; it does not establish a general sampling-bias mechanism.

Viewer retrieval checks the Hub revision before and after downloading, but the
original manifest does not record whether Viewer or pinned-stream mode produced
the cache. Those Hub checks alone do not attest the Viewer conversion commit.
The validation therefore compares every cached row offset and its saved base
features with the immutable source. It does not reconstruct the retrieval route.

The original manifest records selected offsets and the cache checksum. If the
Hub revision changes, normal retrieval refuses to proceed. To reproduce the same
positions from the immutable source:

```sh
pip install datasets
python src/fetch_sample.py --pinned-stream
```

## Census and uniform-row reference

`src/validate_sampling.py` checks each original shard's byte size and SHA-256
against the pinned Hub LFS manifest. It checks the actual footer row count before
assigning global indices in shard/row order. The uniform reference is selected by:

```python
random.Random(20261020).sample(range(3199860), 20000)
```

The scan computes metadata, stored role/message counts, whitespace-delimited
lengths and a literal group-template flag for every released row. It recomputes
the richer candidate, code, creative and context regex flags only for the uniform
reference. Original regex flags are retained. These flags are diagnostics, not
validated semantic classifications.

Only uniform-reference proportions have approximate pointwise 95% Wilson score
intervals, with a finite-population variance correction and the stated
denominator. They describe row-sampling uncertainty conditional on this release.
They do not measure label validity, publisher selection, or the original block
sample's dependence. Census counts have no row-sampling uncertainty.

There is no single pass/fail test of “representativeness.” The comparison reports
percentage-point differences, categorical distribution distances, length
quantiles and maximum ECDF gaps. Model/date differences are not model capability
comparisons.

## Denominators and retained data

Composition, turn counts and base flags use all rows of each scope. Length
comparisons use source-`English`, non-truncated records in each scope, without
deduplication. Words are counted by whitespace, summed across all stored messages
of a role within each record; they are not model tokens or only the final request.

The candidate flag requires English eligibility. Its all-row percentage and its
percentage within the eligible English pool are different statistics; both
denominators are recorded in the comparison. The original PDF's keyword-screen
rate uses the eligible English denominator.

The original sample cache retains dialogue text and minimal fields, stripping IP
hashes, device headers, geography and API identifiers. The census pipeline
temporarily downloads complete source shards, projects required columns, then
deletes each completed raw shard. Its retained features contain no dialogue text
or device/geographic fields. Raw caches and temporary downloads are excluded from
Git.

Equal conversation hashes define the census repetition groups. Full-corpus
hash equality was not independently checked against every ordered dialogue.
Within-scope duplicate fractions depend on sample size and selection design, so
they are not directly comparable prevalence estimates. A separate comparison
counts membership in groups known to repeat in the census, using the same group
definition for all three scopes.

The original benchmark-design caution still applies: group variants and related
conversations before splitting development and test data. A fresh split by row
alone can leak repeated prompts.

## Historical retrieval and content review

English retrieval uses user messages and requires a relationship keyword,
a first-person marker and a help/question/emotion marker. Context tags overlap;
fiction and coding flags do not silently remove cases. The 80-hit/40-non-hit
retrieval audit and the keyword-independent 120-record content audit both come
from the original sample. The new uniform reference does not replace or enlarge
either review set. **No human validation is recorded.**

The original audit exposed repeated group-bot formatting. A post-hoc diagnostic
matches a specific persona phrase together with a group-environment phrase:
**1,259/20,000** original records, including **704/10,636** eligible English
records and **686/1,747** keyword hits. The PDF compares the latter two
denominators. The census applies this same literal rule; it is not a validated
detector of real group chats and can miss other formats.
In the original sample, matches are confined to April–July 2025 and one recorded
model version. The saved diagnostic links its inputs by checksum.

Language labels are automatic and stored text may mix languages. A schema user
message can contain serialized multi-person history; one stored user message
does not establish one natural conversational turn. Replies are observed model
outputs, not reference answers. Neither the sample nor the census independently
establishes subsequent human actions or relationship outcomes.
