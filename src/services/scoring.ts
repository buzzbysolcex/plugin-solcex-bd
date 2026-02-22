/**
 * Buzz by SolCex — Token Scoring Service
 * Scores tokens based on liquidity, volume, holders, social, and contract safety
 */

import type { IAgentRuntime } from '@elizaos/core';
import type { TokenPair, TokenScore, BuzzPluginConfig } from '../types/index.js';

export class TokenScoringService {
  static serviceType = 'token-scoring' as const;

  private runtime: IAgentRuntime;
  private config: BuzzPluginConfig;

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
    this.config = {
      minLiquidityUsd: Number(runtime.getSetting?.('BUZZ_MIN_LIQUIDITY') || 10000),
      minVolumeH24: Number(runtime.getSetting?.('BUZZ_MIN_VOLUME_24H') || 5000),
      minOverallScore: Number(runtime.getSetting?.('BUZZ_MIN_SCORE') || 60),
    };
  }

  get capabilityDescription(): string {
    return 'Scores tokens on liquidity, volume, holder distribution, social presence, and contract safety';
  }

  static async start(runtime: IAgentRuntime): Promise<TokenScoringService> {
    const service = new TokenScoringService(runtime);
    console.log('[Buzz/Scoring] Service initialized');
    return service;
  }

  async stop(): Promise<void> {
    console.log('[Buzz/Scoring] Service stopped');
  }

  /**
   * Score a token based on its pair data
   */
  scoreToken(pair: TokenPair): TokenScore {
    const flags: string[] = [];

    // Liquidity Score (0-100)
    const liquidityUsd = pair.liquidity?.usd || 0;
    let liquidityScore = 0;
    if (liquidityUsd >= 1000000) liquidityScore = 100;
    else if (liquidityUsd >= 500000) liquidityScore = 85;
    else if (liquidityUsd >= 100000) liquidityScore = 70;
    else if (liquidityUsd >= 50000) liquidityScore = 55;
    else if (liquidityUsd >= 10000) liquidityScore = 40;
    else if (liquidityUsd >= 5000) liquidityScore = 25;
    else {
      liquidityScore = 10;
      flags.push('LOW_LIQUIDITY');
    }

    // Volume Score (0-100)
    const volume24h = pair.volume?.h24 || 0;
    let volumeScore = 0;
    if (volume24h >= 5000000) volumeScore = 100;
    else if (volume24h >= 1000000) volumeScore = 85;
    else if (volume24h >= 500000) volumeScore = 70;
    else if (volume24h >= 100000) volumeScore = 55;
    else if (volume24h >= 50000) volumeScore = 40;
    else if (volume24h >= 10000) volumeScore = 25;
    else {
      volumeScore = 10;
      flags.push('LOW_VOLUME');
    }

    // Holder Score (approximated from transaction patterns)
    const txns24h = pair.txns?.h24 || { buys: 0, sells: 0 };
    const totalTxns = txns24h.buys + txns24h.sells;
    const buyRatio = totalTxns > 0 ? txns24h.buys / totalTxns : 0;
    let holderScore = 0;
    if (totalTxns >= 1000) holderScore = 90;
    else if (totalTxns >= 500) holderScore = 75;
    else if (totalTxns >= 200) holderScore = 60;
    else if (totalTxns >= 100) holderScore = 45;
    else if (totalTxns >= 50) holderScore = 30;
    else {
      holderScore = 15;
      flags.push('LOW_ACTIVITY');
    }

    // Buy/sell ratio check
    if (buyRatio > 0.85) flags.push('HIGH_BUY_PRESSURE');
    if (buyRatio < 0.15) flags.push('HIGH_SELL_PRESSURE');

    // Social Score (placeholder — would integrate with social APIs)
    let socialScore = 50; // Default neutral

    // Contract Safety Score (basic heuristics)
    let contractSafetyScore = 70; // Default moderate
    const pairAge = Date.now() - (pair.pairCreatedAt || Date.now());
    const pairAgeDays = pairAge / (1000 * 60 * 60 * 24);

    if (pairAgeDays < 1) {
      contractSafetyScore -= 30;
      flags.push('VERY_NEW_TOKEN');
    } else if (pairAgeDays < 7) {
      contractSafetyScore -= 15;
      flags.push('NEW_TOKEN');
    } else if (pairAgeDays > 90) {
      contractSafetyScore += 15;
    }

    // FDV sanity check
    if (pair.fdv && pair.fdv > 0) {
      const volumeToFdv = volume24h / pair.fdv;
      if (volumeToFdv > 1) {
        flags.push('SUSPICIOUS_VOLUME_TO_FDV');
        contractSafetyScore -= 20;
      }
    }

    contractSafetyScore = Math.max(0, Math.min(100, contractSafetyScore));

    // Overall Score (weighted average)
    const overallScore = Math.round(
      liquidityScore * 0.25 +
      volumeScore * 0.25 +
      holderScore * 0.20 +
      socialScore * 0.15 +
      contractSafetyScore * 0.15
    );

    // Listing Recommendation
    let listingRecommendation: TokenScore['listingRecommendation'];
    if (flags.includes('SUSPICIOUS_VOLUME_TO_FDV') || flags.includes('VERY_NEW_TOKEN')) {
      listingRecommendation = overallScore >= 70 ? 'MAYBE' : 'REJECT';
    } else if (overallScore >= 80) {
      listingRecommendation = 'STRONG_YES';
    } else if (overallScore >= 65) {
      listingRecommendation = 'YES';
    } else if (overallScore >= 50) {
      listingRecommendation = 'MAYBE';
    } else if (overallScore >= 35) {
      listingRecommendation = 'NO';
    } else {
      listingRecommendation = 'REJECT';
    }

    return {
      address: pair.baseToken.address,
      symbol: pair.baseToken.symbol,
      name: pair.baseToken.name,
      chain: pair.chainId,
      overallScore,
      liquidityScore,
      volumeScore,
      holderScore,
      socialScore,
      contractSafetyScore,
      listingRecommendation,
      flags,
      scoredAt: new Date().toISOString(),
    };
  }

  /**
   * Filter pairs that meet minimum thresholds
   */
  filterQualifiedPairs(pairs: TokenPair[]): TokenPair[] {
    return pairs.filter(pair => {
      const liq = pair.liquidity?.usd || 0;
      const vol = pair.volume?.h24 || 0;
      return liq >= (this.config.minLiquidityUsd || 10000) &&
             vol >= (this.config.minVolumeH24 || 5000);
    });
  }

  /**
   * Score and rank multiple tokens
   */
  scoreAndRank(pairs: TokenPair[]): TokenScore[] {
    return pairs
      .map(pair => this.scoreToken(pair))
      .filter(score => score.overallScore >= (this.config.minOverallScore || 60))
      .sort((a, b) => b.overallScore - a.overallScore);
  }
}
