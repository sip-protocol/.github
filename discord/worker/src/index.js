// worker/src/index.js — Cloudflare Worker entrypoint for SIP Discord interactions.
import { verifyKey } from 'discord-interactions'
import { validateAndSanitize } from './sanitize.js'
import { buildModal, buildIntroCard, ephemeral } from './render-intro.js'
import { grantRole, logModlog } from './discord.js'

const PONG = { type: 1 }

// Router. Side effects go through `deps` for testability.
export async function handleInteraction(interaction, env, deps = { grantRole, logModlog }) {
  if (interaction.type === 1) return PONG // PING

  if (interaction.type === 3 && interaction.data?.custom_id === 'sip_intro') {
    return buildModal()
  }

  if (interaction.type === 5 && interaction.data?.custom_id === 'sip_intro_modal') {
    const member = interaction.member
    const userId = member?.user?.id
    if (member?.roles?.includes(env.COMMUNITY_ROLE_ID)) {
      return ephemeral("You're already in 🎉 — welcome back.")
    }
    if (!userId) return ephemeral("Couldn't read your Discord account — please try again.")
    const fields = {}
    for (const r of interaction.data.components ?? []) {
      const c = r.components?.[0]
      if (c) fields[c.custom_id] = c.value
    }
    const result = validateAndSanitize(fields)
    if (!result.ok) return ephemeral(`Couldn't post your intro: ${result.reason}`)

    const grant = await deps.grantRole(env, userId, env.COMMUNITY_ROLE_ID)
    if (!grant.ok) {
      await deps.logModlog(env, `⚠️ intro-gate: failed to grant Community to <@${userId}> (status ${grant.status})`)
      return ephemeral("Couldn't unlock automatically — please ping a moderator.")
    }
    return buildIntroCard(result.fields, userId)
  }

  return ephemeral('Unsupported interaction.')
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
    const signature = request.headers.get('X-Signature-Ed25519')
    const timestamp = request.headers.get('X-Signature-Timestamp')
    if (!signature || !timestamp) return new Response('Missing signature', { status: 401 })
    const body = await request.text() // RAW body — required for verification
    const valid = await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY)
    if (!valid) return new Response('Bad request signature', { status: 401 })

    const interaction = JSON.parse(body)
    const response = await handleInteraction(interaction, env)
    return new Response(JSON.stringify(response), { headers: { 'Content-Type': 'application/json' } })
  },
}
