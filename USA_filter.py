#!/usr/bin/env python3

import argparse
import gzip
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path


# ============================================================
# CHANNEL WHITELIST
#
# These are the US-oriented channels selected from the user's
# original list. Non-US regional feeds such as .ca, .mx, .gt,
# .co, .ar, .pe, .cl, .sv, .cr, .uy, .ec, .hn, .uk, .es,
# .it, .be, .de and explicit Latin America feeds were removed.
# ============================================================

CHANNELS = [
    "Bravo.us",
    "Starz.us",
    "StarzEdge.us",
    "StarzEncoreAction.us",
    "StarzCinema.us",
    "StarzComedy.us",
    "StarzEncoreSuspense.us",
    "StarzEncoreFamilyPacific.us",
    "HBO.us",
    "HBOLatino.us",
    "HBOHits.us",
    "HBOMovies.us",
    "HBODrama.us",
    "HBOComedy.us",
    "ABCEast_WABC.us",
    "ABCKABC.us",
    "NBCEast_WNBC.us",
    "NBCKNBC.us",
    "cpdep",
    "arthur",
    "usop2",
    "usop3",
    "usop11",
    "multi8",
    "multi6",
    "EEntertainmentTelevision.us",
    "CinemaxAction.us",
    "CinemaxClassics.us",
    "CinemaxHits.us",
    "TennisChannel.us",
    "HallmarkMystery.us",
    "HallmarkChannel.us",
    "CNN.us",
    "FoxEast_WNYW.us",
    "CBSEast_WCBS.us",
    "mplus",
    "MTV.us",
    "CWWPIX.us",
    "plex.tv.Tennis.Channel.2.plex",
    "plex.tv.Tennis+.plex",
    "mv1",
    "mvf1",
    "UniversalReality.us@SD",
    "UniversalPremiere.us@East",
    "UniversalCrime.us@East",
    "UniversalComedy.us@SD",
    "UniversalCinema.us@SD",
    "TNT.us",
    "truTV.us",
    "e-entertainment-usa-hd--east/6659",
    "bravo-usa-hd--eastern-feed/6120",
    "bravo-usa-hd--pacific-feed/16226",
    "abc-wabc-new-york-ny-hd/4553",
    "abc-kabc-los-angeles-ca-hd/4552",
    "nbc--network-eastern/1227",
    "nbc-knbc-los-angeles-ca-hd/4558",
    "cbs-wcbs-new-york-ny-hd/4555",
    "hallmark-channel-hd--eastern/6213",
    "hallmark-mystery-eastern--hd/6214",
    "cw--network-eastern/1231",
    "fox--eastern/1229",
    "cnn-hd/4724",
    "the-tennis-channel-hd/7051",
    "hbo-latino-hbo-7-hd--eastern/7096",
    "hbo-2--eastern-feed-hd/6313",
    "hbo-comedy-hd--east/7105",
    "hbo-signature-hbo-3--eastern-hd/7099",
    "hbo-zone-hd--east/7102",
    "5-star-max-hd--eastern/7093",
    "actionmax--eastern-hd/7094",
    "moremax--eastern-hd/7097",
    "starz1--east-hd/3613",
    "starz-edge-hd--eastern/7089",
    "starz-encore-action-hd--eastern/10812",
    "starz-cinema-hd--eastern/7087",
    "starz-comedy-hd--eastern/7088",
    "starz-encore-family-hd--eastern/11441",
    "starz-encore-suspense-hd--eastern/11437",
    "mtv-usa-hd--eastern/4525",
    "tnt-hd--east-feed/3037",
    "trutv-usa--east-hd/6996",
    "XITE90sThrowback.us",
    "XITEHits.us",
    "TelemundoWSCV.us",
    "TennisTV247.us",
]


# ============================================================
# HELPERS
# ============================================================

def normalize(value: str) -> str:
    """
    Normalize text for reliable comparison:
    - Unicode normalization
    - trim
    - lowercase
    - collapse repeated spaces
    """
    value = unicodedata.normalize("NFKC", value or "")
    value = value.strip().casefold()
    value = re.sub(r"\s+", " ", value)
    return value


def local_name(tag: str) -> str:
    """
    Return XML local tag name even if namespaces are present.
    """
    return tag.rsplit("}", 1)[-1]


