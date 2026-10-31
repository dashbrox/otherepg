#!/usr/bin/env python3
"""Build one custom epg-grabber channels XML per source from channels_map.csv.

Run from the root of the otherepg repository:
    python3 build_custom_lists.py

Only rows with a site-specific ID are included in that source's list.
The same xmltv_id is preserved across the three sources so their output
programmes can be compared/merged safely later.
"""

from __future__ import annotations

import csv
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CSV_PATH = ROOT / "channels_map.csv"
OUT_DIR = ROOT / "custom_channels"

SOURCES = {
    "tvpassport": {"site": "tvpassport.com", "column": "tvpassport_site_id"},
    "tvtv": {"site": "tvtv.us", "column": "tvtv_site_id"},
    "tvguide": {"site": "tvguide.com", "column": "tvguide_site_id"},
}

REQUIRED_COLUMNS = {
    "xmltv_id", "name", "tvpassport_site_id", "tvtv_site_id", "tvguide_site_id", "lang"
}


def read_rows() -> list[dict[str, str]]:
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"No se encontró {CSV_PATH}")

    with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        missing = REQUIRED_COLUMNS - set(reader.fieldnames or [])
        if missing:
            raise ValueError("Faltan columnas en channels_map.csv: " + ", ".join(sorted(missing)))

        rows: list[dict[str, str]] = []
        seen: set[str] = set()
        for line_no, row in enumerate(reader, start=2):
            clean = {key: (value or "").strip() for key, value in row.items() if key}
            if not clean.get("xmltv_id") and not clean.get("name"):
                continue
            if not clean.get("xmltv_id") or not clean.get("name"):
                raise ValueError(f"Línea {line_no}: xmltv_id y name son obligatorios")
            key = clean["xmltv_id"].casefold()
            if key in seen:
                raise ValueError(f"Línea {line_no}: xmltv_id duplicado: {clean['xmltv_id']}")
            seen.add(key)
            clean["lang"] = clean.get("lang") or "en"
            rows.append(clean)
        return rows


def write_source_file(source_key: str, source: dict[str, str], rows: list[dict[str, str]]) -> tuple[int, list[str]]:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    channels = ET.Element("channels")
    included = 0
    missing: list[str] = []

    for row in rows:
        site_id = row.get(source["column"], "").strip()
        if not site_id:
            missing.append(row["xmltv_id"])
            continue

        channel = ET.SubElement(
            channels,
            "channel",
            {
                "site": source["site"],
                "site_id": site_id,
                "lang": row["lang"],
                "xmltv_id": row["xmltv_id"],
            },
        )
        channel.text = row["name"]
        included += 1

    tree = ET.ElementTree(channels)
    ET.indent(tree, space="  ")
    output_path = OUT_DIR / f"{source_key}.channels.xml"
    tree.write(output_path, encoding="utf-8", xml_declaration=True)
    return included, missing


def main() -> int:
    rows = read_rows()
    if not rows:
        print("channels_map.csv no contiene canales.", file=sys.stderr)
        return 1

    print(f"Canales solicitados en channels_map.csv: {len(rows)}")
    print("Se crearán listas separadas; no se consultará el catálogo completo de cada sitio.\n")

    total = 0
    for key, source in SOURCES.items():
        included, missing = write_source_file(key, source, rows)
        total += included
        print(f"{source['site']}: {included} canal(es) incluidos")
        if missing:
            print("  Sin ID configurado para esta fuente: " + ", ".join(missing))
        print(f"  Archivo: custom_channels/{key}.channels.xml")

    print(f"\nTotal de entradas generadas entre las tres fuentes: {total}")
    print("Importante: revisa que los site_id de cada fila correspondan al canal deseado.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
