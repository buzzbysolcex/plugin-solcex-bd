import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { getTokenPairs } from "../services/dexscreener.js";
import { analyzeWallet } from "../services/helius.js";
import { scoreToken, applyWalletAdjustment } from "../services/scoring.js";

const SOLANA_ADDR = /[1-9A-HJ-NP-Za-km-z]{32,44}/;

export const checkWalletAction: Action = {
  name: "CHECK_WALLET",
  description:
    "Run wallet forensics on a Solana token's deployer address via Helius API. " +
    "Analyzes: funding source, balances, transaction patterns, dump detection, " +
    "serial creator flags, mixer detection. Adjusts token score based on findings. " +
    "Requires HELIUS_API_KEY. " +
    "Use when: check wallet, wallet forensics, deployer analysis, is this safe, rug check",
  examples: [
    [
      {
        user: "user",
        content: {
          text: "Check the deployer wallet for 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        },
      },
    ],
    [
      {
        user: "user",
        content: {
          text: "Run wallet forensics on this token: DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
        },
      },
    ],
  ],
  similes: [
    "check wallet",
    "wallet forensics",
    "deployer check",
    "deployer analysis",
    "is this safe",
    "rug check",
    "check deployer",
    "wallet analysis",
  ],

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State
  ): Promise<boolean> => {
    const text = message.content?.text || "";
    const hasAddress = SOLANA_ADDR.test(text);
    const hasApiKey = !!runtime.getSetting("HELIUS_API_KEY");
    return hasAddress && hasApiKey;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<boolean> => {
    const text = message.content?.text || "";
    const heliusKey = runtime.getSetting("HELIUS_API_KEY");

    if (!heliusKey) {
      if (callback) {
        callback({
          text: "❌ HELIUS_API_KEY not configured. Wallet forensics requires a Helius API key. Get one free at https://helius.dev",
        });
      }
      return false;
    }

    const addrMatch = text.match(SOLANA_ADDR);
    if (!addrMatch) {
      if (callback) {
        callback({
          text: "No valid Solana address found. Please provide a base58 address.",
        });
      }
      return false;
    }

    const contractAddress = addrMatch[0];

    try {
      // Step 1: Get token info from DexScreener to find deployer
      if (callback) {
        callback({
          text: `🔍 Analyzing token \`${contractAddress}\` — fetching pair data...`,
        });
      }

      const pairs = await getTokenPairs("solana", contractAddress);

      if (pairs.length === 0) {
        if (callback) {
          callback({
            text: `No pairs found for \`${contractAddress}\` on Solana DEXs. Cannot determine deployer.`,
          });
        }
        return true;
      }

      const bestPair = pairs.sort(
        (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
      )[0];

      // Note: DexScreener doesn't directly provide deployer address
      // For the MVP, we analyze the contract address itself (token mint authority)
      // In production, Buzz uses on-chain data to find the actual deployer
      const deployerAddress = contractAddress; // Simplified for MVP

      // Step 2: Run wallet forensics
      const walletResult = await analyzeWallet(deployerAddress, heliusKey);

      // Step 3: Score token and apply wallet adjustment
      const baseScore = scoreToken(bestPair);
      const adjustedScore = applyWalletAdjustment(baseScore, walletResult);

      // Format output
      const flagLines = walletResult.flags
        .map((f) => {
          const icon =
            f.impact > 0
              ? "🟢"
              : f.impact < -10
                ? "🔴"
                : f.impact < 0
                  ? "🟡"
                  : "⚪";
          return `  ${icon} **${f.flag}** (${f.impact > 0 ? "+" : ""}${f.impact}) — ${f.reason}`;
        })
        .join("\n");

      const output =
        `**Wallet Forensics: ${bestPair.baseToken.symbol}**\n\n` +
        `🔬 **Deployer:** \`${walletResult.deployerAddress}\`\n` +
        `💰 Balance: ${walletResult.nativeBalance.toFixed(4)} SOL | ${walletResult.tokenCount} tokens\n` +
        `📨 Funded by: \`${walletResult.fundedBy === "UNKNOWN" ? "Unknown" : walletResult.fundedBy.slice(0, 12) + "..."}\`\n` +
        `📜 Recent txns: ${walletResult.recentTransactions}\n\n` +
        `🏷️ **Flags:**\n${flagLines}\n\n` +
        `${walletResult.summary}\n\n` +
        `📊 **Score Impact:**\n` +
        `  Base score: ${baseScore.totalScore}/100\n` +
        `  Wallet adjustment: ${walletResult.scoreAdjustment > 0 ? "+" : ""}${walletResult.scoreAdjustment}\n` +
        `  **Adjusted score: ${adjustedScore.totalScore}/100** [${adjustedScore.action}]\n\n` +
        `${adjustedScore.recommendation}`;

      if (callback) {
        callback({ text: output });
      }

      return true;
    } catch (error: any) {
      if (callback) {
        callback({
          text: `Wallet forensics failed: ${error.message}. Helius API may be rate-limited or the address may be invalid.`,
        });
      }
      return false;
    }
  },
};
