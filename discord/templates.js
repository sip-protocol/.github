// discord/templates.js — pure: SIP post payload → Components V2 message body.
// The format standard from docs/superpowers/specs/2026-06-11-discord-professional-standard-design.md §3.
// No I/O. Component types: 17 container, 12 media gallery, 10 text display, 14 separator, 1 action row, 2 button.
'use strict'

const FLAG_COMPONENTS_V2 = 1 << 15 // 32768 — disables content/embeds; everything is components

// accent/banner consumed here; crosspost + detailRequired consumed by post.js and the seed reconciler
const TYPES = {
  announcement: { accent: 0x8b5cf6, banner: 'optional', crosspost: true },
  release:      { accent: 0x10b981, banner: 'never',    crosspost: true },
  bounty:       { accent: 0xf59e0b, banner: 'optional', crosspost: false, detailRequired: true },
  security:     { accent: 0xef4444, banner: 'never',    crosspost: true },
  digest:       { accent: 0x6366f1, banner: 'never',    crosspost: true },
}

const CDN_HOST = 'cdn.sip-protocol.org'
const BUTTON_HOSTS = new Set([
  'sip-protocol.org', 'app.sip-protocol.org', 'docs.sip-protocol.org', 'blog.sip-protocol.org',
  'cdn.sip-protocol.org', 'npmjs.com', 'www.npmjs.com', 'earn.superteam.fun', 'superteam.fun',
  'x.com', 'discord.gg', 'github.com',
])
const LIMITS = { title: 150, body: 3800, buttons: 5, cells: 8, cardImages: 4 }

function checkUrl(url, { cdnOnly } = {}) {
  let u
  try { u = new URL(url) } catch { return `invalid URL: ${url}` }
  if (u.protocol !== 'https:') return `URL must be https: ${url}`
  if (cdnOnly) {
    if (u.hostname !== CDN_HOST) return `image URLs must be on cdn.sip-protocol.org (got ${u.hostname})`
    return null
  }
  if (!BUTTON_HOSTS.has(u.hostname)) return `button URL host not in allowlist: ${u.hostname}`
  if (u.hostname === 'github.com' && !(u.pathname === '/sip-protocol' || u.pathname.startsWith('/sip-protocol/'))) {
    return `github.com button URLs allowlisted only under /sip-protocol (got ${u.pathname})`
  }
  return null
}

function validatePayload(p) {
  const errors = []
  const t = TYPES[p?.type]
  if (!t) return { errors: [`type must be one of: ${Object.keys(TYPES).join(', ')} (got ${p?.type})`] }
  if (!p.title || typeof p.title !== 'string') errors.push('title is required (string)')
  else if (p.title.length > LIMITS.title) errors.push(`title exceeds ${LIMITS.title} chars`)
  if (!p.body || typeof p.body !== 'string') errors.push('body is required (string)')
  else if (p.body.length > LIMITS.body) errors.push(`body exceeds ${LIMITS.body} chars (Text Display cap is 4000)`)
  if (!p.channel || !/^[a-z0-9-]+$/.test(p.channel)) errors.push(`channel must be a kebab-case channel name (got ${p?.channel})`)

  if (p.cells !== undefined && !Array.isArray(p.cells)) errors.push('cells must be an array')
  if (p.buttons !== undefined && !Array.isArray(p.buttons)) errors.push('buttons must be an array')
  if (p.cardImages !== undefined && !Array.isArray(p.cardImages)) errors.push('cardImages must be an array')

  const cells = Array.isArray(p.cells) ? p.cells : []
  const buttons = Array.isArray(p.buttons) ? p.buttons : []
  const cardImages = Array.isArray(p.cardImages) ? p.cardImages : []

  if (t.banner === 'never' && (p.banner || cardImages.length)) {
    errors.push(`${p.type} posts are undecorated — no banner/cardImages allowed`)
  } else {
    if (p.banner) { const e = checkUrl(p.banner, { cdnOnly: true }); if (e) errors.push(e) }
    for (const img of cardImages) { const e = checkUrl(img, { cdnOnly: true }); if (e) errors.push(e) }
  }
  if (t.detailRequired && !(cells.length || cardImages.length)) {
    errors.push('bounty requires cells or cardImages (the prize block)')
  }
  if (cardImages.length > LIMITS.cardImages) errors.push(`cardImages exceeds ${LIMITS.cardImages}`)
  if (buttons.length > LIMITS.buttons) errors.push(`buttons exceeds ${LIMITS.buttons} (one action row)`)
  for (const b of buttons) {
    if (!b.label) { errors.push('every button needs a label'); continue }
    if (b.custom_id) {
      if (b.url) errors.push('button cannot have both custom_id and url')
      if (!/^[a-z0-9_]+$/.test(b.custom_id)) errors.push(`button custom_id must match ^[a-z0-9_]+$ (got ${b.custom_id})`)
      continue
    }
    if (!b.url) { errors.push('every button needs url or custom_id'); continue }
    const e = checkUrl(b.url); if (e) errors.push(`${e} (allowlist: ${[...BUTTON_HOSTS].join(', ')})`)
  }
  if (cells.length > LIMITS.cells) errors.push(`cells exceeds ${LIMITS.cells}`)
  for (const c of cells) if (!c.name || !c.value) errors.push('every cell needs name + value')
  return { errors }
}

