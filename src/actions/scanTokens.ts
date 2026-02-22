/**
 * Buzz by SolCex — SCAN_TOKENS Action
 * Discovers and scores new token prospects from DexScreener
 */

import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { DexScreenerService } from '../services/dexscreener.js';
import { TokenScoringService } from '../services/scoring.js';
import type { BDProspect, ScanResult } from '../types/index.js';

export const scanTokensAction: Action = {
  name: 'SCAN_TOKENS',
  description: 'Scan DexScreener for new token prospects, score them, and identify listing candidates for SolCex Exchange. Use when user asks to find new tokens, scan for projects, or discover listing candidates.',
  similes: ['scan_tokens', 'find_tokens', 'discover_projects', 'token_scan', 'scan_dex'],

  examples: [
    [
      {
        name: 'user',
        content: { text: 'Scan for new token prospects on Solana' },
      },
    ],
    [
      {
        name: 'user',
        content: { text: 'Find me some good tokens to list' },
      },
    ],
    [
      {
        name: 'user',
        content: { text: 'Run a token scan and score the results' },
      },
    ],
  ],

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
    const text = (message.content?.text || '').toLowerCase();
    return (
      text.includes('scan') ||
      text.includes('find token') ||
      text.includes('discover') ||
      text.includes('listing candidate') ||
      text.includes('token prospect')
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
      const dexService = await DexScreenerService.start(runtime);
      const scoringService = await TokenScoringService.start(runtime);

      // Determine chain from message
      const text = (message.content?.text || '').toLowerCase();
      let chain = 'solana';
      if (text.includes('ethereum') || text.includes('eth')) chain = 'ethereum';
      else if (text.includes('base')) chain = 'base';
      else if (text.includes('bsc') || text.includes('bnb')) chain = 'bsc';

      if (callback) {
        await callback({
          text: `🔍 Buzz scanning DexScreener for ${chain} token prospects...`,
          action: 'SCAN_TOKENS',
        });
      }

      // Fetch latest profiles and boosted tokens
      const [profiles, boosted] = await Promise.all([
        dexService.getLatestProfiles(),
        dexService.getBoostedTokens(),
      ]);

      // Combine and deduplicate by address
      const allAddresses = new Set<string>();
      const uniqueProfiles = [...profiles, ...boosted].filter(p => {
        if (allAddresses.has(p.address)) return false;
        allAddresses.add(p.address);
        return true;
      });

      // Get detailed pair data for top candidates
      const addressBatch = uniqueProfiles.slice(0, 20).map(p => p.address);
      let pairs = addressBatch.length > 0
        ? await dexService.getTokensByAddress(addressBatch)
        : [];

      // Filter by chain if specified
      if (chain !== 'all') {
        pairs = pairs.filter(p => p.chainId === chain);
      }

      // Filter qualified pairs
      const qualifiedPairs = scoringService.filterQualifiedPairs(pairs);

      // Score and rank
      const scores = scoringService.scoreAndRank(qualifiedPairs);

      // Build prospects
      const prospects: BDProspect[] = scores.slice(0, 10).map(score => ({
        tokenAddress: score.address,
        tokenSymbol: score.symbol,
        tokenName: score.name,
        chain: score.chain,
        score,
        contactInfo: {
          twitter: uniqueProfiles.find(p => p.address === score.address)?.twitter,
          telegram: uniqueProfiles.find(p => p.address === score.address)?.telegram,
          website: uniqueProfiles.find(p => p.address === score.address)?.website,
        },
        status: 'scored',
        discoveredAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      }));

      const scanResult: ScanResult = {
        tokensScanned: pairs.length,
        tokensQualified: qualifiedPairs.length,
        prospects,
        scanTimestamp: new Date().toISOString(),
        chain,
      };

      // Format response
      let responseText = `📊 **Buzz Scan Complete** (${chain})\n`;
      responseText += `Scanned: ${scanResult.tokensScanned} | Qualified: ${scanResult.tokensQualified} | Prospects: ${prospects.length}\n\n`;

      for (const prospect of prospects.slice(0, 5)) {
        const s = prospect.score;
        const rec = s.listingRecommendation;
        const emoji = rec === 'STRONG_YES' ? '🟢' : rec === 'YES' ? '🟡' : rec === 'MAYBE' ? '🟠' : '🔴';
        responseText += `${emoji} **${s.symbol}** (${s.name})\n`;
        responseText += `   Score: ${s.overallScore}/100 | Rec: ${rec}\n`;
        responseText += `   CA: \`${s.address}\`\n`;
        if (s.flags.length > 0) responseText += `   Flags: ${s.flags.join(', ')}\n`;
        responseText += '\n';
      }

      if (prospects.length === 0) {
        responseText += 'No qualifying prospects found in this scan. Try adjusting thresholds or scanning a different chain.';
      }

      if (callback) {
        await callback({
          text: responseText,
          action: 'SCAN_TOKENS',
          data: scanResult,
        });
      }

      return {
        success: true,
        text: responseText,
        data: scanResult,
      };
    } catch (error) {
      const errorMsg = `❌ Buzz scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      if (callback) {
        await callback({ text: errorMsg, action: 'SCAN_TOKENS' });
      }
      return {
        success: false,
        text: errorMsg,
        error: String(error),
      };
    }
  },
};
