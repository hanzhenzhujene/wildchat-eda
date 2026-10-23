"""Export allowlisted source messages with explicit, reviewable privacy redactions.

The raw output stays outside the repository/site. No raw text or identifier value
is printed. Public output preserves every character outside documented spans.
Input text is never generated, translated, repaired, or completed by this script.
"""
import argparse
import collections
import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
REV = "c827c6df8fcf008219ffaffa4d1dd77491099367"
DATASET = "allenai/WildChat-4.8M"
LICENSE_URL = "https://opendatacommons.org/licenses/by/1-0/"
SOURCE_URL = f"https://huggingface.co/datasets/{DATASET}/tree/{REV}"


def read(path):
    return json.loads(path.read_text())


def sha_file(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def text_sha(messages):
    value = json.dumps(messages, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def extract(root, site):
    primary = read(site / "data/examples.json")
    selected = read(root / "outputs/relational_v2/selected_examples.json")["examples"]
    personal = read(root / "outputs/relational_v2/personal31_assessment.json")["rows"]
    groups = {
        "primary_six": {row["id"] for row in primary},
        "relational_selected_eight": {row["row_index"] for row in selected},
        "personal31": {row["row_index"] for row in personal},
    }
    identity = read(root / "data/raw/cache_identity.json")
    assert identity["dataset"] == DATASET and identity["revision"] == REV
    manifest = read(root / "outputs/sample_manifest.json")
    sample = root / "data/raw/sample.jsonl"
    sample_hash = sha_file(sample)
    assert sample_hash == manifest["sample_sha256"]
    retained = {}
    with sample.open() as stream:
        for line in stream:
            row = json.loads(line)
            if row["row_index"] in groups["primary_six"]:
                retained[row["row_index"]] = (row, sample, sample_hash)
    for index in groups["relational_selected_eight"] | groups["personal31"]:
        path = root / f"data/raw/relational_v2/rows/{index}.json"
        row = read(path)
        assert row["row_index"] == index and row["revision"] == REV
        assert text_sha(row["conversation"]) == row["text_sha256"]
        retained[index] = (row, path, sha_file(path))
    assert set(retained) == set.union(*groups.values())
    for example in selected + personal:
        row, _, digest = retained[example["row_index"]]
        assert digest == example["source_file_sha256"]
        assert row["text_sha256"] == example["source_text_sha256"]
    examples = []
    for index, (row, path, digest) in sorted(retained.items()):
        assert not row.get("truncated_cells", [])
        messages = [{"role": m["role"], "content": m["content"]}
                    for m in row["conversation"]]
        assert all(isinstance(m["content"], str) for m in messages)
        item = {
            "row_index": index,
            "collections": [name for name, ids in groups.items() if index in ids],
            "revision": REV,
            "source_path": str(path.resolve()),
            "source_file_sha256": digest,
            "source_text_sha256": text_sha(messages),
            "source_language": row["language"], "model": row["model"],
            "truncated_cells": row.get("truncated_cells", []),
            "source_redacted": row["redacted"], "messages": messages,
        }
        for key in ["source_shard", "source_shard_sha256"]:
            if key in row:
                item[key] = row[key]
        if index == 286012:
            item["source_completeness_note"] = (
                "Final assistant message ends mid-sentence in the pinned release; preserved exactly.")
        for example in selected:
            if example["row_index"] == index:
                item["selected_example_indices"] = {key: example[key] for key in [
                    "source_message_index", "source_reply_message_index", "source_context_message_indices"]}
        for example in personal:
            if example["row_index"] == index:
                item["personal31_indices"] = {key: example[key] for key in [
                    "source_user_message_index", "source_reply_message_index", "context_message_indices"]}
        examples.append(item)
    return {
        "dataset": DATASET, "revision": REV, "private_working_file": True,
        "original_text_status": "Exact retained source role/content fields in original message order; no translation, cleanup, paraphrase, or new redaction performed. Source redactions remain unchanged.",
        "examples": examples,
    }


def redact(example):
    """Rules reviewed for this fixed allowlist; originals never enter the audit."""
    index = example["row_index"]
    values = {}
    group_rows = {2606561, 2632268, 2691198}
    if index in group_rows:
        for message in example["messages"]:
            for match in re.finditer(
                    r'"(ownerid|groupid|userid|senderuserid)"\s*:\s*"?(\d{8,19})',
                    message["content"], re.I):
                kind = "platform_group_id" if match[1].lower() == "groupid" else "platform_user_id"
                values[match[2]] = kind
    if index == 133179:
        for message in example["messages"]:
            for match in re.finditer(r"(?<!\d)\d{14,15}(?!\d)", message["content"]):
                values[match[0]] = "parcel_identifier"
            for match in re.finditer(
                    r"(?:r[ée]clamation|num[ée]ro|n[°º])[^\d\n]{0,35}(\d{8})(?!\d)",
                    message["content"], re.I):
                values[match[1]] = "complaint_identifier"
    replacement_by_value = {}
    counters = collections.Counter()
    for value, kind in values.items():
        counters[kind] += 1
        label = kind.replace("_", " ")
        replacement_by_value[value] = (kind, f"[{label} {counters[kind]} redacted]")
    messages, audit = [], []
    for mi, message in enumerate(example["messages"]):
        text = message["content"]
        spans = []
        if index in group_rows:
            for match in re.finditer(r'https?://[^\s<>"\]\\]+', text):
                if re.search(r"\d{8,}", match[0]) and re.search(r"\.jpe?g(?:[?/#]|$)", match[0], re.I):
                    spans.append((match.start(), match.end(), "attachment_url", "[attachment URL redacted]"))
        if index == 2772529:
            for match in re.finditer(r"@62\d{9,13}(?!\d)", text):
                spans.append((match.start(), match.end(), "phone_number", "[phone number redacted]"))
        for value, (kind, replacement) in replacement_by_value.items():
            for match in re.finditer(r"(?<!\d)" + re.escape(value) + r"(?!\d)", text):
                if not any(start <= match.start() < end for start, end, _, _ in spans):
                    spans.append((match.start(), match.end(), kind, replacement))
        spans.sort()
        assert all(spans[i][1] <= spans[i + 1][0] for i in range(len(spans) - 1))
        parts, cursor = [], 0
        for start, end, kind, replacement in spans:
            parts.extend([text[cursor:start], replacement])
            audit.append({"message_index": mi, "start": start, "end": end,
                          "category": kind, "replacement": replacement})
            cursor = end
        parts.append(text[cursor:])
        output = "".join(parts)
        if not spans:
            assert output == text
        messages.append({"role": message["role"], "content": output})
    return messages, audit


def public_payload(raw):
    output, audits = [], []
    for original in raw["examples"]:
        messages, spans = redact(original)
        item = {key: value for key, value in original.items() if key not in {"source_path", "messages"}}
        item["messages"] = messages
        item["additional_redactions"] = dict(collections.Counter(span["category"] for span in spans))
        item["display_text_sha256"] = text_sha(messages)
        counts = collections.Counter((span["message_index"], span["category"]) for span in spans)
        item["redactions"] = [{"message_index": mi, "type": kind, "count": count}
                              for (mi, kind), count in sorted(counts.items())]
        item["text_status"] = ("Original source text with explicitly marked identifier and attachment-link redactions."
                               if spans else "Original source text, unchanged.")
        output.append(item)
        if spans:
            audits.append({"row_index": original["row_index"], "source_text_sha256": original["source_text_sha256"],
                           "display_text_sha256": item["display_text_sha256"], "redactions": spans})
    return {
        "dataset": DATASET, "revision": REV, "source_url": SOURCE_URL,
        "license": {"name": "ODC-BY-1.0", "url": LICENSE_URL},
        "attribution": "Contains information from allenai/WildChat-4.8M, made available under the ODC Attribution License.",
        "text_status": "Original dataset messages in stored order. Only explicitly marked contact, parcel, complaint, platform identifiers and identifying attachment URLs are redacted. Editorial paraphrases are separate.",
        "records": output,
    }, {"revision": REV, "offset_unit": "zero-based Python Unicode characters in original message", "rows": audits}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", type=pathlib.Path, default=ROOT)
    parser.add_argument("--site-root", type=pathlib.Path, default=ROOT.parent / "website")
    parser.add_argument("--output", type=pathlib.Path, required=True, help="Private raw output; keep outside Git and the site")
    parser.add_argument("--public-output", type=pathlib.Path)
    parser.add_argument("--redactions-output", type=pathlib.Path)
    args = parser.parse_args()
    for forbidden in [args.source_root.resolve(), args.site_root.resolve()]:
        assert forbidden not in args.output.resolve().parents, "Raw output must remain outside the repository and website"
    raw = extract(args.source_root, args.site_root)
    write(args.output, raw)
    public, audit = public_payload(raw)
    if args.public_output:
        write(args.public_output, public)
    if args.redactions_output:
        write(args.redactions_output, audit)
    print(json.dumps({"examples": len(raw["examples"]),
                      "messages": sum(len(item["messages"]) for item in raw["examples"]),
                      "redacted_records": len(audit["rows"]),
                      "redactions": dict(collections.Counter(span["category"] for row in audit["rows"] for span in row["redactions"]))}))


if __name__ == "__main__":
    main()
