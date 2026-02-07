/**
 * USDC balance hook for any BridgeKit-supported chain.
 * Uses the ViemAdapter to query USDC balanceOf via Circle's abstraction.
 *
 * Reference: resources/circle-bridge-kit-transfer/src/hooks/useUsdcBalance.ts
 */

import { useEffect, useState } from 'react';
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

  async function fetchBalance() {
    if (!evmAdapter || !evmAddress) {
      setBalance('0');
      return;
    }

    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const action = await evmAdapter.prepareAction('usdc.balanceOf', {}, {
        chain: chain as any,
        address: evmAddress,
      } as any);
      const raw = await action.execute();
      setBalance(formatUnits(BigInt(raw), 6));
    } catch (err) {
      console.warn(`[balance:${chain}]`, err);
      setBalance('0');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await fetchBalance();
    })();
    return () => {
      cancelled = true;
    };
  }, [chain, evmAdapter, evmAddress]);

  return {
    balance,
    loading,
    refresh: fetchBalance,
  };
}
