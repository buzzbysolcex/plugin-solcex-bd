// ============================================================
// Helius Wallet Forensics Service
// Deep Solana wallet analysis: balances, transactions, flags
// Docs: https://docs.helius.dev/
// Requires: HELIUS_API_KEY (free tier: 10 RPS, 100K credits/month)
// ============================================================

import type {
  WalletForensicsResult,
  WalletFlag,
  WalletFlagDetail,
} from "../types/index.js";

const HELIUS_BASE = "https://api.helius.xyz/v0";

// Known mixer/bridge addresses to flag
const KNOWN_MIXERS = new Set<string>([
  // Add known mixer addresses here as they're discovered
  // These are flagged as MIXER_REJECT
]);

// Known VC/institutional wallets (positive signal)
const KNOWN_INSTITUTIONAL = new Set<string>([
  // Add known VC wallets here
]);

interface HeliusConfig {
  apiKey: string;
}

/**
 * Get SOL and token balances for a wallet
 */
async function getBalances(
  address: string,
  config: HeliusConfig
): Promise<{ nativeBalance: number; tokenCount: number }> {
  const url = `${HELIUS_BASE}/addresses/${address}/balances?api-key=${config.apiKey}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Helius balances failed: ${resp.status}`);
  const data = (await resp.json()) as { nativeBalance?: number; tokens?: Array<{ mint: string; amount: number; decimals: number }> };

  return {
    nativeBalance: (data.nativeBalance ?? 0) / 1e9, // lamports to SOL
    tokenCount: data.tokens?.length ?? 0,
  };
}

/**
 * Get recent transaction history (last 100)
 */
