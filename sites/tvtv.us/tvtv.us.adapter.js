const axios = require('axios')

const DEFAULT_LINEUP_URL = 'https://www.tvtv.us/10080/lineup/luUSA-NY63086-X/'
const FLARESOLVERR_URL = (process.env.FLARESOLVERR_URL || 'http://localhost:8191').replace(/\/$/, '')
const transport = axios.create({ timeout: 120000, maxRedirects: 5 })

let clearancePromise = null

function lineupUrl() {
  const value = process.env.TVTV_LINEUP_URL || DEFAULT_LINEUP_URL
  const parsed = new URL(value)
  if (!['tvtv.us', 'www.tvtv.us'].includes(parsed.hostname)) {
    throw new Error(`TVTV_LINEUP_URL must use tvtv.us; received ${parsed.hostname}`)
  }
  return parsed.toString()
}

function plainHeaders(headers) {
  if (!headers) return {}
  return typeof headers.toJSON === 'function' ? headers.toJSON() : { ...headers }
}

async function requestFlareSolverr(url) {
  const response = await transport.post(
    `${FLARESOLVERR_URL}/v1`,
    { cmd: 'request.get', url, maxTimeout: 120000 },
    { headers: { 'Content-Type': 'application/json' }, timeout: 180000 }
  )

  const payload = response.data
  if (!payload || payload.status !== 'ok') {
    throw new Error(`FlareSolverr failed for ${url}: ${payload && payload.message ? payload.message : 'unknown response'}`)
  }

  const solution = payload.solution || {}
  const cookies = Array.isArray(solution.cookies) ? solution.cookies : []
  const userAgent = solution.userAgent || ''
  const html = solution.response || ''

  if (!cookies.length || !userAgent) {
    throw new Error('FlareSolverr did not return TVTV clearance cookies and a user-agent')
  }

  return { cookies, userAgent, html }
}

function getClearance(targetUrl = lineupUrl()) {
  if (!clearancePromise) {
    clearancePromise = requestFlareSolverr(targetUrl).catch(error => {
      clearancePromise = null
      throw error
    })
  }
  return clearancePromise
}

function cookieHeader(cookies) {
  return cookies
    .filter(cookie => cookie && cookie.name && cookie.value !== undefined)
    .filter(cookie => !cookie.domain || cookie.domain.includes('tvtv.us'))
    .map(cookie => `${cookie.name}=${cookie.value}`)
    .join('; ')
}

async function fetchLineupHtml(url = lineupUrl()) {
  const parsed = new URL(url)
  if (!['tvtv.us', 'www.tvtv.us'].includes(parsed.hostname)) {
    throw new Error(`Lineup URL must use tvtv.us; received ${parsed.hostname}`)
  }

  let clearance = await getClearance(parsed.toString())
  let html = clearance.html

  // A second FlareSolverr request is a fallback for instances that return
  // clearance cookies first but omit the SPA body in that same response.
  if (!html.includes('channels-template')) {
    clearance = await requestFlareSolverr(parsed.toString())
    html = clearance.html
  }

  if (!html.includes('channels-template')) {
    throw new Error('TVTV page loaded without channels-template. Cloudflare may still be blocking this runner.')
  }

  return html
}

async function tvtvAxiosAdapter(config) {
  const url = config && config.url
  if (!url) throw new Error('TVTV adapter received a request without a URL')
  const parsed = new URL(url, config.baseURL)
  if (!['tvtv.us', 'www.tvtv.us'].includes(parsed.hostname)) {
    throw new Error(`TVTV adapter refused a non-TVTV URL: ${parsed.hostname}`)
  }

  const clearance = await getClearance()
  const originalHeaders = plainHeaders(config.headers)
  const headers = {
    ...originalHeaders,
    'User-Agent': clearance.userAgent,
    Cookie: cookieHeader(clearance.cookies),
    'HX-Request': 'true',
    Referer: lineupUrl(),
    Accept: originalHeaders.Accept || originalHeaders.accept || '*/*'
  }

  const response = await transport.request({
    url: parsed.toString(),
    method: config.method || 'GET',
    headers,
    data: config.data,
    params: config.params,
    timeout: config.timeout || 60000,
    responseType: 'text',
    responseEncoding: 'utf8',
    validateStatus: status => status >= 200 && status < 300
  })

  return {
    data: response.data,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    config,
    request: response.request
  }
}

module.exports = {
  tvtvAxiosAdapter,
  fetchLineupHtml,
  DEFAULT_LINEUP_URL
}
