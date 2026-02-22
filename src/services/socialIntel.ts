/**
 * Buzz by SolCex — Social Intelligence Service
 * Layer 3 Research: Grok x_search (#13) + ATV Web3 Identity (#12) + Serper (#14)
 * Real-time sentiment, identity verification, web research
 */

import type { IAgentRuntime } from '@elizaos/core';

export interface SentimentAnalysis {
  query: string;
  sentiment: 'very_bullish' | 'bullish' | 'neutral' | 'bearish' | 'very_bearish';
  sentimentScore: number;           // -100 to +100
  tweetCount: number;
  keyInfluencers: string[];
  topNarratives: string[];
  recentMentions: Array<{
    author: string;
    text: string;
    engagement: number;
    timestamp: string;
  }>;
  analyzedAt: string;
}

export interface Web3Identity {
  address: string;
  ensName?: string;
  farcasterHandle?: string;
  lensHandle?: string;
  gitcoinPassport?: {
    score: number;
    verified: boolean;
  };
  twitterHandle?: string;
  identityScore: number;            // 0-100
  isDoxxed: boolean;
  flags: string[];
  analyzedAt: string;
}

export interface WebResearchResult {
  query: string;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    source: string;
    date?: string;
  }>;
  redFlags: string[];
  positiveSignals: string[];
  researchScore: number;            // 0-100
  analyzedAt: string;
}

export interface SocialIntelReport {
  tokenSymbol: string;
  sentiment: SentimentAnalysis;
  identity?: Web3Identity;
  research: WebResearchResult;
  combinedSocialScore: number;      // 0-100 (feeds into 15% of overall score)
  flags: string[];
  analyzedAt: string;
}

export class SocialIntelService {
  static serviceType = 'social-intel' as const;

