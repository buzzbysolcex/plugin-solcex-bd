/**
 * Buzz by SolCex — BD Pipeline Service
 * Cross-Layer Orchestration: Maps to BD lifecycle cron jobs #31-36
 * Prospect tracking, warm-up sequences, follow-ups, competitor monitoring
 */

import type { IAgentRuntime } from '@elizaos/core';
import type { TokenScore, BDProspect } from '../types/index.js';

export type PipelineStage =
  | 'DISCOVERED'
  | 'SCORED'
  | 'QUALIFIED'
  | 'WARMUP_TOUCH1'
  | 'WARMUP_TOUCH2'
  | 'WARMUP_TOUCH3'
  | 'OUTREACH_SENT'
  | 'FOLLOW_UP_1'
  | 'NEGOTIATING'
  | 'LISTING_AGREED'
  | 'LISTED'
  | 'POST_LISTING_MONITORING'
  | 'REJECTED'
  | 'STALE';

export interface PipelineEntry {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  chain: string;
  stage: PipelineStage;
  score: number;
  contactInfo: {
    twitter?: string;
    telegram?: string;
    email?: string;
    website?: string;
  };
  warmupHistory: Array<{
    touch: number;
    action: string;
    sentAt: string;
    response?: string;
  }>;
  outreachHistory: Array<{
    type: string;
    content: string;
    sentAt: string;
    approved: boolean;
    response?: string;
  }>;
  listingDate?: string;
  healthChecks?: Array<{
    day: number;
    liquidityUsd: number;
    volume24h: number;
    status: '🟢' | '🟡' | '🔴' | '⚫';
    checkedAt: string;
  }>;
  notes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PipelineStats {
  total: number;
  byStage: Record<PipelineStage, number>;
  qualifiedCount: number;
  activeOutreach: number;
  listedCount: number;
  conversionRate: number;          // listed / total scored
  avgTimeToListDays: number;
  hotProspects: PipelineEntry[];   // score 85+
}

export interface CompetitorListing {
  exchange: string;
  tokenSymbol: string;
  tokenAddress?: string;
  chain?: string;
  listedAt: string;
  inOurPipeline: boolean;
  urgencyLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export class BDPipelineService {
  static serviceType = 'bd-pipeline' as const;

  private runtime: IAgentRuntime;
  private pipeline: Map<string, PipelineEntry>;

  // SolCex listing package (from Master Ops)
  static readonly LISTING_PACKAGE = {
    totalFee: 15000,            // USDT
    listingFee: 5000,           // USDT
    liquidityRequirement: 10000, // USDT
    marketMaking: true,
    whaleDrop: true,
    fastTrackDays: 14,
  };

  // Competitor exchanges to monitor
  static readonly COMPETITORS = ['mexc', 'bitget', 'gate', 'kucoin', 'bybit'];

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
    this.pipeline = new Map();
  }

  get capabilityDescription(): string {
    return 'End-to-end BD pipeline management for SolCex Exchange — prospect tracking from discovery through listing, 3-touch warm-up sequences, follow-up automation, competitor monitoring, and post-listing health checks';
  }

  static async start(runtime: IAgentRuntime): Promise<BDPipelineService> {
    const service = new BDPipelineService(runtime);
    console.log('[Buzz/BDPipeline] Service initialized — SolCex listing pipeline active');
    return service;
  }

  async stop(): Promise<void> {
    console.log('[Buzz/BDPipeline] Service stopped');
  }

