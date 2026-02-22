/**
 * Buzz by SolCex — ANALYZE_WALLET Action
 * Perform forensic analysis on a Solana wallet
 */

import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { WalletForensicsService } from '../services/forensics.js';

export const analyzeWalletAction: Action = {
  name: 'ANALYZE_WALLET',
  description: 'Perform forensic analysis on a Solana wallet address using Helius API. Checks balance, transaction history, token holdings, and risk flags.',
  similes: ['analyze_wallet', 'wallet_check', 'check_wallet', 'wallet_forensics'],

  examples: [
    [
      {
        name: 'user',
        content: { text: 'Analyze this wallet: 5iC7p...mo5Jp' },
      },
    ],
    [
      {
        name: 'user',
        content: { text: 'Check wallet forensics for this address' },
      },
    ],
  ],

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
    const text = (message.content?.text || '').toLowerCase();
    const hasSolanaAddress = /[1-9A-HJ-NP-Za-km-z]{32,44}/.test(message.content?.text || '');
    return hasSolanaAddress && (
      text.includes('wallet') ||
      text.includes('forensic') ||
      text.includes('analyze') ||
      text.includes('check address')
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
      const addressMatch = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);

      if (!addressMatch) {
        const errorMsg = '❌ No valid Solana address found.';
        if (callback) await callback({ text: errorMsg, action: 'ANALYZE_WALLET' });
        return { success: false, text: errorMsg };
      }

      const address = addressMatch[0];

      if (callback) {
        await callback({
          text: `🔬 Buzz analyzing wallet \`${address}\`...`,
          action: 'ANALYZE_WALLET',
        });
      }

      const forensicsService = await WalletForensicsService.start(runtime);
      const result = await forensicsService.analyzeWallet(address);

      let responseText = `🔬 **Buzz Wallet Forensics**\n\n`;
      responseText += `📍 Address: \`${result.address}\`\n\n`;

      if (result.balanceSol !== undefined) {
        responseText += `💰 SOL Balance: ${result.balanceSol.toFixed(4)} SOL\n`;
      }
      if (result.tokenAccounts !== undefined) {
        responseText += `🪙 Token Accounts: ${result.tokenAccounts}\n`;
      }
      if (result.transactionCount !== undefined) {
        responseText += `📊 Recent Transactions: ${result.transactionCount}\n`;
      }
      if (result.firstTransaction) {
        responseText += `📅 First TX: ${result.firstTransaction}\n`;
      }
      if (result.lastTransaction) {
        responseText += `📅 Last TX: ${result.lastTransaction}\n`;
      }

      if (result.topTokenHoldings && result.topTokenHoldings.length > 0) {
        responseText += `\n**Top Token Holdings:**\n`;
        for (const holding of result.topTokenHoldings.slice(0, 5)) {
          responseText += `  • ${holding.symbol}: ${holding.amount}`;
          if (holding.valueUsd) responseText += ` ($${holding.valueUsd.toLocaleString()})`;
          responseText += '\n';
        }
      }

      if (result.riskFlags && result.riskFlags.length > 0) {
        responseText += `\n⚠️ **Risk Flags:** ${result.riskFlags.join(', ')}\n`;
      } else {
        responseText += `\n✅ No risk flags detected\n`;
      }

      responseText += `\n🔗 [Solscan](https://solscan.io/account/${address})`;

      if (callback) {
        await callback({ text: responseText, action: 'ANALYZE_WALLET', data: result });
      }

      return { success: true, text: responseText, data: result };
    } catch (error) {
      const errorMsg = `❌ Wallet analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      if (callback) await callback({ text: errorMsg, action: 'ANALYZE_WALLET' });
      return { success: false, text: errorMsg, error: String(error) };
    }
  },
};
