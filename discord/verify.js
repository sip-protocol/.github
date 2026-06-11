#!/usr/bin/env node
// discord/verify.js — GET-only: report drift between manifest and live guild. Exit 1 on drift.
'use strict'

const fs = require('fs')
const path = require('path')
const { planRoles, planCategories, planChannels, planAutomod, planEmojis, planWebhooks, planSeeds, rewriteMentions } = require('./lib.js')
const { render, normalizeComponents } = require('./templates.js')
const { makeApi, requireEnv } = require('./api.js')
const { TOKEN, GUILD } = requireEnv()
const api = makeApi(TOKEN, 'SIP discord/verify.js')
const get = route => api('GET', route)

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'))
  const guild = await get(`/guilds/${GUILD}`)
  const roles = await get(`/guilds/${GUILD}/roles`)
  const channels = await get(`/guilds/${GUILD}/channels`)
  const automod = await get(`/guilds/${GUILD}/auto-moderation/rules`)
  const welcome = await get(`/guilds/${GUILD}/welcome-screen`).catch(() => null)

  const roleId = name => roles.find(r => r.name === name && !r.managed)?.id
  const channelId = name => channels.find(c => c.name === name && c.type !== 4)?.id

  const drift = []
  const pR = planRoles(manifest.roles, roles)
  const pC = planCategories(manifest.categories, channels)
  const pCh = planChannels(manifest.categories, channels, roleId)
  const pA = planAutomod(manifest.automod, automod, { channelId, roleId })
  pR.create.forEach(r => drift.push(`missing role: ${r.name}`))
  pR.update.forEach(u => drift.push(`role drift: ${u.name} ${JSON.stringify(u.patch)}`))
  pC.create.forEach(c => drift.push(`missing category: ${c.name}`))
  pCh.create.forEach(c => drift.push(`missing channel: #${c.spec.name}`))
  pCh.update.forEach(u => drift.push(`channel drift: #${u.name} ${JSON.stringify(u.patch)}`))
  pA.create.forEach(r => drift.push(`missing automod: ${r.name}`))
  if (!guild.features.includes('COMMUNITY')) drift.push('COMMUNITY feature not enabled')
  if (guild.verification_level !== manifest.guild.verification_level) drift.push(`verification_level ${guild.verification_level} ≠ ${manifest.guild.verification_level}`)
  if (guild.explicit_content_filter !== manifest.guild.explicit_content_filter) drift.push(`explicit_content_filter ${guild.explicit_content_filter} ≠ ${manifest.guild.explicit_content_filter}`)
  if (!guild.icon) drift.push('no server icon')
  if (!welcome || !welcome.welcome_channels?.length) drift.push('welcome screen not configured')

  const emojis = await get(`/guilds/${GUILD}/emojis`)
  planEmojis(manifest.emojis, emojis).create.forEach(e => drift.push(`missing emoji: ${e.name}`))

  const hooks = await get(`/guilds/${GUILD}/webhooks`)
  planWebhooks(manifest.webhooks, hooks).create.forEach(w => drift.push(`missing webhook: ${w.name}`))

  const me = await get('/users/@me')
  const messagesByChannel = {}
  for (const seed of manifest.seeds) {
    const cid = channelId(seed.channel)
    messagesByChannel[seed.channel] = cid ? await get(`/channels/${cid}/messages?limit=50`) : []
  }
  const renderSeed = s => render({ ...s.payload, body: rewriteMentions(s.payload.body, channelId) }, { seedKey: s.key })
  planSeeds(manifest.seeds, messagesByChannel, me.id, renderSeed, normalizeComponents)
    .filter(a => a.action !== 'ok')
    .forEach(a => drift.push(`seed drift: ${a.key} → ${a.action}`))

  if (drift.length) {
    console.error(`DRIFT (${drift.length}):`)
    drift.forEach(d => console.error(`  ✗ ${d}`))
    process.exit(1)
  }
  console.log('✓ live state matches manifest')
}

main().catch(e => { console.error(e.message); process.exit(1) })
