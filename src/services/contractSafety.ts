/**
 * Buzz by SolCex — Contract Safety Service
 * Layer 2 Filter: RugCheck (#4) + QuillShield + DFlow MCP (#16)
 * Honeypot detection, authority analysis, LP verification, swap route checks
 */

import type { IAgentRuntime } from '@elizaos/core';

export interface ContractSafetyReport {
  address: string;
  chain: string;
  overallSafetyScore: number;       // 0-100 (QuillShield scale)
  rating: 'SAFE' | 'CAUTION' | 'WARNING' | 'DANGER';

  // Authority Analysis (25 pts)
  authorityScore: number;
  mintAuthority: 'revoked' | 'active' | 'unknown';
  freezeAuthority: 'revoked' | 'active' | 'unknown';
  updateAuthority: 'revoked' | 'active' | 'unknown';

  // Liquidity Analysis (25 pts)
  liquidityScore: number;
  lpLocked: boolean;
  lpBurned: boolean;
  lpLockDuration?: string;
  liquidityUsd: number;

  // Holder Distribution (25 pts)
  holderScore: number;
  topHolderConcentration?: number;   // % held by top 10
  totalHolders?: number;

  // Contract Patterns (25 pts)
  contractScore: number;
  isHoneypot: boolean;
  hasTradingTax: boolean;
  tradingTaxBuy?: number;
  tradingTaxSell?: number;
  isVerified: boolean;

  // DFlow Route Quality
  dflowRouteCount: number;
  dflowBestSlippage?: number;       // % for $10K swap
  dflowScoreModifier: number;       // +13 to -8
  dflowTier1Dexes: string[];

  // Risk flags
  flags: string[];
  analyzedAt: string;
}

export class ContractSafetyService {
  static serviceType = 'contract-safety' as const;

