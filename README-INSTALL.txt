TVTV.us scraper update for StrangeDrVN/epg
========================================

Target lineup:
https://www.tvtv.us/10080/lineup/luUSA-NY63086-X/

WHAT THIS PACKAGE DOES
- Uses FlareSolverr (Chromium-based Cloudflare solver) to read the selected TVTV lineup.
- Extracts only the station IDs present in that lineup, not all 2,300 records in the repository catalogue.
- Maps matching station IDs to the existing XMLTV IDs in sites/tvtv.us/tvtv.us.channels.xml.
- Fetches programme fragments from /partial/source/{UTC-midnight-ms}/{stationId} with HX-Request: true.
- Uses the existing EPG grabber to create XMLTV, GZIP and JSON output.
- Publishes the results under the public branch's tvtv-us/ folder without deleting other folders there.

INSTALLATION
1. Download and unzip tvtv_us_github_actions_update.zip.
2. Open the extracted tvtv_us_update folder.
3. Copy its .github, sites and scripts folders into the root of your StrangeDrVN/epg repository. Merge folders and overwrite only the listed TVTV files if asked:
   - .github/workflows/tvtv-us-grab.yml (new)
   - sites/tvtv.us/tvtv.us.adapter.js (new)
   - sites/tvtv.us/tvtv.us.config.js (replace)
   - sites/tvtv.us/tvtv.us.test.js (replace)
   - scripts/commands/epg/tvtv-us-lineup.js (new)
4. Commit and push these files to the repository's default branch.
5. In GitHub, open Settings > Actions > General and make sure Actions are enabled for the repository. Then open Actions > TVTV.us Lineup EPG > Run workflow.
6. Keep the default lineup URL and choose 2 days for the first run. The workflow also runs daily at 08:15 UTC.

OUTPUT URLS (after the first successful run)
https://raw.githubusercontent.com/StrangeDrVN/epg/public/tvtv-us/guide.xml.gz
https://raw.githubusercontent.com/StrangeDrVN/epg/public/tvtv-us/guide.xml
https://raw.githubusercontent.com/StrangeDrVN/epg/public/tvtv-us/channels.xml

IMPORTANT LIMITATIONS
- This is a first integration package, not a successful live run. Cloudflare may still block GitHub-hosted runner IPs; the workflow deliberately fails instead of publishing an empty guide.
- FlareSolverr runs as a service container inside the GitHub Actions job. No separate account or API key is required.
- The `public` branch is preserved by publishing only the `tvtv-us/` folder. The action requires repository Actions to be enabled and the GITHUB_TOKEN to have contents: write permission.
- Existing XMLTV IDs are reused where the repository catalogue has a matching TVTV station ID. Unmatched stations receive `tvtv.us.<stationId>` IDs; those fallback IDs may need mapping to your M3U's tvg-id values.
- The updated site config also points at the new HTMX endpoint. For this specific provider lineup, use the supplied workflow: it first creates a filtered channels.xml from the actual lineup and then runs the existing EPG grabber. Do not run `--sites=tvtv.us` for this lineup unless you intentionally want to process the repository's entire static 2,300-channel catalogue.
