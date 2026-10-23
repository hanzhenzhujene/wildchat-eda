# Microsoft topic and task label audit

Pinned repository: `microsoft/adopt-adapt-wildchat@b4e77e44b62ba2ddd0f7b53667b218e345faba09`.
Source: `allenai/WildChat-4.8M@c827c6df8fcf008219ffaffa4d1dd77491099367`; 3,199,860 released conversation records.

No classifier was run. Existing public domain and intent label files were downloaded and their Git LFS SHA-256 checksums verified.
Downloaded 172 files, 1,855,397,589 bytes. Domain/intent keys align row-for-row.
All 86 shards align with the earlier immutable-source census on hash, model, language, turn, date and row order.

Counts include every released row. No paper-specific IP, date, language or template filters and no deduplication were applied.
Valid domain labels: 3,196,157; missing/invalid: 3,703.
Valid intent labels: 3,195,661; missing/invalid: 4,199.
Every percentage uses all 3,199,860 records as denominator, including the unclassified bucket.

Model: GPT-4o-mini. All stored messages are supplied, with long messages shortened to their first/last 2,500 characters.
One topical-domain label and one task-intent label are assigned per conversation. Labels are automated and not a human gold standard.
The classifier prompts were developed/validated in English. Performance across the multilingual source is not established.

The repository software license is MIT; source conversations use ODC-BY. Saved label metadata and aggregate counts are publicly released by the authors.
Keep the raw label explanations, IP hashes and exact record join keys out of the public site.

See audit.json, manifest.json and partitions.json for reproducible sizes, checksums, schemas, alignment and duplicate-key counts.
