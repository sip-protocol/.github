import { test } from 'node:test'
import assert from 'node:assert'
import { buildModal, buildIntroCard, ephemeral } from '../src/render-intro.js'

test('buildModal returns a type-9 modal with 4 text inputs', () => {
  const m = buildModal()
  assert.strictEqual(m.type, 9)
  assert.strictEqual(m.data.custom_id, 'sip_intro_modal')
  assert.ok(m.data.title.length <= 45)
  assert.strictEqual(m.data.components.length, 4)
  const handle = m.data.components[0].components[0]
  assert.strictEqual(handle.type, 4)
  assert.strictEqual(handle.custom_id, 'handle')
  assert.strictEqual(handle.style, 1)
  assert.strictEqual(handle.required, true)
  const building = m.data.components[3].components[0]
  assert.strictEqual(building.required, false)
})

test('buildIntroCard returns a public type-4 CV2 card pinging only the joiner', () => {
  const c = buildIntroCard({ handle: 'satoshi', who: 'a builder', why: 'privacy', building: '' }, '123')
  assert.strictEqual(c.type, 4)
  assert.strictEqual(c.data.flags, 1 << 15)
  assert.deepStrictEqual(c.data.allowed_mentions, { parse: [], users: ['123'] })
  assert.strictEqual(c.data.components[0].type, 17)
  const txt = JSON.stringify(c.data.components)
  assert.ok(txt.includes('satoshi'))
  assert.ok(!txt.includes('**Building:**')) // omitted when empty
})

test('buildIntroCard includes Building when present', () => {
  const c = buildIntroCard({ handle: 'a', who: 'b', why: 'c', building: 'a privacy wallet' }, '1')
  assert.ok(JSON.stringify(c.data.components).includes('a privacy wallet'))
})

test('ephemeral returns a flag-64 text reply', () => {
  const e = ephemeral('nope')
  assert.strictEqual(e.type, 4)
  assert.strictEqual(e.data.flags, 1 << 6)
  assert.strictEqual(e.data.content, 'nope')
})
