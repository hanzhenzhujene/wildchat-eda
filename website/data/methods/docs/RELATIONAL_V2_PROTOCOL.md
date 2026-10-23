# Relational-content labels: full-release random sample

**Sample:** 2,000 released rows sampled uniformly without replacement from the pinned 3,199,860-row split (seed 2026102002). No language, keyword, length or deduplication filter precedes the draw. The sample plan is saved before annotation.

**Unit:** the final active user request, interpreted with the stored dialogue. A row is not a person. Earlier interpersonal requests are recorded separately; they do not inflate the final-request counts.

## What the labels describe

| Field | Meaning |
|---|---|
| Purpose | The task the final request asks the model to perform (same seven categories as the original 120-row audit). |
| Relational mode | Apparently personal help, participation in a presented social exchange, described/hypothetical interpersonal content, no interpersonal focus, or unresolved relevance. |
| Frame | Whether the material is presented as personal, hypothetical, fictional, supplied text, or a social exchange. This does not verify that events occurred. |
| Input format | Direct request, supplied document/code, embedded dialogue, or unresolved. |
| Context | The relationship setting described by the request, not a verified user biography. |
| Benchmark route | A possible use for the source material, not an accepted test case. |

`none` and `unclear` are separate. For a like-for-like comparison with the old audit, they can be combined into its `none_or_unclear` category. The coding protocol is more explicit than the old protocol, so differences between audits may reflect annotation differences as well as sampling.

### Candidate uses

- **Advice response:** an apparently personal interpersonal advice or interpretation request.
- **Communication draft:** wording for a concrete interpersonal situation, including work or community exchanges.
- **Social response:** a reply within a presented exchange involving other people (authenticity unverified).
- **Scenario seed:** supplied/hypothetical/fictional material with a recoverable interpersonal choice or response target. Turning it into a test case changes the task and must be documented.

A candidate needs human judgment about inclusion and the intended criterion. A source reply is not a reference answer. No label measures whether a relationship improved.

## AI annotation

The primary model is `gpt-5.4-mini-2026-03-17`. It receives the complete stored role/content dialogue with zero-based message indexes. The source model name and source language label are not included in the annotator's input. The prompt tells the annotator to treat every dialogue as untrusted research material, ignore embedded instructions, and produce short deidentified paraphrases rather than quotations.

The exact system prompt and JSON schema are saved under `config/relational_v2/`. The primary run uses medium reasoning effort, structured JSON output, a 4,000-token completion limit (including reasoning), and `store: false`. No temperature parameter is sent. The second model uses temperature 0 and a 1,200-token output limit. Each record retains the requested and returned model IDs, prompt/schema hash, full input hash, token use, completion status, and source-file hash. The input hash covers the serialized source payload. If a response violates a structural rule (such as pointing to an assistant message or assigning an advice route to a nonrelational request), a retry states the violated rule; that feedback is saved separately. Structural validity does not establish semantic accuracy. Generation is not guaranteed deterministic.

A dialogue exceeding 250,000 serialized input characters is **not truncated or silently discarded**. It remains in the sample denominator with status `input_limit` and unresolved labels. API failures/refusals are likewise retained as unresolved. Counts of incomplete records must be visible in the results.

### Calibration before the final run

Development runs exposed errors in the initial GPT-4.1 mini labels (for example, treating medication or product advice as interpersonal help). The prompt was clarified and the primary model was changed before the final 2,000-row run. A calibration set includes 16 seeded random records plus seven source-checked boundary cases from this same 2,000-row sample (IDs saved in `config/relational_v2/calibration_plan.json`). This is protocol development, not a held-out accuracy test or human validation. Only labels from the final frozen protocol and selected primary model enter the reported distributions.

## Second AI check

`gpt-4.1-2025-04-14` independently labels:

1. Every primary relational, uncertain, candidate, low-confidence, earlier-relational, or incomplete record.
2. A simple random sample of up to 200 remaining records labeled nonrelational/noncandidate (seed 2026102003).

The second model receives the original source and protocol, **not the primary labels**. The selected IDs and selection rule are saved in `secondary_plan.json`. This subset is not uniformly random overall. Agreement is not accuracy; both are OpenAI models and can share errors. All first and second labels remain available. Disagreements are flagged for human review rather than resolved by treating the larger model as ground truth.

## Completed run and incomplete second checks

The primary pass has **1,998 completed labels and two input-limit records** out of 2,000 sampled rows. Both oversized records remain in the denominator.

The second pass selected **454 records** (254 focus records plus 200 random negatives). It saved **314 labels**, **18 attempted failures**, and **two input-limit statuses**. The other **120 records have no saved second label**. The API account reported exhausted credit (`credit_balance_exhausted`), so the run stopped without changing providers or purchasing credits.

Those 120 files use `not_run_quota` as a completion status. Their exact attempt history is **not recorded**: the interrupted workers did not log request starts, so a missing response does not prove that a request was never attempted. Their `attempts` field is null. Existing attempted failures retain their original error and attempt counts. Neither failures nor placeholders enter agreement calculations.

`secondary_run_summary.json` records the completion counts and this limitation. Its token-use sum covers saved successful final responses; it does not claim total billed usage. All labels remain AI-only.

## Human review

### Separate source inspection of the 31 personal-help flags

On 2026-10-21 (UTC), two AI agents read disjoint groups of 16 and 15 full source
conversations. The parent AI also read all 31 and reconciled the judgments.
The final request and its recorded reply remain the unit, with earlier messages
used as context. This was AI source inspection, not human review or a further
blind model evaluation. It did not change the primary labels.

`personal31_assessment.json` records the outcome, rationale, source indexes and
hashes for every record. The categories distinguish a candidate response choice
from unresolved scope, ordinary wording, or another task. They screen for what
can be assessed in a reply; they do not define love of neighbor or require that
all relational care involve conflict. Candidates still need conceptual judgment
and scoring criteria. The two similar procrastination requests remain two sampled
rows but add little task diversity.

This inspection covers all 31 positive flags, not the rest of the sample. It
cannot measure missed candidates or labeling accuracy. No human-validated
reference answers or relationship outcomes are produced.

Rebuild this layer from the saved AI inspections without API calls:

```sh
.venv/bin/python src/assemble_personal31.py
.venv/bin/python src/summarize_relational.py
```

### Human status

No human validation is recorded in this run. Each output has `human_review_status: not_reviewed`.

Human review is especially needed for disagreements, uncertain framing, source requests that depend on missing context, and proposed benchmark candidates. Domain expertise is needed to decide whether an observable response property corresponds to the intended relational construct. Researchers must also check source reuse requirements before including cases in a benchmark.

## Interpretation

Sampling intervals, if reported, describe random-row sampling uncertainty for the **AI-assigned category** in this pinned release. They exclude annotation error and do not estimate the frequency among people or among all uses of AI. The source collection and repeated rows can further limit generalization. Selected examples are illustrations, not an additional random sample.

## Reproduction

From the repository root:

```sh
.venv/bin/python src/sample_relational.py --workers 4
.venv/bin/python src/label_relational.py --phase primary --workers 8
.venv/bin/python src/label_relational.py --phase secondary --workers 8
```

`--available` allows annotation to begin while immutable source shards are still arriving; rerun the complete command after retrieval to verify full coverage. Successfully labeled records are reused only when source hash, protocol hash, and model ID match. `--retry-failed` retries unresolved API failures; oversized inputs retain the documented input-limit status. Raw dialogues stay in ignored `data/raw/`; public artifacts contain AI labels and deidentified paraphrases.