  private runtime: IAgentRuntime;
  private rugcheckBaseUrl: string;

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
    this.rugcheckBaseUrl = 'https://api.rugcheck.xyz/v1';
  }

  get capabilityDescription(): string {
    return 'Deep contract safety analysis via RugCheck honeypot detection, QuillShield scoring (authority, liquidity, holders, patterns), and DFlow swap route verification';
  }

  static async start(runtime: IAgentRuntime): Promise<ContractSafetyService> {
    const service = new ContractSafetyService(runtime);
    console.log('[Buzz/ContractSafety] Service initialized — RugCheck + QuillShield + DFlow');
    return service;
  }

  async stop(): Promise<void> {
    console.log('[Buzz/ContractSafety] Service stopped');
  }

  /**
   * Full safety analysis for a token contract
   */
  async analyzeContract(address: string, chain: string = 'solana'): Promise<ContractSafetyReport> {
    const report: ContractSafetyReport = {
      address,
      chain,
      overallSafetyScore: 0,
      rating: 'DANGER',
      authorityScore: 0,
      mintAuthority: 'unknown',
      freezeAuthority: 'unknown',
      updateAuthority: 'unknown',
      liquidityScore: 0,
      lpLocked: false,
      lpBurned: false,
      liquidityUsd: 0,
      holderScore: 0,
      contractScore: 0,
      isHoneypot: false,
      hasTradingTax: false,
      isVerified: false,
      dflowRouteCount: 0,
      dflowScoreModifier: 0,
      dflowTier1Dexes: [],
      flags: [],
      analyzedAt: new Date().toISOString(),
    };

    // RugCheck Analysis
    await this.runRugCheck(address, chain, report);

    // QuillShield Scoring
    this.computeQuillShieldScore(report);

    // DFlow Route Verification (Solana only)
    if (chain === 'solana') {
      await this.checkDFlowRoutes(address, report);
    }

    // Final score with DFlow modifier
    report.overallSafetyScore = Math.max(0, Math.min(100,
      report.authorityScore + report.liquidityScore +
      report.holderScore + report.contractScore +
      report.dflowScoreModifier
    ));

    // Rating
    if (report.overallSafetyScore >= 80) report.rating = 'SAFE';
    else if (report.overallSafetyScore >= 60) report.rating = 'CAUTION';
    else if (report.overallSafetyScore >= 40) report.rating = 'WARNING';
    else report.rating = 'DANGER';

    return report;
  }

  /**
   * RugCheck API integration
   */
  private async runRugCheck(address: string, chain: string, report: ContractSafetyReport): Promise<void> {
    try {
      const response = await fetch(`${this.rugcheckBaseUrl}/tokens/${address}/report`);
      if (!response.ok) {
        report.flags.push('RUGCHECK_UNAVAILABLE');
        return;
      }

      const data = await response.json();

      // Honeypot detection
      if (data.isHoneypot || data.honeypot) {
        report.isHoneypot = true;
        report.flags.push('HONEYPOT_DETECTED');
        report.contractScore = 0;
      }

      // Authority status
      if (data.mintAuthority !== undefined) {
        report.mintAuthority = data.mintAuthority === null ? 'revoked' : 'active';
        if (report.mintAuthority === 'active') report.flags.push('MINT_AUTHORITY_ACTIVE');
      }
      if (data.freezeAuthority !== undefined) {
        report.freezeAuthority = data.freezeAuthority === null ? 'revoked' : 'active';
        if (report.freezeAuthority === 'active') report.flags.push('FREEZE_AUTHORITY_ACTIVE');
      }
      if (data.updateAuthority !== undefined) {
        report.updateAuthority = data.updateAuthority === null ? 'revoked' : 'active';
      }

      // LP info
      if (data.lpLocked) report.lpLocked = true;
      if (data.lpBurned) report.lpBurned = true;

      // Trading tax
      if (data.buyTax > 0 || data.sellTax > 0) {
        report.hasTradingTax = true;
        report.tradingTaxBuy = data.buyTax;
        report.tradingTaxSell = data.sellTax;
        if (data.buyTax > 10 || data.sellTax > 10) {
          report.flags.push('HIGH_TRADING_TAX');
        }
      }

      // Holders
      if (data.topHolders) {
        const top10Pct = data.topHolders.slice(0, 10).reduce(
          (sum: number, h: any) => sum + (h.percentage || 0), 0
        );
        report.topHolderConcentration = top10Pct;
        if (top10Pct > 80) report.flags.push('HIGH_HOLDER_CONCENTRATION');
      }
      if (data.totalHolders) report.totalHolders = data.totalHolders;

      // Verification
      if (data.isVerified) report.isVerified = true;

    } catch (error) {
      console.error('[Buzz/ContractSafety] RugCheck failed:', error);
      report.flags.push('RUGCHECK_ERROR');
    }
  }

  /**
   * QuillShield scoring framework (0-100 across 4 dimensions)
   */
  private computeQuillShieldScore(report: ContractSafetyReport): void {
    // Authority Analysis (25 pts max)
    let authScore = 25;
    if (report.mintAuthority === 'active') authScore -= 10;
    if (report.freezeAuthority === 'active') authScore -= 10;
    if (report.updateAuthority === 'active') authScore -= 5;
    if (report.mintAuthority === 'unknown') authScore -= 5;
    report.authorityScore = Math.max(0, authScore);

    // Liquidity Analysis (25 pts max)
    let liqScore = 10; // baseline
    if (report.lpLocked) liqScore += 7;
    if (report.lpBurned) liqScore += 8;
    if (report.liquidityUsd >= 500000) liqScore = 25;
    else if (report.liquidityUsd >= 100000) liqScore = Math.min(liqScore + 5, 25);
    report.liquidityScore = Math.max(0, Math.min(25, liqScore));

    // Holder Distribution (25 pts max)
    let holdScore = 15; // baseline
    if (report.topHolderConcentration !== undefined) {
      if (report.topHolderConcentration < 30) holdScore = 25;
      else if (report.topHolderConcentration < 50) holdScore = 20;
      else if (report.topHolderConcentration < 70) holdScore = 12;
      else holdScore = 5;
    }
    if (report.totalHolders && report.totalHolders > 1000) holdScore = Math.min(holdScore + 3, 25);
    report.holderScore = Math.max(0, Math.min(25, holdScore));

    // Contract Patterns (25 pts max)
    let contractScore = 20; // baseline
    if (report.isHoneypot) contractScore = 0;
    if (report.hasTradingTax) {
      const maxTax = Math.max(report.tradingTaxBuy || 0, report.tradingTaxSell || 0);
      if (maxTax > 10) contractScore -= 15;
      else if (maxTax > 5) contractScore -= 8;
      else contractScore -= 3;
    }
    if (report.isVerified) contractScore = Math.min(contractScore + 5, 25);
    report.contractScore = Math.max(0, Math.min(25, contractScore));
  }

  /**
   * DFlow MCP route quality verification (Solana only)
   * Applies scoring modifiers: max +13 / min -8
   */
  private async checkDFlowRoutes(address: string, report: ContractSafetyReport): Promise<void> {
    try {
      // In production, this calls mcporter CLI:
      // mcporter call 'DFlow.SearchDFlow(query: "swap routes {address} slippage")'
      // For the plugin, we simulate with DFlow API endpoint
      const response = await fetch(
        `https://pond.dflow.net/api/v1/routes?tokenMint=${address}&amount=10000`
      );

      if (!response.ok) {
        report.dflowRouteCount = 0;
        report.dflowScoreModifier = -5; // No routes found = red flag
        report.flags.push('NO_DFLOW_ROUTES');
        return;
      }

      const data = await response.json();
      const routes = data.routes || [];
      report.dflowRouteCount = routes.length;

      // Tier-1 DEX detection
      const tier1Names = ['raydium', 'meteora', 'phoenix', 'orca', 'jupiter'];
      report.dflowTier1Dexes = routes
        .map((r: any) => r.dex || r.venue || '')
        .filter((d: string) => tier1Names.some(t => d.toLowerCase().includes(t)));

      // Best slippage
      if (routes.length > 0) {
        const slippages = routes.map((r: any) => r.slippage || r.priceImpact || 100);
        report.dflowBestSlippage = Math.min(...slippages);
      }

      // DFlow scoring modifiers (from Master Ops v5.3.6)
      let modifier = 0;
      if (report.dflowRouteCount >= 3) modifier += 5;        // 3+ routes = real liquidity
      if (report.dflowBestSlippage !== undefined && report.dflowBestSlippage < 1) modifier += 3; // Deep liquidity
      if (report.dflowTier1Dexes.length > 0) modifier += 3;  // Quality venues
      // Orderbook depth check would need additional API call
      if (report.dflowRouteCount === 0) modifier -= 5;       // No routes = flag
      if (report.dflowBestSlippage !== undefined && report.dflowBestSlippage > 5) modifier -= 3; // Thin liquidity

      report.dflowScoreModifier = Math.max(-8, Math.min(13, modifier));

    } catch (error) {
      console.error('[Buzz/ContractSafety] DFlow route check failed:', error);
      report.dflowScoreModifier = 0;
      report.flags.push('DFLOW_CHECK_ERROR');
    }
  }
}
