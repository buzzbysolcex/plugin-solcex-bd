/**
 * Buzz by SolCex — RESEARCH_PROJECT Action
 * Full social intelligence report: Grok sentiment + ATV identity + Serper web research
 */

import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { SocialIntelService } from '../services/socialIntel.js';

export const researchProjectAction: Action = {
  name: 'RESEARCH_PROJECT',
  description: 'Deep project research combining X/Twitter sentiment analysis (Grok), Web3 identity verification (ENS, Farcaster, Gitcoin), and web research for news and red flags.',
  similes: ['research_project', 'investigate_token', 'deep_dive', 'social_intel', 'check_sentiment'],

  examples: [
    [
      { name: 'user', content: { text: 'Research the project behind $TOKEN' } },
    ],
    [
      { name: 'user', content: { text: 'What is the sentiment on PEPE? Do a deep dive.' } },
    ],
  ],

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || '').toLowerCase();
    return (
      text.includes('research') || text.includes('investigate') ||
      text.includes('deep dive') || text.includes('sentiment') ||
      text.includes('social intel') || text.includes('who is behind')
    );
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State, options?: Record<string, unknown>, callback?: HandlerCallback) => {
    try {
      const text = message.content?.text || '';

      // Extract token symbol (look for $SYMBOL or quoted names)
      const symbolMatch = text.match(/\$([A-Za-z0-9]+)/);
      const quotedMatch = text.match(/"([^"]+)"/);
      const tokenSymbol = symbolMatch?.[1] || quotedMatch?.[1] || text.split(' ').pop() || 'UNKNOWN';

      // Extract deployer address if present
      const solMatch = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
      const evmMatch = text.match(/0x[a-fA-F0-9]{40}/);
      const deployerAddress = evmMatch?.[0] || solMatch?.[0];

      if (callback) await callback({ text: `🔍 Buzz researching **$${tokenSymbol}** across Grok, ATV, and Serper...`, action: 'RESEARCH_PROJECT' });

      const socialService = await SocialIntelService.start(runtime);
      const report = await socialService.generateReport(tokenSymbol, undefined, deployerAddress);

      let response = `📋 **Buzz Social Intel Report: $${tokenSymbol}**\n\n`;

      // Sentiment
      const s = report.sentiment;
      const sentEmoji = s.sentimentScore > 50 ? '🟢' : s.sentimentScore > 0 ? '🟡' : s.sentimentScore > -50 ? '🟠' : '🔴';
      response += `**Sentiment:** ${sentEmoji} ${s.sentiment.replace('_', ' ').toUpperCase()} (${s.sentimentScore}/100)\n`;
      if (s.keyInfluencers.length > 0) response += `Key voices: ${s.keyInfluencers.slice(0, 3).join(', ')}\n`;
      if (s.topNarratives.length > 0) response += `Narratives: ${s.topNarratives.slice(0, 3).join('; ')}\n\n`;

      // Identity
      if (report.identity) {
        const id = report.identity;
        response += `**Identity:** ${id.isDoxxed ? '✅ VERIFIED' : '⚠️ ANON'} (${id.identityScore}/100)\n`;
        if (id.ensName) response += `ENS: ${id.ensName}\n`;
        if (id.farcasterHandle) response += `Farcaster: ${id.farcasterHandle}\n`;
        if (id.twitterHandle) response += `Twitter: @${id.twitterHandle}\n`;
        if (id.gitcoinPassport?.verified) response += `Gitcoin Passport: ✅ Verified (score: ${id.gitcoinPassport.score})\n`;
        response += '\n';
      }

      // Web Research
      const r = report.research;
      response += `**Web Research:** ${r.researchScore}/100\n`;
      if (r.positiveSignals.length > 0) response += `✅ Positive: ${r.positiveSignals.slice(0, 3).join('; ')}\n`;
      if (r.redFlags.length > 0) response += `🚨 Red flags: ${r.redFlags.join('; ')}\n`;
      if (r.results.length > 0) response += `Sources found: ${r.results.length}\n\n`;

      // Combined score
      response += `**Combined Social Score: ${report.combinedSocialScore}/100** (feeds into 15% of overall token score)\n`;
      if (report.flags.length > 0) response += `\n⚠️ Flags: ${report.flags.join(', ')}\n`;

      if (callback) await callback({ text: response, action: 'RESEARCH_PROJECT', data: report });
      return { success: true, text: response, data: report };
    } catch (error) {
      const msg = `❌ Research failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      if (callback) await callback({ text: msg, action: 'RESEARCH_PROJECT' });
      return { success: false, text: msg, error: String(error) };
    }
  },
};
