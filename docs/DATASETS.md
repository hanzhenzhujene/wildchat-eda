# Conversation datasets

Checked **23 October 2026** against the primary papers and dataset cards. This is a source comparison, not a reanalysis of every dataset.

WildChat and LMSYS record use of a chat service. PRISM connects study conversations to participant profiles and ratings. OpenAssistant contains volunteer-written dialogue; UltraChat contains model-generated dialogue. These collection methods support different claims.

## Compare the collections

Counts refer to the specified export. A **message** is one speaker's contribution; a **conversation tree** may branch into alternative responses. Neither is interchangeable with a linear conversation record.

| Dataset | Collection | Scale and unit | Structure and participant linkage | Access and limits |
| --- | --- | --- | --- | --- |
| **WildChat-4.8M, filtered release** · [paper](https://arxiv.org/abs/2405.01470) · [pinned card](https://huggingface.co/datasets/allenai/WildChat-4.8M/blob/c827c6df8fcf008219ffaffa4d1dd77491099367/README.md) | Consenting users received free ChatGPT access through a public service. | **3,199,860 conversation records**, April 2023–July 2025. | User/AI messages; depth varies. Hashed IP + browser headers permit tentative cross-conversation association, not verified identity. | Open download; **ODC-BY 1.0**. Conversations flagged as toxic were filtered out. Service traffic is not representative of all AI use. |
| **LMSYS-Chat-1M** · [paper](https://arxiv.org/abs/2309.11998) · [pinned card](https://huggingface.co/datasets/lmsys/lmsys-chat-1m/blob/200748d9d3cddcc9d782887541057aca0b18c5da/README.md) | Vicuna demo / Chatbot Arena traffic, with terms-of-use consent. | **1,000,000 conversations**, 25 models, April–August 2023. | Single- and multi-turn records. The documented public schema has no participant ID or IP field; collection-time IP counts do not establish public user linkage. | Gated; **custom agreement** prohibits redistribution and embedding dataset content. Unsafe conversations remain; benchmark contamination was not removed. |
| **OpenAssistant OASST1, ready export** · [paper](https://arxiv.org/abs/2304.07327) · [pinned card](https://huggingface.co/datasets/OpenAssistant/oasst1/blob/fdf72ae0827c1cda404aff25b6603abec9e3399b/README.md) | Volunteers wrote both conversation roles, then ranked and labelled messages. | **88,838 messages in 10,364 trees**, collected through 12 April 2023. | Branching dialogue. Contributor IDs identify authorship; successive turns need not represent one end user's conversation. | Open download; **Apache 2.0**. Constructed for dataset development. The separate all-tree export has 161,443 messages. |
| **PRISM** · [paper](https://arxiv.org/abs/2404.16019) · [pinned card](https://huggingface.co/datasets/HannahRoseKirk/prism-alignment/blob/18ab5cfb37456f4ec8cbc00212ce54cf7b1239f6/README.md) | Participants chose prompts within study tasks and rated live model responses. | **8,011 conversation trees; 1,396 chat participants** (2024 release). | Explicit `user_id` links multiple study conversations to a survey. Includes alternative responses and ratings; not months of everyday use. | Open download. Human text: **CC-BY 4.0**. Model responses: **CC-BY-NC 4.0**, subject to provider terms. |
| **UltraChat 200k, SFT splits** · [paper](https://arxiv.org/abs/2305.14233) · [pinned card](https://huggingface.co/datasets/HuggingFaceH4/ultrachat_200k/blob/8049631c405ae6576f93f445c6b8166f76f5505a/README.md) | Two ChatGPT agents generated user/assistant dialogue; H4 filtered the collection. | **207,865 train + 23,110 test dialogues**. | Multi-turn, both sides generated. No real-user identity or human history. | Open download; **MIT** according to the card. Useful for training experiments, not for estimating real-user behaviour. Counts exclude the separate generation-ranking splits. |

## Release boundaries

- This repository uses WildChat revision `c827c6df8fcf008219ffaffa4d1dd77491099367` (11 August 2025). The **4.8M name describes the larger collection**, not the 3,199,860-record filtered export.
- The [2024 WildChat paper](https://arxiv.org/html/2405.01470v1) describes an earlier snapshot. Its Table 1 and collection section report 1,039,785 conversations; its later basic-statistics paragraph gives a conflicting count. Those figures are not this repository's denominator.
- PRISM's 1,500 survey respondents differ from the 1,396 who entered the conversation stage. Its 68,371 rated prompt–response–score triples are not 68,371 conversations.
- A recurring identifier, multiple sessions and elapsed time are distinct properties. None alone establishes a validated longitudinal account of a person's behaviour.

## Related interaction studies

These studies collected conversations, but their public materials do not include an equivalent open transcript corpus:

| Study | What it collected | What is public |
| --- | --- | --- |
| [Three-week sycophancy experiment](https://arxiv.org/abs/2605.07912v3) | Study 4 randomized 1,364 participants; 12 sessions over three weeks. AI history reset between sessions. | [Questionnaire/session tables and analysis code](https://github.com/lujainibrahim/syco-long-study); no raw transcripts in the inspected public files. |
| [Four-week chatbot experiment](https://arxiv.org/abs/2503.17473v2) | 981 participants; over 300,000 messages; assigned text/voice modes and conversation prompts. | Paper, appendix and [classifier definitions](https://github.com/mitmedialab/chatbot-psychosocial-study); no raw transcripts in the linked repository. |
| [Character.AI chat-donation study](https://arxiv.org/abs/2506.12605v5) | One-time survey of 1,131 users; 237 donated 4,664 historical chat sessions (464,687 messages). | [Quantitative participant data, analysis code and donation tool](https://github.com/SALT-NLP/AI-companionship-well-being). The repository states that consent agreements prohibit sharing raw histories. Historical donations are not prospective follow-up. |

Links describe available resources; they do not grant permission to redistribute their records. Check each source's current terms before reuse.
