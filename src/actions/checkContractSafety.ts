/**
 * Buzz by SolCex — CHECK_CONTRACT_SAFETY Action
 * Deep contract safety analysis via RugCheck + QuillShield + DFlow
 */

import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { ContractSafetyService } from '../services/contractSafety.js';

export const checkContractSafetyAction: Action = {
  name: 'CHECK_CONTRACT_SAFETY',
  description: 'Deep contract safety analysis — honeypot detection, authority checks, LP verification, and DFlow swap route quality. Essential before any listing or outreach.',
  similes: ['check_safety', 'contract_safety', 'rug_check', 'honeypot_check', 'safety_scan'],

  examples: [
    [
      { name: 'user', content: { text: 'Check contract safety for EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' } },
    ],
    [
      { name: 'user', content: { text: 'Is this token safe? Run a rug check on 0x1234...' } },
    ],
  ],

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || '').toLowerCase();
    const hasAddress = /[1-9A-HJ-NP-Za-km-z]{32,44}|0x[a-fA-F0-9]{40}/.test(message.content?.text || '');
    return hasAddress && (
      text.includes('safety') || text.includes('safe') || text.includes('rug') ||
      text.includes('honeypot') || text.includes('contract check') || text.includes('audit')
    );
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State, options?: Record<string, unknown>, callback?: HandlerCallback) => {
    try {
      const text = message.content?.text || '';
      const evmMatch = text.match(/0x[a-fA-F0-9]{40}/);
      const solMatch = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
      const address = evmMatch?.[0] || solMatch?.[0];

      if (!address) {
        const msg = '❌ No valid contract address found.';
        if (callback) await callback({ text: msg, action: 'CHECK_CONTRACT_SAFETY' });
        return { success: false, text: msg };
      }

      const chain = evmMatch ? (text.includes('base') ? 'base' : text.includes('bsc') ? 'bsc' : 'ethereum') : 'solana';

      if (callback) await callback({ text: `🛡️ Running deep safety analysis on \`${address}\`...`, action: 'CHECK_CONTRACT_SAFETY' });

      const safetyService = await ContractSafetyService.start(runtime);
      const report = await safetyService.analyzeContract(address, chain);

      const ratingEmoji = report.rating === 'SAFE' ? '🟢' : report.rating === 'CAUTION' ? '🟡' : report.rating === 'WARNING' ? '🟠' : '🔴';

      let response = `${ratingEmoji} **Contract Safety Report** — ${report.rating}\n\n`;
      response += `📍 \`${address}\` (${chain})\n`;
      response += `**Overall Safety Score: ${report.overallSafetyScore}/100**\n\n`;
      response += `| Dimension | Score |\n|-----------|-------|\n`;
      response += `| Authority | ${report.authorityScore}/25 |\n`;
      response += `| Liquidity | ${report.liquidityScore}/25 |\n`;
      response += `| Holders | ${report.holderScore}/25 |\n`;
      response += `| Contract | ${report.contractScore}/25 |\n`;
      response += `| DFlow Modifier | ${report.dflowScoreModifier >= 0 ? '+' : ''}${report.dflowScoreModifier} |\n\n`;

      if (report.isHoneypot) response += `🚨 **HONEYPOT DETECTED** — DO NOT TRADE\n\n`;
      if (report.mintAuthority === 'active') response += `⚠️ Mint authority: ACTIVE\n`;
      if (report.freezeAuthority === 'active') response += `⚠️ Freeze authority: ACTIVE\n`;
      if (report.lpLocked) response += `✅ LP locked\n`;
      if (report.lpBurned) response += `✅ LP burned\n`;
      if (report.dflowRouteCount > 0) response += `✅ ${report.dflowRouteCount} DFlow routes found (Tier-1: ${report.dflowTier1Dexes.join(', ') || 'none'})\n`;
      if (report.flags.length > 0) response += `\n⚠️ **Flags:** ${report.flags.join(', ')}\n`;

      if (callback) await callback({ text: response, action: 'CHECK_CONTRACT_SAFETY', data: report });
      return { success: true, text: response, data: report };
    } catch (error) {
      const msg = `❌ Safety check failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      if (callback) await callback({ text: msg, action: 'CHECK_CONTRACT_SAFETY' });
      return { success: false, text: msg, error: String(error) };
    }
  },
};
