import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { scanHighPotential, searchTokens } from "../services/dexscreener.js";
import { batchScore } from "../services/scoring.js";

export const scanTokensAction: Action = {
  name: "SCAN_TOKENS",
  description:
    "Scan for high-potential tokens across DEXs. " +
    "Finds trending and boosted tokens, filters by liquidity/volume/market cap minimums, " +
    "then scores each with the SolCex 100-point system. " +
    "Use when: scan tokens, find new tokens, discover tokens, what's trending",
  examples: [
    [
      {
        user: "user",
        content: { text: "Scan for promising tokens on Solana" },
      },
    ],
    [
      {
        user: "user",
        content: { text: "Find trending tokens with good liquidity" },
      },
    ],
    [
      {
        user: "user",
        content: { text: "What new tokens are worth looking at?" },
      },
    ],
  ],
  similes: [
    "scan tokens",
    "find tokens",
    "discover tokens",
    "trending tokens",
    "token discovery",
    "new tokens",
    "scan dex",
  ],

  validate: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State
  ): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return (
      text.includes("scan") ||
      text.includes("find") ||
      text.includes("discover") ||
      text.includes("trending") ||
      text.includes("new token")
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();

    // Detect chain preference
    let chains: string[] | undefined;
    if (text.includes("solana") || text.includes("sol")) chains = ["solana"];
    else if (text.includes("ethereum") || text.includes("eth"))
      chains = ["ethereum"];
    else if (text.includes("base")) chains = ["base"];
    else if (text.includes("bsc") || text.includes("bnb")) chains = ["bsc"];

    // Detect if user is searching for specific keyword
    const searchMatch = text.match(
      /(?:scan|find|search|discover)\s+(?:for\s+)?(.+?)(?:\s+on\s+|\s+token|\s*$)/
    );
    const searchQuery = searchMatch?.[1]?.trim();

    try {
      let pairs;

      if (
        searchQuery &&
        !["tokens", "promising", "trending", "new", "good"].includes(
          searchQuery
        )
      ) {
        // Specific search
        pairs = await searchTokens(searchQuery);
        if (chains) {
          pairs = pairs.filter((p) => chains!.includes(p.chainId));
        }
        pairs = pairs.slice(0, 20);
      } else {
        // General high-potential scan
        pairs = await scanHighPotential({ chains });
      }

      if (pairs.length === 0) {
        if (callback) {
          callback({
            text: "No tokens matching the criteria were found. Try broadening the search or checking back later.",
          });
        }
        return true;
      }

      // Score all found pairs
      const scored = batchScore(pairs);
      const top = scored.slice(0, 10);

      // Format results
      const results = top
        .map((t, i) => {
          const emoji =
            t.action === "HOT"
              ? "🔥"
              : t.action === "QUALIFIED"
                ? "✅"
                : t.action === "WATCH"
                  ? "👀"
                  : "⏭️";
          return (
            `${i + 1}. ${emoji} **${t.tokenSymbol}** (${t.chain}) — Score: ${t.totalScore}/100 [${t.action}]\n` +
            `   Liq: $${(t.breakdown[0].value)} | MCap: ${t.breakdown[1].value} | Vol: ${t.breakdown[2].value}\n` +
            `   CA: \`${t.contractAddress}\`\n` +
            `   ${t.recommendation}`
          );
        })
        .join("\n\n");

      const summary =
        `**SolCex Token Scan — ${top.length} Results**\n` +
        `${chains ? `Chain: ${chains.join(", ")}` : "All chains"} | ` +
        `HOT: ${top.filter((t) => t.action === "HOT").length} | ` +
        `Qualified: ${top.filter((t) => t.action === "QUALIFIED").length} | ` +
        `Watch: ${top.filter((t) => t.action === "WATCH").length}\n\n` +
        results +
        `\n\n---\n` +
        `💡 Use **SCORE_TOKEN** with a contract address for detailed breakdown.\n` +
        `🔍 Use **CHECK_WALLET** to run deployer forensics on any token scoring 70+.`;

      if (callback) {
        callback({ text: summary });
      }

      return true;
    } catch (error: any) {
      if (callback) {
        callback({
          text: `Token scan failed: ${error.message}. DexScreener API may be rate-limited — try again in a minute.`,
        });
      }
      return false;
    }
  },
};
