const dayjs = require('dayjs')
const utc = require('dayjs/plugin/utc')
const cheerio = require('cheerio')

dayjs.extend(utc)

// NOTE: tvtv removed its JSON API (/api/v1/lineup/...) in jul-2026 (iptv-org/epg#3187).
// The site now renders server-side HTML with a full week of programs per station page.
// URL pattern: /{region}/{city}/{postal}/{lineup}/stn{stationId}-{n}-{slug}
//   - only the station id matters: `stn{ID}-1-x` resolves for any valid lineup path
//   - the same station database is shared by tvtv.us and tvtv.ca, but only tvtv.ca
//     serves BOTH US and Canadian station schedules -> single site for all channels.
//
// QUOTA: days must stay 1. One request per channel returns ~8 days of schedule
// and the parser keeps everything from the requested UTC day onward, so a single
// fetch already yields a multi-day guide. Do NOT grab this site with --days=N>1:
// epg-grabber would re-fetch the same page N times and, because it never dedupes
// programs across fetches, the guide would end up with duplicated slots.
module.exports = {
  site: 'tvtv.ca',
  days: 1,
  url({ channel }) {
    return `https://www.tvtv.ca/ca/los-angeles/90010/luUSA-CA66511-X/stn${channel.site_id}-1-x`
  },
  request: {
    headers: {
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      Connection: 'keep-alive',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'sec-ch-ua': '"Not.A/Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"'
    }
  },
  parser({ content, date }) {
    const programs = []
    // keep everything the page still offers from the start of the requested
    // UTC day onward (the page always begins somewhere inside "today")
    const cutoff = dayjs(date).utc().startOf('day')
    const $ = cheerio.load(content)

    $('#lineup .gridAiring').each((i, el) => {
      const $el = $(el)
      const time = parseInt($el.attr('data-time'), 10)
      if (!time) return

      const start = dayjs(time)
      if (start.utc().valueOf() < cutoff.valueOf()) return

      const runtime = parseInt($el.attr('data-runtime'), 10) || 30
      // long airings repeat the title in two child <div>s -> use the first one;
      // short airings carry the title as their own text node
      const container = $el.children('div').length ? $el.children('div').first() : $el
      const subtitle = container.find('.gridSubtitle').first().text().trim() || null
      const title = container
        .clone()
        .children('.gridSubtitle')
        .remove()
        .end()
        .text()
        .replace(/^…/, '')
        .trim()
      if (!title) return

      programs.push({
        title,
        subtitle,
        start,
        stop: start.add(runtime, 'minute')
      })
    })

    return programs
  }
}
