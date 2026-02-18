// ============================================================
// DexScreener API Service
// Free multi-chain DEX data: pairs, liquidity, volume, socials
// Docs: https://docs.dexscreener.com/api/reference
// Rate limit: 300 requests/minute (no API key needed)
// ============================================================

import type {
  DexPair,
  DexSearchResponse,
  DexTokenResponse,
} from "../types/index.js";

const BASE_URL = "https://api.dexscreener.com/latest/dex";
const TOKENS_URL = "https://api.dexscreener.com/tokens/v1";

/**
 * Search tokens by keyword across all chains
 */
export async function searchTokens(query: string): Promise<DexPair[]> {
  const resp = await fetch(`${BASE_URL}/search?q=${encodeURIComponent(query)}`);
  if (!resp.ok) throw new Error(`DexScreener search failed: ${resp.status}`);
  const data = (await resp.json()) as DexSearchResponse;
  return data.pairs || [];
}

/**
 * Get pair data by contract address(es) on a specific chain
 * Supports up to 30 addresses comma-separated
 */
export async function getTokenPairs(
  chain: string,
  contractAddress: string
): Promise<DexPair[]> {
  const resp = await fetch(`${TOKENS_URL}/${chain}/${contractAddress}`);
  if (!resp.ok) throw new Error(`DexScreener token lookup failed: ${resp.status}`);
  const data = (await resp.json()) as DexTokenResponse;
  return data.pairs || [];
}

/**
 * Get pair data by pair address
 */
export async function getPairByAddress(
  chain: string,
  pairAddress: string
): Promise<DexPair | null> {
  const resp = await fetch(`${BASE_URL}/pairs/${chain}/${pairAddress}`);
  if (!resp.ok) throw new Error(`DexScreener pair lookup failed: ${resp.status}`);
  const data = (await resp.json()) as { pairs?: DexPair[]; pair?: DexPair };
  const pairs = data.pairs || data.pair ? [data.pair || data.pairs?.[0]] : [];
  return pairs[0] || null;
}

/**
 * Get trending/boosted tokens (new profiles)
 */
export async function getTrendingTokens(): Promise<DexPair[]> {
  const resp = await fetch("https://api.dexscreener.com/token-profiles/latest/v1");
  if (!resp.ok) throw new Error(`DexScreener trending failed: ${resp.status}`);
  const profiles = (await resp.json()) as Array<{ chainId: string; tokenAddress: string }>;

  // Get top 10 unique addresses grouped by chain
  const seen = new Set<string>();
  const unique: Array<{ chain: string; address: string }> = [];
  for (const p of profiles) {
    const key = `${p.chainId}:${p.tokenAddress}`;
    if (!seen.has(key) && unique.length < 10) {
      seen.add(key);
      unique.push({ chain: p.chainId, address: p.tokenAddress });
    }
  }

  // Fetch pair data for each
  const pairs: DexPair[] = [];
  for (const { chain, address } of unique) {
    try {
      const result = await getTokenPairs(chain, address);
      if (result.length > 0) pairs.push(result[0]);
    } catch {
      // Skip failed lookups
    }
  }

  return pairs;
}

/**
 * Get boosted tokens (promoted on DexScreener)
 */
export async function getBoostedTokens(): Promise<DexPair[]> {
  const resp = await fetch("https://api.dexscreener.com/token-boosts/latest/v1");
  if (!resp.ok) return [];
  const boosts = (await resp.json()) as Array<{ chainId: string; tokenAddress: string; amount: number }>;

  const topBoosts = boosts.slice(0, 10);
  const pairs: DexPair[] = [];

  for (const b of topBoosts) {
    try {
      const result = await getTokenPairs(b.chainId, b.tokenAddress);
      if (result.length > 0) pairs.push(result[0]);
    } catch {
      // Skip
    }
  }

  return pairs;
}

/**
 * Scan for high-potential tokens: trending + boosted, filtered by minimums
 */
export async function scanHighPotential(options?: {
  minLiquidity?: number;
  minVolume24h?: number;
  minMarketCap?: number;
  chains?: string[];
}): Promise<DexPair[]> {
  const minLiq = options?.minLiquidity ?? 100_000;
  const minVol = options?.minVolume24h ?? 50_000;
  const minMcap = options?.minMarketCap ?? 500_000;
  const chains = options?.chains;

  const [trending, boosted] = await Promise.allSettled([
    getTrendingTokens(),
    getBoostedTokens(),
  ]);

  const allPairs: DexPair[] = [
    ...(trending.status === "fulfilled" ? trending.value : []),
    ...(boosted.status === "fulfilled" ? boosted.value : []),
  ];

  // Deduplicate by pair address
  const seen = new Set<string>();
  const unique: DexPair[] = [];
  for (const pair of allPairs) {
    if (!seen.has(pair.pairAddress)) {
      seen.add(pair.pairAddress);
      unique.push(pair);
    }
  }

  // Filter by minimums
  return unique.filter((pair) => {
    const liq = pair.liquidity?.usd ?? 0;
    const vol = pair.volume?.h24 ?? 0;
    const mcap = pair.marketCap ?? pair.fdv ?? 0;
    const chainMatch = !chains || chains.includes(pair.chainId);
    return liq >= minLiq && vol >= minVol && mcap >= minMcap && chainMatch;
  });
}

/**
 * Get token age in days from pair creation timestamp
 */
export function getTokenAgeDays(pair: DexPair): number {
  if (!pair.pairCreatedAt) return -1;
  const now = Date.now();
  const created = pair.pairCreatedAt;
  return Math.floor((now - created) / (1000 * 60 * 60 * 24));
}

/**
 * Count social platforms from pair info
 */
export function countSocials(pair: DexPair): number {
  let count = 0;
  if (pair.info?.websites?.length) count += pair.info.websites.length;
  if (pair.info?.socials?.length) count += pair.info.socials.length;
  return count;
}
