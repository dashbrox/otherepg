#!/usr/bin/env python3
"""
Limpia los títulos de la guía EPG de Movistar Plus+ que sigan el patrón:
    "Nombre Torneo (T2026): Jugador A - Jugador B (sonido ambiente)"
convirtiéndolos a:
    "Nombre Torneo (2026): Jugador A vs Jugador B"

Uso:
    python clean_guide.py [archivo_entrada|url] [archivo_salida]
Si no se indica archivo_salida, se imprime por stdout.
"""

import re
import sys
import xml.etree.ElementTree as ET
from urllib.request import urlopen

URL_GUIDE = "https://github.com/dashbrox/otherepg/raw/refs/heads/master/guides/movistarplus.es/guide.xml"

def clean_title(title: str) -> str:
    """
    Si el título cumple el patrón:
        Nombre (Taaaa): Jug1 - Jug2 [(comentario)]
    devuelve:
        Nombre (aaaa): Jug1 vs Jug2
    En caso contrario, devuelve el título original.
    """
    # Patrón: captura el nombre del torneo, el año T, los dos jugadores
    # Permite que el segundo jugador tenga un texto entre paréntesis al final
    pattern = re.compile(
        r"^(.*?)\s*\(T(\d{4})\)\s*:\s*(.*?)\s*-\s*(.*?)\s*$",
        re.IGNORECASE
    )
    match = pattern.match(title)
    if not match:
        return title  # no modificar

    tournament = match.group(1).strip()
    year = match.group(2)
    player1 = match.group(3).strip()
    player2_raw = match.group(4).strip()

    # Eliminar cualquier anotación entre paréntesis al final del segundo jugador
    player2 = re.sub(r"\s*\([^)]*\)\s*$", "", player2_raw).strip()

    # Formato solicitado: "Nombre (año): Jug1 vs Jug2"
    return f"{tournament} ({year}): {player1} vs {player2}"


def process_guide(input_source, output_file=None):
    """Lee la guía XML, limpia los títulos y guarda el resultado."""
    # Obtener el contenido XML
    if input_source.startswith("http://") or input_source.startswith("https://"):
        with urlopen(input_source) as response:
            xml_data = response.read().decode("utf-8")
    else:
        with open(input_source, "r", encoding="utf-8") as f:
            xml_data = f.read()

    # Parsear el XML
    root = ET.fromstring(xml_data)

    # Recorrer todos los elementos <programme> y modificar los títulos
    for programme in root.iter("programme"):
        for title_elem in programme.findall("title"):
            if title_elem.text:
                title_elem.text = clean_title(title_elem.text)

    # Serializar a cadena y guardar o imprimir
    cleaned_xml = ET.tostring(root, encoding="unicode")

    if output_file:
        with open(output_file, "w", encoding="utf-8") as f:
            f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
            f.write(cleaned_xml)
        print(f"Guía limpia guardada en: {output_file}", file=sys.stderr)
    else:
        print(cleaned_xml)


if __name__ == "__main__":
    # Si no se pasan argumentos, usar la URL por defecto y mostrar por stdout
    if len(sys.argv) == 1:
        input_src = URL_GUIDE
        output_dest = None
    elif len(sys.argv) == 2:
        input_src = sys.argv[1]
        output_dest = None
    else:
        input_src = sys.argv[1]
        output_dest = sys.argv[2]

    process_guide(input_src, output_dest)
