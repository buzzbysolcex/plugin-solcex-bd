# @elizaos/plugin-solcex-bd

> SolCex Exchange Business Development plugin for ElizaOS — token discovery, 100-point scoring, wallet forensics, and listing pipeline.

Built by [Buzz BD Agent](https://github.com/buzzbysolcex/buzz-bd-agent) — the autonomous BD agent for SolCex Exchange, running 24/7 on Akash Network.

**ERC-8004:** ETH Agent #25045 | Base Agent #17483 | Verify: [8004scan.io](https://8004scan.io)

## Installation

```bash
bun add @elizaos/plugin-solcex-bd
# or
npm install @elizaos/plugin-solcex-bd
```

## Quick Start

```typescript
import { AgentRuntime } from "@elizaos/core";
import { solcexBdPlugin } from "@elizaos/plugin-solcex-bd";

const runtime = new AgentRuntime({
  character: {
    name: "MyBDAgent",
    bio: "I help discover and evaluate tokens for exchange listings.",
    plugins: ["@elizaos/plugin-solcex-bd"],
    settings: {
      secrets: {
        HELIUS_API_KEY: "your_helius_key", // Required for wallet forensics
        // Optional: Connect to SolCex API for enriched intel
        // SOLCEX_API_URL: "https://buzz.solcex.io/api",
        // SOLCEX_API_KEY: "your_key",
      },
    },
  },
  plugins: [solcexBdPlugin],
});

await runtime.initialize();
```

## Actions

### SCAN_TOKENS
Discover high-potential tokens across DEXs.

```
"Scan for promising tokens on Solana"
"Find trending tokens with good liquidity"
"What new tokens are worth looking at?"
```

Returns: Top 10 tokens scored by the 100-point system, with chain, liquidity, market cap, and recommendations.

### SCORE_TOKEN
Deep-score a specific token by contract address.

```
"Score this token: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
"Evaluate 0x1234...5678 on Base"
```

Returns: Full 6-factor breakdown (liquidity 25%, market cap 20%, volume 20%, social 15%, age 10%, team 10%) plus catalyst adjustments.

### CHECK_WALLET
Run deployer wallet forensics via Helius API (Solana only).

```
"Check the deployer wallet for DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
"Is this token safe? Run wallet forensics"
```

Returns: Funding source, balances, transaction patterns, flags (VERIFIED/INSTITUTIONAL/SERIAL_CREATOR/DUMP_ALERT/MIXER_REJECT), risk level, and adjusted score.

**Requires:** `HELIUS_API_KEY` — get one free at [helius.dev](https://helius.dev)

### SUBMIT_LISTING_INQUIRY
Submit a qualified token (70+ score) to SolCex for listing review.

```
"Submit a listing inquiry for BONK to SolCex"
"Send this token to SolCex for listing review"
```

All inquiries are **queued for human review** — never auto-sent.

## Scoring System

| Factor | Weight | Scoring Tiers |
|--------|--------|---------------|
| Liquidity | 25% | >$500K excellent, >$200K good, >$100K minimum |
| Market Cap | 20% | >$10M strong, >$1M good, >$500K acceptable |
| Volume 24h | 20% | >$1M excellent, >$500K good, >$100K moderate |
| Social | 15% | 4+ platforms strong, 2+ moderate, 1 minimal |
| Age | 10% | >180d established, >30d moderate, <7d risky |
| Team | 10% | Website + socials = transparent |

**Catalysts** adjust the base score: volume momentum (+5), buy pressure (+3), multi-platform (+5), price dump (-10), sell pressure (-5).

**Wallet Forensics** further adjust: verified (+3), institutional (+8), net positive (+2), serial creator (-5), dump alert (-10 to -15), mixer funded (AUTO-REJECT).

| Score | Action |
|-------|--------|
| 85-100 | 🔥 HOT — Immediate outreach |
| 70-84 | ✅ QUALIFIED — Priority queue |
| 50-69 | 👀 WATCH — Monitor 48 hours |
| 0-49 | ⏭️ SKIP — Log only |

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `HELIUS_API_KEY` | For CHECK_WALLET | Helius API key for Solana wallet forensics |
| `SOLCEX_API_URL` | Optional | SolCex API endpoint for enriched intel and listing submission |
| `SOLCEX_API_KEY` | Optional | SolCex API authentication key |

## Direct Service Usage

You can also use the services directly without ElizaOS:

```typescript
import { searchTokens, scoreToken, analyzeWallet } from "@elizaos/plugin-solcex-bd";

// Search tokens
const pairs = await searchTokens("BONK");

// Score a pair
const score = scoreToken(pairs[0]);
console.log(`${score.tokenSymbol}: ${score.totalScore}/100`);

// Wallet forensics
const wallet = await analyzeWallet("DeployerAddress...", "your_helius_key");
console.log(wallet.summary);
```

## About

**Buzz BD Agent** is an autonomous business development agent for SolCex Exchange, built by Ogie and Claude Opus 4.6. Running 24/7 on Akash Network with 15 intelligence sources, 29 cron jobs, and dual-chain ERC-8004 identity.

- GitHub: [buzzbysolcex/buzz-bd-agent](https://github.com/buzzbysolcex/buzz-bd-agent)
- Twitter: [@BuzzBySolCex](https://twitter.com/BuzzBySolCex)
- ERC-8004: ETH #25045 | Base #17483
- Live: [retake.tv/BuzzBD](https://retake.tv/BuzzBD)

## License

MIT
