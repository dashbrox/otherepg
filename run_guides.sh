#!/usr/bin/env bash
set -euo pipefail

# Ejecutar desde la raíz del repositorio otherepg.
mkdir -p output

python3 build_custom_lists.py

# Cada guía usa únicamente los canales definidos en channels_map.csv.
# Los límites de conexiones/delay son conservadores para reducir bloqueos.
npm run grab -- --channels=custom_channels/tvpassport.channels.xml --output=output/tvpassport.xml --gzip --maxConnections=2 --delay=1000
# tvtv (31-oct-2026): tvtv.us elimino su API JSON en jul-2026 (iptv-org/epg#3187).
# Nuevo scraper HTML sobre tvtv.ca (sites/tvtv.ca): el dominio .ca sirve horarios
# de estaciones de EE.UU. Y de Canada con la misma base de IDs (stnXXXXX), asi que
# un solo sitio cubre todos los canales con tvtv_site_id en el CSV. La ruta del
# lineup en la URL es cosmetica; solo importa stn{ID}-1-x. Cada pagina trae ~8
# dias de programacion de una sola vez: el config usa days:1 (1 request por
# canal) y el parser conserva todo lo restante de la semana. NO pasar --days
# aqui: re-descargaria la misma pagina N veces y duplicaria slots
# (validate_output.py detecta ese caso y falla el run).
npm run grab -- --channels=custom_channels/tvtv.ca.channels.xml --output=output/tvtv.xml --gzip --maxConnections=1 --delay=2000
npm run grab -- --channels=custom_channels/tvguide.channels.xml --output=output/tvguide.xml --gzip --maxConnections=1 --delay=1000

printf '\nGuías generadas:\n'
ls -lh output/*.xml*
