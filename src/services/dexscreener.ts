/**
 * Buzz by SolCex — DexScreener Service
 * Fetches token profiles, pairs, and market data from DexScreener API
 */

import type { IAgentRuntime, Service } from '@elizaos/core';
import type { TokenProfile, TokenPair } from '../types/index.js';

const DEXSCREENER_BASE = 'https://api.dexscreener.com';

export class DexScreenerService {
  static serviceType = 'dexscreener' as const;

  private runtime: IAgentRuntime;
  private baseUrl: string;

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
    this.baseUrl = (runtime.getSetting?.('DEXSCREENER_API_URL') as string) || DEXSCREENER_BASE;
  }

  get capabilityDescription(): string {
    return 'Fetches real-time token market data, pairs, and profiles from DexScreener API';
  }

  static async start(runtime: IAgentRuntime): Promise<DexScreenerService> {
    const service = new DexScreenerService(runtime);
    console.log('[Buzz/DexScreener] Service initialized');
    return service;
  }

  async stop(): Promise<void> {
    console.log('[Buzz/DexScreener] Service stopped');
  }

  /**
   * Get latest token profiles (trending/boosted)
   */
  async getLatestProfiles(): Promise<TokenProfile[]> {
    try {
      const response = await fetch(`${this.baseUrl}/token-profiles/latest/v1`);
      if (!response.ok) throw new Error(`DexScreener API error: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('[Buzz/DexScreener] Failed to fetch profiles:', error);
      return [];
    }
  }

  /**
   * Get boosted tokens
   */
  async getBoostedTokens(): Promise<TokenProfile[]> {
    try {
      const response = await fetch(`${this.baseUrl}/token-boosts/latest/v1`);
      if (!response.ok) throw new Error(`DexScreener API error: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('[Buzz/DexScreener] Failed to fetch boosted tokens:', error);
      return [];
    }
  }

  /**
   * Search for token pairs by query
   */
  async searchPairs(query: string): Promise<TokenPair[]> {
    try {
      const response = await fetch(`${this.baseUrl}/latest/dex/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error(`DexScreener API error: ${response.status}`);
      const data = await response.json() as any;
      return data.pairs || [];
    } catch (error) {
      console.error('[Buzz/DexScreener] Failed to search pairs:', error);
      return [];
    }
  }

  /**
   * Get pair data by chain and pair address
   */
  async getPairsByChain(chainId: string, pairAddresses: string[]): Promise<TokenPair[]> {
    try {
      const addresses = pairAddresses.join(',');
      const response = await fetch(`${this.baseUrl}/latest/dex/pairs/${chainId}/${addresses}`);
      if (!response.ok) throw new Error(`DexScreener API error: ${response.status}`);
      const data = await response.json() as any;
      return data.pairs || [];
    } catch (error) {
      console.error('[Buzz/DexScreener] Failed to fetch pairs by chain:', error);
      return [];
    }
  }

  /**
   * Get token data by address(es)
   */
  async getTokensByAddress(addresses: string[]): Promise<TokenPair[]> {
    try {
      const addr = addresses.join(',');
      const response = await fetch(`${this.baseUrl}/tokens/v1/${addr}`);
      if (!response.ok) throw new Error(`DexScreener API error: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('[Buzz/DexScreener] Failed to fetch tokens by address:', error);
      return [];
    }
  }
}
