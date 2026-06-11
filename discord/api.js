// discord/api.js — shared Discord REST helper. 429-aware, actionable errors.
'use strict'

const API = 'https://discord.com/api/v10'
const sleep = ms => new Promise(r => setTimeout(r, ms))

function requireEnv() {
  const TOKEN = process.env.DISCORD_BOT_TOKEN
  const GUILD = process.env.DISCORD_GUILD_ID
  if (!TOKEN || !GUILD) {
    console.error('Missing env. Set DISCORD_BOT_TOKEN and DISCORD_GUILD_ID in ~/Documents/secret/.env (zshrc auto-loads).')
    process.exit(1)
  }
  return { TOKEN, GUILD }
}

function makeApi(token, reason) {
  return async function api(method, route, body, extra = {}) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await fetch(`${API}${route}`, {
        method,
        headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json', 'X-Audit-Log-Reason': reason, ...extra.headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}))
        const wait = Math.ceil((data.retry_after || 1) * 1000)
        console.log(`  rate-limited, waiting ${wait}ms`)
        await sleep(wait)
        continue
      }
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`${method} ${route} → ${res.status}: ${text}`)
      }
      if (res.status === 204) return null
      return res.json()
    }
    throw new Error(`${method} ${route} → still rate-limited after 5 attempts`)
  }
}

module.exports = { makeApi, requireEnv }
