#!/usr/bin/env python3
import argparse
import gzip
import json
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path


def norm(value: str) -> str:
    value = unicodedata.normalize('NFKC', value or '')
    value = value.strip().casefold()
    value = re.sub(r'\s+', ' ', value)
    return value


def load_whitelist(path: Path):
    entries = []
    seen = set()
    for raw in path.read_text(encoding='utf-8').splitlines():
        line = raw.strip()
        if not line or line.startswith('#'):
            continue
        n = norm(line)
        if n not in seen:
            entries.append(line)
            seen.add(n)
    return entries


def channel_names(elem):
    out = []
    for child in elem:
        tag = child.tag.rsplit('}', 1)[-1]
        if tag == 'display-name' and child.text:
            out.append(child.text.strip())
    return out


def channel_matches(elem, wanted):
    cid = elem.attrib.get('id', '')
    candidates = {norm(cid)}
    candidates.update(norm(n) for n in channel_names(elem))
    hit = [entry for entry in wanted if norm(entry) in candidates]
    return hit


def xml_header(root_tag='tv', attrs=None):
    attrs = attrs or {}
    def esc(v):
        return (str(v).replace('&', '&amp;').replace('"', '&quot;').replace('<', '&lt;').replace('>', '&gt;'))
    attr_text = ''.join(f' {k}="{esc(v)}"' for k, v in attrs.items())
    return f'<{root_tag}{attr_text}>'


def write_bytes(out, data: bytes):
    out.write(data)
    if not data.endswith(b'\n'):
        out.write(b'\n')


def run(src: Path, whitelist: Path, dst: Path, report_dir: Path, max_channels: int):
    wanted = load_whitelist(whitelist)
    wanted_norm = {norm(x): x for x in wanted}

    matched = {}
    matched_by_id = {}
    matched_by_name = {}
    root_attrs = None

    # Pass 1: read only <channel> elements and discover exact matches.
    for event, elem in ET.iterparse(src, events=('start', 'end')):
        tag = elem.tag.rsplit('}', 1)[-1]
        if event == 'start' and tag == 'tv' and root_attrs is None:
            root_attrs = dict(elem.attrib)
        elif event == 'end' and tag == 'channel':
            hits = channel_matches(elem, wanted)
            if hits:
                cid = elem.attrib.get('id', '')
                names = channel_names(elem)
                matched_entry = hits[0]
                # If two whitelist items resolve to the same source channel, retain one copy.
                key = norm(cid)
                matched.setdefault(key, {
                    'source_id': cid,
                    'display_names': names,
                    'whitelist_entry': matched_entry,
                    'xml': ET.tostring(elem, encoding='utf-8'),
                })
                if norm(cid) in wanted_norm:
                    matched_by_id.setdefault(matched_entry, cid)
                else:
                    matched_by_name.setdefault(matched_entry, cid)
            elem.clear()

    if root_attrs is None:
        raise RuntimeError('No <tv> root element found in source XML.')

    selected = list(matched.values())

    # Preserve whitelist order when selecting the cap.
    order_index = {norm(x): i for i, x in enumerate(wanted)}
    selected.sort(key=lambda item: order_index.get(norm(item['whitelist_entry']), 10**9))

    truncated = selected[max_channels:]
    selected = selected[:max_channels]
    selected_ids = {item['source_id'] for item in selected}

    selected_entries = {norm(item['whitelist_entry']) for item in selected}
    missing = [x for x in wanted if norm(x) not in selected_entries]
    truncated_entries = [item['whitelist_entry'] for item in truncated]

    report_dir.mkdir(parents=True, exist_ok=True)
    (report_dir / 'matched-channels.txt').write_text(
        '\n'.join(f"{item['whitelist_entry']}\t=>\t{item['source_id']}\t=>\t{' | '.join(item['display_names'])}" for item in selected) + '\n',
        encoding='utf-8'
    )
    (report_dir / 'missing-or-truncated.txt').write_text(
        '\n'.join(missing) + '\n',
        encoding='utf-8'
    )
    (report_dir / 'truncated-by-limit.txt').write_text(
        '\n'.join(truncated_entries) + ('\n' if truncated_entries else ''),
        encoding='utf-8'
    )

    # Write a compact XMLTV file while streaming programmes.
    dst.parent.mkdir(parents=True, exist_ok=True)
    opener = gzip.open if dst.suffix == '.gz' else open
    with opener(dst, 'wb') as out:
        write_bytes(out, b'<?xml version="1.0" encoding="UTF-8"?>')
        write_bytes(out, xml_header('tv', root_attrs).encode('utf-8'))
        for item in selected:
            write_bytes(out, item['xml'])

        programme_count = 0
        for event, elem in ET.iterparse(src, events=('end',)):
            tag = elem.tag.rsplit('}', 1)[-1]
            if tag == 'programme':
                if elem.attrib.get('channel') in selected_ids:
                    write_bytes(out, ET.tostring(elem, encoding='utf-8'))
                    programme_count += 1
                elem.clear()

        write_bytes(out, b'</tv>')

    report = {
        'source': str(src),
        'whitelist_entries_unique': len(wanted),
        'matched_before_cap': len(matched),
        'selected_channels': len(selected),
        'truncated_by_max_channels': len(truncated),
        'unmatched_or_truncated_entries': len(missing),
        'programme_count': programme_count,
        'max_channels': max_channels,
    }
    (report_dir / 'summary.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--source', required=True)
    ap.add_argument('--whitelist', required=True)
    ap.add_argument('--output', required=True)
    ap.add_argument('--report-dir', required=True)
    ap.add_argument('--max-channels', type=int, default=200)
    args = ap.parse_args()
    run(Path(args.source), Path(args.whitelist), Path(args.output), Path(args.report_dir), args.max_channels)


if __name__ == '__main__':
    main()
