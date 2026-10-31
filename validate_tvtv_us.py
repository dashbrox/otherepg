#!/usr/bin/env python3
"""Validate the TVTV.us XMLTV output before it is published."""

from __future__ import annotations

import argparse
import gzip
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def expected_channels(path: Path) -> list[str]:
    root = ET.parse(path).getroot()
    return [
        item.attrib.get("xmltv_id") or item.attrib.get("site_id") or "?"
        for item in root
        if local_name(item.tag) == "channel"
    ]


def validate(channels_path: Path, guide_path: Path) -> dict[str, int]:
    if not channels_path.is_file() or channels_path.stat().st_size == 0:
        raise RuntimeError(f"Lista de canales inexistente o vacía: {channels_path}")
    if not guide_path.is_file() or guide_path.stat().st_size == 0:
        raise RuntimeError(f"Guía gzip inexistente o vacía: {guide_path}")

    wanted = expected_channels(channels_path)
    if not wanted:
        raise RuntimeError("La lista channels.xml no contiene canales.")
    if len(wanted) != len(set(wanted)):
        raise RuntimeError("La lista channels.xml contiene xmltv_id duplicados.")

    with gzip.open(guide_path, "rb") as source:
        root = ET.parse(source).getroot()

    if local_name(root.tag) != "tv":
        raise RuntimeError("El archivo generado no tiene <tv> como raíz XMLTV.")

    output_channel_ids = {
        element.attrib.get("id", "")
        for element in root
        if local_name(element.tag) == "channel"
    }
    counts: Counter[str] = Counter()
    slots: Counter[tuple[str, str]] = Counter()

    for element in root:
        if local_name(element.tag) != "programme":
            continue
        channel_id = element.attrib.get("channel", "")
        start = element.attrib.get("start", "")
        counts[channel_id] += 1
        slots[(channel_id, start)] += 1

    missing_definitions = [channel for channel in wanted if channel not in output_channel_ids]
    empty_channels = [channel for channel in wanted if counts[channel] == 0]
    duplicate_slots = [
        f"{channel} @ {start}"
        for (channel, start), count in slots.items()
        if count > 1
    ]
    programme_total = sum(counts.values())

    print("TVTV.us XMLTV validation")
    print(f"Channels expected : {len(wanted)}")
    print(f"Channels emitted  : {len(output_channel_ids)}")
    print(f"Programmes        : {programme_total}")
    print(f"Channels without programmes: {len(empty_channels)}")
    print(f"Duplicate slots   : {len(duplicate_slots)}")

    if missing_definitions:
        raise RuntimeError("Faltan definiciones de canal: " + ", ".join(missing_definitions))
    if empty_channels:
        raise RuntimeError("Canales sin programación: " + ", ".join(empty_channels))
    if duplicate_slots:
        raise RuntimeError("Se detectaron slots duplicados, por ejemplo: " + "; ".join(duplicate_slots[:5]))
    if programme_total == 0:
        raise RuntimeError("La guía no contiene programas; no se publicará.")

    return {"channels": len(wanted), "programmes": programme_total}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--channels", default="custom_channels/tvtv.us.channels.xml")
    parser.add_argument("--guide", default="output/tvtv-us.xml.gz")
    args = parser.parse_args()

    try:
        validate(Path(args.channels), Path(args.guide))
        print("RESULTADO: OK — guía válida, completa y sin slots duplicados.")
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
