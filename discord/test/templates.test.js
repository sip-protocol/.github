// Tests for the pure CV2 template renderer. Run: node --test discord/test/
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { TYPES, FLAG_COMPONENTS_V2, validatePayload, render, normalizeComponents } = require('../templates.js')

const base = { type: 'announcement', channel: 'announcements', title: 'Hello', body: 'World **bold**' }

test('TYPES defines the 5 spec types with accent colors', () => {
  assert.deepEqual(Object.keys(TYPES).sort(), ['announcement', 'bounty', 'digest', 'release', 'security'])
  assert.equal(TYPES.announcement.accent, 0x8b5cf6)
  assert.equal(TYPES.release.accent, 0x10b981)
  assert.equal(TYPES.bounty.accent, 0xf59e0b)
  assert.equal(TYPES.security.accent, 0xef4444)
  assert.equal(TYPES.digest.accent, 0x6366f1)
})

test('validatePayload: accepts a minimal announcement', () => {
  assert.deepEqual(validatePayload(base).errors, [])
})

test('validatePayload: rejects unknown type, missing fields, bad channel chars', () => {
  assert.match(validatePayload({ ...base, type: 'nope' }).errors[0], /type must be one of/)
  assert.match(validatePayload({ type: 'release', channel: 'announcements' }).errors[0], /title is required/)
  assert.match(validatePayload({ ...base, channel: 'No Spaces' }).errors[0], /channel/)
})

test('validatePayload: banner must be on cdn.sip-protocol.org over https', () => {
  assert.deepEqual(validatePayload({ ...base, banner: 'https://cdn.sip-protocol.org/discord/x.v1.png' }).errors, [])
  assert.match(validatePayload({ ...base, banner: 'https://evil.com/x.png' }).errors[0], /cdn\.sip-protocol\.org/)
  assert.match(validatePayload({ ...base, banner: 'http://cdn.sip-protocol.org/x.png' }).errors[0], /https/)
})

test('validatePayload: security forbids banner and cardImages', () => {
  const p = { type: 'security', channel: 'announcements', title: 'Advisory', body: 'Upgrade now', banner: 'https://cdn.sip-protocol.org/d/x.png' }
  assert.match(validatePayload(p).errors[0], /security posts are undecorated/)
})

test('validatePayload: bounty requires cells or cardImages', () => {
  assert.match(validatePayload({ type: 'bounty', channel: 'bounties', title: 'B', body: 'b' }).errors[0], /bounty requires/)
  assert.deepEqual(validatePayload({ type: 'bounty', channel: 'bounties', title: 'B', body: 'b', cells: [{ name: 'X', value: '$1' }] }).errors, [])
})

test('validatePayload: button URLs allowlisted by host (github.com restricted to /sip-protocol)', () => {
  const ok = { ...base, buttons: [{ label: 'Docs', url: 'https://docs.sip-protocol.org' }, { label: 'Repo', url: 'https://github.com/sip-protocol/sip-protocol' }] }
  assert.deepEqual(validatePayload(ok).errors, [])
  assert.match(validatePayload({ ...base, buttons: [{ label: 'X', url: 'https://github.com/evil/repo' }] }).errors[0], /allowlist/)
  assert.match(validatePayload({ ...base, buttons: [{ label: 'X', url: 'https://rando.xyz' }] }).errors[0], /allowlist/)
})

test('validatePayload: enforces limits (body ≤3800, ≤5 buttons, ≤8 cells)', () => {
  assert.match(validatePayload({ ...base, body: 'x'.repeat(3801) }).errors[0], /body exceeds/)
  assert.match(validatePayload({ ...base, buttons: Array(6).fill({ label: 'b', url: 'https://sip-protocol.org' }) }).errors[0], /buttons/)
  const cells = Array(9).fill({ name: 'n', value: 'v' })
  assert.match(validatePayload({ type: 'bounty', channel: 'bounties', title: 'B', body: 'b', cells }).errors[0], /cells/)
})