def channel_display_names(channel_element):
    names = []

    for child in channel_element:
        if local_name(child.tag) == "display-name":
            if child.text:
                text = child.text.strip()
                if text:
                    names.append(text)

    return names


def get_channel_candidates(channel_element):
    """
    Values that can identify a channel.
    """
    values = []

    channel_id = channel_element.attrib.get("id", "")
    if channel_id:
        values.append(channel_id)

    values.extend(channel_display_names(channel_element))

    return values


def channel_matches(channel_element, wanted_normalized):
    """
    Match against channel id first, then display-name.

    Returns:
        wanted entry or None
    """

    candidates = {
        normalize(value)
        for value in get_channel_candidates(channel_element)
        if value
    }

    # Exact normalized match.
    for wanted_original, wanted_norm in wanted_normalized.items():
        if wanted_norm in candidates:
            return wanted_original

    return None


def escape_attribute(value: str) -> str:
    return (
        str(value)
        .replace("&", "&amp;")
        .replace('"', "&quot;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def write_line(output, text: str):
    data = text.encode("utf-8")

    output.write(data)

    if not data.endswith(b"\n"):
        output.write(b"\n")


# ============================================================
# MAIN FILTER
# ============================================================

def build_epg(
    source: Path,
    output: Path,
    max_channels: int,
):
    if not source.exists():
        raise FileNotFoundError(f"Source file not found: {source}")

    if max_channels <= 0:
        raise ValueError("max_channels must be greater than zero")

    # Remove duplicates while preserving user's order.
    wanted = []
    seen = set()

    for item in CHANNELS:
        item = item.strip()

        if not item:
            continue

        key = normalize(item)

        if key in seen:
            continue

        seen.add(key)
        wanted.append(item)

    wanted_normalized = {
        original: normalize(original)
        for original in wanted
    }

    # --------------------------------------------------------
    # PASS 1
    #
    # Find matching channel definitions.
    # --------------------------------------------------------

    matched = {}

    root_attributes = None

    print("Reading channel definitions...")

    for event, element in ET.iterparse(
        source,
        events=("start", "end"),
    ):
        tag = local_name(element.tag)

        if event == "start":
            if tag == "tv" and root_attributes is None:
                root_attributes = dict(element.attrib)

        elif event == "end":
            if tag == "channel":

                matched_entry = channel_matches(
                    element,
                    wanted_normalized,
                )

                if matched_entry is not None:

                    source_id = element.attrib.get("id", "")

                    # Multiple whitelist entries can occasionally
                    # resolve to the same actual source channel.
                    unique_key = normalize(source_id)

                    if unique_key not in matched:
                        matched[unique_key] = {
                            "source_id": source_id,
                            "wanted": matched_entry,
                            "display_names": channel_display_names(
                                element
                            ),
                            "xml": ET.tostring(
                                element,
                                encoding="utf-8",
                            ),
                        }

            element.clear()

    if root_attributes is None:
        raise RuntimeError(
            "Could not find the <tv> root element."
        )

    # --------------------------------------------------------
    # SORT BY USER WHITELIST ORDER
    # --------------------------------------------------------

    order = {
        normalize(channel): index
        for index, channel in enumerate(wanted)
    }

    selected = list(matched.values())

    selected.sort(
        key=lambda item: order.get(
            normalize(item["wanted"]),
            10**9,
        )
    )

    matched_count = len(selected)

    # Apply hard maximum.
    truncated = selected[max_channels:]

    selected = selected[:max_channels]

    selected_source_ids = {
        item["source_id"]
        for item in selected
    }

    selected_wanted = {
        normalize(item["wanted"])
        for item in selected
    }

    truncated_wanted = [
        item["wanted"]
        for item in truncated
    ]

    missing_wanted = [
        channel
        for channel in wanted
        if normalize(channel) not in selected_wanted
        and channel not in truncated_wanted
    ]

    # --------------------------------------------------------
    # PREPARE OUTPUT
    # --------------------------------------------------------

    output.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    # XML declaration and root.
    xml_attributes = "".join(
        f' {key}="{escape_attribute(value)}"'
        for key, value in root_attributes.items()
    )

    channel_count = len(selected)

    print()
    print("========================================")
    print("FILTERING IPTV-EPG US")
    print("========================================")
    print(f"Whitelist entries : {len(wanted)}")
    print(f"Matched source    : {matched_count}")
    print(f"Selected          : {channel_count}")
    print(f"Maximum           : {max_channels}")
    print(f"Truncated         : {len(truncated)}")
    print(f"Missing           : {len(missing_wanted)}")
    print("========================================")
    print()

    # --------------------------------------------------------
    # PASS 2
    #
    # Write selected channel definitions and programmes.
    # --------------------------------------------------------

    programme_count = 0

    with gzip.open(
        output,
        "wb",
        compresslevel=9,
    ) as output_file:

        write_line(
            output_file,
            '<?xml version="1.0" encoding="UTF-8"?>',
        )

        write_line(
            output_file,
            f"<tv{xml_attributes}>",
        )

        # Write channels.
        for item in selected:
            write_line(
                output_file,
                ET.tostring(
                    ET.fromstring(item["xml"]),
                    encoding="unicode",
                ),
            )

        print("Reading programmes...")

        for event, element in ET.iterparse(
            source,
            events=("end",),
        ):
            tag = local_name(element.tag)

            if tag == "programme":

                source_channel = element.attrib.get(
                    "channel",
                    "",
                )

                if source_channel in selected_source_ids:

                    write_line(
                        output_file,
                        ET.tostring(
                            element,
                            encoding="unicode",
                        ),
                    )

                    programme_count += 1

                element.clear()

        write_line(
            output_file,
            "</tv>",
        )

    # --------------------------------------------------------
    # REPORT
    # --------------------------------------------------------

    report_lines = []

    report_lines.append(
        "========================================"
    )
    report_lines.append(
        "IPTV-EPG US FILTER REPORT"
    )
    report_lines.append(
        "========================================"
    )
    report_lines.append(
        f"Whitelist entries: {len(wanted)}"
    )
    report_lines.append(
        f"Matched before cap: {matched_count}"
    )
    report_lines.append(
        f"Selected channels: {channel_count}"
    )
    report_lines.append(
        f"Maximum channels: {max_channels}"
    )
    report_lines.append(
        f"Truncated channels: {len(truncated)}"
    )
    report_lines.append(
        f"Missing channels: {len(missing_wanted)}"
    )
    report_lines.append(
        f"Programme entries: {programme_count}"
    )
    report_lines.append("")
    report_lines.append(
        "------------ MATCHED ------------"
    )

    for item in selected:

        names = " | ".join(
            item["display_names"]
        )

        report_lines.append(
            f"{item['wanted']} => "
            f"{item['source_id']} => "
            f"{names}"
        )

    report_lines.append("")
    report_lines.append(
        "------------ TRUNCATED ------------"
    )

    if truncated:
        for item in truncated:
            report_lines.append(
                item["wanted"]
            )
    else:
        report_lines.append(
            "None"
        )

    report_lines.append("")
    report_lines.append(
        "------------ MISSING ------------"
    )

    if missing_wanted:
        for item in missing_wanted:
            report_lines.append(
                item
            )
    else:
        report_lines.append(
            "None"
        )

    report_lines.append("")

    Path(
        "epg-us-report.txt"
    ).write_text(
        "\n".join(report_lines),
        encoding="utf-8",
    )

    print()
    print(
        f"Finished: {programme_count:,} programme entries"
    )
    print(
        f"Output: {output}"
    )

    return {
        "whitelist": len(wanted),
        "matched": matched_count,
        "selected": channel_count,
        "truncated": len(truncated),
        "missing": len(missing_wanted),
        "programmes": programme_count,
    }


# ============================================================
# CLI
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        description=(
            "Filter IPTV-EPG US XMLTV to a selected "
            "channel whitelist."
        )
    )

    parser.add_argument(
        "--source",
        required=True,
        help="Source XMLTV file",
    )

    parser.add_argument(
        "--output",
        required=True,
        help="Output .xml.gz file",
    )

    parser.add_argument(
        "--max-channels",
        type=int,
        default=200,
        help="Maximum number of channels",
    )

    args = parser.parse_args()

    try:
        result = build_epg(
            source=Path(args.source),
            output=Path(args.output),
            max_channels=args.max_channels,
        )

        print()
        print("FINAL RESULT")
        print(result)

    except Exception as exc:
        print(
            f"ERROR: {exc}",
            file=sys.stderr,
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
