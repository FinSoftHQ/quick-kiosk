import { defineEventHandler, getRequestURL, getRequestHeader, proxyRequest, createError } from 'h3'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const apiUpstreamBaseUrl
    = ((config.apiUpstreamBaseUrl as string | undefined) ?? '').trim()
      || (process.env.NUXT_API_UPSTREAM_BASE_URL ?? '').trim()
      || ''
  const apiKey
    = ((config.apiKey as string | undefined) ?? '').trim()
      || (process.env.API_KEY ?? '').trim()
      || ''

  const apiSecret
    = ((config.apiSecret as string | undefined) ?? '').trim()
      || (process.env.API_SECRET ?? '').trim()
      || ''

  if (!apiUpstreamBaseUrl || apiUpstreamBaseUrl.trim() === '') {
    throw createError({
      statusCode: 500,
      statusMessage: 'NUXT_API_UPSTREAM_BASE_URL is not configured'
    })
  }

  if (!apiKey || apiKey.trim() === '') {
    throw createError({
      statusCode: 500,
      statusMessage: 'API_KEY is not configured'
    })
  }

  if (!apiSecret || apiSecret.trim() === '') {
    throw createError({
      statusCode: 500,
      statusMessage: 'API_SECRET is not configured'
    })
  }

  const upstreamHost = new URL(apiUpstreamBaseUrl).host
  const requestHost = getRequestHeader(event, 'host') || ''
  if (upstreamHost === requestHost) {
    throw createError({
      statusCode: 500,
      statusMessage: 'NUXT_API_UPSTREAM_BASE_URL points to the web server itself (self-proxy)'
    })
  }

  const clientApiKey = getRequestHeader(event, 'x-api-key')
  if (clientApiKey !== undefined) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Client-provided API key is not accepted'
    })
  }

  const clientApiSecret = getRequestHeader(event, 'x-api-secret')
  if (clientApiSecret !== undefined) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Client-provided API secret is not accepted'
    })
  }

  const requestUrl = getRequestURL(event)
  const target = new URL(requestUrl.pathname + requestUrl.search, apiUpstreamBaseUrl).toString()

  return proxyRequest(event, target, {
    headers: {
      'x-api-key': apiKey,
      'x-api-secret': apiSecret
    }
  })
})