  /**
   * Add a scored token to the pipeline
   */
  addProspect(score: TokenScore, contactInfo?: PipelineEntry['contactInfo']): PipelineEntry {
    const id = `${score.chain}-${score.address}`;

    const entry: PipelineEntry = {
      id,
      tokenAddress: score.address,
      tokenSymbol: score.symbol,
      tokenName: score.name,
      chain: score.chain,
      stage: score.overallScore >= 70 ? 'QUALIFIED' : 'SCORED',
      score: score.overallScore,
      contactInfo: contactInfo || {},
      warmupHistory: [],
      outreachHistory: [],
      notes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (score.overallScore >= 85) {
      entry.notes.push('🔥 HOT PROSPECT — Immediate outreach recommended');
    }

    this.pipeline.set(id, entry);
    return entry;
  }

  /**
   * Advance a prospect to the next stage
   */
  advanceStage(id: string, newStage: PipelineStage, note?: string): PipelineEntry | null {
    const entry = this.pipeline.get(id);
    if (!entry) return null;

    entry.stage = newStage;
    entry.updatedAt = new Date().toISOString();
    if (note) entry.notes.push(`[${new Date().toISOString()}] ${note}`);

    return entry;
  }

  /**
   * Record a warm-up touch (3-Touch Warm-Up Sequence)
   * Touch 1: Like/retweet their content (day 0)
   * Touch 2: Meaningful comment on their post (day 2-3)
   * Touch 3: DM with value proposition (day 5-7)
   */
  recordWarmupTouch(id: string, touch: number, action: string): PipelineEntry | null {
    const entry = this.pipeline.get(id);
    if (!entry) return null;

    entry.warmupHistory.push({
      touch,
      action,
      sentAt: new Date().toISOString(),
    });

    // Advance stage
    if (touch === 1) entry.stage = 'WARMUP_TOUCH1';
    else if (touch === 2) entry.stage = 'WARMUP_TOUCH2';
    else if (touch === 3) entry.stage = 'WARMUP_TOUCH3';

    entry.updatedAt = new Date().toISOString();
    return entry;
  }

  /**
   * Record outreach (requires Ogie approval)
   */
  recordOutreach(id: string, type: string, content: string, approved: boolean): PipelineEntry | null {
    const entry = this.pipeline.get(id);
    if (!entry) return null;

    entry.outreachHistory.push({
      type,
      content,
      sentAt: new Date().toISOString(),
      approved,
    });

    if (approved) {
      entry.stage = 'OUTREACH_SENT';
    }

    entry.updatedAt = new Date().toISOString();
    return entry;
  }

  /**
   * Get prospects needing follow-up
   * BD lifecycle cron #32: bd-followup-check (14:00 AST daily)
   */
  getFollowUpNeeded(): PipelineEntry[] {
    const now = Date.now();
    const results: PipelineEntry[] = [];

    for (const entry of this.pipeline.values()) {
      if (entry.stage === 'OUTREACH_SENT') {
        const lastOutreach = entry.outreachHistory[entry.outreachHistory.length - 1];
        if (lastOutreach) {
          const daysSince = (now - new Date(lastOutreach.sentAt).getTime()) / (1000 * 60 * 60 * 24);
          if (daysSince > 3) {
            results.push(entry);
          }
        }
      } else if (entry.stage === 'WARMUP_TOUCH1' || entry.stage === 'WARMUP_TOUCH2') {
        const lastTouch = entry.warmupHistory[entry.warmupHistory.length - 1];
        if (lastTouch) {
          const daysSince = (now - new Date(lastTouch.sentAt).getTime()) / (1000 * 60 * 60 * 24);
          if (entry.stage === 'WARMUP_TOUCH1' && daysSince > 2) results.push(entry);
          if (entry.stage === 'WARMUP_TOUCH2' && daysSince > 3) results.push(entry);
        }
      }
    }

    return results;
  }

  /**
   * Post-listing health check
   * BD lifecycle cron #36: bd-post-listing-health (Day 1, 7, 14, 30)
   */
  recordHealthCheck(
    id: string,
    day: number,
    liquidityUsd: number,
    volume24h: number,
    listingDayLiquidity: number,
    listingDayVolume: number
  ): PipelineEntry | null {
    const entry = this.pipeline.get(id);
    if (!entry) return null;

    // Health status based on change from listing day
    const liqChange = liquidityUsd / (listingDayLiquidity || 1);
    const volChange = volume24h / (listingDayVolume || 1);

    let status: '🟢' | '🟡' | '🔴' | '⚫';
    if (liqChange >= 0.8 && volChange >= 0.3) status = '🟢';       // Healthy
    else if (liqChange >= 0.5 && volChange >= 0.1) status = '🟡';  // Warning
    else if (liqChange >= 0.2) status = '🔴';                       // Critical
    else status = '⚫';                                              // Dead

    if (!entry.healthChecks) entry.healthChecks = [];
    entry.healthChecks.push({
      day,
      liquidityUsd,
      volume24h,
      status,
      checkedAt: new Date().toISOString(),
    });

    entry.stage = 'POST_LISTING_MONITORING';
    entry.updatedAt = new Date().toISOString();
    return entry;
  }

  /**
   * Get full pipeline statistics
   */
  getStats(): PipelineStats {
    const byStage: Record<string, number> = {};
    let listedCount = 0;
    let totalScored = 0;
    const hotProspects: PipelineEntry[] = [];

    for (const entry of this.pipeline.values()) {
      byStage[entry.stage] = (byStage[entry.stage] || 0) + 1;
      if (entry.stage === 'LISTED' || entry.stage === 'POST_LISTING_MONITORING') listedCount++;
      if (entry.stage !== 'DISCOVERED') totalScored++;
      if (entry.score >= 85 && !['LISTED', 'REJECTED', 'STALE'].includes(entry.stage)) {
        hotProspects.push(entry);
      }
    }

    return {
      total: this.pipeline.size,
      byStage: byStage as Record<PipelineStage, number>,
      qualifiedCount: (byStage['QUALIFIED'] || 0) + (byStage['WARMUP_TOUCH1'] || 0) +
                      (byStage['WARMUP_TOUCH2'] || 0) + (byStage['WARMUP_TOUCH3'] || 0),
      activeOutreach: (byStage['OUTREACH_SENT'] || 0) + (byStage['FOLLOW_UP_1'] || 0) +
                      (byStage['NEGOTIATING'] || 0),
      listedCount,
      conversionRate: totalScored > 0 ? listedCount / totalScored : 0,
      avgTimeToListDays: 0, // Would calculate from actual listing dates
      hotProspects: hotProspects.sort((a, b) => b.score - a.score).slice(0, 5),
    };
  }

  /**
   * Check competitor exchange listings
   * BD lifecycle cron #34: bd-competitor-alert (every 6h)
   */
  async checkCompetitorListings(): Promise<CompetitorListing[]> {
    const alerts: CompetitorListing[] = [];

    // In production, this would scrape competitor listing announcement pages
    // For the plugin, we define the interface and monitoring structure
    for (const exchange of BDPipelineService.COMPETITORS) {
      try {
        // Check exchange listing announcement feeds
        const response = await fetch(
          `https://api.dexscreener.com/latest/dex/search?q=${exchange}%20listing%20new`
        );
        // Process results and cross-reference with pipeline
        // This is the framework — actual implementation varies per exchange API
      } catch (error) {
        console.error(`[Buzz/BDPipeline] Competitor check failed for ${exchange}:`, error);
      }
    }

    return alerts;
  }

  /**
   * Generate weekly public alpha thread draft
   * BD lifecycle cron #33: bd-public-alpha-draft (Tuesday 09:00 AST)
   */
  generateAlphaThreadDraft(): string[] {
    const qualifiedTokens = Array.from(this.pipeline.values())
      .filter(e => e.score >= 70 && !['REJECTED', 'STALE', 'LISTED'].includes(e.stage))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (qualifiedTokens.length === 0) {
      return ['No qualifying tokens above 70 score this week.'];
    }

    const thread: string[] = [
      `🐝 Buzz Weekly Alpha | ${new Date().toLocaleDateString()}\n\nTop token prospects scored by Buzz this week. Scored on liquidity, volume, safety, social, and on-chain data across 16 intelligence sources.\n\n🧵👇`,
    ];

    for (let i = 0; i < qualifiedTokens.length; i++) {
      const t = qualifiedTokens[i];
      const emoji = t.score >= 85 ? '🔥' : t.score >= 70 ? '✅' : '👀';
      thread.push(
        `${i + 1}/${qualifiedTokens.length} ${emoji} $${t.tokenSymbol} (${t.tokenName})\n\n` +
        `Score: ${t.score}/100\n` +
        `Chain: ${t.chain}\n` +
        `CA: ${t.tokenAddress}\n\n` +
        `${t.contactInfo.twitter ? `@${t.contactInfo.twitter.replace('@', '')}` : ''}`
      );
    }

    thread.push(
      `Buzz runs 36 automated cron jobs across 16 intelligence sources 24/7.\n\n` +
      `Built on @akabornetwk | ERC-8004 verified\n\n` +
      `NFA. DYOR.\n\n#AgentEconomy #SolCex #BuzzBD`
    );

    return thread;
  }
}
