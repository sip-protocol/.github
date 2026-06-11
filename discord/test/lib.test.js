// Unit tests for the pure planning library. Run: node --test discord/test/
const { test } = require('node:test')
const assert = require('node:assert/strict')
const {
  planRoles, planCategories, planChannels, buildOverwrites, planAutomod, rewriteMentions,
  planEmojis, planWebhooks, planSeeds,
} = require('../lib.js')
const { render, normalizeComponents } = require('../templates.js')

const manifest = JSON.parse(require('fs').readFileSync(`${__dirname}/../manifest.json`, 'utf8'))
const GUILD_ID = '999000'

function liveFromManifest() {
  // Synthesize a live state that exactly matches the manifest (for idempotency tests)
  const roles = manifest.roles.map((r, i) => ({ id: `r${i}`, name: r.name, color: r.color, hoist: r.hoist, managed: false, permissions: r.permissions }))
  const channels = []
  let cid = 0
  for (const cat of manifest.categories) {
    const catId = `cat${cid++}`
    channels.push({ id: catId, type: 4, name: cat.name, parent_id: null })
    for (const ch of cat.channels) {
      channels.push({ id: `ch${cid++}`, type: ch.type, name: ch.name, topic: ch.topic, parent_id: catId })
    }
  }
  return { roles, channels }
}

test('planRoles creates all roles on empty live, none on matching live', () => {
  const empty = planRoles(manifest.roles, [])
  assert.equal(empty.create.length, 4)
  const live = liveFromManifest()
  const full = planRoles(manifest.roles, live.roles)
  assert.equal(full.create.length, 0)
  assert.equal(full.update.length, 0)
})

test('planRoles updates color drift', () => {
  const live = liveFromManifest()
  live.roles[0].color = 0
  const plan = planRoles(manifest.roles, live.roles)
  assert.equal(plan.update.length, 1)
  assert.equal(plan.update[0].patch.color, manifest.roles[0].color)
})

test('planCategories + planChannels create everything on empty live', () => {
  const cats = planCategories(manifest.categories, [])
  assert.equal(cats.create.length, 5)
  const chans = planChannels(manifest.categories, [], () => null)
  assert.equal(chans.create.length, 10)
})

test('planChannels is empty on manifest-shaped live (idempotency)', () => {
  const live = liveFromManifest()
  const chans = planChannels(manifest.categories, live.channels, name => live.roles.find(r => r.name === name)?.id)
  assert.equal(chans.create.length, 0)
  assert.equal(chans.update.length, 0)
})

test('planChannels flags announcements type drift 0→5 as update', () => {
  const live = liveFromManifest()
  const ann = live.channels.find(c => c.name === 'announcements')
  ann.type = 0
  const chans = planChannels(manifest.categories, live.channels, () => null)
  assert.equal(chans.update.length, 1)
  assert.equal(chans.update[0].patch.type, 5)
})

test('buildOverwrites maps @everyone to guild id with exact deny string', () => {
  const ows = buildOverwrites(
    [{ role: '@everyone', deny: '309237647360' }],
    { guildId: GUILD_ID, roleId: () => null }
  )
  assert.deepEqual(ows, [{ id: GUILD_ID, type: 0, allow: '0', deny: '309237647360' }])
})

test('planAutomod resolves alert channel + exempts, creates missing only', () => {
  const ids = { channelId: n => ({ 'mod-log': 'ML1', 'dev-chat': 'DC1', 'bug-reports': 'BR1' })[n], roleId: n => ({ Admin: 'AD1' })[n] }
  const plan = planAutomod(manifest.automod, [], ids)
  assert.equal(plan.create.length, 4)
  const drainer = plan.create.find(r => r.name === 'Wallet-drainer phrases')
  assert.deepEqual(drainer.exempt_channels, ['DC1', 'BR1'])
  assert.deepEqual(drainer.exempt_roles, ['AD1'])
  assert.equal(drainer.actions[1].metadata.channel_id, 'ML1')
  const none = planAutomod(manifest.automod, plan.create.map(r => ({ name: r.name })), ids)
  assert.equal(none.create.length, 0)
})

