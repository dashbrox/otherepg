const axios = require('axios')
const dayjs = require('dayjs')
const cheerio = require('cheerio')
const utc = require('dayjs/plugin/utc')
const timezone = require('dayjs/plugin/timezone')
const customParseFormat = require('dayjs/plugin/customParseFormat')

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(customParseFormat)

module.exports = {
  site: 'tvpassport.com',
  days: 3,
  url({ channel, date }) {
    return `https://www.tvpassport.com/tv-listings/stations/${channel.site_id}/${date.format(
      'YYYY-MM-DD'
    )}`
  },
  async request() {
    return {
      timeout: 30000,
      headers: {
        Cookie: await getCookie()
      }
    }
  },
  parser: function ({ content }) {
    let programs = []
    const currentTimezone = parseCurrentTimezone(content)
    const items = parseItems(content)

    for (let item of items) {
      const $item = cheerio.load(item)
      const start = parseStart($item, currentTimezone)
      const duration = parseDuration($item)
      const stop = start.add(duration, 'm')

      let title = parseTitle($item)
      let subtitle = parseSubTitle($item)

      if (!title) continue

      if (title === 'Movie' || title === 'Cinéma') {
        title = subtitle
        subtitle = null
      }

      programs.push({
        title,
        subtitle,
        description: parseDescription($item),
        image: parseImage($item),
        category: parseCategory($item),
        rating: parseRating($item),
        actors: parseActors($item),
        guest: parseGuest($item),
        director: parseDirector($item),
        year: parseYear($item),
        start,
        stop
      })
    }

    return programs
  },
  async channels() {
    return [
      // Original TSN channels
      {
        lang: 'en',
        site_id: 'tsn1-hd/2819',
        name: 'TSN1 HD'
      },
      {
        lang: 'en',
        site_id: 'tsn2-hd/5920',
        name: 'TSN2 HD'
      },
      {
        lang: 'en',
        site_id: 'tsn3-hd/13768',
        name: 'TSN3 HD'
      },
      {
        lang: 'en',
        site_id: 'tsn4-hd/13769',
        name: 'TSN4 HD'
      },
      {
        lang: 'en',
        site_id: 'tsn5-hd/13770',
        name: 'TSN5 HD'
      },
      // New channels
      {
        lang: 'en',
        site_id: 'e-entertainment-usa-hd--east/6659',
        name: 'E! Entertainment USA HD - East'
      },
      {
        lang: 'en',
        site_id: 'bravo-usa-hd--eastern-feed/6120',
        name: 'Bravo USA HD - Eastern Feed'
      },
      {
        lang: 'en',
        site_id: 'bravo-usa-hd--pacific-feed/16226',
        name: 'Bravo USA HD - Pacific Feed'
      },
      {
        lang: 'en',
        site_id: 'abc-wabc-new-york-ny-hd/4553',
        name: 'ABC (WABC) New York, NY HD'
      },
      {
        lang: 'en',
        site_id: 'abc-kabc-los-angeles-ca-hd/4552',
        name: 'ABC (KABC) Los Angeles, CA HD'
      },
      {
        lang: 'en',
        site_id: 'nbc--network-eastern/1227',
        name: 'NBC - Network Eastern'
      },
      {
        lang: 'en',
        site_id: 'nbc-knbc-los-angeles-ca-hd/4558',
        name: 'NBC (KNBC) Los Angeles, CA HD'
      },
      {
        lang: 'en',
        site_id: 'cbs-wcbs-new-york-ny-hd/4555',
        name: 'CBS (WCBS) New York, NY HD'
      },
      {
        lang: 'en',
        site_id: 'hallmark-channel-hd--eastern/6213',
        name: 'Hallmark Channel HD - Eastern'
      },
      {
        lang: 'en',
        site_id: 'hallmark-mystery-eastern--hd/6214',
        name: 'Hallmark Mystery Eastern - HD'
      },
      {
        lang: 'en',
        site_id: 'cw--network-eastern/1231',
        name: 'CW - Network Eastern'
      },
      {
        lang: 'en',
        site_id: 'fox--eastern/1229',
        name: 'FOX - Eastern'
      },
      {
        lang: 'en',
        site_id: 'cnn-hd/4724',
        name: 'CNN HD'
      },
      {
        lang: 'en',
        site_id: 'the-tennis-channel-hd/7051',
        name: 'The Tennis Channel HD'
      },
      {
        lang: 'en',
        site_id: 'hbo-latino-hbo-7-hd--eastern/7096',
        name: 'HBO Latino (HBO 7) HD - Eastern'
      },
      {
        lang: 'en',
        site_id: 'hbo-2--eastern-feed-hd/6313',
        name: 'HBO 2 - Eastern Feed HD'
      },
      {
        lang: 'en',
        site_id: 'hbo-comedy-hd--east/7105',
        name: 'HBO Comedy HD - East'
      },
      {
        lang: 'en',
        site_id: 'hbo-signature-hbo-3--eastern-hd/7099',
        name: 'HBO Signature (HBO 3) - Eastern HD'
      },
      {
        lang: 'en',
        site_id: 'hbo-zone-hd--east/7102',
        name: 'HBO Zone HD - East'
      },
      {
        lang: 'en',
        site_id: '5-star-max-hd--eastern/7093',
        name: '5 Star Max HD - Eastern'
      },
      {
        lang: 'en',
        site_id: 'actionmax--eastern-hd/7094',
        name: 'ActionMax - Eastern HD'
      },
      {
        lang: 'en',
        site_id: 'moremax--eastern-hd/7097',
        name: 'MoreMax - Eastern HD'
      },
      {
        lang: 'en',
        site_id: 'starz1--east-hd/3613',
        name: 'STARZ1 - East HD'
      },
      {
        lang: 'en',
        site_id: 'starz-edge-hd--eastern/7089',
        name: 'Starz Edge HD - Eastern'
      },
      {
        lang: 'en',
        site_id: 'starz-encore-action-hd--eastern/10812',
        name: 'Starz Encore Action HD - Eastern'
      },
      {
        lang: 'en',
        site_id: 'starz-cinema-hd--eastern/7087',
        name: 'Starz Cinema HD - Eastern'
      },
      {
        lang: 'en',
        site_id: 'starz-comedy-hd--eastern/7088',
        name: 'Starz Comedy HD - Eastern'
      },
      {
        lang: 'en',
        site_id: 'starz-encore-family-hd--eastern/11441',
        name: 'Starz Encore Family HD - Eastern'
      },
      {
        lang: 'en',
        site_id: 'starz-encore-suspense-hd--eastern/11437',
        name: 'Starz Encore Suspense HD - Eastern'
      },
      {
        lang: 'en',
        site_id: 'mtv-usa-hd--eastern/4525',
        name: 'MTV USA HD - Eastern'
      },
      {
        lang: 'en',
        site_id: 'tnt-hd--east-feed/3037',
        name: 'TNT HD - East Feed'
      },
      {
        lang: 'en',
        site_id: 'trutv-usa--east-hd/6996',
        name: 'truTV USA - East HD'
      }
    ]
  }
}

