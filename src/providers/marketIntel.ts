import type { Provider, IAgentRuntime, Memory, State } from "@elizaos/core";
import { getTrendingTokens } from "../services/dexscreener.js";

export const marketIntelProvider: Provider = {
  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State
  ): Promise<string> => {
    try {
      // Try Buzz API first for enriched intel
      const apiUrl = runtime.getSetting("SOLCEX_API_URL");
      const apiKey = runtime.getSetting("SOLCEX_API_KEY");

      if (apiUrl && apiKey) {
        try {
          const resp = await fetch(`${apiUrl}/market-intel`, {
            headers: { "X-SolCex-API-Key": apiKey },
          });

          if (resp.ok) {
            const data = await resp.json();
            const trending = (data.trending || [])
              .slice(0, 5)
              .map((t: any) => `${t.symbol} (${t.chain}, score: ${t.score})`)
              .join(", ");

            return (
              `Market Intelligence (SolCex BD):\n` +
              `  Trending: ${trending || "None"}\n` +
              `  Volume spikes: ${(data.volumeSpikes || []).length} tokens\n` +
              `  New launches (24h): ${(data.newLaunches || []).length}\n` +
              `  Pipeline: ${data.pipelineCount || 0} tokens tracked`
            );
          }
        } catch {
          // Fall through to DexScreener
        }
      }

      // Fallback: DexScreener trending only
      const trending = await getTrendingTokens();
      const top5 = trending
        .slice(0, 5)
        .map(
          (p) =>
            `${p.baseToken.symbol} (${p.chainId}, liq: $${(p.liquidity?.usd ?? 0).toLocaleString()})`
        )
        .join(", ");

      return (
        `Market Intelligence (DexScreener):\n` +
        `  Trending tokens: ${top5 || "No data"}\n` +
        `  Source: DexScreener latest profiles\n` +
        `  Note: Connect SOLCEX_API for enriched multi-source intel`
      );
    } catch {
      return "Market intelligence temporarily unavailable.";
    }
  },
};
