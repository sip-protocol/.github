#!/usr/bin/env node
// discord/setup.js — reconcile manifest.json → live Discord guild. Idempotent.
// Usage: node setup.js [--plan]   Env: DISCORD_BOT_TOKEN, DISCORD_GUILD_ID
'use strict'

const fs = require('fs')
const path = require('path')
const { planRoles, planCategories, planChannels, buildOverwrites, planAutomod, rewriteMentions } = require('./lib.js')
const { makeApi, requireEnv } = require('./api.js')
const { TOKEN, GUILD } = requireEnv()
const DRY = process.argv.includes('--plan')
const api = makeApi(TOKEN, 'SIP discord/setup.js')

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'))
  const warnings = []
  const log = (...a) => console.log(...a)

  // ---- read live state
  const guild = await api('GET', `/guilds/${GUILD}`)
  let roles = await api('GET', `/guilds/${GUILD}/roles`)
  let channels = await api('GET', `/guilds/${GUILD}/channels`)
  const automodLive = await api('GET', `/guilds/${GUILD}/auto-moderation/rules`)
  log(`Guild: ${guild.name} (${GUILD}) — ${channels.length} channels, ${roles.length} roles live`)

  const roleId = name => roles.find(r => r.name === name && !r.managed)?.id
  const channelId = name => channels.find(c => c.name === name && c.type !== 4)?.id
  const categoryId = name => channels.find(c => c.name === name && c.type === 4)?.id

  // ---- compute plan
  const pRoles = planRoles(manifest.roles, roles)
  const pCats = planCategories(manifest.categories, channels)
  const pChans = planChannels(manifest.categories, channels, roleId)
  const ids = { guildId: GUILD, roleId, channelId }
  const pAuto = planAutomod(manifest.automod, automodLive, { channelId, roleId })
  const everyoneLive = roles.find(r => r.id === GUILD)
  const needEveryone = everyoneLive.permissions !== manifest.guild.everyone_permissions

  log(`\nPLAN: roles +${pRoles.create.length}/~${pRoles.update.length} · categories +${pCats.create.length} · channels +${pChans.create.length}/~${pChans.update.length} · automod +${pAuto.create.length} · @everyone perms ${needEveryone ? 'PATCH' : 'ok'}`)
  pRoles.create.forEach(r => log(`  + role ${r.name}`))
  pCats.create.forEach(c => log(`  + category ${c.name}`))
  pChans.create.forEach(c => log(`  + channel #${c.spec.name} (${c.category})`))
  pChans.update.forEach(c => log(`  ~ channel #${c.name} ${JSON.stringify(c.patch)}`))
  pAuto.create.forEach(r => log(`  + automod ${r.name}`))
  if (DRY) { log('\n--plan: no changes applied.'); return }

  // ---- 1. @everyone base permissions
  if (needEveryone) {
    await api('PATCH', `/guilds/${GUILD}/roles/${GUILD}`, { permissions: manifest.guild.everyone_permissions })
    log('✓ @everyone base permissions')
  }

  // ---- 2. roles (then refresh)
  for (const r of pRoles.create) { await api('POST', `/guilds/${GUILD}/roles`, r); log(`✓ role ${r.name}`) }
  for (const u of pRoles.update) { await api('PATCH', `/guilds/${GUILD}/roles/${u.id}`, u.patch); log(`✓ role ~${u.name}`) }
  roles = await api('GET', `/guilds/${GUILD}/roles`)
  // NOTE: the bot's own managed role (SIPHER) cannot be edited via API (403 50013) — cosmetic color stays default.

  // ---- 3. categories (then refresh)
  for (const c of pCats.create) { await api('POST', `/guilds/${GUILD}/channels`, { name: c.name, type: 4, position: c.position }); log(`✓ category ${c.name}`) }
  channels = await api('GET', `/guilds/${GUILD}/channels`)

  // ---- 4. channels (create as type 0; announcement upgrade happens post-COMMUNITY)
  for (const c of planChannels(manifest.categories, channels, roleId).create) {
    const payload = {
      name: c.spec.name,
      type: 0,
      topic: c.spec.topic,
      parent_id: categoryId(c.category),
      permission_overwrites: buildOverwrites(c.overwrites, ids),
    }
    await api('POST', `/guilds/${GUILD}/channels`, payload)
    log(`✓ channel #${c.spec.name}`)
  }
  channels = await api('GET', `/guilds/${GUILD}/channels`)

  // ---- 4b. category-level overwrites (the category channel itself; children created with
  //          parent_id inherit the category permissions in the client)
  for (const cat of manifest.categories) {
    if (!cat.overwrites) continue
    const id = categoryId(cat.name)
    for (const ow of buildOverwrites(cat.overwrites, ids)) {
      await api('PUT', `/channels/${id}/permissions/${ow.id}`, { type: ow.type, allow: ow.allow, deny: ow.deny })
    }
    log(`✓ overwrites on category ${cat.name}`)
  }

  // ---- 5. guild settings
  await api('PATCH', `/guilds/${GUILD}`, {
    verification_level: manifest.guild.verification_level,
    default_message_notifications: manifest.guild.default_message_notifications,
    explicit_content_filter: manifest.guild.explicit_content_filter,
  })
  log('✓ guild settings (verification, notifications, content filter)')

  // ---- 6. COMMUNITY
  if (!guild.features.includes('COMMUNITY')) {
    try {
      await api('PATCH', `/guilds/${GUILD}`, {
        features: [...guild.features, 'COMMUNITY'],
        rules_channel_id: channelId(manifest.guild.rules_channel),
        public_updates_channel_id: channelId(manifest.guild.public_updates_channel),
      })
      log('✓ COMMUNITY enabled')
    } catch (e) {
      console.error(`COMMUNITY enable failed (${e.message}).\nFallback: toggle Server Settings → Enable Community in the UI, then re-run setup.js.`)
      process.exit(2)
    }
  }

  // ---- 7. drifted channels (announcements → type 5, topics, parents)
  for (const u of planChannels(manifest.categories, channels, roleId).update) {
    await api('PATCH', `/channels/${u.id}`, u.patch)
    log(`✓ channel ~#${u.name} ${JSON.stringify(u.patch)}`)
  }

  // ---- 8. icon
  if (!guild.icon) {
    const png = fs.readFileSync(path.join(__dirname, manifest.guild.icon_file))
    await api('PATCH', `/guilds/${GUILD}`, { icon: `data:image/png;base64,${png.toString('base64')}` })
    log('✓ icon uploaded')
  }

  // ---- 8b. bot avatar (the bot user's own profile picture, same logo)
  const me = await api('GET', '/users/@me')
  if (!me.avatar) {
    const png = fs.readFileSync(path.join(__dirname, manifest.guild.icon_file))
    await api('PATCH', '/users/@me', { avatar: `data:image/png;base64,${png.toString('base64')}` })
    log('✓ bot avatar set')
  }

  // ---- 9. automod
  for (const r of planAutomod(manifest.automod, automodLive, { channelId, roleId }).create) {
    try {
      await api('POST', `/guilds/${GUILD}/auto-moderation/rules`, r)
      log(`✓ automod ${r.name}`)
    } catch (e) {
      warnings.push(`automod ${r.name}: ${e.message}`)
    }
  }

  // ---- 10. welcome screen
  try {
    await api('PATCH', `/guilds/${GUILD}/welcome-screen`, {
      enabled: true,
      description: manifest.welcome_screen.description,
      welcome_channels: manifest.welcome_screen.channels.map(w => ({
        channel_id: channelId(w.channel), description: w.description, emoji_name: w.emoji,
      })),
    })
    log('✓ welcome screen')
  } catch (e) {
    warnings.push(`welcome screen: ${e.message}`)
  }

  // ---- 11. onboarding
  try {
    await api('PUT', `/guilds/${GUILD}/onboarding`, {
      prompts: [{
        id: '0', type: 0, title: manifest.onboarding.prompt.title,
        single_select: true, required: true, in_onboarding: true,
        options: manifest.onboarding.prompt.options.map(o => ({
          title: o.title, description: o.description, emoji_name: o.emoji,
          role_ids: o.roles.map(roleId), channel_ids: o.channels.map(channelId),
        })),
      }],
      default_channel_ids: manifest.onboarding.default_channels.map(channelId),
      enabled: true, mode: 0,
    })
    log('✓ onboarding')
  } catch (e) {
    warnings.push(`onboarding: ${e.message}`)
  }

  // ---- 12. cleanup Discord-default cruft (scoped, exact-name, voice/empty-category only)
  for (const name of manifest.cleanup_defaults.delete_voice_channels) {
    const v = channels.find(c => c.type === 2 && c.name === name)
    if (v) { await api('DELETE', `/channels/${v.id}`); log(`✓ deleted default voice #${name}`) }
  }
  channels = await api('GET', `/guilds/${GUILD}/channels`)
  for (const name of manifest.cleanup_defaults.delete_empty_categories) {
    const cat = channels.find(c => c.type === 4 && c.name === name)
    if (cat && !channels.some(c => c.parent_id === cat.id)) {
      await api('DELETE', `/channels/${cat.id}`)
      log(`✓ deleted empty default category ${name}`)
    }
  }

  // ---- 13. seed messages (only into empty channels) + pins
  for (const seed of manifest.seeds) {
    const id = channelId(seed.channel)
    const existing = await api('GET', `/channels/${id}/messages?limit=1`)
    if (existing.length) { log(`· #${seed.channel} already has messages, skipping seed`); continue }
    const msg = await api('POST', `/channels/${id}/messages`, { content: rewriteMentions(seed.content, channelId) })
    if (seed.pin) await api('PUT', `/channels/${id}/pins/${msg.id}`)
    log(`✓ seeded #${seed.channel}${seed.pin ? ' (pinned)' : ''}`)
  }

  // ---- 14. permanent invite (reuse if one already exists)
  const invites = await api('GET', `/guilds/${GUILD}/invites`)
  let invite = invites.find(i => i.max_age === 0 && i.channel?.id === channelId(manifest.invite.channel))
  if (!invite) invite = await api('POST', `/channels/${channelId(manifest.invite.channel)}/invites`, { max_age: 0, max_uses: 0, unique: true })
  log(`\n✦ INVITE: https://discord.gg/${invite.code}`)

  if (warnings.length) {
    console.error(`\nCompleted with ${warnings.length} warning(s):`)
    warnings.forEach(w => console.error(`  ⚠ ${w}`))
    process.exit(2)
  }
  log('\nDone. Run verify.js to confirm drift-free.')
}

main().catch(e => { console.error(e.message); process.exit(1) })
