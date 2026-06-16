import { test } from 'node:test'
import assert from 'node:assert'
import { grantRole, logModlog, postMessage } from '../src/discord.js'

const env = { DISCORD_GUILD_ID: 'G', DISCORD_BOT_TOKEN: 'tok', DISCORD_MODLOG_WEBHOOK_URL: 'https://hook' }

test('grantRole PUTs the member-role route with the bot token', async () => {
  const calls = []
  globalThis.fetch = async (url, opts) => { calls.push({ url, opts }); return { ok: true, status: 204 } }
  const r = await grantRole(env, 'U', 'R')
  assert.strictEqual(r.ok, true)
  assert.strictEqual(calls[0].url, 'https://discord.com/api/v10/guilds/G/members/U/roles/R')
  assert.strictEqual(calls[0].opts.method, 'PUT')
  assert.match(calls[0].opts.headers.Authorization, /^Bot tok$/)
})

test('grantRole reports failure status', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 403 })
  const r = await grantRole(env, 'U', 'R')
  assert.deepStrictEqual(r, { ok: false, status: 403 })
})

test('logModlog posts to the webhook and never throws', async () => {
  let body
  globalThis.fetch = async (url, opts) => { body = JSON.parse(opts.body); return { ok: true } }
  await logModlog(env, 'hello')
  assert.strictEqual(body.content, 'hello')
  assert.deepStrictEqual(body.allowed_mentions, { parse: [] })
})

test('logModlog is a no-op without a webhook url', async () => {
  globalThis.fetch = async () => { throw new Error('should not be called') }
  await logModlog({ ...env, DISCORD_MODLOG_WEBHOOK_URL: undefined }, 'x') // must not throw
})

test('grantRole returns { ok:false, status:0 } when fetch throws', async () => {
  globalThis.fetch = async () => { throw new Error('network down') }
  const r = await grantRole(env, 'U', 'R')
  assert.deepStrictEqual(r, { ok: false, status: 0 })
})

test('postMessage POSTs to the channel-messages route with the bot token', async () => {
  let call
  globalThis.fetch = async (url, opts) => { call = { url, opts }; return { ok: true, status: 200 } }
  const r = await postMessage(env, 'C', { content: 'hi' })
  assert.strictEqual(r.ok, true)
  assert.strictEqual(call.url, 'https://discord.com/api/v10/channels/C/messages')
  assert.strictEqual(call.opts.method, 'POST')
  assert.match(call.opts.headers.Authorization, /^Bot tok$/)
})

test('postMessage never throws on a network error', async () => {
  globalThis.fetch = async () => { throw new Error('down') }
  assert.deepStrictEqual(await postMessage(env, 'C', {}), { ok: false, status: 0 })
})
