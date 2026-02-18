import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { getTokenPairs } from "../services/dexscreener.js";
import { scoreToken } from "../services/scoring.js";

const SOLANA_ADDR = /[1-9A-HJ-NP-Za-km-z]{32,44}/;
const EVM_ADDR = /0x[a-fA-F0-9]{40}/;

export const submitListingAction: Action = {
  name: "SUBMIT_LISTING_INQUIRY",
  description:
    "Submit a token listing inquiry to SolCex Exchange. " +
    "The inquiry is QUEUED for human review — never auto-sent. " +
    "Requires the token to score 70+ on the SolCex scoring system. " +
    "Requires SOLCEX_API_URL and SOLCEX_API_KEY. " +
    "Use when: submit listing, list this token, send to solcex, listing inquiry",
  examples: [
    [
      {
        user: "user",
        content: {
          text: "Submit a listing inquiry for BONK to SolCex",
        },
      },
    ],
    [
      {
        user: "user",
        content: {
          text: "Send this token to SolCex for listing review: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        },
      },
    ],
  ],
  similes: [
    "submit listing",
    "list token",
    "send to solcex",
    "listing inquiry",
    "listing request",
    "apply for listing",
  ],

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State
  ): Promise<boolean> => {
    const text = message.content?.text || "";
    const hasAddress = SOLANA_ADDR.test(text) || EVM_ADDR.test(text);
    return hasAddress;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<boolean> => {
    const text = message.content?.text || "";
    const solcexUrl = runtime.getSetting("SOLCEX_API_URL");
    const solcexKey = runtime.getSetting("SOLCEX_API_KEY");

    // Extract address
    const evmMatch = text.match(EVM_ADDR);
    const solMatch = text.match(SOLANA_ADDR);
    const contractAddress = evmMatch?.[0] || solMatch?.[0];
    const chain = evmMatch
      ? text.toLowerCase().includes("base")
        ? "base"
        : "ethereum"
      : "solana";

    if (!contractAddress) {
      if (callback) {
        callback({
          text: "No valid contract address found. Provide a Solana or EVM address to submit a listing inquiry.",
        });
      }
      return false;
    }

    try {
      // Step 1: Score the token first
      const pairs = await getTokenPairs(chain, contractAddress);

      if (pairs.length === 0) {
        if (callback) {
          callback({
            text: `No trading pairs found for \`${contractAddress}\` on ${chain}. Cannot evaluate for listing.`,
          });
        }
        return true;
      }

      const bestPair = pairs.sort(
        (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
      )[0];

      const score = scoreToken(bestPair);

      // Step 2: Check minimum score
      if (score.totalScore < 70) {
        if (callback) {
          callback({
            text:
              `**${score.tokenSymbol}** scored ${score.totalScore}/100 — below the 70-point minimum for listing inquiries.\n\n` +
              `${score.recommendation}\n\n` +
              `The token needs to improve in these areas before qualifying:\n` +
              score.breakdown
                .filter((b) => b.score < b.maxScore * 0.6)
                .map((b) => `  • ${b.category}: ${b.score}/${b.maxScore} — ${b.details}`)
                .join("\n"),
          });
        }
        return true;
      }

      // Step 3: Submit inquiry
      if (solcexUrl && solcexKey) {
        // Real API submission
        try {
          const resp = await fetch(`${solcexUrl}/listing-inquiry`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-SolCex-API-Key": solcexKey,
            },
            body: JSON.stringify({
              contractAddress,
              chain,
              tokenName: score.tokenName,
              tokenSymbol: score.tokenSymbol,
              score: score.totalScore,
              pairAddress: score.pairAddress,
              requestedBy: runtime.character?.name || "ElizaOS Agent",
              requestedAt: new Date().toISOString(),
            }),
          });

          if (resp.ok) {
            const data = await resp.json();
            if (callback) {
              callback({
                text:
                  `✅ **Listing inquiry submitted for ${score.tokenSymbol}!**\n\n` +
                  `Inquiry ID: ${data.id || "pending"}\n` +
                  `Score: ${score.totalScore}/100 [${score.action}]\n` +
                  `Chain: ${chain}\n` +
                  `CA: \`${contractAddress}\`\n\n` +
                  `⏳ **Status: QUEUED for human review.** The SolCex BD team will evaluate and respond.\n\n` +
                  `ℹ️ All listing inquiries require human approval before any outreach is sent.`,
              });
            }
            return true;
          }
        } catch {
          // Fall through to offline mode
        }
      }

      // Offline mode: generate inquiry report without API
      if (callback) {
        callback({
          text:
            `📋 **Listing Inquiry Report — ${score.tokenSymbol}**\n\n` +
            `This token qualifies for a SolCex listing inquiry:\n\n` +
            `Token: **${score.tokenName} (${score.tokenSymbol})**\n` +
            `Chain: ${chain}\n` +
            `CA: \`${contractAddress}\`\n` +
            `Score: **${score.totalScore}/100** [${score.action}]\n` +
            `Liquidity: ${score.breakdown[0].value}\n` +
            `Market Cap: ${score.breakdown[1].value}\n` +
            `Volume 24h: ${score.breakdown[2].value}\n` +
            `DEX: ${score.pairUrl}\n\n` +
            (solcexUrl
              ? `⚠️ API submission failed — sharing report for manual review.\n`
              : `ℹ️ SOLCEX_API_URL not configured — report generated for manual forwarding.\n`) +
            `\n📧 Forward this report to the SolCex team: buzzbysolcex@gmail.com\n` +
            `🐝 Powered by Buzz BD Agent | ERC-8004 #25045`,
        });
      }

      return true;
    } catch (error: any) {
      if (callback) {
        callback({
          text: `Listing inquiry failed: ${error.message}`,
        });
      }
      return false;
    }
  },
};
