#!/usr/bin/env node
// discord/render.js — render assets-src SVGs to PNG. Emojis → assets/emoji/ (committed,
// uploaded by setup.js). Banners → out/ at 2x (copy to cdn-sip/discord/ with a .vN suffix).
// Only file in the toolkit with a dependency: npm install (devDep @resvg/resvg-js).
'use strict'

const fs = require('fs')
const path = require('path')
const { Resvg } = require('@resvg/resvg-js')

const FONT_DIR = path.join(__dirname, 'assets-src/fonts')
const fontFiles = fs.readdirSync(FONT_DIR).filter(f => f.endsWith('.ttf')).map(f => path.join(FONT_DIR, f))
const fontOpts = { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Inter' }

function renderOne(svgPath, outPath, width) {
  const svg = fs.readFileSync(svgPath, 'utf8')
  const png = new Resvg(svg, { font: fontOpts, fitTo: { mode: 'width', value: width } }).render().asPng()
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, png)
  const kb = (png.length / 1024).toFixed(1)
  console.log(`✓ ${path.basename(outPath)} (${width}px wide, ${kb} KB)`)
  return png.length
}

// Emojis: 128px, must stay ≤256 KB (Discord upload cap)
for (const f of fs.readdirSync(path.join(__dirname, 'assets-src/emoji'))) {
  if (!f.endsWith('.svg')) continue
  const bytes = renderOne(path.join(__dirname, 'assets-src/emoji', f), path.join(__dirname, 'assets/emoji', f.replace('.svg', '.png')), 128)
  if (bytes > 256 * 1024) { console.error(`✗ ${f} exceeds Discord's 256 KB emoji cap`); process.exit(1) }
}

// Banners: 2x for retina (1200×400 → 2400×800)
for (const f of fs.readdirSync(path.join(__dirname, 'assets-src/banners'))) {
  if (!f.endsWith('.svg')) continue
  renderOne(path.join(__dirname, 'assets-src/banners', f), path.join(__dirname, 'out', f.replace('.svg', '.v1.png')), 2400)
}
console.log('\nBanners in out/ — copy to ~/local-dev/cdn-sip/discord/ (Task 13). Bump .vN when changing a shipped banner.')
