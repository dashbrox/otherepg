#!/usr/bin/env bash
set -euo pipefail

# Ejecutar desde la raíz del repositorio otherepg.
mkdir -p output

python3 build_custom_lists.py

# Cada guía usa únicamente los canales definidos en channels_map.csv.
# Los límites de conexiones/delay son conservadores para reducir bloqueos.
npm run grab -- --channels=custom_channels/tvpassport.channels.xml --output=output/tvpassport.xml --gzip --maxConnections=2 --delay=1000
npm run grab -- --channels=custom_channels/tvtv.channels.xml --output=output/tvtv.xml --gzip --maxConnections=1 --delay=2000
npm run grab -- --channels=custom_channels/tvguide.channels.xml --output=output/tvguide.xml --gzip --maxConnections=1 --delay=1000

printf '\nGuías generadas:\n'
ls -lh output/tvpassport.xml* output/tvtv.xml* output/tvguide.xml*
