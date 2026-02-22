/**
 * Buzz by SolCex — Market Intelligence Provider
 * Provides real-time market context to the agent's decision-making
 */

import type { Provider, IAgentRuntime, Memory, State } from '@elizaos/core';
import { DexScreenerService } from '../services/dexscreener.js';

export const marketIntelProvider: Provider = {
  name: 'buzz-market-intel',
  description: 'Provides real-time trending token data and market intelligence from DexScreener for Buzz BD decisions',

  get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    try {
      const dexService = await DexScreenerService.start(runtime);

      // Fetch trending/boosted tokens
      const boosted = await dexService.getBoostedTokens();

      const trendingSummary = boosted.slice(0, 5).map(t => ({
        symbol: t.symbol || 'N/A',
        name: t.name || 'Unknown',
        chain: t.chainId || 'unknown',
        address: t.address,
      }));

      const text = trendingSummary.length > 0
        ? `Current trending tokens on DexScreener: ${trendingSummary.map(t => `${t.symbol} (${t.chain})`).join(', ')}`
        : 'No trending token data available at this time.';

      return {
        text,
        data: {
          trendingTokens: trendingSummary,
          fetchedAt: new Date().toISOString(),
          source: 'DexScreener',
        },
        values: {
          trendingCount: String(trendingSummary.length),
        },
      };
    } catch (error) {
      console.error('[Buzz/Provider] Market intel fetch failed:', error);
      return {
        text: 'Market intelligence temporarily unavailable.',
        data: { error: String(error) },
        values: {},
      };
    }
  },
};
