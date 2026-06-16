// worker/src/render-intro.js — pure builders: the modal, the public intro card, ephemeral replies.
// Mirrors the SIP Components-V2 card style from discord/templates.js.

const FLAG_COMPONENTS_V2 = 1 << 15  // 32768
const FLAG_EPHEMERAL = 1 << 6       // 64
const SIP_ACCENT = 0x8b5cf6         // announcement purple

const row = (custom_id, label, style, required, min, max, placeholder) => ({
  type: 1, // action row
  components: [{ type: 4, custom_id, label, style, required, min_length: min, max_length: max, placeholder }],
})

// Interaction response type 9 (MODAL)
export function buildModal() {
  return {
    type: 9,
    data: {
      custom_id: 'sip_intro_modal',
      title: 'Introduce yourself to SIP',
      components: [
        row('handle', 'Name / handle', 1, true, 2, 50, 'How should we call you?'),
        row('who', 'Who are you?', 2, true, 15, 300, 'Builder, researcher, curious about privacy…'),
        row('why', 'Why SIP — what brings you here?', 2, true, 20, 300, 'What pulled you in?'),
        row('building', 'What are you building / interested in?', 2, false, 0, 300, 'Optional'),
      ],
    },
  }
}

const text = content => ({ type: 10, content })
const sep = () => ({ type: 14, divider: true, spacing: 1 })

// Interaction response type 4 (CHANNEL_MESSAGE_WITH_SOURCE), public, Components V2.
export function buildIntroCard(fields, userId) {
  const inner = [text(`### 👋 ${fields.handle} just joined`)]
  inner.push(text(`**Who:** ${fields.who}`))
  inner.push(text(`**Here for:** ${fields.why}`))
  if (fields.building) inner.push(text(`**Building:** ${fields.building}`))
  inner.push(sep())
  inner.push(text(`-# Welcome in, <@${userId}> — you're now a member. Explore the server.`))
  return {
    type: 4,
    data: {
      flags: FLAG_COMPONENTS_V2,
      allowed_mentions: { parse: [], users: [userId] },
      components: [{ type: 17, accent_color: SIP_ACCENT, components: inner }],
    },
  }
}

// Ephemeral text reply (errors + already-in).
export function ephemeral(content) {
  return { type: 4, data: { flags: FLAG_EPHEMERAL, content } }
}

export const _internals = { FLAG_COMPONENTS_V2, FLAG_EPHEMERAL, SIP_ACCENT }
