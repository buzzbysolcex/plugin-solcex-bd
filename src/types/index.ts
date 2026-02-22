/**
 * Buzz by SolCex — elizaOS Plugin Types
 * Token discovery, scoring, and BD pipeline types
 */

export interface TokenProfile {
  address: string;
  chainId: string;
  symbol: string;
  name: string;
  description?: string;
  icon?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  links?: Record<string, string>;
}

export interface TokenPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: {
    address: string;
    symbol: string;
    name: string;
  };
  quoteToken: {
    address: string;
    symbol: string;
    name: string;
  };
  priceUsd: string;
  priceNative: string;
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  liquidity: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv: number;
  marketCap: number;
  pairCreatedAt: number;
  txns: {
    h24: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    m5: { buys: number; sells: number };
  };
}

export interface TokenScore {
  address: string;
  symbol: string;
  name: string;
  chain: string;
  overallScore: number;
  liquidityScore: number;
  volumeScore: number;
  holderScore: number;
  socialScore: number;
  contractSafetyScore: number;
  listingRecommendation: 'STRONG_YES' | 'YES' | 'MAYBE' | 'NO' | 'REJECT';
  flags: string[];
  scoredAt: string;
}

export interface BDProspect {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  chain: string;
  score: TokenScore;
  contactInfo?: {
    twitter?: string;
    telegram?: string;
    email?: string;
    website?: string;
  };
  status: 'discovered' | 'scored' | 'contacted' | 'negotiating' | 'listed' | 'rejected';
  discoveredAt: string;
  lastUpdated: string;
  notes?: string;
}

export interface BuzzPluginConfig {
  dexscreenerApiUrl?: string;
  heliusApiKey?: string;
  solcexApiUrl?: string;
  minLiquidityUsd?: number;
  minVolumeH24?: number;
  minOverallScore?: number;
  autoOutreach?: boolean;
  scanIntervalMs?: number;
}

export interface ScanResult {
  tokensScanned: number;
  tokensQualified: number;
  prospects: BDProspect[];
  scanTimestamp: string;
  chain: string;
}

export interface WalletForensics {
  address: string;
  balanceSol?: number;
  tokenAccounts?: number;
  nftCount?: number;
  transactionCount?: number;
  firstTransaction?: string;
  lastTransaction?: string;
  topTokenHoldings?: Array<{
    mint: string;
    symbol: string;
    amount: number;
    valueUsd?: number;
  }>;
  riskFlags?: string[];
}
