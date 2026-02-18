// ============================================================
// @elizaos/plugin-solcex-bd — Type Definitions
// SolCex Exchange Business Development Plugin for ElizaOS
// ============================================================

// --- Token & Pair Data (from DexScreener) ---

export interface DexPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    h24: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    m5: { buys: number; sells: number };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  liquidity?: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: {
    imageUrl?: string;
    websites?: Array<{ label: string; url: string }>;
    socials?: Array<{ type: string; url: string }>;
  };
}

export interface DexSearchResponse {
  schemaVersion: string;
  pairs: DexPair[] | null;
}

export interface DexTokenResponse {
  pairs: DexPair[] | null;
}

// --- Scoring ---

export interface ScoreBreakdown {
  category: string;
  weight: number;
  score: number;
  maxScore: number;
  value: string;
  details: string;
}

export interface CatalystAdjustment {
  name: string;
  points: number;
  reason: string;
}

export type ScoreAction = "HOT" | "QUALIFIED" | "WATCH" | "SKIP";

export interface TokenScore {
  contractAddress: string;
  chain: string;
  tokenName: string;
  tokenSymbol: string;
  totalScore: number;
  maxScore: number;
  action: ScoreAction;
  breakdown: ScoreBreakdown[];
  catalysts: CatalystAdjustment[];
  recommendation: string;
  scoredAt: string;
  pairAddress: string;
  pairUrl: string;
}

// --- Wallet Forensics (Helius) ---

export interface HeliusBalanceResponse {
  nativeBalance: number;
  tokens: Array<{
    mint: string;
    amount: number;
    decimals: number;
  }>;
}

export interface HeliusTransaction {
  signature: string;
  timestamp: number;
  type: string;
  description: string;
  fee: number;
  nativeTransfers: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
  tokenTransfers: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    mint: string;
    tokenAmount: number;
  }>;
}

export type WalletFlag =
  | "WALLET_VERIFIED"
  | "INSTITUTIONAL"
  | "NET_POSITIVE"
  | "SERIAL_CREATOR"
  | "DUMP_ALERT"
  | "MIXER_REJECT"
  | "UNKNOWN";

export interface WalletFlagDetail {
  flag: WalletFlag;
  impact: number; // positive = bonus, negative = penalty
  reason: string;
}

export interface WalletForensicsResult {
  deployerAddress: string;
  chain: string;
  fundedBy: string;
  nativeBalance: number;
  tokenCount: number;
  recentTransactions: number;
  flags: WalletFlagDetail[];
  scoreAdjustment: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  analyzedAt: string;
  summary: string;
}

// --- Pipeline ---

export interface PipelineEntry {
  contractAddress: string;
  chain: string;
  tokenName: string;
  tokenSymbol: string;
  score: number;
  stage: PipelineStage;
  walletChecked: boolean;
  walletFlags: WalletFlag[];
  addedAt: string;
  updatedAt: string;
}

export type PipelineStage =
  | "DISCOVERED"
  | "SCORED"
  | "VERIFIED"
  | "QUALIFIED"
  | "OUTREACH_DRAFTED"
  | "HUMAN_APPROVED"
  | "SENT"
  | "RESPONDED"
  | "NEGOTIATING"
  | "LISTED";

export interface PipelineStatus {
  total: number;
  byStage: Record<PipelineStage, number>;
  hot: number;
  qualified: number;
  pendingOutreach: number;
  updatedAt: string;
}

// --- Listing Inquiry ---

export interface ListingInquiry {
  id: string;
  contractAddress: string;
  chain: string;
  tokenName: string;
  tokenSymbol: string;
  score: number;
  walletResult: WalletForensicsResult | null;
  requestedBy: string; // agent name or ID
  requestedAt: string;
  status: "QUEUED" | "APPROVED" | "REJECTED" | "SENT";
  notes: string;
}

// --- Market Intelligence ---

export interface MarketIntel {
  trending: Array<{
    symbol: string;
    chain: string;
    score: number;
    volumeChange24h: number;
  }>;
  volumeSpikes: Array<{
    symbol: string;
    chain: string;
    volume24h: number;
    changePercent: number;
  }>;
  newLaunches: Array<{
    symbol: string;
    chain: string;
    contractAddress: string;
    launchedAt: string;
    liquidity: number;
  }>;
  pipelineCount: number;
  updatedAt: string;
}

// --- Plugin Config ---

export interface SolcexPluginConfig {
  heliusApiKey?: string;
  solcexApiUrl?: string;
  solcexApiKey?: string;
  x402WalletAddress?: string;
  x402DailyBudget?: number;
  defaultChain?: string;
  maxResultsPerScan?: number;
  minScoreForWalletCheck?: number;
  minScoreForOutreach?: number;
}

export const DEFAULT_CONFIG: SolcexPluginConfig = {
  defaultChain: "solana",
  maxResultsPerScan: 20,
  minScoreForWalletCheck: 70,
  minScoreForOutreach: 85,
};
