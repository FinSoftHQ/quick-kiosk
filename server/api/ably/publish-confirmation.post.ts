import { createError, defineEventHandler, readBody, setResponseStatus } from 'h3'
import Ably from 'ably'

let rest: Ably.Rest | null = null
let restKey = ''

function ablyRest(key: string): Ably.Rest {
  if (!rest || restKey !== key) {
    rest = new Ably.Rest(key)
    restKey = key
  }
  return rest
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const ablyApiKey
    = ((config.ablyApiKey as string | undefined) ?? '').trim()
      || (process.env.NUXT_ABLY_API_KEY ?? '').trim()
      || ''

  if (!ablyApiKey) {
    throw createError({ statusCode: 500, statusMessage: 'NUXT_ABLY_API_KEY is not configured' })
  }

  const body = await readBody<{ member_code?: unknown }>(event)
  const memberCode = typeof body?.member_code === 'string' ? body.member_code.trim() : ''
  if (!/^\d{3,8}$/.test(memberCode)) {
    throw createError({ statusCode: 400, statusMessage: 'member_code must be 3-8 digits' })
  }

  try {
    await ablyRest(ablyApiKey).channels.get('confirmation').publish('member-confirmed', {
      member_code: memberCode,
      confirmed_at: new Date().toISOString()
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Ably publish failed' })
  }

  setResponseStatus(event, 200)
  return { ok: true }
})
