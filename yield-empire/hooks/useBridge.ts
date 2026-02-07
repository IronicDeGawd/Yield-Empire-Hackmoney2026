/**
 * Bridge hook for Circle BridgeKit CCTP transfers.
 * Handles the full flow: approve → burn → waitAttestation → mint
 *
 * Reference: resources/circle-bridge-kit-transfer/src/hooks/useBridge.ts
 */

import { useState } from 'react';
import {
  BridgeKit,
  type BridgeResult,
  type BridgeParams as BridgeKitParams,
  type EstimateResult,
} from '@circle-fin/bridge-kit';
import type { ViemAdapter } from '@circle-fin/adapter-viem-v2';

export type SupportedChain = string;

export interface BridgeParams {
  fromChain: SupportedChain;
  toChain: SupportedChain;
  amount: string;
  recipientAddress?: string;
  fromAdapter: ViemAdapter;
  toAdapter: ViemAdapter;
}

export function useBridge() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BridgeResult | null>(null);

  const [isEstimating, setIsEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [estimateData, setEstimateData] = useState<EstimateResult | null>(null);

  function clear() {
    setError(null);
    setData(null);
    setIsLoading(false);
    setEstimateError(null);
    setEstimateData(null);
    setIsEstimating(false);
  }

  function buildBridgeKitParams(params: BridgeParams): BridgeKitParams {
    const to = params.recipientAddress
      ? {
          adapter: params.toAdapter,
          chain: params.toChain as BridgeKitParams['to']['chain'],
          recipientAddress: params.recipientAddress,
        }
      : {
          adapter: params.toAdapter,
          chain: params.toChain as BridgeKitParams['to']['chain'],
        };

    return {
      from: {
        adapter: params.fromAdapter,
        chain: params.fromChain as BridgeKitParams['from']['chain'],
      },
      to,
      amount: params.amount,
    };
  }

  async function bridge(
    params: BridgeParams,
    options?: { onEvent?: (evt: Record<string, unknown>) => void }
  ) {
    setIsLoading(true);
    setError(null);
    setData(null);

    try {
      const kit = new BridgeKit();
      const handler = (payload: Record<string, unknown>) => options?.onEvent?.(payload);
      kit.on('*', handler);

      try {
        const result = await kit.bridge(buildBridgeKitParams(params));
        setData(result);
        return { ok: true, data: result };
      } finally {
        kit.off('*', handler);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Bridge failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  async function retry(
    failedResult: BridgeResult,
    params: BridgeParams,
    options?: { onEvent?: (evt: Record<string, unknown>) => void }
  ) {
    setIsLoading(true);
    setError(null);

    try {
      const kit = new BridgeKit();
      const handler = (payload: Record<string, unknown>) => options?.onEvent?.(payload);
      kit.on('*', handler);

      try {
        const result = await kit.retry(failedResult, {
          from: params.fromAdapter,
          to: params.toAdapter,
        });
        setData(result);
        return { ok: true, data: result };
      } finally {
        kit.off('*', handler);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Retry failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  async function estimate(params: BridgeParams) {
    setIsEstimating(true);
    setEstimateError(null);
    setEstimateData(null);

    try {
      const kit = new BridgeKit();
      const result = await kit.estimate(buildBridgeKitParams(params));
      setEstimateData(result);
      return { ok: true, data: result };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Estimate failed';
      setEstimateError(message);
      throw err;
    } finally {
      setIsEstimating(false);
    }
  }

  return {
    bridge,
    retry,
    estimate,
    isLoading,
    error,
    data,
    isEstimating,
    estimateError,
    estimateData,
    clear,
  };
}
