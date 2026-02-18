// ============================================================
// SolCex 100-Point Scoring Engine
// 6 weighted factors + catalyst adjustments + wallet forensics
// Production-tested by Buzz BD Agent since Jan 2026
// ============================================================

import type {
  DexPair,
  TokenScore,
  ScoreBreakdown,
  ScoreAction,
  CatalystAdjustment,
  WalletForensicsResult,
} from "../types/index.js";
import { getTokenAgeDays, countSocials } from "./dexscreener.js";

// --- Weight Configuration ---

const WEIGHTS = {
  liquidity: 25,
  marketCap: 20,
  volume24h: 20,
  social: 15,
  age: 10,
  team: 10,
} as const;

// --- Individual Factor Scoring ---

function scoreLiquidity(pair: DexPair): ScoreBreakdown {
  const usd = pair.liquidity?.usd ?? 0;
  let score = 0;
  let details = "";

  if (usd >= 500_000) {
    score = 25;
    details = "Excellent liquidity";
  } else if (usd >= 200_000) {
    score = 20;
    details = "Good liquidity";
  } else if (usd >= 100_000) {
    score = 15;
    details = "Acceptable liquidity";
  } else if (usd >= 50_000) {
    score = 10;
    details = "Low liquidity — higher risk";
  } else {
    score = 5;
    details = "Very low liquidity — caution";
  }

  return {
    category: "Liquidity",
    weight: WEIGHTS.liquidity,
    score,
    maxScore: 25,
    value: `$${usd.toLocaleString()}`,
    details,
  };
}

function scoreMarketCap(pair: DexPair): ScoreBreakdown {
  const mcap = pair.marketCap ?? pair.fdv ?? 0;
  let score = 0;
  let details = "";

  if (mcap >= 10_000_000) {
    score = 20;
    details = "Strong market cap";
  } else if (mcap >= 1_000_000) {
    score = 16;
    details = "Good market cap";
  } else if (mcap >= 500_000) {
    score = 12;
    details = "Acceptable market cap";
  } else if (mcap >= 100_000) {
    score = 8;
    details = "Small cap — early stage";
  } else {
    score = 4;
    details = "Micro cap — high risk";
  }

  return {
    category: "Market Cap",
    weight: WEIGHTS.marketCap,
    score,
    maxScore: 20,
    value: `$${mcap.toLocaleString()}`,
    details,
  };
}

function scoreVolume(pair: DexPair): ScoreBreakdown {
  const vol = pair.volume?.h24 ?? 0;
  let score = 0;
  let details = "";

  if (vol >= 1_000_000) {
    score = 20;
    details = "Excellent volume";
  } else if (vol >= 500_000) {
    score = 16;
    details = "Good volume";
  } else if (vol >= 100_000) {
    score = 12;
    details = "Moderate volume";
  } else if (vol >= 50_000) {
    score = 8;
    details = "Low volume";
  } else {
    score = 4;
    details = "Very low volume";
  }

  return {
    category: "Volume 24h",
    weight: WEIGHTS.volume24h,
    score,
    maxScore: 20,
    value: `$${vol.toLocaleString()}`,
    details,
  };
}

function scoreSocial(pair: DexPair): ScoreBreakdown {
  const platforms = countSocials(pair);
  let score = 0;
  let details = "";

  if (platforms >= 4) {
    score = 15;
    details = `${platforms} platforms — strong presence`;
  } else if (platforms >= 2) {
    score = 10;
    details = `${platforms} platforms — moderate presence`;
  } else if (platforms >= 1) {
    score = 6;
    details = `${platforms} platform — minimal presence`;
  } else {
    score = 2;
    details = "No social links found";
  }

  return {
    category: "Social",
    weight: WEIGHTS.social,
    score,
    maxScore: 15,
    value: `${platforms} platforms`,
    details,
  };
}

function scoreAge(pair: DexPair): ScoreBreakdown {
  const days = getTokenAgeDays(pair);
  let score = 0;
  let details = "";

  if (days > 180) {
    score = 10;
    details = `${days} days — established`;
  } else if (days > 30) {
    score = 8;
    details = `${days} days — moderate history`;
  } else if (days > 7) {
    score = 5;
    details = `${days} days — new`;
  } else if (days >= 0) {
    score = 3;
    details = `${days} days — very new, higher risk`;
  } else {
    score = 2;
    details = "Age unknown";
  }

  return {
    category: "Age",
    weight: WEIGHTS.age,
    score,
    maxScore: 10,
    value: days >= 0 ? `${days} days` : "Unknown",
    details,
  };
}

function scoreTeam(pair: DexPair): ScoreBreakdown {
  // Heuristic: if they have websites + multiple socials, likely more transparent
  const websites = pair.info?.websites?.length ?? 0;
  const socials = pair.info?.socials?.length ?? 0;
  let score = 0;
  let details = "";

  if (websites >= 1 && socials >= 2) {
    score = 10;
    details = "Website + multiple socials — good transparency";
  } else if (websites >= 1 || socials >= 2) {
    score = 7;
    details = "Some online presence";
  } else if (socials >= 1) {
    score = 4;
    details = "Minimal online presence";
  } else {
    score = 2;
    details = "No verifiable team info";
  }

  return {
    category: "Team Transparency",
    weight: WEIGHTS.team,
    score,
    maxScore: 10,
    value: `${websites} sites, ${socials} socials`,
    details,
  };
}

