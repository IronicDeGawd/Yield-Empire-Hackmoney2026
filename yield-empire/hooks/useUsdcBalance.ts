/**
 * USDC balance hook for any BridgeKit-supported chain.
 * Uses the ViemAdapter to query USDC balanceOf via Circle's abstraction.
 *
 * Reference: resources/circle-bridge-kit-transfer/src/hooks/useUsdcBalance.ts
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatUnits } from 'viem';
import type { ViemAdapter } from '@circle-fin/adapter-viem-v2';
import type { SupportedChain } from '@/hooks/useBridge';

interface UseUsdcBalanceParams {
  evmAdapter?: ViemAdapter | null;
  evmAddress?: string | null;
}

export function useUsdcBalance(
  chain: SupportedChain,
  { evmAdapter, evmAddress }: UseUsdcBalanceParams = {}
) {
  const [balance, setBalance] = useState('0');
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchBalance = useCallback(async () => {
    if (!evmAdapter || !evmAddress) {
      if (mountedRef.current) setBalance('0');
      return;
    }

    if (mountedRef.current) setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const action = await evmAdapter.prepareAction('usdc.balanceOf', {}, {
        chain: chain as any,
        address: evmAddress,
      } as any);
      const raw = await action.execute();
      if (mountedRef.current) setBalance(formatUnits(BigInt(raw), 6));
    } catch (err) {
      console.warn(`[balance:${chain}]`, err);
      if (mountedRef.current) setBalance('0');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [chain, evmAdapter, evmAddress]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return {
    balance,
    loading,
    refresh: fetchBalance,
  };
}
