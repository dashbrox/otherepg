#!/usr/bin/env python3
"""Valida que cada canal de las listas custom tenga programas en su guía.

Garantía anti-guía-vacía: si una fuente se rompe como tvtv.us en jul-2026
(iptv-org/epg#3187), este paso hace fallar el workflow en lugar de publicar
silenciosamente guías con huecos. Uso en el repo (raíz):
    python3 validate_output.py

Comprueba, por cada par lista->guía:
  1. La guía existe, es gzip válido y XML parseable.
  2. Cada canal de la lista tiene >= --min-programs programas.
  3. No existen slots duplicados (mismo canal + mismo start), síntoma de
     haber grabado un sitio con --days=N>1 cuando su página ya trae N días.
"""

from __future__ import annotations

import argparse
import gzip
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

# lista custom_channels -> archivo de salida en output/
PAIRS = [
    ("custom_channels/tvpassport.channels.xml", "output/tvpassport.xml.gz"),
    ("custom_channels/tvtv.ca.channels.xml", "output/tvtv.xml.gz"),
    ("custom_channels/tvguide.channels.xml", "output/tvguide.xml.gz"),
]


def parse_guide(path: Path) -> tuple[dict[str, int], list[str]]:
    """Devuelve {channel_id: nº programas} y la lista de slots duplicados."""
    with gzip.open(path, "rb") as f:
        root = ET.parse(f).getroot()

    counts: Counter[str] = Counter()
    slots: Counter[tuple[str, str]] = Counter()
    for prog in root.iter("programme"):
        ch = prog.get("channel") or "?"
        counts[ch] += 1
        slots[(ch, prog.get("start") or "?")] += 1

    dupes = [f"{ch} @ {start}" for (ch, start), n in slots.items() if n > 1]
    return dict(counts), dupes


def expected_channels(path: Path) -> list[str]:
    root = ET.parse(path).getroot()
    return [c.get("xmltv_id") or c.get("site_id") or "?" for c in root.iter("channel")]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-programs", type=int, default=1)
    args = ap.parse_args()

    repo = Path(__file__).resolve().parent
    failed = False

    for list_rel, guide_rel in PAIRS:
        list_path = repo / list_rel
        guide_path = repo / guide_rel
        print(f"\n== {list_rel} -> {guide_rel}")

        if not list_path.exists():
            print(f"  ERROR: no existe la lista {list_rel}")
            failed = True
            continue
        if not guide_path.exists():
            print(f"  ERROR: no existe la guía {guide_rel}")
            failed = True
            continue

        try:
            counts, dupes = parse_guide(guide_path)
        except Exception as exc:  # noqa: BLE001
            print(f"  ERROR: guía ilegible ({type(exc).__name__}: {exc})")
            failed = True
            continue

        ids = expected_channels(list_path)
        total = sum(counts.get(i, 0) for i in ids)
        print(f"  canales en lista: {len(ids)} | programas: {total} | medios: {sum(counts.values())}")

        empty = [i for i in ids if counts.get(i, 0) < args.min_programs]
        if empty:
            print(f"  ERROR: {len(empty)} canal(es) sin programas: {', '.join(empty)}")
            failed = True
        else:
            print(f"  OK: todos los canales tienen >= {args.min_programs} programas")

        if dupes:
            print(f"  ERROR: {len(dupes)} slot(s) duplicado(s), p.ej. {dupes[:3]}")
            failed = True

    print()
    if failed:
        print("RESULTADO: FALLÓ — revisa los errores de arriba.")
        return 1
    print("RESULTADO: OK — todas las guías cubren todos sus canales.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
