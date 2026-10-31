const dayjs = require('dayjs')
const utc = require('dayjs/plugin/utc')
const cheerio = require('cheerio')
const { tvtvAxiosAdapter } = require('./tvtv.us.adapter')

dayjs.extend(utc)

module.exports = {
  site: 'tvtv.us',
  days: 2,
  maxConnections: 2,
  delay: 2000,
  url({ date, channel }) {
    // TVTV expects midnight UTC in Unix milliseconds, not a local timestamp.
    const timestamp = dayjs.utc(date).startOf('day').valueOf()
    return `https://www.tvtv.us/partial/source/${timestamp}/${channel.site_id}`
  },
  request: {
    headers: {
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'HX-Request': 'true',
      Referer: process.env.TVTV_LINEUP_URL || 'https://www.tvtv.us/10080/lineup/luUSA-NY63086-X/'
    },
    adapter: tvtvAxiosAdapter
  },
  async parser({ content }) {
    const html = Buffer.isBuffer(content) ? content.toString('utf8') : String(content || '')
    const $ = cheerio.load(html)
    const programs = []
    const airings = $('.grid-row .gridAiring').length
      ? $('.grid-row .gridAiring')
      : $('.gridAiring')

    airings.each((_, element) => {
      const airing = $(element)
      const time = Number(airing.attr('data-time'))
      const runtime = Number(airing.attr('data-runtime'))
      if (!Number.isFinite(time) || !Number.isFinite(runtime) || runtime <= 0) return

      const title = extractTitle($, element)
      if (!title) return

      const start = dayjs.utc(time)
      if (!start.isValid()) return

      const subtitle = airing.find('.gridSubtitle').first().text().replace(/\s+/g, ' ').trim()
      const id = airing.attr('data-id') || null

      programs.push({
        id,
        title,
        subtitle: subtitle || null,
        start,
        stop: start.add(runtime, 'minute')
      })
    })

    return programs
  }
}

function extractTitle($, element) {
  const airing = $(element)
  const children = airing.contents().toArray()

  // Most TVTV cards have the title as a direct text node. Long-airing cards
  // put it in the first wrapper that also contains the subtitle.
  for (const child of children) {
    if (child.type === 'text' && String(child.data || '').trim()) {
      return String(child.data).replace(/\s+/g, ' ').trim()
    }

    if (child.type === 'tag') {
      const wrapper = $(child)
      if (wrapper.find('.gridSubtitle').length) {
        const directText = wrapper
          .contents()
          .toArray()
          .filter(node => node.type === 'text')
          .map(node => String(node.data || '').trim())
          .find(Boolean)
        if (directText) return directText.replace(/\s+/g, ' ').trim()
      }
    }
  }

  const clone = airing.clone()
  clone.find('.gridSubtitle').remove()
  return clone.text().replace(/\s+/g, ' ').trim()
}
