import { test } from 'node:test'
import assert from 'node:assert'
import { handleInteraction } from '../src/index.js'
import worker from '../src/index.js'

const env = { COMMUNITY_ROLE_ID: 'R', DISCORD_GUILD_ID: 'G' }
const modalSubmit = (fields, roles = []) => ({
  type: 5,
  data: { custom_id: 'sip_intro_modal', components: Object.entries(fields).map(([custom_id, value]) => ({ components: [{ custom_id, value }] })) },
  member: { user: { id: 'U' }, roles },
})
const goodFields = { handle: 'satoshi', who: 'a privacy researcher here', why: 'I care about on-chain privacy' }

test('PING → PONG', async () => {
  assert.deepStrictEqual(await handleInteraction({ type: 1 }, env), { type: 1 })
})

test('intro button → modal', async () => {
  const r = await handleInteraction({ type: 3, data: { custom_id: 'sip_intro' } }, env)
  assert.strictEqual(r.type, 9)
})

test('valid modal submit grants role and returns the intro card', async () => {
  const calls = []
  const deps = { grantRole: async (...a) => { calls.push(a); return { ok: true, status: 204 } }, logModlog: async () => {} }
  const r = await handleInteraction(modalSubmit(goodFields), env, deps)
  assert.strictEqual(r.type, 4)
  assert.strictEqual(r.data.flags, 1 << 15) // public CV2 card
  assert.deepStrictEqual(calls[0], [env, 'U', 'R'])
})

test('already-Community submit is a no-op (ephemeral, no grant)', async () => {
  let granted = false
  const deps = { grantRole: async () => { granted = true; return { ok: true, status: 204 } }, logModlog: async () => {} }
  const r = await handleInteraction(modalSubmit(goodFields, ['R']), env, deps)
  assert.strictEqual(r.data.flags, 1 << 6) // ephemeral
  assert.strictEqual(granted, false)
})

test('invalid input → ephemeral error, no grant', async () => {
  let granted = false
  const deps = { grantRole: async () => { granted = true; return { ok: true, status: 204 } }, logModlog: async () => {} }
  const r = await handleInteraction(modalSubmit({ ...goodFields, why: 'go to evil.xyz' }), env, deps)
  assert.strictEqual(r.data.flags, 1 << 6)
  assert.match(r.data.content, /Links/)
  assert.strictEqual(granted, false)
})

test('grant failure → ephemeral error + modlog', async () => {
  let logged = false
  const deps = { grantRole: async () => ({ ok: false, status: 403 }), logModlog: async () => { logged = true } }
  const r = await handleInteraction(modalSubmit(goodFields), env, deps)
  assert.strictEqual(r.data.flags, 1 << 6)
  assert.match(r.data.content, /ping a moderator/)
  assert.strictEqual(logged, true)
})

const makeReq = (method, headers = {}, body = '{"type":1}') =>
  new Request('https://worker.test', { method, headers, body: method === 'GET' ? undefined : body })

test('fetch rejects non-POST with 405', async () => {
  const res = await worker.fetch(makeReq('GET'), {})
  assert.strictEqual(res.status, 405)
})

test('fetch rejects missing signature headers with 401', async () => {
  const res = await worker.fetch(makeReq('POST'), {})
  assert.strictEqual(res.status, 401)
})

test('fetch rejects an invalid signature with 401', async () => {
  const headers = { 'X-Signature-Ed25519': '00', 'X-Signature-Timestamp': '0' }
  const res = await worker.fetch(makeReq('POST', headers), { DISCORD_PUBLIC_KEY: 'deadbeef' })
  assert.strictEqual(res.status, 401)
})
