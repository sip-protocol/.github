# SIP Protocol Discord — Operations Playbook

How SIP runs its Discord. The structure is reconciled by `setup.js` (manifest.json);
this document governs everything the manifest can't: what we post, how it looks,
when we act, and what changes as the server grows.
Spec: sip-protocol `docs/superpowers/specs/2026-06-11-discord-professional-standard-design.md`.

## 1. Voice & identity

- SIPHER (the bot) authors every official post, via `post.js`. Humans chat as humans.
- Tone: builder-to-builder. No hype, no price talk, honest numbers. English only.
- The team NEVER DMs first, never asks anyone to connect a wallet (also rule #5 in #rules).

## 2. Message standard

Every official post is a Components V2 container rendered by `templates.js` — never
hand-compose in the client. Types:

| Type | Accent | Banner | Use for | Channel |
|------|--------|--------|---------|---------|
| `announcement` | purple #8b5cf6 | optional | milestones, launches | #announcements |
| `release` | emerald #10b981 | never | npm/program releases | #announcements |
| `bounty` | amber #f59e0b | optional | Earn launches, winners | #bounties (+ #announcements on launch day) |
| `security` | red #ef4444 | never | advisories, impersonation warnings | #announcements |
| `digest` | indigo #6366f1 | never | HERALD weekly recap (automated) | #announcements |

Discipline:
- ≤2 organic announcements/week. Releases as they ship. Security: immediately, undecorated.
- Deadlines always as Discord timestamps (`<t:unix:R>`) — they localize per viewer.
- 1–2 brand emojis per post max. Never emoji walls.
- Banners only on `announcement`/`bounty`; rendered from `assets-src/`, served from
  `cdn.sip-protocol.org/discord/`, content-versioned (`.v2` = new file, never overwrite).

## 3. Posting workflow

1. Write the payload: `discord/posts/YYYY-MM-DD-slug.json` (schema in templates.js).
2. Preview: `node discord/post.js posts/<file>.json --plan`.
3. RECTOR sign-off (in-session or async) — required for every `announcement`/`security`.
4. Post: `node discord/post.js posts/<file>.json` (crosspost + pin are automatic).
5. Commit the payload. The posts/ directory is the audit trail.

Automated paths: HERALD digest (approved in HeraldView → X → webhook cross-post);
GitHub feed (org webhook, no human in the loop); drift alerts (weekly Action → #mod-log).

## 4. Conventions

- One thread per bounty in #bounties for submissions/questions; winners announced in-channel.
- Pins: ≤5 per channel. #rules + #resources seed posts stay pinned (reconciled).
- Contributor role is earned (merged PR / real contribution) — never self-assign, never bulk-grant.
- New channels only via the growth triggers below; structure changes go through manifest.json.

## 4a. Onboarding gate (the intro flow)

New members see only `#rules` + `#introductions` until they introduce themselves. The
`#introductions` seed card has an **Introduce yourself** button → a 4-field modal
(handle / who / why / building). On submit, the Cloudflare Worker
(`discord/worker/`) validates + sanitizes the input, grants `Community` (the unlock
role), and posts a public intro card. Fully automatic — no mod approval.

- Worker source: `discord/worker/` — deploy with `npm run deploy` (wrangler).
- Endpoint URL is set in the Discord Dev Portal (SIPHER app → Interactions Endpoint URL).
- Secrets: `DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_MODLOG_WEBHOOK_URL`
  (`wrangler secret put`). Vars: `DISCORD_GUILD_ID`, `COMMUNITY_ROLE_ID` (wrangler.toml).
- Failure (e.g. role hierarchy) → ephemeral "ping a moderator" + a note in `#mod-log`.
  Fix: ensure the SIPHER integration role sits **above** `Community` in the role list.

## 4b. Granting earned tiers

The ladder is `Community` (auto) → `Builder` → `Contributor` → `Core`. All but
`Community` are granted **manually**, never self-assigned (rule below):

- **Builder** — actively building with the SDK / sustained help in `#dev-chat`.
- **Contributor** — merged a PR to any `sip-protocol` repo.
- **Core** — sustained maintainer / deeply trusted (Admin grants).
- **OG** — batch-granted to the first wave of members (one-time, RECTOR's cutoff).

Grant via Server Settings → Members, or `node` against the REST API. Never bulk-grant
earned tiers; the value is that they're earned.

## 5. Moderation runbook

- AutoMod alerts land in #mod-log. Wallet-drainer phrase hits: delete → ban → note in #mod-log.
- Impersonation ("SIP team" DMs): ban + `security` post if any member was plausibly hit.
- Raid: Server Settings → Safety Setup → Pause Invites (or DMs); re-enable after the wave; tighten AutoMod if a pattern emerges.
- Real vulnerability reported in public: delete the message, thank reporter via DM,
  point to SECURITY.md private reporting, assess exposure before any public note.

## 6. Growth triggers

Act when the threshold is hit — not before (YAGNI for community ops):

| Trigger | Action |
|---------|--------|
| 50 members | Recruit first mod → grant the existing `Moderator` role; open #showcase (COMMUNITY) |
| 100 members | #support forum channel (DEVELOPMENT); monthly dev-call scheduled event |
| 250 members | Second mod; AutoMod rule audit; locale channels only if non-English chatter is organic |
| Boost L1 (2) | Animated icon + invite splash (render from assets-src) |
| Boost L2 (7) | Role icons (Contributor, Bounty Hunter) + server banner — SVG pipeline is ready |
| Boost L3 (14) | Vanity URL attempt |

Thresholds are heuristics — RECTOR tunes them.

## 7. Credentials

| Secret | Where | Used by |
|--------|-------|---------|
| `DISCORD_BOT_TOKEN` | `~/Documents/secret/.env` + `.github` repo Actions secret | setup/verify/post + drift cron |
| `DISCORD_GUILD_ID` | same | same |
| `DISCORD_GITHUB_WEBHOOK_URL` | `~/Documents/secret/.env` + GitHub org webhook config | GitHub → #github-feed |
| `DISCORD_ANNOUNCE_WEBHOOK_URL` | `~/Documents/secret/.env` + sipher VPS env | HERALD digest cross-post |
| `DISCORD_MODLOG_WEBHOOK_URL` | `~/Documents/secret/.env` + `.github` Actions secret | drift alerts |

Rotation (do immediately on any suspected leak):
1. Bot token: Developer Portal → SIPHER → Bot → Reset Token (MFA = RECTOR) → update `.env`,
   `.github` Actions secret. 2. Webhooks: delete in Server Settings → Integrations → re-run
   `setup.js` (recreates + prints new URLs) → update `.env`, org webhook config, VPS env,
   Actions secret. Webhook URLs are post-only capabilities; the bot token is Administrator — guard accordingly.

## 8. Gotchas

API behaviors learned in v1 setup (COMMUNITY prerequisites, type-5 timing, managed-role
403, OAuth app-handoff, onboarding minimums) — see the spec for
`2026-06-10-discord-server-design.md` and the session memory `reference_discord-server-iac`.