const text = content => ({ type: 10, content })
const sep = () => ({ type: 14, divider: true, spacing: 1 })

function render(p, opts = {}) {
  const { errors } = validatePayload(p)
  if (errors.length) throw new Error(`invalid payload: ${errors.join(' | ')}`)
  const t = TYPES[p.type]
  const inner = []
  if (p.banner) inner.push({ type: 12, items: [{ media: { url: p.banner } }] })
  inner.push(text(`### ${p.title}`))
  inner.push(text(p.body))
  if (p.cells?.length || p.cardImages?.length || p.buttons?.length) inner.push(sep())
  if (p.cells?.length) {
    inner.push(text(p.cells.map(c => `**${c.name}** — ${c.value}${c.note ? ` — ${c.note}` : ''}`).join('\n')))
  }
  if (p.cardImages?.length) {
    inner.push({ type: 12, items: p.cardImages.map(url => ({ media: { url } })) })
  }
  if (p.buttons?.length) {
    inner.push({ type: 1, components: p.buttons.map(b => (
      b.custom_id
        ? { type: 2, style: b.style ?? 1, label: b.label, custom_id: b.custom_id }
        : { type: 2, style: 5, label: b.label, url: b.url }
    )) })
  }
  inner.push(sep())
  const marker = opts.seedKey ? ` · seed:${opts.seedKey}` : ''
  inner.push(text(`-# SIP Protocol · [sip-protocol.org](https://sip-protocol.org)${marker}`))
  return { flags: FLAG_COMPONENTS_V2, components: [{ type: 17, accent_color: t.accent, components: inner }] }
}

// Keep only the fields WE author, so live messages (which gain id/proxy_url/size fields)
// compare equal to fresh renders. Field order is fixed here → JSON.stringify is canonical.
function normalizeComponents(components) {
  const norm = c => {
    const out = { type: c.type }
    if (c.accent_color !== undefined) out.accent_color = c.accent_color
    if (c.content !== undefined) out.content = c.content
    if (c.divider !== undefined) out.divider = c.divider
    if (c.spacing !== undefined) out.spacing = c.spacing
    if (c.style !== undefined) out.style = c.style
    if (c.label !== undefined) out.label = c.label
    if (c.url !== undefined) out.url = c.url
    if (c.custom_id !== undefined) out.custom_id = c.custom_id
    if (c.items) out.items = c.items.map(i => ({ media: { url: i.media.url } }))
    if (c.components) out.components = c.components.map(norm)
    return out
  }
  return (components || []).map(norm)
}

module.exports = { TYPES, FLAG_COMPONENTS_V2, LIMITS, validatePayload, render, normalizeComponents }
