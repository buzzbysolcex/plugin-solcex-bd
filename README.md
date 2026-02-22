# 🐝 Buzz by SolCex — elizaOS Plugin v0.2.0

**Autonomous BD Agent for Crypto Exchange Token Listings**

Native elizaOS plugin bringing Buzz's full 4-Layer Intelligence Architecture to the elizaOS ecosystem. 8 services, 6 actions, 2 providers — mapped directly to Buzz's production capabilities running 24/7 on Akash Network.

> **Reference:** SolCex Master Ops v5.3.8 — 3-Provider Cascade + GHCR Pipeline (Feb 22, 2026)
> **Deployment:** `ghcr.io/buzzbysolcex/buzz-bd-agent:v5.3.8`
> **Live:** 36 cron jobs | 16/16 intelligence sources | 3-Provider LLM Cascade

## Architecture — 4-Layer Intelligence

```
╔═══════════════════════════════════════════════════╗
║  LAYER 1 — CAST THE NET (Discovery)               ║
║  DexScreener, AIXBT, Clawpump, CoinGecko, Boosts  ║
║  → DexScreenerService                              ║
╠═══════════════════════════════════════════════════╣
║  LAYER 2 — FILTER (Safety & Liquidity)             ║
║  RugCheck, Helius, Allium (16 chains), DFlow MCP   ║
║  → ContractSafetyService, WalletForensicsService,  ║
║    MultiChainIntelService                          ║
╠═══════════════════════════════════════════════════╣
║  LAYER 3 — RESEARCH (Deep Intel)                   ║
║  Grok x_search, ATV Web3 Identity, Serper          ║
║  → SocialIntelService                              ║
╠═══════════════════════════════════════════════════╣
║  LAYER 4 — SCORE & ACT (100-Point System)          ║
║  + QuillShield safety overlay                      ║
║  + DFlow route quality modifiers (+13/-8)          ║
║  → TokenScoringService, BDPipelineService          ║
╚═══════════════════════════════════════════════════╝
```

## 8 Services

| # | Service | Layer | Intel Sources | Description |
|---|---------|-------|---------------|-------------|
| 1 | `DexScreenerService` | L1 | #1, #18 | Token discovery — profiles, pairs, boosts, trending |
| 2 | `TokenScoringService` | L4 | All layers | 100-point scoring engine with catalyst adjustments |
| 3 | `WalletForensicsService` | L2 | #5 Helius | Solana wallet forensics — balances, tx history, risk |
| 4 | `ContractSafetyService` | L2 | #4 RugCheck, #16 DFlow | Honeypot detection, authority checks, LP verification, swap routes |
| 5 | `MultiChainIntelService` | L2 | #6 Allium | 16-chain deployer PnL, cross-chain behavior tracking |
| 6 | `SocialIntelService` | L3 | #12 ATV, #13 Grok, #14 Serper | Sentiment analysis, Web3 identity, web research |
| 7 | `BDPipelineService` | Cross | BD lifecycle #31-36 | Prospect tracking, warm-ups, follow-ups, competitor monitoring |
| 8 | `AgentNetworkService` | Support | #15 sub-agents, ACP, x402 | Agent-to-agent interop, micropayments, trust verification |

## 6 Actions

| Action | Triggers | Description |
|--------|----------|-------------|
| `SCAN_TOKENS` | "scan for tokens", "find listing candidates" | Discover and score token prospects from DexScreener |
| `SCORE_TOKEN` | "score this token [address]" | Deep 100-point scoring for a specific contract |
| `ANALYZE_WALLET` | "analyze wallet [address]" | Helius-powered Solana wallet forensics |
| `CHECK_CONTRACT_SAFETY` | "check safety [address]", "rug check" | RugCheck + QuillShield + DFlow safety analysis |
| `RESEARCH_PROJECT` | "research $TOKEN", "deep dive" | Grok sentiment + ATV identity + Serper web research |
| `CHECK_PIPELINE` | "show pipeline", "BD status" | Pipeline stats, hot prospects, follow-up queue |

## 2 Providers

| Provider | Description |
|----------|-------------|
| `buzz-market-intel` | Injects real-time trending token data into agent context |
| `buzz-bd-pipeline` | SolCex listing package ($15K USDT), Buzz identity, pipeline context |

## Quick Start

```bash
bun add @buzzbysolcex/plugin-buzz-solcex
```

### Agent Configuration

```typescript
import { buzzSolcexPlugin } from '@buzzbysolcex/plugin-buzz-solcex';

const agent = {
  name: 'MyAgent',
  plugins: [buzzSolcexPlugin],
  settings: {
    HELIUS_API_KEY: 'your-helius-key',
    ALLIUM_API_KEY: 'your-allium-key',
    GROK_API_KEY: 'your-xai-key',
    ATV_API_KEY: 'your-atv-key',
    SERPER_API_KEY: 'your-serper-key',
    BUZZ_MIN_LIQUIDITY: '10000',
    BUZZ_MIN_VOLUME_24H: '5000',
    BUZZ_MIN_SCORE: '60',
  },
};
```

## Scoring System (Master Ops v5.3.8)

### Base Metrics (100 points)

| Metric | Points | Full Score |
|--------|--------|-----------|
| Liquidity | 30 | $500K+ |
| Volume (24h) | 25 | $1M+ |
| Age | 15 | 7-30 days |
| Community | 15 | Active socials |
| Contract Safety | 15 | Audited, no flags |

### Score Thresholds

| Score | Label | Action |
|-------|-------|--------|
| 85-100 | 🔥 HOT | Immediate outreach + forensics |
| 70-84 | ✅ QUALIFIED | Priority queue + forensics |
| 50-69 | 👀 WATCH | Monitor 48h |
| 0-49 | ❌ SKIP | No action |

### DFlow Route Modifiers: max +13 / min -8 pts

## LLM Cascade (Master Ops v5.3.8)

| Priority | Model | Provider | Format | Cost |
|----------|-------|----------|--------|------|
| PRIMARY | MiniMax M2.5 (229B) | MiniMax Direct | `anthropic-messages` | ~$41/mo |
| FREE 1 | Llama 3.3 70B | OpenRouter | openai | $0 |
| FREE 2 | Qwen3 30B-A3B | AkashML | openai | $0 |

**Key v5.3.8 fix:** MiniMax API switched from `openai-completions` to `anthropic-messages` format, resolving empty `tool_call_id` errors.

## Environment Variables

| Variable | Required | Service |
|----------|----------|---------|
| `HELIUS_API_KEY` | No | WalletForensics |
| `ALLIUM_API_KEY` | No | MultiChainIntel |
| `GROK_API_KEY` / `XAI_API_KEY` | No | SocialIntel |
| `ATV_API_KEY` | No | SocialIntel |
| `SERPER_API_KEY` | No | SocialIntel |

> DexScreener + RugCheck always available (free, no key).

## Development

```bash
git clone https://github.com/buzzbysolcex/plugin-buzz-solcex
cd plugin-buzz-solcex
bun install && bun run build
```

## About

| Field | Value |
|-------|-------|
| Exchange | [SolCex](https://solcex.io) |
| ERC-8004 | Ethereum #25045 \| Base #17483 |
| Docker | `ghcr.io/buzzbysolcex/buzz-bd-agent:v5.3.8` |
| npm | `@buzzbd/plugin-solcex-bd@1.0.0` |
| Registry PR | elizaos-plugins/registry #263 |
| Twitter | [@BuzzBySolCex](https://twitter.com/BuzzBySolCex) |

## License

MIT
