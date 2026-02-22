/**
 * Buzz by SolCex — SCORE_TOKEN Action
 * Score a specific token by contract address
 */

import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { DexScreenerService } from '../services/dexscreener.js';
import { TokenScoringService } from '../services/scoring.js';

export const scoreTokenAction: Action = {
  name: 'SCORE_TOKEN',
  description: 'Score a specific token by its contract address. Analyzes liquidity, volume, holder activity, and contract safety to produce a listing recommendation for SolCex Exchange.',
  similes: ['score_token', 'analyze_token', 'rate_token', 'check_token', 'evaluate_token'],

  examples: [
    [
      {
        name: 'user',
        content: { text: 'Score this token: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
      },
    ],
    [
      {
        name: 'user',
        content: { text: 'Analyze token 0x1234... for listing' },
      },
    ],
  ],

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
    const text = (message.content?.text || '').toLowerCase();
    // Check for contract address pattern (Solana base58 or EVM hex)
    const hasAddress = /[1-9A-HJ-NP-Za-km-z]{32,44}|0x[a-fA-F0-9]{40}/.test(message.content?.text || '');
    return hasAddress && (
      text.includes('score') ||
      text.includes('analyze') ||
      text.includes('rate') ||
      text.includes('check') ||
      text.includes('evaluate') ||
      text.includes('listing')
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ) => {
    try {
      const text = message.content?.text || '';

      // Extract address from message
      const solanaMatch = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
      const evmMatch = text.match(/0x[a-fA-F0-9]{40}/);
      const address = evmMatch?.[0] || solanaMatch?.[0];

      if (!address) {
        const errorMsg = '❌ No valid token address found. Please provide a Solana or EVM contract address.';
        if (callback) await callback({ text: errorMsg, action: 'SCORE_TOKEN' });
        return { success: false, text: errorMsg };
      }

      if (callback) {
        await callback({
          text: `🔎 Buzz analyzing token \`${address}\`...`,
          action: 'SCORE_TOKEN',
        });
      }

      const dexService = await DexScreenerService.start(runtime);
      const scoringService = await TokenScoringService.start(runtime);

      // Fetch token data
      const pairs = await dexService.getTokensByAddress([address]);

      if (!pairs || pairs.length === 0) {
        const notFoundMsg = `❌ Token \`${address}\` not found on DexScreener. It may not be listed on any DEX yet.`;
        if (callback) await callback({ text: notFoundMsg, action: 'SCORE_TOKEN' });
        return { success: false, text: notFoundMsg };
      }

      // Use the highest liquidity pair
      const bestPair = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
      const score = scoringService.scoreToken(bestPair);

      const rec = score.listingRecommendation;
      const emoji = rec === 'STRONG_YES' ? '🟢' : rec === 'YES' ? '🟡' : rec === 'MAYBE' ? '🟠' : '🔴';

      let responseText = `${emoji} **Buzz Token Score: ${score.symbol}** (${score.name})\n\n`;
      responseText += `📍 Chain: ${score.chain}\n`;
      responseText += `📋 CA: \`${score.address}\`\n\n`;
      responseText += `**Overall Score: ${score.overallScore}/100** — ${rec}\n\n`;
      responseText += `| Metric | Score |\n|--------|-------|\n`;
      responseText += `| Liquidity | ${score.liquidityScore}/100 |\n`;
      responseText += `| Volume (24h) | ${score.volumeScore}/100 |\n`;
      responseText += `| Holder Activity | ${score.holderScore}/100 |\n`;
      responseText += `| Social Presence | ${score.socialScore}/100 |\n`;
      responseText += `| Contract Safety | ${score.contractSafetyScore}/100 |\n\n`;

      if (bestPair.liquidity?.usd) responseText += `💰 Liquidity: $${bestPair.liquidity.usd.toLocaleString()}\n`;
      if (bestPair.volume?.h24) responseText += `📊 Volume 24h: $${bestPair.volume.h24.toLocaleString()}\n`;
      if (bestPair.fdv) responseText += `🏷️ FDV: $${bestPair.fdv.toLocaleString()}\n`;
      if (bestPair.priceUsd) responseText += `💵 Price: $${bestPair.priceUsd}\n\n`;

      if (score.flags.length > 0) {
        responseText += `⚠️ **Flags:** ${score.flags.join(', ')}\n\n`;
      }

      responseText += `🔗 [DexScreener](https://dexscreener.com/${score.chain}/${score.address})`;

      if (callback) {
        await callback({
          text: responseText,
          action: 'SCORE_TOKEN',
          data: { score, pair: bestPair },
        });
      }

      return {
        success: true,
        text: responseText,
        data: { score, pair: bestPair },
      };
    } catch (error) {
      const errorMsg = `❌ Token scoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      if (callback) await callback({ text: errorMsg, action: 'SCORE_TOKEN' });
      return { success: false, text: errorMsg, error: String(error) };
    }
  },
};
