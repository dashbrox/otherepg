# Filtered IPTV-EPG US guide

This repository downloads `https://iptv-epg.org/files/epg-us.xml` and creates a compact XMLTV guide containing only the requested channels.

## Regional filtering

The whitelist intentionally excludes channel IDs clearly belonging to Canada, the UK, Spain, Europe, and Latin America. Examples removed include `.ca`, `.uk`, `.es`, `.it`, `.be`, `.de`, `.ec`, `.hn`, `.gt`, `.mx`, `.co`, `.ar`, `.pe`, `.cl`, `.sv`, `.cr`, `.uy`, and similar country/feed markers, plus `Panregional`, `LatinAmerica`, and Mexico-specific feeds.

US channels that contain words such as `HBO Latino` are retained because they are US services/feeds rather than Latin-American regional feeds.

## How it works

1. GitHub Actions downloads the current US EPG.
2. `channels.txt` is matched against XMLTV `channel id` and `display-name` values.
3. Matching channels are kept in whitelist order.
4. The output is capped at 200 channels.
5. Diagnostics are written to `report/` so missing IDs are visible instead of being silently discarded.
6. The resulting `custom-epg.xml.gz` is attached to the `latest` GitHub release.

The current regional-cleaned whitelist contains 85 entries. Because the cap is 200, there is currently no artificial truncation; the cap remains available in case the list is expanded later.
