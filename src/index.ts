/**
 * Buzz by SolCex — Native elizaOS Plugin v0.2.0
 *
 * Autonomous BD agent plugin for SolCex Exchange.
 * 8 services | 6 actions | 2 providers
 * Mapped to Buzz's 4-Layer Intelligence Architecture (16 sources)
 *
 * SERVICES (8):
 *   1. DexScreenerService     — Layer 1: Token discovery (#1, #18)
 *   2. TokenScoringService    — Layer 4: 100-point scoring engine
 *   3. WalletForensicsService — Layer 2: Helius wallet analysis (#5)
 *   4. ContractSafetyService  — Layer 2: RugCheck + QuillShield + DFlow (#4, #16)
 *   5. MultiChainIntelService — Layer 2: Allium 16-chain coverage (#6)
 *   6. SocialIntelService     — Layer 3: Grok + ATV + Serper (#12, #13, #14)
 *   7. BDPipelineService      — Cross-Layer: Discovery-to-listing lifecycle
 *   8. AgentNetworkService    — Supporting: Sub-agents, ACP, x402
 *
 * ACTIONS (6):
 *   - SCAN_TOKENS            — Discover and score token prospects
 *   - SCORE_TOKEN            — Score a specific token by address
 *   - ANALYZE_WALLET         — Wallet forensics via Helius
 *   - CHECK_CONTRACT_SAFETY  — RugCheck + QuillShield + DFlow safety
 *   - RESEARCH_PROJECT       — Grok sentiment + ATV identity + Serper
 *   - CHECK_PIPELINE         — BD pipeline stats and follow-ups
 *
 * PROVIDERS (2):
 *   - buzz-market-intel      — Real-time trending token data
 *   - buzz-bd-pipeline       — Pipeline context and listing package
 *
 * @version 0.2.0
 * @author SolCex Exchange
 * @link https://solcex.io
 */

import type { Plugin } from '@elizaos/core';

// === Actions ===
import { scanTokensAction } from './actions/scanTokens.js';
import { scoreTokenAction } from './actions/scoreToken.js';
import { analyzeWalletAction } from './actions/analyzeWallet.js';
import { checkContractSafetyAction } from './actions/checkContractSafety.js';
import { researchProjectAction } from './actions/researchProject.js';
import { checkPipelineAction } from './actions/checkPipeline.js';

// === Providers ===
import { marketIntelProvider } from './providers/marketIntel.js';
import { bdPipelineProvider } from './providers/bdPipeline.js';

// === Re-export types ===
export * from './types/index.js';

// === Re-export all 8 services ===
export { DexScreenerService } from './services/dexscreener.js';
export { TokenScoringService } from './services/scoring.js';
export { WalletForensicsService } from './services/forensics.js';
export { ContractSafetyService } from './services/contractSafety.js';
export { MultiChainIntelService } from './services/multiChainIntel.js';
export { SocialIntelService } from './services/socialIntel.js';
export { BDPipelineService } from './services/bdPipeline.js';
export { AgentNetworkService } from './services/agentNetwork.js';

/**
 * Buzz by SolCex — elizaOS Plugin v0.2.0
 *
 * 8 services | 6 actions | 2 providers
 * 4-Layer Intelligence Architecture across 16 sources
 */
export const buzzSolcexPlugin: Plugin = {
  name: 'plugin-buzz-solcex',
  description: 'Autonomous BD agent for SolCex Exchange — 8 services covering token discovery, 100-point scoring, contract safety (RugCheck + QuillShield + DFlow), wallet forensics (Helius), 16-chain intel (Allium), social intelligence (Grok + ATV + Serper), BD pipeline lifecycle, and agent network interop (sub-agents, ACP, x402)',

  actions: [
    scanTokensAction,
    scoreTokenAction,
    analyzeWalletAction,
    checkContractSafetyAction,
    researchProjectAction,
    checkPipelineAction,
  ],

  providers: [
    marketIntelProvider,
    bdPipelineProvider,
  ],

  services: [],

  init: async (config: Record<string, string>, runtime: any) => {
    console.log('═══════════════════════════════════════════════════');
    console.log('  🐝 Buzz by SolCex — elizaOS Plugin v0.2.0');
    console.log('  8 Services | 6 Actions | 2 Providers');
    console.log('  4-Layer Intelligence | 16 Sources');
    console.log('  ERC-8004: ETH #25045 | Base #17483');
    console.log('═══════════════════════════════════════════════════');
    console.log('');
    console.log('  Services:');
    console.log('    1. DexScreenerService     — Token discovery');
    console.log('    2. TokenScoringService    — 100-point scoring');
    console.log('    3. WalletForensicsService — Helius wallet analysis');
    console.log('    4. ContractSafetyService  — RugCheck + QuillShield + DFlow');
    console.log('    5. MultiChainIntelService — Allium 16-chain coverage');
    console.log('    6. SocialIntelService     — Grok + ATV + Serper');
    console.log('    7. BDPipelineService      — Discovery-to-listing pipeline');
    console.log('    8. AgentNetworkService    — Sub-agents, ACP, x402');
    console.log('');

    // Validate configured API keys
    const keys = [
      { name: 'HELIUS_API_KEY', service: 'Wallet Forensics', required: false },
      { name: 'ALLIUM_API_KEY', service: 'Multi-Chain Intel', required: false },
      { name: 'GROK_API_KEY', service: 'Grok Sentiment', required: false },
      { name: 'XAI_API_KEY', service: 'Grok Sentiment (alt)', required: false },
      { name: 'ATV_API_KEY', service: 'ATV Web3 Identity', required: false },
      { name: 'SERPER_API_KEY', service: 'Serper Web Search', required: false },
    ];

    let configuredCount = 0;
    for (const key of keys) {
      const value = runtime?.getSetting?.(key.name);
      if (value) {
        configuredCount++;
        console.log(`  ✅ ${key.service} — configured`);
      } else {
        console.log(`  ⚠️  ${key.service} — not configured (${key.name})`);
      }
    }

    console.log('  ✅ DexScreener — always available (free, no key)');
    console.log('  ✅ RugCheck — always available (free, no key)');
    configuredCount += 2;

    console.log('');
    console.log(`  ${configuredCount}/${keys.length + 2} intelligence sources active`);
    console.log('  ✅ Plugin initialized successfully');
    console.log('═══════════════════════════════════════════════════');
  },
};

// Default export for elizaOS plugin loader
export default buzzSolcexPlugin;
