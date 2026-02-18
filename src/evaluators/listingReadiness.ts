import type { Evaluator, IAgentRuntime, Memory, State } from "@elizaos/core";

export const listingReadinessEvaluator: Evaluator = {
  name: "LISTING_READINESS",
  description:
    "Evaluates whether a token discussed in conversation is ready for SolCex listing inquiry. " +
    "Checks if score, wallet forensics, and other criteria have been met.",
  similes: ["listing check", "ready for listing", "listing evaluation"],
  alwaysRun: false,

  validate: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State
  ): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return (
      text.includes("score") &&
      (text.includes("/100") || text.includes("listing"))
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
  ): Promise<void> => {
    // This evaluator runs after scoring/wallet actions to assess listing readiness
    // In practice, it would update the agent's memory with the evaluation result

    const text = message.content?.text || "";

    // Extract score from recent messages
    const scoreMatch = text.match(/(\d{1,3})\/100/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;

    // Check for wallet verification
    const walletChecked =
      text.includes("WALLET_VERIFIED") ||
      text.includes("wallet forensics") ||
      text.includes("Wallet Forensics");

    const hasRedFlags =
      text.includes("MIXER_REJECT") ||
      text.includes("DUMP_ALERT") ||
      text.includes("SERIAL_CREATOR") ||
      text.includes("AUTO-REJECTED");

    // Evaluate readiness
    let readiness: string;

    if (hasRedFlags) {
      readiness = "REJECTED — Red flags detected in wallet forensics. Do not proceed with listing inquiry.";
    } else if (score >= 85 && walletChecked) {
      readiness = "READY — Token scores 85+ with clean wallet. Recommend submitting listing inquiry via SUBMIT_LISTING_INQUIRY.";
    } else if (score >= 70 && walletChecked) {
      readiness = "NEEDS_REVIEW — Token qualifies (70+) but may need additional verification before outreach.";
    } else if (score >= 70 && !walletChecked) {
      readiness = "NEEDS_WALLET_CHECK — Token scores 70+ but wallet forensics have not been run. Use CHECK_WALLET first.";
    } else {
      readiness = "NOT_READY — Token does not meet minimum criteria for listing inquiry.";
    }

    // Store evaluation in memory (via runtime)
    // The evaluation context will be available to the agent for decision-making
    if (state) {
      (state as any).listingReadiness = readiness;
      (state as any).lastEvaluatedScore = score;
      (state as any).walletChecked = walletChecked;
    }
  },
};
