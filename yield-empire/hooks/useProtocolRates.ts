/**
 * Hook to fetch live APY rates from DeFi protocols.
 *
 * - Aave V3 (Base Sepolia): fetched via getReserveData()
 * - Compound V3 (Sepolia): fetched via getUtilization() + getSupplyRate()
 * - Morpho/Curve: estimated (too complex to fetch on-chain)
 * - Uniswap: simulated (swap protocol, no lending APY)
 * - Yearn: simulated (placeholder, no on-chain integration)
 *
 * Falls back to hardcoded rates from BUILDING_CONFIGS on fetch failure.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePublicClient } from 'wagmi';
import { BUILDING_CONFIGS } from '@/lib/constants';
import { getAaveSupplyAPY } from '@/lib/protocols/aave';
import { getCompoundSupplyAPY } from '@/lib/protocols/compound';
import type { ProtocolId, RateSource } from '@/lib/types';

export interface ProtocolRate {
  apy: number;
  source: RateSource;
  isLive: boolean;
  lastUpdated: number;
}

export type ProtocolRates = Record<ProtocolId, ProtocolRate>;

const REFRESH_INTERVAL = 60_000; // 60 seconds

function buildFallbackRates(): ProtocolRates {
  return {
    aave: { apy: BUILDING_CONFIGS.aave.baseYield, isLive: false, source: 'estimated', lastUpdated: 0 },
    compound: { apy: BUILDING_CONFIGS.compound.baseYield, isLive: false, source: 'estimated', lastUpdated: 0 },
    uniswap: { apy: BUILDING_CONFIGS.uniswap.baseYield, isLive: false, source: 'simulated', lastUpdated: 0 },
    curve: { apy: BUILDING_CONFIGS.curve.baseYield, isLive: false, source: 'estimated', lastUpdated: 0 },
    yearn: { apy: BUILDING_CONFIGS.yearn.baseYield, isLive: false, source: 'simulated', lastUpdated: 0 },
  };
}

export function useProtocolRates() {
  const [rates, setRates] = useState<ProtocolRates>(buildFallbackRates);
  const [isLoading, setIsLoading] = useState(false);
  const prevRatesRef = useRef<ProtocolRates>(rates);

  // Public clients for each chain
  const baseSepoliaClient = usePublicClient({ chainId: 84532 });
  const sepoliaClient = usePublicClient({ chainId: 11155111 });

  const fetchRates = useCallback(async () => {
    setIsLoading(true);
    const now = Date.now();
    const newRates = buildFallbackRates();
    const prev = prevRatesRef.current;

    // Fetch Aave APY (Base Sepolia)
    if (baseSepoliaClient) {
      try {
        const apy = await getAaveSupplyAPY(baseSepoliaClient);
        if (apy > 0) {
          newRates.aave = { apy, isLive: true, source: 'live', lastUpdated: now };
        } else if (prev.aave.isLive) {
          // Keep last known live rate if new fetch returns 0
          newRates.aave = { ...prev.aave };
        }
      } catch {
        // On failure, keep last known live rate or fallback
        if (prev.aave.isLive) {
          newRates.aave = { ...prev.aave };
        }
      }
    }

    // Fetch Compound APY (Sepolia)
    if (sepoliaClient) {
      try {
        const apy = await getCompoundSupplyAPY(sepoliaClient);
        if (apy > 0) {
          newRates.compound = { apy, isLive: true, source: 'live', lastUpdated: now };
        } else if (prev.compound.isLive) {
          newRates.compound = { ...prev.compound };
        }
      } catch {
        if (prev.compound.isLive) {
          newRates.compound = { ...prev.compound };
        }
      }
    }

    // Morpho (curve), Uniswap, Yearn: keep fallback rates

    prevRatesRef.current = newRates;
    setRates(newRates);
    setIsLoading(false);
  }, [baseSepoliaClient, sepoliaClient]);

  // Fetch on mount and refresh periodically
  useEffect(() => {
    fetchRates();
    const interval = setInterval(fetchRates, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchRates]);

  return { rates, isLoading, refresh: fetchRates };
}
