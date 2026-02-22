/**
 * Buzz by SolCex — CHECK_PIPELINE Action
 * View BD pipeline stats, hot prospects, and follow-up queue
 */

import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { BDPipelineService } from '../services/bdPipeline.js';
import { AgentNetworkService } from '../services/agentNetwork.js';

export const checkPipelineAction: Action = {
  name: 'CHECK_PIPELINE',
  description: 'View the SolCex BD pipeline — stats, hot prospects, follow-up queue, x402 spend, and agent network health.',
  similes: ['check_pipeline', 'pipeline_status', 'bd_status', 'show_pipeline', 'prospect_list'],

  examples: [
    [
      { name: 'user', content: { text: 'Show me the pipeline status' } },
    ],
    [
      { name: 'user', content: { text: 'How is the BD pipeline looking?' } },
    ],
  ],

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || '').toLowerCase();
    return (
      text.includes('pipeline') || text.includes('bd status') ||
      text.includes('prospect') || text.includes('listing status') ||
      text.includes('follow up') || text.includes('outreach status')
    );
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State, options?: Record<string, unknown>, callback?: HandlerCallback) => {
    try {
      const pipelineService = await BDPipelineService.start(runtime);
      const networkService = await AgentNetworkService.start(runtime);

      const stats = pipelineService.getStats();
      const networkStats = networkService.getNetworkStats();
      const followUps = pipelineService.getFollowUpNeeded();

      let response = `📊 **Buzz BD Pipeline Status**\n\n`;
      response += `**Pipeline Overview:**\n`;
      response += `Total prospects: ${stats.total}\n`;
      response += `Qualified: ${stats.qualifiedCount}\n`;
      response += `Active outreach: ${stats.activeOutreach}\n`;
      response += `Listed: ${stats.listedCount}\n`;
      response += `Conversion: ${(stats.conversionRate * 100).toFixed(1)}%\n\n`;

      // Hot prospects
      if (stats.hotProspects.length > 0) {
        response += `**🔥 Hot Prospects (85+ score):**\n`;
        for (const p of stats.hotProspects) {
          response += `• ${p.tokenSymbol} (${p.chain}) — Score: ${p.score} — Stage: ${p.stage}\n`;
        }
        response += '\n';
      }

      // Follow-ups needed
      if (followUps.length > 0) {
        response += `**📬 Follow-ups Needed (${followUps.length}):**\n`;
        for (const f of followUps.slice(0, 5)) {
          response += `• ${f.tokenSymbol} — Stage: ${f.stage} — Last touch: ${f.updatedAt.slice(0, 10)}\n`;
        }
        response += '\n';
      }

      // Agent network
      response += `**🤖 Agent Network:**\n`;
      response += `Sub-agent tasks: ${networkStats.subAgentTasksCompleted}/${networkStats.subAgentTasksTotal} (${(networkStats.subAgentSuccessRate * 100).toFixed(0)}% success)\n`;
      response += `x402 today: $${networkStats.x402SpendTodayUsd.toFixed(2)} | month: $${networkStats.x402SpendMonthUsd.toFixed(2)} / $${networkStats.x402MonthlyCapUsd}\n`;
      response += `Trusted agents: ${networkStats.trustedAgents}\n`;

      // SolCex listing package reminder
      response += `\n💰 **SolCex Listing Package:** 15K USDT (5K fee + 10K liquidity) | Fast-track: 10-14 days`;

      if (callback) await callback({ text: response, action: 'CHECK_PIPELINE', data: { stats, networkStats, followUps } });
      return { success: true, text: response, data: { stats, networkStats } };
    } catch (error) {
      const msg = `❌ Pipeline check failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      if (callback) await callback({ text: msg, action: 'CHECK_PIPELINE' });
      return { success: false, text: msg, error: String(error) };
    }
  },
};
