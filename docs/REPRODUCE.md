# Reproduce the release

There are three levels: view the saved data, rebuild figures from aggregates, or download source data to recompute statistics. Only the third requires source retrieval. AI annotation is an additional, optional model run.

## 1. View the website and check saved results

```sh
python3 -m http.server 8765 --directory website
```

Open `http://localhost:8765/`. The site runs entirely from static files; it has no backend, login or model calls.

To run the release checks and statistical unit tests:

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-lock.txt
make check
make test
```

Use Python 3.9+ and Node.js 22+. `requirements-lock.txt` records the environment used for this release; `requirements.txt` lists direct dependencies. A unit test for the original raw-sample checksum skips when that intentionally excluded local cache is absent.

`make check` verifies source revisions, category totals, sample sizes, figure files, the PDF checksum, source-text handling and filter behaviour. It does not call an annotation API or download the corpus.

## 2. Rebuild the current charts and PDF

```sh
make figures
make check
```

The builder reads saved aggregates in `website/data/` and `analysis/outputs/linkage/summary.json`. It writes twelve PNG/SVG figures, the figure index, the safe linkage aggregate and the ten-page PDF. It updates the PDF checksum in the site's source metadata. Historical charts stay in the appendix with their original denominators.

Rebuilding can change binary files because of library versions and PDF metadata; numerical counts should remain unchanged. Refresh `release-manifest.json` with `python3 scripts/check_release.py --write-manifest` after inspecting changed outputs.

## 3. Recompute from fixed public sources

Run the original-sample prerequisite first, then the census, then topics:

```sh
pip install datasets
make sample
make census
make topics
```

The census comparison needs the original raw-sample cache as well as its saved feature CSV. Topic alignment needs all 86 census feature files and checkpoints. The Makefile stops before downloading if those prerequisites are missing. Linkage can run separately from the saved immutable shard manifest.

These commands download source files into ignored local directories. They do not run as part of the release check. Download sizes are substantial; extraction is resumable. Avoid committing the resulting raw caches or per-record linkage outputs.

| Analysis | Command | Outputs |
| --- | --- | --- |
| Original 20,000-row block sample (prerequisite for the comparison) | `make sample` | Ignored `analysis/data/raw/sample.jsonl`; requires the optional `datasets` package. |
| Full metadata census + row-random comparison | `make census` | `analysis/outputs/sampling_validation/` |
| Microsoft released topic/task labels (no new inference) | `make topics` | `analysis/outputs/microsoft_topics/` |
| Aggregate metadata association across records | `make linkage` | `analysis/outputs/linkage/summary.json`; per-record derived keys stay local. |
| Original sample statistics | `python3 analysis/src/analyze.py` followed by `python3 analysis/src/distributions.py` | Sample counts, descriptive figures and local review packs. |

The immutable [86-shard manifest](../analysis/outputs/validation_discovery/original_shards.json) supplies fixed URLs, sizes and SHA-256 digests. The census script checks each shard before extraction. It projects text-free features, then removes each completed raw shard.

The historical sample's original retrieval mode was not recorded. Source parity was checked later against the immutable files. The pinned-stream command reproduces selection from the fixed source; it does not reconstruct a missing historical retrieval log.

The public website uses saved exports. Recomputing analysis outputs does **not** automatically replace every website JSON file. Compare revisions, counts and scopes before exporting a new release. The current release manifest records the saved state.

## Optional AI content annotation

The [sampling code](../analysis/src/sample_relational.py), [label runner](../analysis/src/label_relational.py), [system prompt](../analysis/config/relational_v2/system_prompt.txt) and [schema](../analysis/config/relational_v2/schema.json) document the 2,000-record analysis. Historical model IDs/settings are recorded in the [annotation manifest](../analysis/outputs/relational_v2/annotation_manifest.json).

Retrieval requires the fixed source files. Running the label runner requires your own `OPENAI_API_KEY` environment variable and incurs provider usage. The runner uses full stored role/content messages, does not truncate over-limit records, and keeps incomplete outputs marked. A new run can produce different labels; it is not required to use this repository.

The released final label exports are under `website/data/relational_v2.json`. The old aggregation scripts also reference local annotation/audit files that are not all redistributed. They are retained as processing provenance, not a claim that every historical AI annotation step can be replayed from this checkout alone. Raw provider responses, quota logs and private working notes are not part of this release.

## File boundaries

- `analysis/outputs/` contains text-free features, counts and source/sample manifests.
- `website/data/` includes the published label exports and selected source excerpts used by the browser. These excerpts do not constitute a bulk chat release.
- The repository does not contain IP hashes, browser header values or person-level linkage keys.
- Other datasets are described and linked, not redistributed. Their access terms differ.
