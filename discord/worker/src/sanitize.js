// worker/src/sanitize.js — pure input validation + sanitization for intro submissions.
// No I/O. Rejects unsafe content; escapes the rest for safe rendering in a bot-posted card.

const FIELD_RULES = {
  handle: { label: 'Name / handle', min: 2, max: 50, required: true },
  who: { label: 'Who are you', min: 15, max: 300, required: true },
  why: { label: 'Why SIP', min: 20, max: 300, required: true },
  building: { label: 'What you are building', min: 0, max: 300, required: false },
}

// Mirrors the wallet-drainer intent of manifest.json automod (kept in sync manually).
const DRAINER_PATTERNS = [
  'free nitro', 'nitro giveaway', 'claim your airdrop', 'airdrop claim', 'connect your wallet',
  'verify your wallet', 'wallet verification', 'validate your wallet', 'synchronize your wallet',
  'dm me to claim', 'first come first serve',
]

const URL_RE = /(https?:\/\/|www\.|discord\.gg\/|t\.me\/|[a-z0-9-]+\.(xyz|io|com|net|org|app|fi|finance|link|click|gift|claim)\b)/i

function escapeMarkdown(s) {
  return s
    .replace(/[\\`*_~|>#-]/g, '\\$&')
    .replace(/@/g, '@​')            // break @everyone/@here/@user
    .replace(/<(@|#|@&)/g, '<​$1')  // break channel/role/user component mentions
}

// fields: { handle, who, why, building } raw strings (may be undefined)
// returns { ok: true, fields } | { ok: false, reason }
export function validateAndSanitize(fields) {
  const out = {}
  for (const [key, rule] of Object.entries(FIELD_RULES)) {
    const trimmed = (fields[key] ?? '').toString().trim()
    if (!trimmed) {
      if (rule.required) return { ok: false, reason: `${rule.label} is required.` }
      out[key] = ''
      continue
    }
    // Security checks take precedence over length: a link or drainer phrase is a hard
    // rejection regardless of field length, and the user gets the accurate reason.
    if (URL_RE.test(trimmed)) return { ok: false, reason: `Links aren't allowed in your intro (${rule.label}).` }
    if (DRAINER_PATTERNS.some(p => trimmed.toLowerCase().includes(p))) {
      return { ok: false, reason: 'Your intro was blocked by SIP AutoMod. The team never DMs first.' }
    }
    if (trimmed.length < rule.min) return { ok: false, reason: `${rule.label} is too short (min ${rule.min}).` }
    if (trimmed.length > rule.max) return { ok: false, reason: `${rule.label} is too long (max ${rule.max}).` }
    out[key] = escapeMarkdown(trimmed)
  }
  return { ok: true, fields: out }
}

export const _internals = { URL_RE, DRAINER_PATTERNS, escapeMarkdown, FIELD_RULES }