  private runtime: IAgentRuntime;
  private grokApiKey: string | null;
  private atvApiKey: string | null;
  private serperApiKey: string | null;

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
    this.grokApiKey = (runtime.getSetting?.('GROK_API_KEY') as string) ||
                      (runtime.getSetting?.('XAI_API_KEY') as string) || null;
    this.atvApiKey = (runtime.getSetting?.('ATV_API_KEY') as string) || null;
    this.serperApiKey = (runtime.getSetting?.('SERPER_API_KEY') as string) || null;
  }

  get capabilityDescription(): string {
    return 'Social intelligence combining real-time X/Twitter sentiment (Grok), Web3 identity verification (ATV: ENS, Farcaster, Gitcoin), and web research (Serper) for comprehensive project due diligence';
  }

  static async start(runtime: IAgentRuntime): Promise<SocialIntelService> {
    const service = new SocialIntelService(runtime);
    const sources: string[] = [];
    if (service.grokApiKey) sources.push('Grok');
    if (service.atvApiKey) sources.push('ATV');
    if (service.serperApiKey) sources.push('Serper');
    console.log(`[Buzz/SocialIntel] Service initialized — active sources: ${sources.join(', ') || 'none (configure API keys)'}`);
    return service;
  }

  async stop(): Promise<void> {
    console.log('[Buzz/SocialIntel] Service stopped');
  }

  /**
   * Grok x_search — Real-time X/Twitter sentiment
   */
  async analyzeSentiment(tokenSymbol: string, tokenName?: string): Promise<SentimentAnalysis> {
    const query = tokenName ? `$${tokenSymbol} OR "${tokenName}" crypto` : `$${tokenSymbol} crypto`;
    const result: SentimentAnalysis = {
      query,
      sentiment: 'neutral',
      sentimentScore: 0,
      tweetCount: 0,
      keyInfluencers: [],
      topNarratives: [],
      recentMentions: [],
      analyzedAt: new Date().toISOString(),
    };

    if (!this.grokApiKey) {
      return result;
    }

    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.grokApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'grok-2',
          messages: [
            {
              role: 'system',
              content: 'You are a crypto sentiment analyst. Analyze X/Twitter sentiment for the given token. Respond in JSON with: sentiment (very_bullish/bullish/neutral/bearish/very_bearish), sentimentScore (-100 to +100), tweetCount (estimated), keyInfluencers (array of handles), topNarratives (array of key talking points). Be data-driven and concise.',
            },
            {
              role: 'user',
              content: `Analyze current X/Twitter sentiment for: ${query}. Search recent posts and provide sentiment analysis.`,
            },
          ],
          search: true, // Grok x_search mode
        }),
      });

      if (!response.ok) return result;

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      // Parse JSON response from Grok
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          result.sentiment = parsed.sentiment || 'neutral';
          result.sentimentScore = parsed.sentimentScore || 0;
          result.tweetCount = parsed.tweetCount || 0;
          result.keyInfluencers = parsed.keyInfluencers || [];
          result.topNarratives = parsed.topNarratives || [];
        }
      } catch {
        // If JSON parsing fails, do basic keyword analysis
        const lower = content.toLowerCase();
        if (lower.includes('very bullish') || lower.includes('extremely positive')) {
          result.sentiment = 'very_bullish';
          result.sentimentScore = 75;
        } else if (lower.includes('bullish') || lower.includes('positive')) {
          result.sentiment = 'bullish';
          result.sentimentScore = 40;
        } else if (lower.includes('bearish') || lower.includes('negative')) {
          result.sentiment = 'bearish';
          result.sentimentScore = -40;
        }
      }
    } catch (error) {
      console.error('[Buzz/SocialIntel] Grok sentiment failed:', error);
    }

    return result;
  }

  /**
   * ATV Web3 Identity — ENS, Farcaster, Lens, Gitcoin Passport
   */
  async verifyIdentity(address: string): Promise<Web3Identity> {
    const identity: Web3Identity = {
      address,
      identityScore: 0,
      isDoxxed: false,
      flags: [],
      analyzedAt: new Date().toISOString(),
    };

    if (!this.atvApiKey) {
      identity.flags.push('NO_ATV_API_KEY');
      return identity;
    }

    try {
      const response = await fetch(
        `https://api.atv.sh/v1/identity/${address}`,
        {
          headers: {
            'X-API-Key': this.atvApiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        identity.flags.push('ATV_API_ERROR');
        return identity;
      }

      const data = await response.json();

      // Parse identity fields
      identity.ensName = data.ens || data.ensName || undefined;
      identity.farcasterHandle = data.farcaster || data.farcasterHandle || undefined;
      identity.lensHandle = data.lens || data.lensHandle || undefined;
      identity.twitterHandle = data.twitter || data.twitterHandle || undefined;

      if (data.gitcoinPassport) {
        identity.gitcoinPassport = {
          score: data.gitcoinPassport.score || 0,
          verified: data.gitcoinPassport.verified || false,
        };
      }

      // Identity scoring
      let score = 0;
      if (identity.ensName) { score += 20; identity.flags.push('ENS_HOLDER'); }
      if (identity.farcasterHandle) { score += 15; }
      if (identity.lensHandle) { score += 10; }
      if (identity.twitterHandle) { score += 15; }
      if (identity.gitcoinPassport?.verified) { score += 20; }
      if (identity.gitcoinPassport?.score && identity.gitcoinPassport.score > 20) { score += 20; }

      identity.identityScore = Math.min(100, score);
      identity.isDoxxed = score >= 50;

      if (identity.isDoxxed) {
        identity.flags.push('IDENTITY_VERIFIED');
      } else if (score === 0) {
        identity.flags.push('ANON_DEPLOYER');
      }

    } catch (error) {
      console.error('[Buzz/SocialIntel] ATV identity check failed:', error);
      identity.flags.push('IDENTITY_CHECK_ERROR');
    }

    return identity;
  }

  /**
   * Serper — Web search for news, partnerships, red flags
   */
  async researchProject(tokenSymbol: string, tokenName?: string): Promise<WebResearchResult> {
    const query = tokenName
      ? `"${tokenName}" OR "$${tokenSymbol}" crypto project`
      : `$${tokenSymbol} crypto project`;

    const result: WebResearchResult = {
      query,
      results: [],
      redFlags: [],
      positiveSignals: [],
      researchScore: 50, // neutral baseline
      analyzedAt: new Date().toISOString(),
    };

    if (!this.serperApiKey) {
      return result;
    }

    try {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': this.serperApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: query,
          num: 10,
        }),
      });

      if (!response.ok) return result;

      const data = await response.json();
      const organic = data.organic || [];

      result.results = organic.map((r: any) => ({
        title: r.title || '',
        url: r.link || '',
        snippet: r.snippet || '',
        source: r.source || new URL(r.link || 'https://unknown').hostname,
        date: r.date,
      }));

      // Analyze results for red flags and positive signals
      for (const r of result.results) {
        const text = `${r.title} ${r.snippet}`.toLowerCase();

        // Red flags
        if (text.includes('scam') || text.includes('fraud')) result.redFlags.push(`Scam mention: ${r.source}`);
        if (text.includes('rug pull') || text.includes('rugpull')) result.redFlags.push(`Rug pull mention: ${r.source}`);
        if (text.includes('hack') || text.includes('exploit')) result.redFlags.push(`Security incident: ${r.source}`);
        if (text.includes('lawsuit') || text.includes('sec investigation')) result.redFlags.push(`Legal issue: ${r.source}`);

        // Positive signals
        if (text.includes('partnership') || text.includes('collaboration')) result.positiveSignals.push(`Partnership: ${r.source}`);
        if (text.includes('audit') || text.includes('certik') || text.includes('hacken')) result.positiveSignals.push(`Audit mention: ${r.source}`);
        if (text.includes('grant') || text.includes('funding')) result.positiveSignals.push(`Funding: ${r.source}`);
        if (text.includes('mainnet') || text.includes('launch')) result.positiveSignals.push(`Development milestone: ${r.source}`);
      }

      // Research scoring
      let score = 50;
      score += result.positiveSignals.length * 8;
      score -= result.redFlags.length * 15;
      if (result.results.length === 0) score -= 20; // No web presence
      result.researchScore = Math.max(0, Math.min(100, score));

    } catch (error) {
      console.error('[Buzz/SocialIntel] Serper research failed:', error);
    }

    return result;
  }

  /**
   * Full social intelligence report combining all 3 sources
   */
  async generateReport(
    tokenSymbol: string,
    tokenName?: string,
    deployerAddress?: string
  ): Promise<SocialIntelReport> {
    // Run all analyses in parallel
    const [sentiment, research, identity] = await Promise.all([
      this.analyzeSentiment(tokenSymbol, tokenName),
      this.researchProject(tokenSymbol, tokenName),
      deployerAddress ? this.verifyIdentity(deployerAddress) : Promise.resolve(undefined),
    ]);

    const flags: string[] = [];

    // Combine flags
    if (identity) flags.push(...identity.flags);
    if (research.redFlags.length > 0) flags.push('WEB_RED_FLAGS_FOUND');
    if (sentiment.sentiment === 'very_bearish') flags.push('VERY_BEARISH_SENTIMENT');

    // Combined social score (feeds into 15% of overall token score)
    let combinedScore = 0;
    const sentimentNormalized = (sentiment.sentimentScore + 100) / 2; // -100..+100 → 0..100
    combinedScore += sentimentNormalized * 0.40;                       // 40% weight
    combinedScore += (identity?.identityScore || 50) * 0.30;          // 30% weight
    combinedScore += research.researchScore * 0.30;                    // 30% weight

    return {
      tokenSymbol,
      sentiment,
      identity,
      research,
      combinedSocialScore: Math.round(combinedScore),
      flags,
      analyzedAt: new Date().toISOString(),
    };
  }
}
