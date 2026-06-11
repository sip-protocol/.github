#!/usr/bin/env node
// discord/verify.js — GET-only: report drift between manifest and live guild. Exit 1 on drift.
'use strict'

const fs = require('fs')
const path = require('path')
const { planRoles, planCategories, planChannels, planAutomod } = require('./lib.js')
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

  if (drift.length) {
    console.error(`DRIFT (${drift.length}):`)
    drift.forEach(d => console.error(`  ✗ ${d}`))
    process.exit(1)
  }
  console.log('✓ live state matches manifest')
}

main().catch(e => { console.error(e.message); process.exit(1) })
