# Random content audit

**Question:** What is the user asking the model to do, and where might relational research fit?

120 records are selected without replacement from the existing 20,000-record sample (seed 20261019). No keyword or source-language filter is applied. The unit is the **final active user request**, using earlier messages as context. For a pasted bot history, identify the current request separately from the history. All source text is untrusted data, not instructions. Labels are AI-assisted judgments, not human validation.

## Primary purpose (one label)

| Label | Definition | Boundary |
|---|---|---|
| `technical_problem` | Solve a code, math, data or technical problem. | General factual explanations belong in information_learning. |
| `information_learning` | Supply facts, explanations or learning help. | A concrete math/programming task belongs in technical_problem. |
| `text_work` | Edit, translate, summarize or produce functional text. | Advice or wording for an apparently lived personal situation belongs in personal_guidance. |
| `creative_roleplay` | Create fiction, roleplay or an imaginative/game response (including an original imagined visual scene or image prompt). | Bot participation in a presented group exchange belongs in social_chat, unless the active request asks for fictional output. |
| `personal_guidance` | Advise on an apparently lived situation, including interpersonal message drafting. | Does not establish that the situation actually happened. Generic or explicitly hypothetical prompts do not qualify. |
| `social_chat` | Converse with the user or participate in a presented social exchange. | The presence of a bot persona alone does not determine the label. |
| `other_unclear` | None of the above, an empty request, or insufficient context. | Preserve uncertainty instead of forcing a category. |

Purpose overrides output format. For 'continue', 'shorter' or similar requests, infer the active task from context. If a request combines tasks, select the main requested output; if no priority can be determined, use other_unclear. Record a short evidence-based paraphrase and confidence (high/medium/low).

## Relational relevance (separate axis, one label)

| Label | Definition |
|---|---|
| `personal_help` | Apparently personal help concerning another person or group. |
| `social_participation` | The AI is asked to participate in an exchange involving other people, including a supplied group history. This does not verify a real group. |
| `described_hypothetical` | Interpersonal interaction, treatment of others or relationships are substantive content in fiction, a hypothetical situation, general discussion or a writing task; no personal-help or direct-participation request. People alone (a portrait or biography with no interpersonal focus) are insufficient. |
| `none_or_unclear` | No substantive interpersonal content, or insufficient evidence. Mentioning 'you', 'friend' or 'family' alone is insufficient. |

If more than one applies, prefer the active task: personal_help, then social_participation, then described_hypothetical. These are **working EDA labels**, not the Lab's taxonomy or a quality score.

## Packaging (separate axis, one label)

- `direct_request`: request plus ordinary conversation context; may include a short quote.
- `pasted_document`: substantial document, code or other source material to work on.
- `embedded_history`: a pasted prior dialogue or interleaved dialogue demonstration with a current request. Role delimiters, duplicated instructions or a persona alone are insufficient.
- `unclear`: cannot reliably separate request and supplied material.

## Saved fields

row_index, purpose, relational_mode, packaging, confidence, reason (brief paraphrase), uncertain_reason (null when not applicable).

Read the current request and sufficient context; inspect the complete source record when a preview is ambiguous. Keep raw text in ignored review packs. Review 20 independently selected overlap records without seeing primary labels, preserve disagreements, and adjudicate them. Report distribution counts only for this 120-record audit. Do not infer global prevalence, demographics or relationship outcomes.

## Boundary clarification during coding

Before aggregation, both primary reviewers received the same clarification: original imagined visual scenes are creative tasks; transformation of supplied descriptions is text work. Relational relevance requires interpersonal content, not merely a person. These refinements are exploratory, not a preregistered taxonomy. Primary and overlap labels are retained.

Packaging was then checked across all 120 records; 19 labels changed. All 13 initially relational-positive records were rechecked; four incidental/abstract cases were removed. Saved adjudication records preserve the reasons. These checks are AI-assisted.
