/**
 * Buzz by SolCex — Multi-Chain Intelligence Service
 * Layer 2 Filter: Allium (#6) — 16-chain deployer wallet PnL,
 * cross-chain behavior tracking, multi-chain token presence
 */

import type { IAgentRuntime } from '@elizaos/core';

export interface DeployerProfile {
  address: string;
  chains: string[];
  totalDeployments: number;
  netPnlUsd: number;
  avgTokenLifespanDays: number;
  rugCount: number;
  successfulProjects: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  flags: string[];
  analyzedAt: string;
}

export interface ChainPresence {
  tokenAddress: string;
  chain: string;
  liquidityUsd: number;
  volume24h: number;
  holderCount?: number;
  deployedAt?: string;
}

export interface MultiChainReport {
  tokenSymbol: string;
  tokenName: string;
  primaryChain: string;
  chainsPresent: ChainPresence[];
  totalLiquidityUsd: number;
  totalVolume24h: number;
  deployerProfile?: DeployerProfile;
  crossChainScore: number;          // 0-100
  flags: string[];
  analyzedAt: string;
}

export class MultiChainIntelService {
  static serviceType = 'multichain-intel' as const;

  private runtime: IAgentRuntime;
  private alliumApiKey: string | null;
  private alliumBaseUrl: string;

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
    this.alliumApiKey = (runtime.getSetting?.('ALLIUM_API_KEY') as string) || null;
    this.alliumBaseUrl = 'https://api.allium.so/api/v1';
  }

  get capabilityDescription(): string {
    return 'Multi-chain intelligence across 16 chains via Allium — deployer wallet PnL, cross-chain behavior tracking, and token presence detection';
  }

  static async start(runtime: IAgentRuntime): Promise<MultiChainIntelService> {
    const service = new MultiChainIntelService(runtime);
    if (!service.alliumApiKey) {
      console.warn('[Buzz/MultiChain] No ALLIUM_API_KEY — cross-chain analysis limited');
    } else {
      console.log('[Buzz/MultiChain] Service initialized — 16-chain coverage via Allium');
    }
    return service;
  }

  async stop(): Promise<void> {
    console.log('[Buzz/MultiChain] Service stopped');
  }

  /**
   * Supported chains via Allium
   */
  static readonly SUPPORTED_CHAINS = [
    'ethereum', 'solana', 'base', 'arbitrum', 'optimism',
    'polygon', 'avalanche', 'bsc', 'fantom', 'gnosis',
    'celo', 'linea', 'scroll', 'zksync', 'blast', 'mantle'
  ];

  /**
   * Analyze a deployer wallet across all chains
   */
  async analyzeDeployer(deployerAddress: string): Promise<DeployerProfile> {
    const profile: DeployerProfile = {
      address: deployerAddress,
      chains: [],
      totalDeployments: 0,
      netPnlUsd: 0,
      avgTokenLifespanDays: 0,
      rugCount: 0,
      successfulProjects: 0,
      riskLevel: 'MEDIUM',
      flags: [],
      analyzedAt: new Date().toISOString(),
    };

    if (!this.alliumApiKey) {
      profile.flags.push('NO_ALLIUM_API_KEY');
      return profile;
    }

    try {
      // Query Allium for deployer wallet activity across chains
      const response = await fetch(`${this.alliumBaseUrl}/explorer/wallets/${deployerAddress}`, {
        headers: {
          'X-API-Key': this.alliumApiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        profile.flags.push('ALLIUM_API_ERROR');
        return profile;
      }

      const data = await response.json();

      // Parse chain activity
      if (data.chains) {
        profile.chains = data.chains.map((c: any) => c.chain || c.name);
      }

      // Parse PnL
      if (data.pnl !== undefined) {
        profile.netPnlUsd = data.pnl;
      }

      // Parse deployment history
      if (data.deployments) {
        profile.totalDeployments = data.deployments.length || 0;

        // Analyze deployment patterns
        let totalLifespan = 0;
        let rugIndicators = 0;

        for (const dep of data.deployments) {
          const lifespanDays = dep.lifespanDays || 0;
          totalLifespan += lifespanDays;

          if (lifespanDays < 2 && dep.liquidityRemoved) {
            rugIndicators++;
          }
          if (dep.status === 'successful' || lifespanDays > 30) {
            profile.successfulProjects++;
          }
        }

        profile.rugCount = rugIndicators;
        profile.avgTokenLifespanDays = profile.totalDeployments > 0
          ? totalLifespan / profile.totalDeployments
          : 0;
      }

      // Risk assessment
      if (profile.rugCount >= 3) {
        profile.riskLevel = 'CRITICAL';
        profile.flags.push('SERIAL_RUGGER');
      } else if (profile.rugCount >= 1 || profile.netPnlUsd < -10000) {
        profile.riskLevel = 'HIGH';
        profile.flags.push('RUG_HISTORY');
      } else if (profile.avgTokenLifespanDays < 7) {
        profile.riskLevel = 'HIGH';
        profile.flags.push('SHORT_LIVED_TOKENS');
      } else if (profile.chains.length >= 5) {
        // Multi-chain deployer could be sophisticated or a serial launcher
        if (profile.successfulProjects > profile.rugCount) {
          profile.riskLevel = 'LOW';
          profile.flags.push('MULTI_CHAIN_BUILDER');
        } else {
          profile.riskLevel = 'MEDIUM';
          profile.flags.push('MULTI_CHAIN_SERIAL_CREATOR');
        }
      } else if (profile.netPnlUsd > 0 && profile.successfulProjects > 0) {
        profile.riskLevel = 'LOW';
      }

      // Scoring modifier flags for TokenScoringService
      if (profile.chains.length > 1) profile.flags.push('MULTI_CHAIN_DEPLOYER');
      if (profile.netPnlUsd > 0) profile.flags.push('NET_POSITIVE_PNL');
      if (profile.netPnlUsd < -50000) profile.flags.push('LARGE_NEGATIVE_PNL');

    } catch (error) {
      console.error('[Buzz/MultiChain] Deployer analysis failed:', error);
      profile.flags.push('ANALYSIS_ERROR');
    }

    return profile;
  }

  /**
   * Check if a token exists across multiple chains
   */
  async checkCrossChainPresence(tokenSymbol: string): Promise<ChainPresence[]> {
    const presences: ChainPresence[] = [];

    try {
      // Query DexScreener for cross-chain pairs (free, no key needed)
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(tokenSymbol)}`
      );

      if (!response.ok) return presences;

      const data = await response.json();
      const pairs = data.pairs || [];

      // Group by chain, take best pair per chain
      const chainMap = new Map<string, any>();
      for (const pair of pairs) {
        const chain = pair.chainId;
        if (!chainMap.has(chain) ||
            (pair.liquidity?.usd || 0) > (chainMap.get(chain).liquidity?.usd || 0)) {
          chainMap.set(chain, pair);
        }
      }

      for (const [chain, pair] of chainMap) {
        presences.push({
          tokenAddress: pair.baseToken?.address || '',
          chain,
          liquidityUsd: pair.liquidity?.usd || 0,
          volume24h: pair.volume?.h24 || 0,
          holderCount: undefined,
          deployedAt: pair.pairCreatedAt
            ? new Date(pair.pairCreatedAt).toISOString()
            : undefined,
        });
      }
    } catch (error) {
      console.error('[Buzz/MultiChain] Cross-chain presence check failed:', error);
    }

    return presences.sort((a, b) => b.liquidityUsd - a.liquidityUsd);
  }

  /**
   * Full multi-chain report for a token
   */
  async generateReport(
    tokenSymbol: string,
    tokenName: string,
    deployerAddress?: string
  ): Promise<MultiChainReport> {
    const chainsPresent = await this.checkCrossChainPresence(tokenSymbol);
    const primaryChain = chainsPresent.length > 0 ? chainsPresent[0].chain : 'unknown';

    const report: MultiChainReport = {
      tokenSymbol,
      tokenName,
      primaryChain,
      chainsPresent,
      totalLiquidityUsd: chainsPresent.reduce((sum, c) => sum + c.liquidityUsd, 0),
      totalVolume24h: chainsPresent.reduce((sum, c) => sum + c.volume24h, 0),
      crossChainScore: 0,
      flags: [],
      analyzedAt: new Date().toISOString(),
    };

    // Deployer profile if address provided
    if (deployerAddress) {
      report.deployerProfile = await this.analyzeDeployer(deployerAddress);
      report.flags.push(...(report.deployerProfile.flags || []));
    }

    // Cross-chain scoring
    let score = 50; // baseline
    const chainCount = chainsPresent.length;
    if (chainCount >= 5) score += 20;
    else if (chainCount >= 3) score += 15;
    else if (chainCount >= 2) score += 8;

    if (report.totalLiquidityUsd >= 1000000) score += 15;
    else if (report.totalLiquidityUsd >= 500000) score += 10;
    else if (report.totalLiquidityUsd >= 100000) score += 5;

    if (report.deployerProfile?.riskLevel === 'CRITICAL') score -= 30;
    else if (report.deployerProfile?.riskLevel === 'HIGH') score -= 15;
    else if (report.deployerProfile?.riskLevel === 'LOW') score += 10;

    report.crossChainScore = Math.max(0, Math.min(100, score));

    return report;
  }
}
