#!/usr/bin/env node
// discord/post.js — post a SIP-standard CV2 message from a git-archived payload.
// Usage: node post.js posts/<file>.json [--plan]   Env: DISCORD_BOT_TOKEN, DISCORD_GUILD_ID
// Payloads live in discord/posts/ and are committed = permanent audit trail.
'use strict'

const fs = require('fs')
const path = require('path')
const { makeApi, requireEnv } = require('./api.js')
const { TYPES, validatePayload, render } = require('./templates.js')
const { rewriteMentions } = require('./lib.js')

const { TOKEN, GUILD } = requireEnv()
const DRY = process.argv.includes('--plan')
const file = process.argv.slice(2).find(a => !a.startsWith('--'))
if (!file) { console.error('Usage: node post.js posts/<file>.json [--plan]'); process.exit(1) }
const api = makeApi(TOKEN, 'SIP discord/post.js')

async function main() {
  const payload = JSON.parse(fs.readFileSync(path.resolve(__dirname, file), 'utf8'))
  const { errors } = validatePayload(payload)
  if (errors.length) {
    console.error(`Invalid payload (${file}):`)
    errors.forEach(e => console.error(`  ✗ ${e}`))
    process.exit(1)
  }

  const channels = await api('GET', `/guilds/${GUILD}/channels`)
  const channel = channels.find(c => c.name === payload.channel && c.type !== 4)
  if (!channel) {
    console.error(`Channel #${payload.channel} not found. Channels: ${channels.filter(c => c.type !== 4).map(c => c.name).join(', ')}`)
    process.exit(1)
  }
  const channelId = name => channels.find(c => c.name === name && c.type !== 4)?.id

  const rewritten = { ...payload, body: rewriteMentions(payload.body, channelId) }
  const msg = render(rewritten)

  console.log(`POST → #${payload.channel} · type=${payload.type} · accent=#${TYPES[payload.type].accent.toString(16)}`)
  console.log(`  title: ${payload.title}`)
  console.log(`  body: ${payload.body.length} chars${payload.banner ? ' · banner' : ''}${payload.cells ? ` · ${payload.cells.length} cells` : ''}${payload.cardImages ? ` · ${payload.cardImages.length} cards` : ''}${payload.buttons ? ` · ${payload.buttons.length} buttons` : ''}`)
  console.log(`  crosspost: ${channel.type === 5 ? 'yes (announcement channel)' : 'no'} · pin: ${payload.pin ? 'yes' : 'no'}`)
  if (DRY) { console.log('\n--plan: no message sent.'); return }

  const posted = await api('POST', `/channels/${channel.id}/messages`, { ...msg, allowed_mentions: { parse: [] } })
  console.log(`✓ posted — message ${posted.id}`)
  if (channel.type === 5) {
    await api('POST', `/channels/${channel.id}/messages/${posted.id}/crosspost`)
    console.log('✓ crossposted to followers')
  }
  if (payload.pin) {
    await api('PUT', `/channels/${channel.id}/pins/${posted.id}`)
    console.log('✓ pinned')
  }
  console.log(`\nReminder: commit ${file} (the audit trail).`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
