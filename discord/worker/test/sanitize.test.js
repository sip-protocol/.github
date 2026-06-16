import { test } from 'node:test'
import assert from 'node:assert'
import { validateAndSanitize } from '../src/sanitize.js'

const good = { handle: 'satoshi', who: 'A privacy researcher from Jakarta', why: 'I care about on-chain privacy a lot', building: '' }

test('accepts a valid intro', () => {
  const r = validateAndSanitize(good)
  assert.strictEqual(r.ok, true)
  assert.strictEqual(r.fields.handle, 'satoshi')
})

test('rejects a missing required field', () => {
  const r = validateAndSanitize({ ...good, why: '   ' })
  assert.strictEqual(r.ok, false)
  assert.match(r.reason, /Why SIP/)
})

test('rejects too-short input', () => {
  const r = validateAndSanitize({ ...good, who: 'hi' })
  assert.strictEqual(r.ok, false)
  assert.match(r.reason, /too short/)
})

test('rejects URLs in any field', () => {
  for (const bad of ['visit https://evil.link', 'join discord.gg/x', 'go to evil.xyz now', 'www.evil.com']) {
    const r = validateAndSanitize({ ...good, why: `I am here because ${bad} ok` })
    assert.strictEqual(r.ok, false, bad)
    assert.match(r.reason, /[Ll]inks/)
  }
})

test('rejects drainer phrases', () => {
  const r = validateAndSanitize({ ...good, who: 'I am here to claim your airdrop friend' })
  assert.strictEqual(r.ok, false)
  assert.match(r.reason, /AutoMod/)
})

test('escapes markdown + mention tokens', () => {
  const r = validateAndSanitize({ ...good, who: 'I am @everyone and **admin** of #general here ok' })
  assert.strictEqual(r.ok, true)
  assert.ok(!r.fields.who.includes('@everyone'))
  assert.ok(r.fields.who.includes('\\*\\*'))
})

test('optional building may be empty', () => {
  const r = validateAndSanitize({ ...good, building: '' })
  assert.strictEqual(r.ok, true)
  assert.strictEqual(r.fields.building, '')
})
