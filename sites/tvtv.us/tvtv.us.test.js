const config = require('./tvtv.us.config')
const { extractLineupChannels, buildChannelsXml } = require('../../scripts/commands/epg/tvtv-us-lineup')

describe('tvtv.us scraper', () => {
  test('builds the new HTMX endpoint with an exact UTC millisecond timestamp', () => {
    const date = require('dayjs')('2026-08-07T00:00:00Z')
    const channel = { site_id: '10709' }
    expect(config.url({ date, channel })).toBe('https://www.tvtv.us/partial/source/1786060800000/10709')
  })

  test('parses programme cards from the HTML fragment', async () => {
    const html = `
      <div class="grid-row" data-source="10709">
        <div class="gridAiring M" data-id="p-1" data-time="1786060800000" data-runtime="60" data-qualifiers="HD,New">
          Movie title<span class="gridSubtitle">A subtitle</span>
        </div>
      </div>`
    const programs = await config.parser({ content: html })
    expect(programs).toHaveLength(1)
    expect(programs[0].id).toBe('p-1')
    expect(programs[0].title).toBe('Movie title')
    expect(programs[0].subtitle).toBe('A subtitle')
    expect(programs[0].start.valueOf()).toBe(1786060800000)
    expect(programs[0].stop.valueOf()).toBe(1786064400000)
  })

  test('extracts only the channels present in the selected lineup', () => {
    const html = `
      <template id="channels-template">
        <a data-id="10709" data-ch="2.1"><img title="WABC-TV" data-light="logos/wabc.png"></a>
        <a data-id="10710" data-ch="4.1"><img title="WCBS-TV"></a>
      </template>`
    const catalog = new Map([['10709', { xmltvId: 'WABC.us@East', name: 'ABC East' }]])
    const channels = extractLineupChannels(html, catalog)
    expect(channels).toHaveLength(2)
    expect(channels[0].xmltvId).toBe('WABC.us@East')
    expect(channels[1].xmltvId).toBe('tvtv.us.10710')
    expect(buildChannelsXml(channels)).toContain('site_id="10709"')
  })
})
