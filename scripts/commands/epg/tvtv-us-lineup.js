const fs = require('fs')
const path = require('path')
const cheerio = require('cheerio')
const { fetchLineupHtml, DEFAULT_LINEUP_URL } = require('../../../sites/tvtv.us/tvtv.us.adapter')

const CATALOG_PATH = path.join(process.cwd(), 'sites', 'tvtv.us', 'tvtv.us.channels.xml')
const OUTPUT_DIR = path.join(process.cwd(), 'output', 'tvtv-us')
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'channels.xml')

function xmlEscape(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function loadCatalog(filePath = CATALOG_PATH) {
  const xml = fs.readFileSync(filePath, 'utf8')
  const $ = cheerio.load(xml, { xmlMode: true })
  const catalog = new Map()

  $('channel').each((_, element) => {
    const channel = $(element)
    const siteId = String(channel.attr('site_id') || '').trim()
    if (!siteId) return
    catalog.set(siteId, {
      xmltvId: String(channel.attr('xmltv_id') || '').trim(),
      name: channel.text().trim()
    })
  })

  return catalog
}

function extractLineupChannels(html, catalog = loadCatalog()) {
  const $ = cheerio.load(html)
  const template = $('template#channels-template').html()
  if (!template) throw new Error('TVTV response does not contain template#channels-template')

  const lineup = cheerio.load(template)
  const seen = new Set()
  const channels = []

  lineup('a[data-id][data-ch]').each((_, element) => {
    const anchor = lineup(element)
    const siteId = String(anchor.attr('data-id') || '').trim()
    const number = String(anchor.attr('data-ch') || '').trim()
    const image = anchor.find('img').first()
    const callsign = String(image.attr('title') || anchor.text() || '').replace(/\s+/g, ' ').trim()
    const light = String(image.attr('data-light') || '').trim()

    if (!/^\d+$/.test(siteId) || !number || seen.has(siteId)) return
    seen.add(siteId)

    const mapped = catalog.get(siteId) || {}
    channels.push({
      siteId,
      number,
      callsign,
      xmltvId: mapped.xmltvId || `tvtv.us.${siteId}`,
      name: mapped.name || [number, callsign].filter(Boolean).join(' - ') || `TVTV ${siteId}`,
      logo: light ? `https://www.tvtv.us/api/v2/gn/si/${light}` : ''
    })
  })

  if (!channels.length) {
    throw new Error('The lineup was reached, but no channels were extracted; refusing to publish an empty guide')
  }

  return channels
}

function buildChannelsXml(channels) {
  const records = channels.map(channel => {
    const logo = channel.logo ? ` logo="${xmlEscape(channel.logo)}"` : ''
    return `  <channel site="tvtv.us" site_id="${xmlEscape(channel.siteId)}" lang="en" xmltv_id="${xmlEscape(channel.xmltvId)}"${logo}>${xmlEscape(channel.name)}</channel>`
  })

  return `<?xml version="1.0" encoding="UTF-8"?>\n<channels>\n${records.join('\n')}\n</channels>\n`
}

async function main() {
  const lineupUrl = process.env.TVTV_LINEUP_URL || DEFAULT_LINEUP_URL
  console.log(`[TVTV] Loading lineup ${lineupUrl}`)
  const html = await fetchLineupHtml(lineupUrl)
  const channels = extractLineupChannels(html)
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  fs.writeFileSync(OUTPUT_PATH, buildChannelsXml(channels), 'utf8')

  const mapped = channels.filter(channel => !channel.xmltvId.startsWith('tvtv.us.')).length
  console.log(`[TVTV] Found ${channels.length} channels in your lineup.`)
  console.log(`[TVTV] Matched ${mapped} channels to the repository XMLTV identifiers.`)
  console.log(`[TVTV] Wrote ${OUTPUT_PATH}`)
}

if (require.main === module) {
  main().catch(error => {
    console.error(`[TVTV] ${error.stack || error.message || error}`)
    process.exitCode = 1
  })
}

module.exports = { extractLineupChannels, buildChannelsXml, loadCatalog }