// El resto de funciones auxiliares se mantienen igual
async function getCookie() {
  const res = await axios.get('https://www.tvpassport.com/tv-listings')
  const setCookie = res.headers['set-cookie']
  if (!setCookie || setCookie.length === 0) return ''
  const cookies = setCookie.map(cookie => cookie.split(';')[0])
  return cookies.join('; ')
}

function parseDescription($item) {
  return $item('*').data('description')
}

function parseImage($item) {
  const showpicture = $item('*').data('showpicture')
  if (!showpicture) return null
  const url = new URL(showpicture, 'https://cdn.tvpassport.com/image/show/960x540/')
  return url.href
}

function parseTitle($item) {
  return $item('*').data('showname')?.toString() || null
}

function parseSubTitle($item) {
  return $item('*').data('episodetitle')?.toString() || null
}

function parseYear($item) {
  return $item('*').data('year')?.toString() || null
}

function parseCategory($item) {
  const showtype = $item('*').data('showtype')
  return showtype ? showtype.split(', ') : []
}

function parseActors($item) {
  const cast = $item('*').data('cast')
  return cast ? cast.split(', ') : []
}

function parseDirector($item) {
  const director = $item('*').data('director')
  return director ? director.split(', ') : []
}

function parseGuest($item) {
  const guest = $item('*').data('guest')
  return guest ? guest.split(', ') : []
}

function parseRating($item) {
  const rating = $item('*').data('rating')
  return rating
    ? {
        system: 'MPA',
        value: rating.replace(/^TV/, 'TV-')
      }
    : null
}

function parseStart($item, currentTimezone) {
  const time = $item('*').data('st')
  return dayjs.tz(time, 'YYYY-MM-DD HH:mm:ss', currentTimezone)
}

function parseDuration($item) {
  const duration = $item('*').data('duration')
  return parseInt(duration)
}

function parseItems(content) {
  if (!content) return []
  const $ = cheerio.load(content)
  return $('.station-listings .list-group-item').toArray()
}

function parseCurrentTimezone(content) {
  if (!content) return 'America/New_York'
  const $ = cheerio.load(content)
  return $('#timezone_selector').val()
}
