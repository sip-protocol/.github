// Unit tests for the pure planning library. Run: node --test discord/test/
const { test } = require('node:test')
const assert = require('node:assert/strict')
const {
  planRoles, planCategories, planChannels, buildOverwrites, planAutomod, rewriteMentions,
} = require('../lib.js')

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
