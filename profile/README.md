<div align="center">

<pre>
███████╗ ██╗ ██████╗
██╔════╝ ██║ ██╔══██╗
███████╗ ██║ ██████╔╝
╚════██║ ██║ ██╔═══╝
███████║ ██║ ██║
╚══════╝ ╚═╝ ╚═╝
</pre>

### Privacy Layer for Cross-Chain Transactions

[![Website](https://img.shields.io/badge/🌐_sip--protocol.org-00C08B?style=for-the-badge)](https://sip-protocol.org)
[![npm](https://img.shields.io/badge/npm-@sip--protocol/sdk-CB3837?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@sip-protocol/sdk)
[![Docs](https://img.shields.io/badge/📚_Documentation-blue?style=for-the-badge)](https://docs.sip-protocol.org)

**🏆 Winner — [Zypherpunk Hackathon](https://zypherpunk.xyz) NEAR Track ($4,000)**

*Shielded Intents • Stealth Addresses • Viewing Keys • Compliant Privacy*

</div>

---

## What is SIP?

**SIP (Shielded Intents Protocol)** brings privacy to cross-chain transactions. One toggle to shield your sender, amount, and recipient—while maintaining compliance with viewing keys.

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

The privacy layer SDK with stealth addresses, commitments, and viewing keys.

- ✅ **Status:** Production-ready (M4 complete)
- 🛠️ **Stack:** TypeScript, @noble/curves, Vitest
- 📦 **Packages:** @sip-protocol/sdk, @sip-protocol/types
- ✨ **Tests:** 741 tests passing

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

- 📋 **Status:** Planned
- 🛠️ **Stack:** Noir, Halo2 backend
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

### ✅ Completed

- **M1:** Architecture & Specification
- **M2:** Cryptographic Core (Pedersen, stealth addresses)
- **M3:** SDK Production (validation, errors, tests)
- **M4:** Network Integration (NEAR, Zcash, wallet adapters)

### 🔄 In Progress

- **M5:** Documentation & Launch

### 🔮 Future

- Real ZK circuits (Noir + Halo2)
- Private payments API
- DAO treasury integration
- Hardware wallet support

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

**SIP Protocol** | Cross-Chain Privacy | 2025

[![GitHub](https://img.shields.io/badge/GitHub-sip--protocol-181717?style=for-the-badge&logo=github)](https://github.com/sip-protocol)
[![Website](https://img.shields.io/badge/Website-sip--protocol.org-00C08B?style=for-the-badge&logo=google-chrome&logoColor=white)](https://sip-protocol.org)

*Built on NEAR Intents + Zcash Privacy*

</div>
