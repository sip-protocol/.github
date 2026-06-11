// discord/lib.js — pure planning logic, no I/O.
// Computes what setup.js must create/update to move live guild state toward manifest.json.
'use strict'

const byName = arr => new Map(arr.map(x => [x.name, x]))

function planRoles(wanted, live) {
  const liveBy = byName(live.filter(r => !r.managed))
  const create = []
  const update = []
  for (const r of wanted) {
    const cur = liveBy.get(r.name)
    if (!cur) {
      create.push({ name: r.name, color: r.color, hoist: r.hoist, mentionable: r.mentionable, permissions: r.permissions })
    } else {
      const patch = {}
      if (cur.color !== r.color) patch.color = r.color
      if (cur.hoist !== r.hoist) patch.hoist = r.hoist
      if (Object.keys(patch).length) update.push({ id: cur.id, name: r.name, patch })
    }
  }
  return { create, update }
}

function planCategories(categories, liveChannels) {
  const liveCats = byName(liveChannels.filter(c => c.type === 4))
  const create = categories.filter(c => !liveCats.has(c.name)).map((c, i) => ({ name: c.name, position: i }))
  return { create }
}

function buildOverwrites(overwrites, ids) {
  return (overwrites || []).map(ow => ({
    id: ow.role === '@everyone' ? ids.guildId : ids.roleId(ow.role),
    type: 0,
    allow: ow.allow || '0',
    deny: ow.deny || '0',
  }))
}

function planChannels(categories, liveChannels, roleId) {
  const liveBy = byName(liveChannels.filter(c => c.type !== 4))
  const liveCats = byName(liveChannels.filter(c => c.type === 4))
  const create = []
  const update = []
  for (const cat of categories) {
    for (const ch of cat.channels) {
      const cur = liveBy.get(ch.name)
      if (!cur) {
        create.push({ category: cat.name, spec: ch, overwrites: ch.overwrites || null })
        continue
      }
      const patch = {}
      if (ch.type === 5 && cur.type === 0) patch.type = 5 // announcement upgrade post-COMMUNITY
      if ((cur.topic || '') !== ch.topic) patch.topic = ch.topic
      const wantCat = liveCats.get(cat.name)
      if (wantCat && cur.parent_id !== wantCat.id) patch.parent_id = wantCat.id
      if (Object.keys(patch).length) update.push({ id: cur.id, name: ch.name, patch })
    }
  }
  return { create, update }
}

function planAutomod(rules, liveRules, ids) {
  const liveBy = byName(liveRules)
  const create = []
  for (const r of rules) {
    if (liveBy.has(r.name)) continue
    create.push({
      name: r.name,
      event_type: r.event_type,
      trigger_type: r.trigger_type,
      ...(r.trigger_metadata ? { trigger_metadata: r.trigger_metadata } : {}),
      actions: r.actions.map(a => a.type === 2
        ? { type: 2, metadata: { channel_id: ids.channelId(a.alert_channel) } }
        : { type: 1, ...(a.custom_message ? { metadata: { custom_message: a.custom_message } } : {}) }),
      enabled: true,
      exempt_channels: (r.exempt_channels || []).map(ids.channelId),
      exempt_roles: (r.exempt_roles || []).map(ids.roleId),
    })
  }
  return { create }
}

function rewriteMentions(content, channelId) {
  return content.replace(/<#([a-z0-9-]+)>/g, (m, name) => {
    const id = channelId(name)
    return id ? `<#${id}>` : m
  })
}

function planEmojis(wanted, live) {
  const liveBy = byName(live)
  return { create: wanted.filter(e => !liveBy.has(e.name)) }
}

function planWebhooks(wanted, live) {
  const liveBy = byName(live)
  return { create: wanted.filter(w => !liveBy.has(w.name)) }
}

// Seeds are reconciled managed messages. Match: bot-authored message whose components
// JSON contains the `seed:<key>` footer marker; fallback (one-time migration of
// pre-marker seeds): the OLDEST bot-authored message in the channel (Discord returns
// newest-first). normalizeComponents comparison decides ok vs patch.
// NOTE: each seed must use a DISTINCT channel — two unmigrated seeds sharing a channel
// would both fall back to the same oldest message during legacy migration.
function planSeeds(seeds, messagesByChannel, botUserId, renderSeed, normalize) {
  const norm = normalize || require('./templates.js').normalizeComponents
  return seeds.map(seed => {
    const msgs = messagesByChannel[seed.channel] || []
    const mine = msgs.filter(m => m.author?.id === botUserId)
    // newest-first: if multiple marked messages exist, target the newest (the current post).
    // The trailing JSON-quote makes the key match exact (seed:rules ≠ seed:rulesv2).
    const marked = mine.find(m => JSON.stringify(m.components || []).includes(`seed:${seed.key}"`))
    const target = marked || (mine.length ? mine[mine.length - 1] : null)
    if (!target) return { key: seed.key, channel: seed.channel, action: 'post' }
    const want = norm(renderSeed(seed).components)
    const have = norm(target.components || [])
    if (JSON.stringify(want) === JSON.stringify(have)) return { key: seed.key, channel: seed.channel, action: 'ok', targetId: target.id }
    return { key: seed.key, channel: seed.channel, action: 'patch', targetId: target.id, pinned: !!target.pinned }
  })
}

module.exports = { planRoles, planCategories, planChannels, buildOverwrites, planAutomod, rewriteMentions, planEmojis, planWebhooks, planSeeds }