async function getTransactions(
  address: string,
  config: HeliusConfig
): Promise<Array<{ type: string; timestamp: number; description: string }>> {
  const url = `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${config.apiKey}&limit=100`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Helius transactions failed: ${resp.status}`);
  const txns = (await resp.json()) as Array<any>;

  return (txns || []).map((tx: any) => ({
    type: tx.type || "UNKNOWN",
    timestamp: tx.timestamp || 0,
    description: tx.description || "",
  }));
}

/**
 * Attempt to find funding source (who sent SOL to this wallet first)
 */
async function findFundingSource(
  address: string,
  config: HeliusConfig
): Promise<string> {
  try {
    const url = `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${config.apiKey}&limit=100&type=TRANSFER`;
    const resp = await fetch(url);
    if (!resp.ok) return "UNKNOWN";
    const txns = (await resp.json()) as any;

    // Find earliest incoming SOL transfer
    const incoming = (txns || [])
      .filter(
        (tx: any) =>
          tx.nativeTransfers?.some(
            (t: any) => t.toUserAccount === address && t.amount > 0
          )
      )
      .sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0));

    if (incoming.length > 0) {
      const firstTx = incoming[0];
      const sender = firstTx.nativeTransfers?.find(
        (t: any) => t.toUserAccount === address
      )?.fromUserAccount;
      return sender || "UNKNOWN";
    }

    return "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}

/**
 * Analyze transaction patterns for dump detection
 */
function analyzeDumpPattern(
  transactions: Array<{ type: string; timestamp: number; description: string }>
): { isDumping: boolean; dumpPercent: number } {
  const now = Date.now() / 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60;

  // Look for token sale patterns in last 7 days
  const recentTxns = transactions.filter((tx) => tx.timestamp > sevenDaysAgo);
  const sells = recentTxns.filter(
    (tx) =>
      tx.type === "SWAP" &&
      tx.description.toLowerCase().includes("sold")
  );

  // If >50% of recent transactions are sells, flag as dump
  const dumpPercent =
    recentTxns.length > 0 ? (sells.length / recentTxns.length) * 100 : 0;

  return {
    isDumping: dumpPercent > 50 && sells.length >= 3,
    dumpPercent,
  };
}

/**
 * Count token creates (serial creator detection)
 */
function countTokenCreates(
  transactions: Array<{ type: string; description: string }>
): number {
  return transactions.filter(
    (tx) =>
      tx.type === "CREATE" ||
      tx.description.toLowerCase().includes("created") ||
      tx.description.toLowerCase().includes("initialize mint")
  ).length;
}

/**
 * Generate wallet flags from analysis
 */
function generateFlags(
  address: string,
  fundedBy: string,
  nativeBalance: number,
  tokenCount: number,
  transactions: Array<{ type: string; timestamp: number; description: string }>
): WalletFlagDetail[] {
  const flags: WalletFlagDetail[] = [];

  // Check mixer funding
  if (KNOWN_MIXERS.has(fundedBy)) {
    flags.push({
      flag: "MIXER_REJECT",
      impact: -100,
      reason: `Funded by known mixer: ${fundedBy.slice(0, 8)}...`,
    });
    return flags; // Auto-reject, no need for more analysis
  }

  // Check institutional
  if (KNOWN_INSTITUTIONAL.has(fundedBy) || KNOWN_INSTITUTIONAL.has(address)) {
    flags.push({
      flag: "INSTITUTIONAL",
      impact: 8,
      reason: "Linked to known institutional/VC wallet",
    });
  }

  // Check serial creator
  const createCount = countTokenCreates(transactions);
  if (createCount > 5) {
    flags.push({
      flag: "SERIAL_CREATOR",
      impact: -5,
      reason: `Created ${createCount} tokens — serial creator pattern`,
    });
  }

  // Check dump pattern
  const { isDumping, dumpPercent } = analyzeDumpPattern(transactions);
  if (isDumping) {
    flags.push({
      flag: "DUMP_ALERT",
      impact: dumpPercent > 70 ? -15 : -10,
      reason: `${dumpPercent.toFixed(0)}% sell transactions in last 7 days`,
    });
  }

  // Positive: net positive balance + active
  if (nativeBalance > 1 && tokenCount > 0 && !isDumping) {
    flags.push({
      flag: "NET_POSITIVE",
      impact: 2,
      reason: `${nativeBalance.toFixed(2)} SOL + ${tokenCount} tokens held`,
    });
  }

  // Clean wallet (no negative flags)
  if (flags.length === 0 || flags.every((f) => f.impact >= 0)) {
    flags.push({
      flag: "WALLET_VERIFIED",
      impact: 3,
      reason: "No negative signals detected",
    });
  }

  return flags;
}

// --- Main Forensics Function ---

/**
 * Run full wallet forensics on a Solana address
 * Returns flags, risk level, and score adjustment
 */
export async function analyzeWallet(
  deployerAddress: string,
  apiKey: string
): Promise<WalletForensicsResult> {
  const config: HeliusConfig = { apiKey };

  // Parallel fetch: balances + transactions + funding source
  const [balances, transactions, fundedBy] = await Promise.all([
    getBalances(deployerAddress, config),
    getTransactions(deployerAddress, config),
    findFundingSource(deployerAddress, config),
  ]);

  // Generate flags
  const flags = generateFlags(
    deployerAddress,
    fundedBy,
    balances.nativeBalance,
    balances.tokenCount,
    transactions
  );

  // Calculate total adjustment
  const scoreAdjustment = flags.reduce((sum, f) => sum + f.impact, 0);

  // Determine risk level
  let riskLevel: WalletForensicsResult["riskLevel"] = "LOW";
  if (flags.some((f) => f.flag === "MIXER_REJECT")) {
    riskLevel = "CRITICAL";
  } else if (flags.some((f) => f.flag === "DUMP_ALERT" && f.impact <= -15)) {
    riskLevel = "HIGH";
  } else if (flags.some((f) => f.impact < 0)) {
    riskLevel = "MEDIUM";
  }

  // Build summary
  const flagNames = flags.map((f) => f.flag).join(", ");
  const summary =
    riskLevel === "CRITICAL"
      ? `⛔ CRITICAL: Mixer-funded deployer. AUTO-REJECT.`
      : riskLevel === "HIGH"
        ? `⚠️ HIGH RISK: ${flagNames}. Manual review required.`
        : riskLevel === "MEDIUM"
          ? `⚡ MEDIUM RISK: ${flagNames}. Proceed with caution.`
          : `✅ LOW RISK: ${flagNames}. Wallet appears clean.`;

  return {
    deployerAddress,
    chain: "solana",
    fundedBy,
    nativeBalance: balances.nativeBalance,
    tokenCount: balances.tokenCount,
    recentTransactions: transactions.length,
    flags,
    scoreAdjustment,
    riskLevel,
    analyzedAt: new Date().toISOString(),
    summary,
  };
}
