.PHONY: serve check figures test sample census topics linkage
PYTHON ?= python3

serve:
	$(PYTHON) -m http.server 8765 --directory website

check:
	$(PYTHON) scripts/check_release.py
	node scripts/check_public_hub.mjs
	node scripts/check_validation.mjs
	node scripts/check_source_text.mjs
	node scripts/check_relational_ui.mjs
	node scripts/check_personal_review.mjs
	node scripts/check_topics.mjs
	node scripts/check_selection_scope.mjs
	node --check website/hub.js
	node --check website/app.js
	node --check website/fit-flow.js

figures:
	$(PYTHON) scripts/build_public_figures.py

test:
	$(PYTHON) -m unittest discover -s analysis/tests -v

# These explicitly download source files; they are not part of make check.
sample:
	$(PYTHON) analysis/src/fetch_sample.py --pinned-stream

census:
	@$(PYTHON) -c "from pathlib import Path; assert Path('analysis/data/raw/sample.jsonl').exists(), 'First install datasets and run make sample (see docs/REPRODUCE.md).'"
	$(PYTHON) analysis/src/validate_sampling.py --workers 4
	$(PYTHON) analysis/src/summarize_validation.py

topics:
	@$(PYTHON) -c "from pathlib import Path; assert all(Path(f'analysis/data/derived/validation/{i:05d}.parquet').exists() and Path(f'analysis/outputs/sampling_validation/shards/{i:05d}.json').exists() for i in range(86)), 'First run make census; topic alignment requires all 86 local census features/checkpoints.'"
	$(PYTHON) analysis/src/microsoft_topics.py --workers 6

linkage:
	$(PYTHON) analysis/src/analyze_linkage.py --workers 4
