'use strict'

const axios = require('axios')

const DEFAULT_LINEUP_URL = 'https://www.tvtv.us/10080/lineup/luUSA-NY63086-X/'
const FLARESOLVERR_URL = (process.env.FLARESOLVERR_URL || 'http://localhost:8191').replace(/\/$/, '')
const SESSION_ID = `tvtv-us-${process.pid}`
const transport = axios.create({ timeout: 180000, maxRedirects: 5 })

let sessionPromise = null
let requestQueue = Promise.resolve()
let cleanupRegistered = false

function lineupUrl() {
  const value = process.env.TVTV_LINEUP_URL || DEFAULT_LINEUP_URL
  const parsed = new URL(value)
  assertTvtvHost(parsed)
  return parsed.toString()
}

function assertTvtvHost(parsed) {
  if (!['tvtv.us', 'www.tvtv.us'].includes(parsed.hostname)) {
    throw new Error(`TVTV URL must use tvtv.us; received ${parsed.hostname}`)
  }
}

function plainHeaders(headers) {
  if (!headers) return {}
  return typeof headers.toJSON === 'function' ? headers.toJSON() : { ...headers }
}

function browserHeaders(input = {}) {
  const headers = {}
  for (const [name, value] of Object.entries(input)) {
    const lower = name.toLowerCase()
    // These are controlled by the FlareSolverr browser/session. Replaying
    // cookies or a different UA from Node can invalidate Cloudflare clearance.
    if (['host', 'content-length', 'cookie', 'user-agent', 'connection'].includes(lower)) continue
    if (value !== undefined && value !== null) headers[name] = String(value)
  }

  headers.Accept = headers.Accept || headers.accept || '*/*'
  headers['Accept-Language'] = headers['Accept-Language'] || headers['accept-language'] || 'en-US,en;q=0.9'
  headers['HX-Request'] = 'true'
  headers.Referer = lineupUrl()
  headers['HX-Current-URL'] = lineupUrl()
  return headers
}

async function flarePost(payload, timeout = 180000) {
  let response
  try {
    response = await transport.post(`${FLARESOLVERR_URL}/v1`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout
    })
  } catch (error) {
    const detail = error && error.message ? error.message : String(error)
    throw new Error(`Cannot contact FlareSolverr at ${FLARESOLVERR_URL}: ${detail}`)
  }

  const data = response.data
  if (!data || data.status !== 'ok') {
    const message = data && data.message ? data.message : 'unknown FlareSolverr response'
    throw new Error(`FlareSolverr command ${payload.cmd} failed: ${message}`)
  }
  return data
}

async function requestInSession(url, headers = {}, session = SESSION_ID) {
  const data = await flarePost({
    cmd: 'request.get',
    url,
    session,
    maxTimeout: 120000,
    waitInSeconds: 0,
    headers
  })

  const solution = data.solution || {}
  const status = Number(solution.status)
  const body = typeof solution.response === 'string' ? solution.response : ''

  if (!Number.isFinite(status) || status < 200 || status >= 300) {
    const snippet = body.replace(/\s+/g, ' ').slice(0, 300)
    throw new Error(
      `TVTV.us returned HTTP ${Number.isFinite(status) ? status : 'unknown'} for ${url}. ` +
      `FlareSolverr response: ${snippet || data.message || 'empty response'}`
    )
  }

  if (/cf-chl-|challenge-platform|<title>Just a moment|Attention Required!/i.test(body)) {
    throw new Error(`TVTV.us returned a Cloudflare challenge instead of page data for ${url}.`)
  }

  return {
    body,
    status,
    statusText: String(solution.headers && solution.headers.statusText || 'OK'),
    headers: solution.headers || {}
  }
}

async function destroySession() {
  try {
    await transport.post(`${FLARESOLVERR_URL}/v1`, {
      cmd: 'sessions.destroy',
      session: SESSION_ID
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    })
  } catch (_) {
    // The Actions service container is temporary; cleanup is best-effort.
  }
}

async function createSession() {
  await flarePost({ cmd: 'sessions.create', session: SESSION_ID })

  const url = lineupUrl()
  const page = await requestInSession(url, browserHeaders({}), SESSION_ID)
  if (!page.body.includes('channels-template')) {
    throw new Error(
      'TVTV lineup was reached, but template#channels-template was not found. ' +
      'Cloudflare may still be blocking this runner or TVTV changed its HTML.'
    )
  }

  if (!cleanupRegistered) {
    cleanupRegistered = true
    process.once('beforeExit', () => {
      // The pending HTTP request keeps Node alive until FlareSolverr closes it.
      void destroySession()
    })
  }

  return { id: SESSION_ID, lineupHtml: page.body }
}

function getSession() {
  if (!sessionPromise) {
    sessionPromise = createSession().catch(async error => {
      await destroySession()
      sessionPromise = null
      throw error
    })
  }
  return sessionPromise
}

function serializeSessionRequest(task) {
  const result = requestQueue.then(task, task)
  requestQueue = result.catch(() => {})
  return result
}

function withParams(url, params) {
  if (!params || typeof params !== 'object') return url
  const parsed = new URL(url)
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      for (const item of value) parsed.searchParams.append(`${key}[]`, String(item))
    } else {
      parsed.searchParams.set(key, String(value))
    }
  }
  return parsed.toString()
}

async function tvtvAxiosAdapter(config) {
  if (!config || !config.url) throw new Error('TVTV adapter received a request without a URL')

  const parsed = new URL(config.url, config.baseURL)
  assertTvtvHost(parsed)

  const method = String(config.method || 'get').toLowerCase()
  if (method !== 'get') {
    throw new Error(`TVTV FlareSolverr adapter only supports GET requests; received ${method.toUpperCase()}`)
  }

  const targetUrl = withParams(parsed.toString(), config.params)
  await getSession()

  // FlareSolverr sessions keep Cloudflare cookies in the same browser context.
  // Serialize calls so concurrent epg-grabber workers do not navigate the
  // same persistent browser session simultaneously.
  const result = await serializeSessionRequest(() =>
    requestInSession(targetUrl, browserHeaders(plainHeaders(config.headers)), SESSION_ID)
  )

  return {
    data: result.body,
    status: result.status,
    statusText: result.statusText,
    headers: result.headers,
    config,
    request: null
  }
}

async function fetchLineupHtml(url = lineupUrl()) {
  const parsed = new URL(url)
  assertTvtvHost(parsed)
  const session = await getSession()
  return session.lineupHtml
}

module.exports = {
  tvtvAxiosAdapter,
  fetchLineupHtml,
  DEFAULT_LINEUP_URL
}