test('rewriteMentions swaps <#name> for <#id>', () => {
  const out = rewriteMentions('go to <#dev-chat> or <#bounties>', n => ({ 'dev-chat': '111', bounties: '222' })[n])
  assert.equal(out, 'go to <#111> or <#222>')
})

test('planEmojis creates only missing emojis by name', () => {
  const wanted = [{ name: 'sip_shield', file: 'assets/emoji/sip_shield.png' }, { name: 'sip_zk', file: 'assets/emoji/sip_zk.png' }]
  const plan = planEmojis(wanted, [{ name: 'sip_shield', id: '1' }])
  assert.equal(plan.create.length, 1)
  assert.equal(plan.create[0].name, 'sip_zk')
})

test('planWebhooks creates only missing webhooks by name', () => {
  const wanted = [{ name: 'SIP GitHub', channel: 'github-feed' }, { name: 'HERALD', channel: 'announcements' }]
  const plan = planWebhooks(wanted, [{ name: 'HERALD', channel_id: 'x' }])
  assert.equal(plan.create.length, 1)
  assert.equal(plan.create[0].name, 'SIP GitHub')
})

test('planSeeds: post when no marked message, ok when matching, patch on drift', () => {
  const seed = { key: 'rules', channel: 'rules', pin: true, payload: { type: 'announcement', channel: 'rules', title: 'T', body: 'B' } }
  const renderSeed = s => render(s.payload, { seedKey: s.key })
  const BOT = 'bot1'

  // no messages at all → post
  let plan = planSeeds([seed], { rules: [] }, BOT, renderSeed)
  assert.deepEqual(plan[0], { key: 'rules', channel: 'rules', action: 'post' })

  // live message with marker and identical components → ok
  const liveMsg = { id: 'm1', author: { id: BOT }, pinned: true, components: JSON.parse(JSON.stringify(renderSeed(seed).components)) }
  plan = planSeeds([seed], { rules: [liveMsg] }, BOT, renderSeed)
  assert.equal(plan[0].action, 'ok')

  // drifted content → patch targeting the marked message
  const drifted = JSON.parse(JSON.stringify(liveMsg))
  drifted.components[0].components[1].content = 'old text'
  plan = planSeeds([seed], { rules: [drifted] }, BOT, renderSeed)
  assert.equal(plan[0].action, 'patch')
  assert.equal(plan[0].targetId, 'm1')

  // unmarked legacy bot message (plain content) → migrate = patch oldest bot message
  const legacy = { id: 'm0', author: { id: BOT }, pinned: true, content: '**Welcome**', components: [] }
  plan = planSeeds([seed], { rules: [{ id: 'm9', author: { id: 'someone' } }, legacy] }, BOT, renderSeed)
  assert.equal(plan[0].action, 'patch')
  assert.equal(plan[0].targetId, 'm0')

  // non-bot messages only → post fresh
  plan = planSeeds([seed], { rules: [{ id: 'm9', author: { id: 'someone' }, components: [] }] }, BOT, renderSeed)
  assert.equal(plan[0].action, 'post')
})

test('planSeeds: marker match is exact — seed:rules does not match a seed:rulesv2 marker', () => {
  const seed = { key: 'rules', channel: 'rules', pin: true, payload: { type: 'announcement', channel: 'rules', title: 'T', body: 'B' } }
  const renderSeed = s => render(s.payload, { seedKey: s.key })
  const BOT = 'bot1'
  // newest-first: a rulesv2-marked message is NEWER than the true rules-marked one
  const v2Msg = { id: 'mNew', author: { id: BOT }, pinned: false, components: JSON.parse(JSON.stringify(render(seed.payload, { seedKey: 'rulesv2' }).components)) }
  const trueMsg = { id: 'mOld', author: { id: BOT }, pinned: true, components: JSON.parse(JSON.stringify(renderSeed(seed).components)) }
  const plan = planSeeds([seed], { rules: [v2Msg, trueMsg] }, BOT, renderSeed)
  assert.equal(plan[0].action, 'ok')
  assert.equal(plan[0].targetId, 'mOld')
})