// --- Catalyst Detection ---

function detectCatalysts(pair: DexPair): CatalystAdjustment[] {
  const catalysts: CatalystAdjustment[] = [];
  const vol24h = pair.volume?.h24 ?? 0;
  const vol6h = pair.volume?.h6 ?? 0;
  const priceChange = pair.priceChange?.h24 ?? 0;
  const buys24h = pair.txns?.h24?.buys ?? 0;
  const sells24h = pair.txns?.h24?.sells ?? 0;
  const socials = countSocials(pair);

  // Volume spike: 6h volume > 50% of 24h volume = momentum
  if (vol6h > 0 && vol24h > 0 && vol6h / vol24h > 0.5) {
    catalysts.push({
      name: "Volume Momentum",
      points: 5,
      reason: "6h volume >50% of 24h — active momentum",
    });
  }

  // Strong buy pressure
  if (buys24h > 0 && sells24h > 0 && buys24h / sells24h > 2) {
    catalysts.push({
      name: "Buy Pressure",
      points: 3,
      reason: `Buy/sell ratio ${(buys24h / sells24h).toFixed(1)}x`,
    });
  }

  // Multi-platform social
  if (socials >= 4) {
    catalysts.push({
      name: "Multi-Platform Presence",
      points: 5,
      reason: `${socials} social platforms active`,
    });
  }

  // Negative: severe dump
  if (priceChange < -30) {
    catalysts.push({
      name: "Price Dump",
      points: -10,
      reason: `${priceChange.toFixed(1)}% drop in 24h`,
    });
  }

  // Negative: low buy/sell ratio (dump pattern)
  if (buys24h > 0 && sells24h > 0 && sells24h / buys24h > 3) {
    catalysts.push({
      name: "Sell Pressure",
      points: -5,
      reason: `Sell/buy ratio ${(sells24h / buys24h).toFixed(1)}x — dump risk`,
    });
  }

  return catalysts;
}

// --- Score Action Mapping ---

function getAction(score: number): ScoreAction {
  if (score >= 85) return "HOT";
  if (score >= 70) return "QUALIFIED";
  if (score >= 50) return "WATCH";
  return "SKIP";
}

function getRecommendation(action: ScoreAction): string {
  switch (action) {
    case "HOT":
      return "🔥 HOT — Immediate outreach + wallet forensics recommended";
    case "QUALIFIED":
      return "✅ QUALIFIED — Priority queue, run wallet forensics";
    case "WATCH":
      return "👀 WATCH — Monitor for 48 hours";
    case "SKIP":
      return "⏭️ SKIP — Below threshold, log only";
  }
}

// --- Main Scoring Function ---

/**
 * Score a token from DexScreener pair data
 * Returns a full TokenScore with breakdown, catalysts, and recommendation
 */
export function scoreToken(pair: DexPair): TokenScore {
  // Run all factor scores
  const breakdown: ScoreBreakdown[] = [
    scoreLiquidity(pair),
    scoreMarketCap(pair),
    scoreVolume(pair),
    scoreSocial(pair),
    scoreAge(pair),
    scoreTeam(pair),
  ];

  // Base score from factors
  let baseScore = breakdown.reduce((sum, b) => sum + b.score, 0);

  // Catalyst adjustments
  const catalysts = detectCatalysts(pair);
  const catalystTotal = catalysts.reduce((sum, c) => sum + c.points, 0);

  // Total score (capped at 0-100)
  const totalScore = Math.max(0, Math.min(100, baseScore + catalystTotal));

  const action = getAction(totalScore);

  return {
    contractAddress: pair.baseToken.address,
    chain: pair.chainId,
    tokenName: pair.baseToken.name,
    tokenSymbol: pair.baseToken.symbol,
    totalScore,
    maxScore: 100,
    action,
    breakdown,
    catalysts,
    recommendation: getRecommendation(action),
    scoredAt: new Date().toISOString(),
    pairAddress: pair.pairAddress,
    pairUrl: pair.url,
  };
}

/**
 * Apply wallet forensics result to an existing score
 * Returns adjusted total score
 */
export function applyWalletAdjustment(
  tokenScore: TokenScore,
  walletResult: WalletForensicsResult
): TokenScore {
  const adjusted = { ...tokenScore };
  const adjustment = walletResult.scoreAdjustment;

  // Add wallet flags as catalysts
  for (const flag of walletResult.flags) {
    adjusted.catalysts.push({
      name: `Wallet: ${flag.flag}`,
      points: flag.impact,
      reason: flag.reason,
    });
  }

  // Recalculate total
  adjusted.totalScore = Math.max(
    0,
    Math.min(100, tokenScore.totalScore + adjustment)
  );
  adjusted.action = getAction(adjusted.totalScore);
  adjusted.recommendation = getRecommendation(adjusted.action);

  // Auto-reject mixer-funded
  if (walletResult.flags.some((f) => f.flag === "MIXER_REJECT")) {
    adjusted.totalScore = 0;
    adjusted.action = "SKIP";
    adjusted.recommendation =
      "🚫 AUTO-REJECTED — Deployer funded via mixer/tornado";
  }

  return adjusted;
}

/**
 * Batch score multiple pairs, sorted by score descending
 */
export function batchScore(pairs: DexPair[]): TokenScore[] {
  return pairs.map(scoreToken).sort((a, b) => b.totalScore - a.totalScore);
}
