# SIP Protocol Discord — infra-as-code

Declarative setup for the community server. `manifest.json` is the desired state;
`setup.js` reconciles live state toward it (create-if-missing, update drift,
never deletes anything except the scoped Discord-default cruft listed in
`cleanup_defaults`). Idempotent — re-run safely any time.

## Run

Requires Node ≥18 and env (in `~/Documents/secret/.env`):
`DISCORD_BOT_TOKEN` (SIPHER bot, Administrator) · `DISCORD_GUILD_ID`

    node discord/setup.js --plan          # dry-run: print what would change
    node discord/setup.js                 # apply
    node discord/verify.js                # GET-only drift check (exit 1 on drift)
    node --test discord/test/lib.test.js  # unit tests for the planning library

Webhook URLs print once at creation. Lost one? Server Settings → Integrations → \<webhook\> → Copy URL (or delete it and re-run setup.js).

Emoji/banner PNGs are generated from assets-src/ via npm run render (Task: render.js) — setup.js preflights their existence.

## Files

- `manifest.json` — guild settings, roles, categories/channels, AutoMod, welcome
  screen, onboarding, seed messages, emojis, webhooks, invite spec
- `lib.js` — pure planning functions (tested)
- `setup.js` — REST apply (rate-limit aware, actionable errors, exit 2 = warnings)
- `verify.js` — drift report
- `templates.js` — pure payload → Components V2 renderer (the format standard, tested)
- `post.js` — post a payload from `posts/` (`node post.js posts/<f>.json [--plan]`); auto-crossposts in announcement channels
- `posts/` — every payload ever posted, committed (audit trail)
- `api.js` — shared REST helper (429-aware)
- `render.js` + `assets-src/` — SVG sources → PNG (`npm run render`); banners ship to cdn-sip
- `PLAYBOOK.md` — operations playbook: message standards, workflows, growth triggers

Spec: sip-protocol `docs/superpowers/specs/2026-06-10-discord-server-design.md`
