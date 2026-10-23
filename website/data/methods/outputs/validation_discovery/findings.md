# Full-population metric availability: WildChat Atlas validation

Checked 2026-10-20 UTC against `allenai/WildChat-4.8M`, `default/train`, pinned commit `c827c6df8fcf008219ffaffa4d1dd77491099367`.

## Finding

The complete source has **3,199,860 rows in 86 Parquet files** (15,282,293,424 compressed bytes). `/size` and `/parquet` both return `partial=false` and response header `x-revision` equal to the pinned source commit. Current Hub HEAD also equals that commit. The original source files are already Parquet, so an exact population census of selected columns can use immutable original URLs directly.

**Do not use current `/statistics` as the target population benchmark.** It reports `partial=true`, `num_examples=781368` (24.42% of the target row count), and a different response `x-revision`, `d041355e7fd406276cc1e8c303eafccedbef3d93`. Both limitations independently disqualify it. Its language/model frequencies sum to its own denominator; its timestamp bounds end in May 2024. The reason for the revision mismatch has not been established.

## Available versus requiring a census

| Metric | Fastest sound source |
|---|---|
| Full row count and file sizes | Current `/size` and `/parquet`, with saved revision headers. |
| Full language/model counts | Read only `language` and `model` from all original pinned shards; aggregate and check counts sum to 3,199,860, including nulls. |
| Full timestamp min/max | Reduce footer row-group min/max across all shards if every nonempty group has usable stats. |
| Date histogram | Read `timestamp`; footer bounds cannot supply within-group frequencies. |
| Turn histogram, mean, quantiles | Read `turn`; footers supply extrema but not exact full distribution. |
| Stored message counts and role totals | Read `conversation.list.element.role`, then list lengths and role counts. Do not assume `2*turn` without checking. |
| Text lengths/content categories | Requires `conversation.list.element.content`; metadata census cannot validate these. |

## Verified range-read feasibility

Original pinned URL pattern:

`https://huggingface.co/datasets/allenai/WildChat-4.8M/resolve/c827c6df8fcf008219ffaffa4d1dd77491099367/data/train-00000-of-00086.parquet`

The index runs 00000 through 00085. Original source paths are listed in `hub_pinned.json`. HTTP suffix and explicit range requests returned 206 on shard 0 and shard 85. Shard 0 has 37,208 rows in 38 row groups (37 groups of 1,000 rows plus 208); shard 85 has 37,207 rows in 38 groups. These observations do not establish every intermediate shard's layout.

For shard 0, the footer is 697,157 bytes and all seven selected columns (`model`, `timestamp`, `turn`, `language`, `toxic`, `redacted`, nested `role`) total **413,395 compressed bytes**, versus 125,527,585 bytes for the file. Nested `role` alone is 38,523 bytes. Content is 89,037,840 bytes. Reading isolated rows still ordinarily requires decompressing their selected row groups; randomly spread text rows may touch most groups.

The first original file's HEAD redirect attests `X-Repo-Commit=c827c6...` and linked object digest `6df660dca78dd92b865bef09b928992ceb6c913b4f06082315876a5997ad2eaa`. The converted first file has the same linked digest and size, but belongs to conversion commit `b8eaa0b5976e076a20bf217a57c6c2005d4c0f5e`. This is first-shard identity evidence only. Direct original pinned URLs avoid dependence on the moving conversion branch.

For the census, use projected columns with bounded concurrency and HTTP range reads, preserve immutable file paths, accumulate all row counts and null counts, and retain only necessary metadata/aggregates. Footer-derived offsets permit exact column range reads; normal readahead can fetch much more than the selected compressed bytes. Verify request behavior on one shard before all 86.

## Evidence saved

- Raw API JSON: `hf_statistics`, `hf_size`, `hf_parquet`, `hf_splits`, `hub_current`, `hub_pinned`, `hub_convert`, each with `.meta.json` URL/time/status/header/checksum companion.
- `pinned_parquet_0000_metadata.json`: full leaf schema paths and compressed sizes, selected-column stats/offsets, row-group sizes.
- `pinned_parquet_0085_metadata.json`: last-shard selected metadata.
- `range_probe_log.json` and `first_shard_identity_headers.json`: bounded range and object identity evidence. Signed redirect URLs were not retained.
- `availability_summary.json`: machine-readable conclusion.

No full scan or row-text inspection was performed. Footer summaries exclude all content-column min/max values.

Official documentation: [statistics scope and partial flag](https://huggingface.co/docs/dataset-viewer/statistics), [Parquet projection and conversion branch](https://huggingface.co/docs/dataset-viewer/parquet), [remote SQL aggregation](https://huggingface.co/docs/dataset-viewer/duckdb).
