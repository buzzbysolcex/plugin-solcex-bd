import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { getTokenPairs } from "../services/dexscreener.js";
import { scoreToken } from "../services/scoring.js";

// Regex patterns for contract addresses
const SOLANA_ADDR = /[1-9A-HJ-NP-Za-km-z]{32,44}/;
const EVM_ADDR = /0x[a-fA-F0-9]{40}/;

function extractAddress(text: string): { address: string; chain: string } | null {
  const evmMatch = text.match(EVM_ADDR);
  if (evmMatch) {
    // Guess chain from context
    const lower = text.toLowerCase();
    let chain = "ethereum";
    if (lower.includes("base")) chain = "base";
    else if (lower.includes("bsc") || lower.includes("bnb")) chain = "bsc";
    else if (lower.includes("arb")) chain = "arbitrum";
    return { address: evmMatch[0], chain };
  }

  const solMatch = text.match(SOLANA_ADDR);
  if (solMatch) {
    return { address: solMatch[0], chain: "solana" };
  }

  return null;
}

export const scoreTokenAction: Action = {
  name: "SCORE_TOKEN",
  description:
    "Score a specific token using the SolCex 100-point weighted system. " +
    "Analyzes liquidity (25%), market cap (20%), volume (20%), social (15%), age (10%), team (10%) " +
    "plus catalyst adjustments. Provide a contract address. " +
    "Use when: score token, rate token, evaluate token, analyze token, check token",
  examples: [
    [
      {
        user: "user",
        content: {
          text: "Score this token: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        },
      },
    ],
    [
      {
        user: "user",
        content: {
          text: "Evaluate 0x1234567890abcdef1234567890abcdef12345678 on Base",
        },
      },
    ],
  ],
  similes: [
    "score token",
    "rate token",
    "evaluate token",
    "analyze token",
    "check token",
    "token score",
    "how good is this token",
  ],

  validate: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State
  ): Promise<boolean> => {
    const text = message.content?.text || "";
    return SOLANA_ADDR.test(text) || EVM_ADDR.test(text);
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<boolean> => {
    const text = message.content?.text || "";
    const extracted = extractAddress(text);

    if (!extracted) {
      if (callback) {
        callback({
          text: "No valid contract address found. Please provide a Solana (base58) or EVM (0x...) address.",
        });
      }
      return false;
    }

    try {
      // Fetch pair data from DexScreener
      const pairs = await getTokenPairs(extracted.chain, extracted.address);

      if (pairs.length === 0) {
        if (callback) {
          callback({
            text: `No trading pairs found for \`${extracted.address}\` on ${extracted.chain}. The token may not be listed on any DEX yet, or the address may be incorrect.`,
          });
        }
        return true;
      }

      // Score the highest-liquidity pair
      const bestPair = pairs.sort(
        (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
      )[0];

      const result = scoreToken(bestPair);

      // Format detailed breakdown
      const breakdownLines = result.breakdown
        .map(
          (b) =>
            `  ${b.category} (${b.weight}%): **${b.score}/${b.maxScore}** — ${b.value} — ${b.details}`
        )
        .join("\n");

      const catalystLines =
        result.catalysts.length > 0
          ? result.catalysts
              .map(
                (c) =>
                  `  ${c.points > 0 ? "➕" : "➖"} ${c.name}: ${c.points > 0 ? "+" : ""}${c.points} — ${c.reason}`
              )
              .join("\n")
          : "  None detected";

      const output =
        `**${result.tokenName} (${result.tokenSymbol}) — Score: ${result.totalScore}/100**\n\n` +
        `Chain: ${result.chain} | CA: \`${result.contractAddress}\`\n` +
        `Pair: \`${result.pairAddress}\`\n` +
        `DEX: ${result.pairUrl}\n\n` +
        `📊 **Factor Breakdown:**\n${breakdownLines}\n\n` +
        `⚡ **Catalysts:**\n${catalystLines}\n\n` +
        `${result.recommendation}\n\n` +
        (result.action === "HOT" || result.action === "QUALIFIED"
          ? `🔍 **Next step:** Use **CHECK_WALLET** to run deployer forensics on \`${result.contractAddress}\``
          : `ℹ️ Token scored below outreach threshold.`);

      if (callback) {
        callback({ text: output });
      }

      return true;
    } catch (error: any) {
      if (callback) {
        callback({
          text: `Scoring failed for \`${extracted.address}\`: ${error.message}`,
        });
      }
      return false;
    }
  },
};
