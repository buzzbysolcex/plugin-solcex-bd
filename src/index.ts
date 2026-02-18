// ============================================================
// @elizaos/plugin-solcex-bd
// SolCex Exchange Business Development Plugin for ElizaOS
//
// Token discovery, 100-point scoring, wallet forensics,
// and listing pipeline for autonomous BD agents.
//
// By: Buzz BD Agent | SolCex Exchange
// ERC-8004: ETH #25045 | Base #17483
// GitHub: https://github.com/buzzbysolcex/plugin-solcex-bd
// ============================================================

import type { Plugin } from "@elizaos/core";

// Actions
import { scanTokensAction } from "./actions/scanTokens.js";
import { scoreTokenAction } from "./actions/scoreToken.js";
import { checkWalletAction } from "./actions/checkWallet.js";
import { submitListingAction } from "./actions/submitListing.js";

// Providers
import { pipelineStatusProvider } from "./providers/pipelineStatus.js";
import { marketIntelProvider } from "./providers/marketIntel.js";

// Evaluators
import { listingReadinessEvaluator } from "./evaluators/listingReadiness.js";

// Types
export type {
  TokenScore,
  ScoreBreakdown,
  ScoreAction,
  CatalystAdjustment,
  WalletForensicsResult,
  WalletFlag,
  WalletFlagDetail,
  PipelineStatus,
  PipelineStage,
  PipelineEntry,
  ListingInquiry,
  MarketIntel,
  DexPair,
  SolcexPluginConfig,
} from "./types/index.js";

// Service functions (for direct use)
export { searchTokens, getTokenPairs, scanHighPotential } from "./services/dexscreener.js";
export { scoreToken, batchScore, applyWalletAdjustment } from "./services/scoring.js";
export { analyzeWallet } from "./services/helius.js";

// --- Plugin Definition ---

export const solcexBdPlugin: Plugin = {
  name: "plugin-solcex-bd",
  description:
    "SolCex Exchange BD — Multi-chain token discovery, 100-point scoring, " +
    "wallet forensics via Helius, and listing pipeline management. " +
    "Built by Buzz BD Agent (ERC-8004 #25045). " +
    "Actions: SCAN_TOKENS, SCORE_TOKEN, CHECK_WALLET, SUBMIT_LISTING_INQUIRY",
  actions: [
    scanTokensAction,
    scoreTokenAction,
    checkWalletAction,
    submitListingAction,
  ],
  providers: [
    pipelineStatusProvider,
    marketIntelProvider,
  ],
  evaluators: [
    listingReadinessEvaluator,
  ],
  services: [],
};

export default solcexBdPlugin;
