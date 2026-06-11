<div align="center">

<pre>
███████╗ ██╗ ██████╗
██╔════╝ ██║ ██╔══██╗
███████╗ ██║ ██████╔╝
╚════██║ ██║ ██╔═══╝
███████║ ██║ ██║
╚══════╝ ╚═╝ ╚═╝
</pre>

### THE Privacy Standard for Web3

[![Website](https://img.shields.io/badge/🌐_sip--protocol.org-00C08B?style=for-the-badge)](https://sip-protocol.org)
[![npm](https://img.shields.io/badge/npm-@sip--protocol/sdk-CB3837?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@sip-protocol/sdk)
[![Docs](https://img.shields.io/badge/📚_Documentation-blue?style=for-the-badge)](https://docs.sip-protocol.org)
[![Discord](https://img.shields.io/badge/Discord-Join_the_community-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/gXRsWkKq9E)

**🏆 Winner — [Zypherpunk Hackathon](https://zypherpunk.xyz) 3 Tracks ($6,500: NEAR $4,000 + Tachyon $500 + pumpfun $2,000)**

*Shielded Intents • Stealth Addresses • Viewing Keys • Compliant Privacy*

</div>

---

## What is SIP?

**SIP (Shielded Intents Protocol)** is the privacy standard for Web3. One toggle to shield your sender, amount, and recipient—while maintaining compliance with viewing keys. Works for same-chain AND cross-chain transactions.

```typescript
// Create a private cross-chain swap
const intent = await sip
  .intent()
  .input('solana', 'SOL', 1_000_000_000n)
  .output('zcash', 'ZEC', 50_000_000n)
  .privacy(PrivacyLevel.SHIELDED)  // ← One toggle
  .build()
```

**Enables:**
- ✅ Hidden sender identity (Pedersen commitments)
- ✅ Hidden transaction amounts
- ✅ Unlinkable recipients (stealth addresses)
- ✅ Selective disclosure for compliance (viewing keys)
- ✅ Multi-chain privacy via NEAR Intents

---

## Ecosystem

<table>
<tr>
<td width="50%">

### 🔐 [sip-protocol](https://github.com/sip-protocol/sip-protocol)
**Core SDK & Types**

The privacy layer SDK with stealth addresses, Pedersen commitments, and viewing keys.

- ✅ **Status:** Production-ready (M17 complete)
- 🛠️ **Stack:** TypeScript, @noble/curves, Vitest
- 📦 **Packages:** 7 packages (sdk, types, react, cli, api, react-native, circuits)
- ✨ **Tests:** 6,661+ tests passing

[📖 Documentation](https://docs.sip-protocol.org) • [🚀 Get Started](#quick-start)

</td>
<td width="50%">

### 📚 [docs-sip](https://github.com/sip-protocol/docs-sip)
**Documentation Site**

Comprehensive guides, API reference, and integration examples.

- 🌐 **Live:** docs.sip-protocol.org
- 🛠️ **Stack:** Astro, Starlight
- 📖 **Content:** Guides, API, Examples

[🌐 Visit Docs](https://docs.sip-protocol.org)

</td>
</tr>
<tr>
<td width="50%">

### 🔬 [circuits](https://github.com/sip-protocol/circuits)
**ZK Proof Circuits**

Noir-based zero-knowledge proof circuits for funding, validity, and fulfillment proofs.

- ✅ **Status:** Implemented (3 circuits, 19 tests)
- 🛠️ **Stack:** Noir 1.0.0-beta.15, Barretenberg
- 🎯 **Proofs:** Funding, Validity, Fulfillment

</td>
<td width="50%">

### 🌟 [awesome-sip](https://github.com/sip-protocol/awesome-sip)
**Examples & Community**

Production-ready examples and community projects.

- 📋 **Status:** Future
- 🎯 **Content:** DAO treasury, private payments, compliance flows

</td>
</tr>
</table>

---

## Quick Start

### Installation

```bash
# npm
npm install @sip-protocol/sdk

# pnpm
pnpm add @sip-protocol/sdk
```

### Create a Shielded Intent

```typescript
import { SIP, PrivacyLevel } from '@sip-protocol/sdk'

// Initialize
const sip = new SIP()

// Create private cross-chain swap
const intent = await sip
  .intent()
  .input('solana', 'SOL', 1_000_000_000n)
  .output('zcash', 'ZEC', 50_000_000n)
  .privacy(PrivacyLevel.SHIELDED)
  .build()

// Intent now has:
// - Hidden sender (Pedersen commitment)
// - Hidden amount (Pedersen commitment)
// - Stealth recipient address
```

### With Compliance (Viewing Keys)

```typescript
// Generate viewing key for auditors
const viewingKey = sip.generateViewingKey('/m/44/501/0/audit')

// Create compliant private intent
const intent = await sip
  .intent()
  .input('ethereum', 'ETH', 1_000_000_000_000_000_000n)
  .output('near', 'NEAR', 100_000_000_000_000_000_000_000n)
  .privacy(PrivacyLevel.COMPLIANT)
  .build()

// Auditor can decrypt transaction details with viewingKey
```

---

## Privacy Levels

| Level | Sender | Amount | Recipient | Auditable |
|-------|--------|--------|-----------|-----------|
| `transparent` | Public | Public | Public | N/A |
| `shielded` | Hidden | Hidden | Stealth | No |
| `compliant` | Hidden | Hidden | Stealth | Yes (viewing key) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SIP PROTOCOL STACK                       │
├─────────────────────────────────────────────────────────────┤
│  PRIVACY LAYER (SIP)          ← We build this               │
│  • Pedersen Commitments  • Stealth Addresses                │
│  • Viewing Keys          • Shielded Intents                 │
├─────────────────────────────────────────────────────────────┤
│  SETTLEMENT LAYER             ← We leverage this            │
│  • NEAR Intents         • Chain Signatures                  │
├─────────────────────────────────────────────────────────────┤
│  BLOCKCHAIN LAYER             ← We connect to this          │
│  • NEAR  • Ethereum  • Solana  • Bitcoin  • More...         │
└─────────────────────────────────────────────────────────────┘
```

**SIP is an application layer** that complements NEAR Intents and Zcash—not a competing infrastructure protocol.

---

## Why SIP?

> **"Bridging tokens is easy, bridging secrets is hard."**
> — [a16z Crypto, Big Ideas 2026](https://a16zcrypto.com/posts/article/big-ideas-things-excited-about-crypto-2026/)

**SIP is the privacy layer that makes bridging secrets possible.**

### The Problem

Cross-chain transactions are **public by default**:
- ❌ Anyone can see your wallet address
- ❌ Anyone can see transaction amounts
- ❌ Anyone can link your transactions
- ❌ No privacy = security risk for high-value users

### The Solution

**SIP adds privacy to NEAR Intents:**
- ✅ **Stealth addresses** - One-time recipient addresses
- ✅ **Pedersen commitments** - Hide amounts cryptographically
- ✅ **Viewing keys** - Selective disclosure for compliance
- ✅ **Multi-chain** - Works across any NEAR-connected chain

### Who Needs This?

| User | Use Case |
|------|----------|
| **DAOs** | Private treasury operations |
| **Institutions** | Compliant private transactions |
| **High-net-worth** | Protection from targeting |
| **Traders** | MEV protection, hidden strategies |

---

## Roadmap

### ✅ Completed (M1-M16)

- **Phase 1:** Foundation — Core crypto, NEAR Intents, Zcash
- **Phase 2:** Standard — Multi-backend, 15+ chains support
- **Phase 3:** Ecosystem — Compliance, React/CLI/API packages, hardware wallets
- **M16:** Narrative Capture — Content campaign, community, 25 blog posts

### ✅ Recently Completed (M17)

- **M17:** Solana Same-Chain Privacy — Native SDK + Jupiter DEX integration (Complete Jan 2026)

### 🎯 In Progress (M18)

- **M18:** Ethereum Same-Chain Privacy — Base L2 + Solidity contracts

### 🔮 Future (M18-M21)

- **M18:** Ethereum Same-Chain — EVM privacy + L2 support
- **M19-M21:** Technical Moat — Proof composition, SIP-EIP standard

---

## Contributing

- ⭐ **Star** repositories you find useful
- 🐛 **Report issues** to help us improve
- 💡 **Suggest features** in GitHub Discussions
- 🔧 **Submit PRs** with improvements

---

<div align="center">

### Privacy is not a feature. It's a right.

*One toggle to shield them all.*

---

**SIP Protocol** | THE Privacy Standard for Web3 | 2026

[![GitHub](https://img.shields.io/badge/GitHub-sip--protocol-181717?style=for-the-badge&logo=github)](https://github.com/sip-protocol)
[![Website](https://img.shields.io/badge/Website-sip--protocol.org-00C08B?style=for-the-badge&logo=google-chrome&logoColor=white)](https://sip-protocol.org)
[![Discord](https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/gXRsWkKq9E)

*Built on NEAR Intents + Zcash Privacy*

</div>
