# Methods and data scope

## Units

| Term | Meaning here |
| --- | --- |
| **Record** | One released dataset row containing metadata and a stored conversation. It is not a person or necessarily an independent session. |
| **Conversation** | The ordered message list inside a record. Similar history may recur in several records. |
| **Message** | One role/content entry. A pasted chat remains inside its containing message. |
| **Request** | The task the user asks AI to perform, interpreted in context. The content analysis classifies the final active request. |
| **Stored user turns** | Count of user-role messages. Text that describes a dialogue does not add stored turns. |

The full census counts **10,334,364 messages** (5,167,182 user messages and 5,167,182 assistant messages) in **3,199,860 records**. These are message counts, not unique requests or users.

## Analysis scopes

| Layer | Selection | What was measured | Validation status |
| --- | --- | --- | --- |
| Full-release census | Every row in all 86 pinned files; no extra language, topic, deduplication or date filter. | Source labels, stored message counts, word lengths, dates, repeated text and a literal template rule. | Source file SHA-256 digests and row counts checked. Source-language labels are not independently validated. |
| Original 20,000 rows | 200 near-equal row-index sections; one seeded contiguous 100-row block per section (seed 20261017). | Metadata distributions and historical figures. | All 20,000 row positions checked against immutable source files. Not an independent row-random sample. |
| Row-random 20,000 | Uniform draw without replacement from all 3,199,860 rows (seed 20261020). No prefilter. | Comparison with the census and original block sample. | 113 rows overlap the original sample. Intervals refer only to this sampling design. |
| Content 2,000 | Uniform draw without replacement (seed 2026102002). No language or keyword prefilter. | Final-request purpose, input form and interpersonal content, using stored history. | 1,998 AI labels; two complete inputs exceeded the annotation limit. A selected second AI pass produced 314 completed labels. **No human validation.** |
| Historical 120 | Random draw from the original 20,000 rows (seed 20261019). | Earlier final-request labels. | AI checks only; annotation model/version and inference settings were not recorded for this pilot. |
| Retrieval audit | Separate 80 keyword hits and 40 non-hits. | Keyword-screen behaviour. | Not a prevalence sample. |
| Examples | Deliberately selected records from different source sets. | Original questions/replies, stored context and label boundaries. | Selected examples cannot estimate frequency. Marked redactions and AI paraphrases remain identified. |

The publisher had already removed records flagged as toxic before this export. Conclusions describe the retained release, not all traffic. Word counts split on whitespace; they are not tokenizer counts and are especially limited across writing systems.

Total user-text length per English-labeled record has a median of **193 words** in the original sample, versus **176** in the census and **178** in the row-random sample. This sums all stored user messages in each record. This is why the original block-sample plots are retained as historical figures rather than presented as corpus totals.

Saved evidence: [census and sample comparison](../website/data/validation.json), [86-file verification](../analysis/outputs/sampling_validation/scan_manifest.json), [content summary](../analysis/outputs/relational_v2/summary.json), [original sample plan](../analysis/outputs/sample_manifest.json).

## Topic and task

Microsoft released one **topic** label (what the conversation concerns) and one **task** label (what the user asks AI to do) per conversation. These are separate classifications, not two names for the same category.

The fixed release uses GPT-4o-mini labels. Its classification input includes stored messages, with long messages shortened to their first/last 2,500 characters. Prompts were developed in English; multilingual label quality is not established here.

All **3,199,860 rows** were aligned to the census. Topic has **3,703** missing/invalid outputs; task has **4,199**. These remain in the denominator. No additional source-paper language, geography or template filters are applied here. AI labels are not human ground truth.

Sources: [released code and labels](https://github.com/microsoft/adopt-adapt-wildchat/tree/b4e77e44b62ba2ddd0f7b53667b218e345faba09), [taxonomy](../analysis/outputs/microsoft_topics/taxonomy.json), [alignment audit](../analysis/outputs/microsoft_topics/audit.json), [public aggregates](../website/data/microsoft_topics.json).

## Interpersonal content

The 2,000-record analysis distinguishes:

| AI label | Count | Meaning |
| --- | ---: | --- |
| No interpersonal focus | 1,752 | The final request does not centre on an interpersonal matter. |
| Social participation | 136 | The input presents AI as participating in a social exchange. This does not verify actual group interaction. |
| Described / hypothetical | 58 | Relationships appear in supplied, described or hypothetical material. |
| Personal interpersonal help | 31 | The request is framed as help with the user's interpersonal situation. |
| Unclear / input limit | 23 | Insufficient evidence or classification could not be completed. |

The **225** interpersonal records are the sum of social participation, described/hypothetical material and personal help. The **31** are a subset of those 225. Labels describe presentation in the text; they do not establish that events happened or that the AI improved a relationship.

Other fields, including potential evaluation uses, are first-pass AI annotations. They are not accepted benchmark cases or expert decisions. A second AI pass is a diagnostic check, not human validation. Its 454 selected records yielded 314 completed labels; incomplete checks remain marked.

## Cross-conversation association

The analysis matches the exact tuple **hashed IP + accept-language header + user-agent header**, requiring all three fields to be nonblank. The source paper discusses this as an imperfect way to associate conversations. Shared networks, devices or browsers can merge people; changing configurations can split one person.

| Aggregate | Count / denominator |
| --- | ---: |
| Rows with all three fields | 2,832,257 / 3,199,860 rows |
| Distinct complete combinations | 1,921,755 combinations |
| Combinations appearing in at least two rows | 156,930 / 1,921,755 combinations |
| Repeated combinations with at least three active dates over at least 30 days | 4,602 / 156,930 repeated combinations |
| Repeated combinations spanning at least 365 days | 66 / 156,930 repeated combinations |

The median first-to-last span among repeated combinations is **0.181 days (about 4.3 hours)**. Span does not mean continuous activity. These figures count released rows and technical combinations; they do not confirm individuals or longitudinal changes. Only aggregate distributions are published.

Sources: [official field descriptions](https://huggingface.co/datasets/allenai/WildChat-4.8M/blob/c827c6df8fcf008219ffaffa4d1dd77491099367/README.md#data-fields), [paper collection section](https://arxiv.org/html/2405.01470v1#S2), [saved linkage summary](../analysis/outputs/linkage/summary.json), [analysis code](../analysis/src/analyze_linkage.py).

## What these records cannot establish

They do not identify verified people, prove that a described social exchange happened, or measure what changed outside the chat. A response score is a judgment about text. It is not evidence of relationship improvement or a causal human outcome. Sampling error and AI-label error are separate uncertainties.