test('render: announcement anatomy — container, accent, title, body, footer', () => {
  const msg = render(base)
  assert.equal(msg.flags, FLAG_COMPONENTS_V2)
  assert.equal(msg.components.length, 1)
  const c = msg.components[0]
  assert.equal(c.type, 17)
  assert.equal(c.accent_color, 0x8b5cf6)
  const texts = c.components.filter(x => x.type === 10).map(x => x.content)
  assert.equal(texts[0], '### Hello')
  assert.equal(texts[1], 'World **bold**')
  assert.match(texts.at(-1), /^-# SIP Protocol · \[sip-protocol\.org\]/)
})

test('render: banner becomes a leading media gallery; buttons become a link-button row', () => {
  const msg = render({ ...base, banner: 'https://cdn.sip-protocol.org/discord/w.v1.png', buttons: [{ label: 'Docs', url: 'https://docs.sip-protocol.org' }] })
  const c = msg.components[0]
  assert.equal(c.components[0].type, 12)
  assert.equal(c.components[0].items[0].media.url, 'https://cdn.sip-protocol.org/discord/w.v1.png')
  const row = c.components.find(x => x.type === 1)
  assert.deepEqual(row.components[0], { type: 2, style: 5, label: 'Docs', url: 'https://docs.sip-protocol.org' })
})

test('render: cells become stacked bold lines; cardImages become a gallery after the separator', () => {
  const withCells = render({ type: 'bounty', channel: 'bounties', title: 'B', body: 'b', cells: [{ name: '🧵 Thread', value: '$1,000', note: 'best thread wins' }] })
  const cellText = withCells.components[0].components.filter(x => x.type === 10).map(x => x.content)
  assert.ok(cellText.some(t => t.includes('**🧵 Thread** — $1,000 — best thread wins')))
  const withCards = render({ type: 'bounty', channel: 'bounties', title: 'B', body: 'b', cardImages: ['https://cdn.sip-protocol.org/discord/c1.v1.png', 'https://cdn.sip-protocol.org/discord/c2.v1.png'] })
  const galleries = withCards.components[0].components.filter(x => x.type === 12)
  assert.equal(galleries.length, 1)
  assert.equal(galleries[0].items.length, 2)
})

test('render: seedKey lands in the footer marker', () => {
  const msg = render(base, { seedKey: 'rules' })
  const footer = msg.components[0].components.at(-1)
  assert.match(footer.content, / · seed:rules$/)
})

test('render: throws on invalid payload', () => {
  assert.throws(() => render({ type: 'nope' }), /type must be one of/)
})

test('normalizeComponents: strips Discord-added ids/proxy fields so live vs rendered compare equal', () => {
  const rendered = render(base, { seedKey: 'k' }).components
  const live = JSON.parse(JSON.stringify(rendered))
  live[0].id = 7
  live[0].components.forEach((c, i) => { c.id = i + 10 })
  assert.deepEqual(normalizeComponents(live), normalizeComponents(rendered))
})

test('normalizeComponents: detects real content drift', () => {
  const a = render(base).components
  const b = render({ ...base, body: 'changed' }).components
  assert.notDeepEqual(normalizeComponents(a), normalizeComponents(b))
})

// Fix 1: non-array truthy values must not crash, must produce errors
test('validatePayload: non-array cells/buttons/cardImages produce errors, never throw', () => {
  assert.match(validatePayload({ ...base, cells: {} }).errors[0], /cells must be an array/)
  assert.match(validatePayload({ ...base, buttons: 'nope' }).errors[0], /buttons must be an array/)
  assert.match(validatePayload({ ...base, cardImages: 42 }).errors[0], /cardImages must be an array/)
})

// Fix 2: github.com allowlist must reject path-prefix spoofs
test('validatePayload: github.com path boundary blocks sip-protocolevil prefix', () => {
  assert.match(validatePayload({ ...base, buttons: [{ label: 'X', url: 'https://github.com/sip-protocolevil/repo' }] }).errors[0], /allowlist/)
  assert.deepEqual(validatePayload({ ...base, buttons: [{ label: 'Org', url: 'https://github.com/sip-protocol' }] }).errors, [])
})

// Fix 4: all 5 accent colors + note-less cell
test('render: each type gets its correct accent color', () => {
  for (const type of Object.keys(TYPES)) {
    const p = type === 'bounty'
      ? { type, channel: 'bounties', title: 'T', body: 'B', cells: [{ name: 'n', value: 'v' }] }
      : { type, channel: 'announcements', title: 'T', body: 'B' }
    assert.equal(render(p).components[0].accent_color, TYPES[type].accent, type)
  }
})

test('render: cell without note renders name — value only', () => {
  const msg = render({ type: 'bounty', channel: 'bounties', title: 'B', body: 'b', cells: [{ name: 'X', value: '$1' }] })
  const texts = msg.components[0].components.filter(x => x.type === 10).map(x => x.content)
  assert.ok(texts.some(t => t === '**X** — $1'))
})

test('validatePayload accepts an interactive (custom_id) button', () => {
  const p = { type: 'announcement', channel: 'introductions', title: 'Hi', body: 'x'.repeat(20),
    buttons: [{ label: 'Introduce yourself', custom_id: 'sip_intro' }] }
  assert.deepStrictEqual(validatePayload(p).errors, [])
})

test('validatePayload rejects a bad custom_id', () => {
  const p = { type: 'announcement', channel: 'introductions', title: 'Hi', body: 'x'.repeat(20),
    buttons: [{ label: 'Go', custom_id: 'Bad ID!' }] }
  assert.ok(validatePayload(p).errors.some(e => e.includes('custom_id')))
})

test('validatePayload rejects a button with both url and custom_id', () => {
  const p = { type: 'announcement', channel: 'introductions', title: 'Hi', body: 'x'.repeat(20),
    buttons: [{ label: 'Go', custom_id: 'sip_intro', url: 'https://sip-protocol.org' }] }
  assert.ok(validatePayload(p).errors.some(e => e.includes('both')))
})

test('render emits a primary custom_id button', () => {
  const p = { type: 'announcement', channel: 'introductions', title: 'Hi', body: 'x'.repeat(20),
    buttons: [{ label: 'Introduce yourself', custom_id: 'sip_intro' }] }
  const row = render(p).components[0].components.find(c => c.type === 1)
  assert.deepStrictEqual(row.components[0], { type: 2, style: 1, label: 'Introduce yourself', custom_id: 'sip_intro' })
})

test('normalizeComponents preserves custom_id', () => {
  const norm = normalizeComponents([{ type: 2, style: 1, label: 'x', custom_id: 'sip_intro' }])
  assert.strictEqual(norm[0].custom_id, 'sip_intro')
})
