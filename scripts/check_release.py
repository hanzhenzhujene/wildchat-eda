#!/usr/bin/env python3
"""Check saved release integrity without fetching data or calling models."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
REV = 'c827c6df8fcf008219ffaffa4d1dd77491099367'
N = 3_199_860
IGNORED_PARTS = {'.git', '.venv', '__pycache__', 'tmp', '.cache'}
MANIFEST = ROOT / 'release-manifest.json'


def read(path):
    return json.loads((ROOT / path).read_text())


def release_files():
    result = []
    for p in ROOT.rglob('*'):
        rel = p.relative_to(ROOT)
        if not p.is_file() or p == MANIFEST:
            continue
        if any(x in IGNORED_PARTS for x in rel.parts) or p.name == '.DS_Store':
            continue
        result.append(p)
    return sorted(result)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write-manifest', action='store_true')
    args = parser.parse_args()
    paths = release_files()
    forbidden_suffixes = {'.parquet', '.duckdb', '.jsonl', '.key', '.pem'}
    credentials = re.compile(r'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{16}|sk-(?:proj-)?[A-Za-z0-9_-]{35,})\b')
    sensitive_keys = {'hashed_ip', 'accept-language', 'user-agent', 'turn_identifier', 'ip_key', 'header_key', 'openai_id'}

    def check_json_keys(value, rel):
        if isinstance(value, dict):
            for k, v in value.items():
                assert k not in sensitive_keys, f'Identifier field in public data: {rel}: {k}'
                check_json_keys(v, rel)
        elif isinstance(value, list):
            for item in value:
                check_json_keys(item, rel)

    for p in paths:
        rel = p.relative_to(ROOT)
        assert not p.is_symlink(), f'Unexpected symlink: {rel}'
        assert p.stat().st_size < 50_000_000, f'Large file needs separate handling: {rel}'
        assert p.suffix not in forbidden_suffixes, f'Unexpected raw/cache file: {rel}'
        assert not p.name.startswith('.env'), f'Environment file: {rel}'
        assert not {'raw', 'derived', 'reviews'}.intersection(rel.parts), f'Local working data: {rel}'
        if p.suffix in {'.md', '.py', '.js', '.mjs', '.json', '.txt', '.yml', '.html', '.css', '.cff'}:
            text = p.read_text()
            assert not credentials.search(text), f'Credential-like string: {rel}'
            if p != Path(__file__).resolve():
                assert '/Users/' not in text, f'Local home path: {rel}'
            if p.suffix == '.json':
                data = json.loads(text)
                if rel.parts[0] in {'website', 'analysis'} and ('data' in rel.parts or 'outputs' in rel.parts):
                    check_json_keys(data, rel)
        if p.suffix == '.md':
            for target in re.findall(r'!?\[[^\]]*\]\(([^\s)]+)(?:\s+[^)]*)?\)', p.read_text()):
                if re.match(r'^[a-z]+:', target) or target.startswith('#'):
                    continue
                local = unquote(target.split('#', 1)[0])
                assert (p.parent / local).exists(), f'Broken Markdown link in {rel}: {target}'

    census = read('website/data/validation.json')
    assert census['source']['revision'] == REV and census['scopes']['census']['n'] == N
    assert read('analysis/config/source.json')['revision'] == REV
    source_files = read('analysis/outputs/validation_discovery/original_shards.json')['files']
    assert len(source_files) == 86
    assert all(REV in x['url'] and re.fullmatch(r'[a-f0-9]{64}', x['sha256']) for x in source_files)
    labels = read('website/data/relational_v2.json')
    assert len(labels['rows']) == labels['metadata']['n'] == 2000
    saved_summary = read('analysis/outputs/relational_v2/summary.json')
    for key in ['purpose_counts', 'relational_mode_counts', 'packaging_counts']:
        assert saved_summary[key] == labels['summary'][key]
        assert sum(saved_summary[key].values()) == 2000
    assert saved_summary['relational_mode_counts']['personal_help'] == 31
    assert labels['summary']['human_validated_n'] == 0
    assert 'calibration_question' in (ROOT / 'website/data/relational_v2/personal31_assessment.json').read_text()
    link = read('analysis/outputs/linkage/summary.json')
    public_link = read('website/data/public-hub/linkage.json')
    assert link['totals'] == public_link['totals']
    assert link['totals']['rows'] == N and not public_link['linkage_keys_published']
    assert len(read('website/data/public-hub/figures.json')) == 24

    # Parse source without importing modules that have extraction side effects.
    for p in [*list((ROOT / 'analysis/src').glob('*.py')), *list((ROOT / 'scripts').glob('*.py'))]:
        compile(p.read_text(), str(p.relative_to(ROOT)), 'exec')

    current = {p.relative_to(ROOT).as_posix(): {'bytes': p.stat().st_size, 'sha256': digest(p)} for p in paths}
    if args.write_manifest:
        MANIFEST.write_text(json.dumps({'release': '2026.10.23', 'source_revision': REV,
            'files': current}, indent=2) + '\n')
    else:
        saved = read('release-manifest.json')
        assert saved['source_revision'] == REV
        assert saved['files'] == current, 'Files differ from release-manifest.json; inspect changes before refreshing it.'
    print(json.dumps({'status': 'passed', 'files': len(current), 'records': N, 'figures': 24,
        'content_sample': 2000, 'human_validated_labels': 0, 'manifest_written': args.write_manifest}, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (AssertionError, ValueError) as exc:
        print(f'Release check failed: {exc}', file=sys.stderr)
        sys.exit(1)
