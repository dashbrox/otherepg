# tvtv.ca

Sitio nuevo para sustituir a tvtv.us, cuya API JSON (`/api/v1/lineup/.../grid/...`)
fue eliminada por tvtv en julio de 2026 (iptv-org/epg#3187) y hoy responde
"Not found" (los 404 masivos del workflow).

tvtv.ca sirve la misma base de estaciones (IDs `stnXXXXX` compartidos con
tvtv.us) y renderiza server-side, en cada página de estación, ~8 días de
programación en HTML (`div.gridAiring` con `data-time`/`data-runtime`).

## Uso en este repo

- `run_guides.sh` llama `npm run grab -- --channels=custom_channels/tvtv.ca.channels.xml ...`
- `custom_channels/tvtv.ca.channels.xml` se genera desde `channels_map.csv`
  (columna `tvtv_site_id`) con `build_custom_lists.py`.
- 1 request por canal por corrida (la página ya trae la semana completa).

## No pasar --days=N>1

El CLI sobrescribe `config.days` (0.46.x: `cli.ts` línea 113). Con `--days=3`
epg-grabber re-descargaría la misma página 3 veces y, como no deduplica
programas entre fetches, la guía saldría con slots repetidos.
`validate_output.py` detecta ese caso (slots duplicados) y falla el run.
