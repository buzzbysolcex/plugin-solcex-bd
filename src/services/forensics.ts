/**
 * Buzz by SolCex — Wallet Forensics Service
 * Analyzes wallets using Helius API for risk assessment
 */

import type { IAgentRuntime } from '@elizaos/core';
import type { WalletForensics } from '../types/index.js';

export class WalletForensicsService {
  static serviceType = 'wallet-forensics' as const;

  private runtime: IAgentRuntime;
  private heliusApiKey: string | null;
  private heliusBaseUrl: string;

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
    this.heliusApiKey = (runtime.getSetting?.('HELIUS_API_KEY') as string) || null;
    this.heliusBaseUrl = 'https://api.helius.xyz/v0';
  }

  get capabilityDescription(): string {
    return 'Analyzes Solana wallets for risk assessment, transaction history, and token holdings via Helius API';
  }

  static async start(runtime: IAgentRuntime): Promise<WalletForensicsService> {
    const service = new WalletForensicsService(runtime);
    if (!service.heliusApiKey) {
      console.warn('[Buzz/Forensics] No HELIUS_API_KEY configured — wallet analysis limited');
    } else {
      console.log('[Buzz/Forensics] Service initialized with Helius API');
    }
    return service;
  }

  async stop(): Promise<void> {
    console.log('[Buzz/Forensics] Service stopped');
  }

  /**
   * Analyze a Solana wallet address
   */
  async analyzeWallet(address: string): Promise<WalletForensics> {
    const result: WalletForensics = {
      address,
      riskFlags: [],
    };

    if (!this.heliusApiKey) {
      result.riskFlags?.push('NO_API_KEY_CONFIGURED');
      return result;
    }

    try {
      // Fetch balances
      const balanceResponse = await fetch(
        `${this.heliusBaseUrl}/addresses/${address}/balances?api-key=${this.heliusApiKey}`
      );
      if (balanceResponse.ok) {
        const balanceData: any = await balanceResponse.json() as any;
        result.balanceSol = (balanceData.nativeBalance || 0) / 1e9;
        result.tokenAccounts = balanceData.tokens?.length || 0;

        // Extract top token holdings
        if (balanceData.tokens && balanceData.tokens.length > 0) {
          result.topTokenHoldings = balanceData.tokens
            .sort((a: any, b: any) => (b.amount || 0) - (a.amount || 0))
            .slice(0, 10)
            .map((t: any) => ({
              mint: t.mint,
              symbol: t.symbol || 'UNKNOWN',
              amount: t.amount || 0,
              valueUsd: t.valueUsd,
            }));
        }
      }

      // Fetch transaction history (recent)
      const txResponse = await fetch(
        `${this.heliusBaseUrl}/addresses/${address}/transactions?api-key=${this.heliusApiKey}&limit=100`
      );
      if (txResponse.ok) {
        const txData: any = await txResponse.json() as any;
        result.transactionCount = txData.length || 0;

        if (txData.length > 0) {
          result.lastTransaction = new Date(txData[0].timestamp * 1000).toISOString();
          result.firstTransaction = new Date(txData[txData.length - 1].timestamp * 1000).toISOString();
        }
      }

      // Risk analysis
      if (result.balanceSol !== undefined && result.balanceSol < 0.01) {
        result.riskFlags?.push('VERY_LOW_SOL_BALANCE');
      }
      if (result.transactionCount !== undefined && result.transactionCount < 5) {
        result.riskFlags?.push('LOW_TRANSACTION_HISTORY');
      }
      if (result.tokenAccounts !== undefined && result.tokenAccounts > 200) {
        result.riskFlags?.push('EXCESSIVE_TOKEN_ACCOUNTS');
      }

    } catch (error) {
      console.error('[Buzz/Forensics] Wallet analysis failed:', error);
      result.riskFlags?.push('ANALYSIS_ERROR');
    }

    return result;
  }
}
