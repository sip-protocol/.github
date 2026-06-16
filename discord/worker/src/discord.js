// worker/src/discord.js — minimal Discord REST calls for the Worker (bot token).
const API = 'https://discord.com/api/v10'

// Add a single role to a member. Returns { ok, status }.
export async function grantRole(env, userId, roleId) {
  const res = await fetch(`${API}/guilds/${env.DISCORD_GUILD_ID}/members/${userId}/roles/${roleId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
      'X-Audit-Log-Reason': 'SIP intro gate auto-grant',
      'Content-Length': '0',
    },
  })
  return { ok: res.ok, status: res.status }
}

// Best-effort note to #mod-log via the Ops webhook. Never throws.
export async function logModlog(env, content) {
  if (!env.DISCORD_MODLOG_WEBHOOK_URL) return
  try {
    await fetch(env.DISCORD_MODLOG_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    })
  } catch { /* best-effort logging */ }
}
