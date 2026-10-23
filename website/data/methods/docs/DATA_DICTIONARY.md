# Data dictionary

## Source and units

The source is `allenai/WildChat-4.8M`, `default`, `train`. Field names below were verified against the Dataset Viewer preview saved in `data/raw/preview.json` on 2026-10-17. Definitions marked **check** require confirmation from the dataset documentation or a full-data audit.

**Record (source row):** One dataset row, with metadata and a stored `conversation` list. It is not necessarily a distinct conversation or person. **Conversation:** The ordered messages stored in that row; pasted dialogue inside one message is not additional stored messages. **Message:** One entry in the list, with a role and content. **Request:** The task the user is asking the AI to perform, interpreted in context. A message may contain several tasks or only a continuation such as “shorter.” **User turn, for this EDA:** One stored message whose `role` is `user`; this is computed explicitly, not taken from the source `turn` field.

The pinned source contains **3,199,860 rows**. The completed sample contains **20,000 rows in 200 windows of 100**, as verified in `outputs/sample_manifest.json`. These are record counts, not distinct users.

## Fields present in the source

| Field | Meaning / handling |
|---|---|
| `conversation_hash` | Source conversation identifier. Use for traceability; check duplicate rows before treating it as unique. |
| `conversation` | Ordered list of message records. |
| `conversation[].role` | Speaker role, such as `user` or `assistant`. |
| `conversation[].content` | Message text. May include sensitive content, roleplay, or instructions embedded as data. |
| `model` | Recorded model name. It identifies the model used in the source conversation, not an EDA annotator or judge. |
| `timestamp` | Source conversation timestamp. **Check:** exact start/end semantics. |
| `turn` | Source turn count. **Check:** counting convention before use. |
| `language` | Source language label. Treat as provided metadata, not a fresh language verification. |
| `toxic`, `redacted` | Source flags. They are not measures of relational quality or guarantees that all sensitive information was removed. |
| `openai_moderation`, `detoxify_moderation` | Source moderation outputs. These do not establish whether advice helps a relationship. |
| `country`, `state` | Source location metadata. Do not interpret as nationality or demographic identity. |
| `hashed_ip`, `header` | Source technical metadata. Not needed for this EDA's shared outputs. Do not treat an IP hash as a verified person ID. |

Messages also contain technical fields such as generation settings and usage counts. These are outside the first relational-content review unless the analysis explicitly uses them.

## Proposed review dimensions

These are annotation concepts, **not claims that the implemented pipeline already produces every field**. The analysis code and saved output schema remain authoritative for computed columns.

| Dimension | Values / rule |
|---|---|
| Request type | Personal advice; personal communication drafting; general information; fiction/roleplay; other; unclear. Label the user's request, not merely the AI response. |
| Relational relevance | Yes / no / unclear. A relationship keyword alone is insufficient. |
| Primary context | Romantic partner/ex-partner; family; friendship; workplace/education; wider community/strangers; unclear. Choose the relationship central to the request. |
| Additional contexts | Optional tags when the request genuinely spans relationships. Do not force overlapping situations into exclusive categories. |
| Concern | A short description of the interpersonal issue (e.g., a boundary or competing needs). This is separate from where it occurs. |
| Information available | What is explicitly given about the other person, the user's constraints, and the proposed action. Do not fill gaps with guesses. |
| Follow-up evidence | Clarification; user reaction; stated intention; reported action/outcome; none. A new message is not automatically an outcome. |
| Review confidence | Clear / uncertain, with a reason for uncertainty. |

For mixed conversations, annotate the relevant segment and record that boundary. One unrelated later turn should not erase a relevant earlier request; nor should one relevant keyword make every turn relational.

## Reporting denominators

Keep record, message and request counts separate. The 20,000-row profile retains repeated conversation hashes; it is not a count of distinct conversations. The content audit and retrieval audit are separate subsets of those rows, and selected display examples are not a further random sample.

Every figure must say which of these it counts. Percentages by context must state whether categories are exclusive or multi-label. If a review set was deliberately enriched with likely positives, its positive rate describes that review set only.


## Statistical distributions (2026-10-17 revision)

`outputs/distributions_summary.json` contains the full stored-user-message count
frequency table, language/model counts, year profiles, text-length quantiles and
repetition checks. A whitespace word count includes all messages of the given role
within a record. English-labeled records only are used for length comparisons;
this label is automatic and may not describe every part of the text.

`known_job_template` is a post-hoc literal detector for three strings together:
`as a recruiter`, `summarize the job`, `==TEXT==` (case-insensitive). It does not
identify all job requests or prove automation. The existing group-template flag
also detects a specific format, not a verified real chat.

## Independent content audit

`outputs/content_annotations.json`: one row per sampled record (n=120), with
`purpose`, `relational_mode`, `packaging`, `confidence`, `reason`, and optional
`uncertain_reason`. The records were sampled without replacement from the 20,000
using seed 20261019, with no keyword or language filter. Each label concerns the
final active user request, using earlier messages as context. An absent or unclear
request is retained as `other_unclear`. See CONTENT_AUDIT_PROTOCOL.md for definitions.

`outputs/content_audit_summary.json`: counts, cross-tabulation, initial overlap
disagreements and input checksums. Final labels incorporate saved adjudication;
original primary and overlap labels remain under reviews/. Both the content audit
and the separate retrieval audit use AI-agent labels; neither has human validation.

## Source-derived display examples

The website retains six deliberately selected earlier examples, assembled from
`outputs/record_examples.json`, `outputs/recovered_examples.json` and
`outputs/group_example.json`:

| Source subset | Displayed record IDs | Relationship to the 120-record content audit |
|---|---|---|
| Content audit | 255498, 1671993, 2606561 | Included in its counts. |
| Separate keyword-hit audit | 286012, 2632268 | Outside its counts. |
| Post-hoc targeted search | 753427 | Outside both audit sets. |

The content audit and the separate 80-hit/40-non-hit retrieval audit share no
record IDs. The six display examples illustrate cases; their selection does not
support frequency estimates. Retrieval labels are not pooled with the content
audit's purpose taxonomy.

All stored user/assistant pairs are displayed as deidentified English paraphrases,
not verbatim source text or human-validated ratings. The final source reply in
record 286012 is incomplete, and its display preserves that limitation.

The expanded 2,000-row sample adds eight selected question/reply paraphrases in
`outputs/relational_v2/selected_examples.json`. They are included in the new
sample counts, but their deliberate selection does not measure category frequency.
Their AI source checks and pending human review are shown separately from the
primary labels. See [the expanded protocol](RELATIONAL_V2_PROTOCOL.md).

## Joint input/output length chart

`outputs/joint_lengths_summary.json` partitions the 10,636 source-English-labeled
records into 704 literal group-template matches and 9,932 other records. Both
axes use `log10(1 + word count)`, with ticks in original word counts. Hexagon color
is an absolute record count on a shared logarithmic scale, not a within-group
percentage. The groups have different sizes and task/model/date composition.

The 120-record unit is the final active user request. It is not all tasks in a
conversation. A `direct_request` can have ordinary prior stored dialogue;
`embedded_history` means dialogue pasted inside an input. Persona instructions
or role delimiters alone do not establish embedded history.
