# Paquete tvtv.us -> tvtv.ca (fix 404 masivos)

## 1. Copiar al repo (desde la raíz de tu clon de dashbrox/otherepg)

    unzip -o otherepg-tvtv-ca-fix.zip
    cp -r otherepg-tvtv-ca-fix/. .

La carpeta incluye ya la ruta correcta `.github/workflows/custom-epg.yml`.

## 2. Revisar y commitear

    git add .github/workflows/custom-epg.yml run_guides.sh validate_output.py \
            build_custom_lists.py channels_map.csv VERIFICACION_tvtv.md \
            custom_channels sites/tvtv.ca
    git commit -m "tvtv.us -> tvtv.ca: scraper HTML nuevo + validador anti-guia-vacia"
    git push

## 3. Primera corrida

    Actions > "Generate custom US EPG guides" > Run workflow (workflow_dispatch)

El paso nuevo "Validar canales sin programas" imprime cuántos canales y
programas tiene cada guía y falla nombrando exactamente qué canal quedó sin
programas (o con slots duplicados, o XML roto). Con la corrida verde tienes
la confirmación 54/54 de tvtv.ca en tu propio repo.

## Notas

- channels_map.csv va incluido SIN cambios (si es idéntico al tuyo, git no
  verá diff).
- custom_channels/*.xml se regeneran solos en cada corrida a partir del CSV;
  van incluidos para que también puedas correr run_guides.sh en local.
- NO añadas --days al paso de tvtv: la página ya trae ~8 días por request y
  duplicaría slots (el validador lo detectaría). Detalle en
  sites/tvtv.ca/readme.md y VERIFICACION_tvtv.md.
