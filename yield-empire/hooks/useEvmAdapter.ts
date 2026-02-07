/**
 * EVM adapter hook for Circle BridgeKit
 * Creates a BridgeKit-compatible ViemAdapter from the wagmi wallet connection.
 *
 * Reference: resources/circle-bridge-kit-transfer/src/hooks/useEvmAdapter.ts
 */

import { useEffect, useRef, useState } from 'react';
import { useAccount, useConnectorClient } from 'wagmi';
import {
  createViemAdapterFromProvider,
  type ViemAdapter,
} from '@circle-fin/adapter-viem-v2';

export function useEvmAdapter() {
  const { address } = useAccount();
  const { data: client } = useConnectorClient();
  const [adapter, setAdapter] = useState<ViemAdapter | null>(null);

  const lastProviderRef = useRef<unknown>(null);
  const lastAddressRef = useRef<string | null>(null);

  function pickProvider(): unknown | null {
    // Try extracting from wagmi's connector client transport first
    const provider = (client as Record<string, unknown>)?.transport as Record<string, unknown> | undefined;
    const innerProvider = (provider as Record<string, unknown>)?.value as Record<string, unknown> | undefined;
    const transportProvider = (innerProvider as Record<string, unknown>)?.provider;
    if (transportProvider) return transportProvider;

    // Fallback to injected provider (window.ethereum)
    const eth = (globalThis as Record<string, unknown>)?.ethereum as Record<string, unknown> | undefined;
    if (!eth) return null;
    const providers = eth.providers as unknown[] | undefined;
    if (Array.isArray(providers) && providers.length > 0) {
      return providers[0];
    }
    return eth;
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!address) {
        if (!cancelled) {
          setAdapter(null);
          lastProviderRef.current = null;
          lastAddressRef.current = null;
        }
        return;
      }

      const provider = pickProvider();
      if (!provider) {
        if (!cancelled) {
          setAdapter(null);
          lastProviderRef.current = null;
          lastAddressRef.current = null;
        }
        return;
      }

      // Only recreate adapter when the provider instance changes
      const providerChanged = provider !== lastProviderRef.current;
      if (providerChanged) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newAdapter = await createViemAdapterFromProvider({ provider: provider as any });
        if (!cancelled) {
          setAdapter(newAdapter);
          lastProviderRef.current = provider;
        }
      }
      if (!cancelled) {
        lastAddressRef.current = address;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, address]);

  return { evmAdapter: adapter, evmAddress: address ?? null };
}
