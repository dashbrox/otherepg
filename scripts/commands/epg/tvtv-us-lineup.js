'use strict'

const fs = require('fs')
const path = require('path')
const cheerio = require('cheerio')
const csv = require('csv-parser')
const {
  fetchLineupHtml,
  DEFAULT_LINEUP_URL
} = require('../../../sites/tvtv.us/tvtv.us.adapter')

const ROOT = process.cwd()
const CSV_PATH = path.join(ROOT, 'channels_map.csv')
const OUTPUT_DIR = path.join(ROOT, 'custom_channels')
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'tvtv.us.channels.xml')
const REPORT_DIR = path.join(ROOT, 'output')
const REPORT_PATH = path.join(REPORT_DIR, 'tvtv-us-lineup-report.json')

function xmlEscape(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function readChannelMap(filePath = CSV_PATH) {
  return new Promise((resolve, reject) => {
    const rows = []
    const bySiteId = new Map()

    fs.createReadStream(filePath)
      .pipe(csv({ mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '').trim() }))
      .on('data', row => {
        const siteId = String(row.tvtv_site_id || '').trim()
        if (!siteId) return

        const xmltvId = String(row.xmltv_id || '').trim()
        const name = String(row.name || '').trim()
        const lang = String(row.lang || 'en').trim() || 'en'

        if (!/^\d+$/.test(siteId)) {
          reject(new Error(`tvtv_site_id inválido en channels_map.csv: ${siteId}`))
          return
        }
        if (!xmltvId || !name) {
          reject(new Error(`La fila con tvtv_site_id=${siteId} necesita xmltv_id y name`))
          return
        }
        if (bySiteId.has(siteId)) {
          const previous = bySiteId.get(siteId)
          reject(new Error(
            `tvtv_site_id duplicado en channels_map.csv: ${siteId} ` +
            `(${previous.xmltvId} y ${xmltvId})`
          ))
          return
        }

        const channel = { siteId, xmltvId, name, lang }
        bySiteId.set(siteId, channel)
        rows.push(channel)
      })
      .on('error', reject)
      .on('end', () => resolve(rows))
  })
}

function extractLineupChannels(html) {
  const $ = cheerio.load(html)
  const template = $('template#channels-template').first()
  if (!template.length) {
    throw new Error('TVTV no devolvió template#channels-template; posible bloqueo de Cloudflare o cambio de HTML.')
  }

  const fragment = cheerio.load(template.html() || '')
  const channels = new Map()

  fragment('a[data-id][data-ch]').each((_, element) => {
    const anchor = fragment(element)
    const siteId = String(anchor.attr('data-id') || '').trim()
    const number = String(anchor.attr('data-ch') || '').trim()
    const image = anchor.find('img').first()
    const callSign = String(image.attr('title') || anchor.text() || '')
      .replace(/\s+/g, ' ')
      .trim()
    const light = String(image.attr('data-light') || '').trim()

    if (!/^\d+$/.test(siteId) || !number || channels.has(siteId)) return

    channels.set(siteId, {
      siteId,
      number,
      callSign,
      logo: light ? `https://www.tvtv.us/api/v2/gn/si/${light}` : ''
    })
  })

  if (!channels.size) {
    throw new Error('Se encontró channels-template, pero no se detectaron canales con data-id y data-ch.')
  }

  return channels
}

function buildChannelsXml(mappedRows, lineupChannels) {
  const entries = mappedRows.map(row => {
    const lineupChannel = lineupChannels.get(row.siteId)
    const logo = lineupChannel && lineupChannel.logo
      ? ` logo="${xmlEscape(lineupChannel.logo)}"`
      : ''

    return `  <channel site="tvtv.us" site_id="${xmlEscape(row.siteId)}" lang="${xmlEscape(row.lang)}" xmltv_id="${xmlEscape(row.xmltvId)}"${logo}>${xmlEscape(row.name)}</channel>`
  })

  return `<?xml version="1.0" encoding="UTF-8"?>\n<channels>\n${entries.join('\n')}\n</channels>\n`
}

async function main() {
  const lineupUrl = process.env.TVTV_LINEUP_URL || DEFAULT_LINEUP_URL
  const parsedUrl = new URL(lineupUrl)
  if (!['tvtv.us', 'www.tvtv.us'].includes(parsedUrl.hostname)) {
    throw new Error(`TVTV_LINEUP_URL debe apuntar a tvtv.us; recibido: ${parsedUrl.hostname}`)
  }

  console.log(`[TVTV.us] Leyendo lineup: ${lineupUrl}`)
  const html = await fetchLineupHtml(lineupUrl)
  const lineupChannels = extractLineupChannels(html)
  const mapRows = await readChannelMap()

  const selected = mapRows.filter(row => lineupChannels.has(row.siteId))
  const notInLineup = mapRows
    .filter(row => !lineupChannels.has(row.siteId))
    .map(row => ({ siteId: row.siteId, xmltvId: row.xmltvId, name: row.name }))

  if (!selected.length) {
    throw new Error(
      `El lineup contiene ${lineupChannels.size} canales, pero ninguno coincide con ` +
      `los tvtv_site_id de channels_map.csv. No se generará una lista vacía.`
    )
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  fs.writeFileSync(OUTPUT_PATH, buildChannelsXml(selected, lineupChannels), 'utf8')

  const report = {
    lineupUrl,
    lineupChannelCount: lineupChannels.size,
    csvTvtvEntries: mapRows.length,
    matched: selected.length,
    notInLineup,
    selected: selected.map(row => {
      const ch = lineupChannels.get(row.siteId)
      return {
        siteId: row.siteId,
        xmltvId: row.xmltvId,
        name: row.name,
        lineupNumber: ch.number,
        callSign: ch.callSign
      }
    })
  }
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  console.log(`[TVTV.us] Canales detectados en el lineup: ${lineupChannels.size}`)
  console.log(`[TVTV.us] Canales de channels_map.csv que coinciden: ${selected.length}`)
  console.log(`[TVTV.us] Entradas de channels_map.csv fuera de este lineup: ${notInLineup.length}`)
  for (const row of notInLineup) {
    console.log(`  OMITIDO: ${row.xmltvId} (${row.name}) — site_id ${row.siteId} no aparece en el lineup`)
  }
  console.log(`[TVTV.us] Lista creada: ${OUTPUT_PATH}`)
  console.log(`[TVTV.us] Informe: ${REPORT_PATH}`)
}

if (require.main === module) {
  main().catch(error => {
    console.error(`[TVTV.us] ERROR: ${error.stack || error.message || error}`)
    process.exitCode = 1
  })
}

module.exports = {
  extractLineupChannels,
  buildChannelsXml,
  readChannelMap
}
