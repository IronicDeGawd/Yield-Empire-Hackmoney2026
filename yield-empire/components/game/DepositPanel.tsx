'use client';

/**
 * DepositPanel - Cross-chain USDC deposit panel using Circle BridgeKit.
 * Provides chain selection, amount input, fee estimation, and bridge execution
 * with step-by-step progress tracking.
 *
 * Persists in-flight bridge state to localStorage so interrupted transfers
 * (e.g. during attestation wait) can be retried after page refresh.
 */

import { useState, useEffect, useRef } from 'react';
import { ArrowDownUp, ChevronDown, Loader2, X, Check, RotateCw } from 'lucide-react';
import { useSwitchChain } from 'wagmi';
import { useEvmAdapter } from '@/hooks/useEvmAdapter';
import { useBridge, type BridgeParams } from '@/hooks/useBridge';
import { useUsdcBalance } from '@/hooks/useUsdcBalance';
import { useProgress, type StepKey } from '@/hooks/useProgress';
import type { BridgeResult } from '@circle-fin/bridge-kit';
import { arcTestnet } from '@/lib/wagmi-config';

const PENDING_BRIDGE_KEY = 'yield-empire:pending-bridge';

const CHAINS = [
  { id: 'Ethereum_Sepolia', label: 'Sepolia', chainId: 11155111 },
  { id: 'Base_Sepolia', label: 'Base Sepolia', chainId: 84532 },
  { id: 'Arc_Testnet', label: 'Arc Testnet', chainId: 5042002 },
] as const;

const STEP_LABELS: Record<StepKey, string> = {
  idle: 'Ready',
  approving: 'Approving USDC\u2026',
  burning: 'Burning USDC\u2026',
  'waiting-attestation': 'Waiting for attestation\u2026',
  minting: 'Minting on destination\u2026',
  completed: 'Transfer complete!',
  error: 'Transfer failed',
};

const STEP_ORDER: StepKey[] = ['approving', 'burning', 'waiting-attestation', 'minting', 'completed'];

interface DepositPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Ensure a custom chain (e.g. Arc Testnet) is added to MetaMask before
 * attempting to switch.  The Circle BridgeKit adapter calls
 * `walletClient.switchChain()` internally which does NOT fall back to
 * `wallet_addEthereumChain` – so we must add it ourselves.
 */
async function ensureChainInWallet(chainId: number): Promise<void> {
  // Only Arc Testnet needs manual addition – well-known chains are
  // already in MetaMask's registry.
  if (chainId !== arcTestnet.id) return;

  const eth =
    typeof window !== 'undefined'
      ? ((window as unknown as Record<string, unknown>).ethereum as {
          request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
        } | undefined)
      : undefined;
  if (!eth) return;

  try {
    // Try switching first – succeeds if the chain was already added.
    await eth.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${chainId.toString(16)}` }],
    });
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code === 4902) {
      // Chain unknown – add it.
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: `0x${arcTestnet.id.toString(16)}`,
            chainName: arcTestnet.name,
            nativeCurrency: arcTestnet.nativeCurrency,
            rpcUrls: arcTestnet.rpcUrls.default.http,
            blockExplorerUrls: [arcTestnet.blockExplorers.default.url],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

export function DepositPanel({ isOpen, onClose }: DepositPanelProps) {
  const { evmAdapter, evmAddress } = useEvmAdapter();
  const { bridge, retry, estimate, isLoading, error, data: bridgeResult, isEstimating, estimateData, clear } = useBridge();
  const { switchChainAsync } = useSwitchChain();
  const progress = useProgress();

  const [fromChain, setFromChain] = useState<string>(CHAINS[0].id);
  const [toChain, setToChain] = useState<string>(CHAINS[2].id);
  const [amount, setAmount] = useState('');
  const [hasPendingBridge, setHasPendingBridge] = useState(false);

  const lastResultRef = useRef<BridgeResult | null>(null);

  const { balance: fromBalance, loading: balanceLoading } = useUsdcBalance(fromChain, {
    evmAdapter,
    evmAddress,
  });

  // Check for pending bridge on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PENDING_BRIDGE_KEY);
      if (stored) {
        const pending = JSON.parse(stored);
        if (pending && pending.fromChain && pending.toChain) {
          setHasPendingBridge(true);
          setFromChain(pending.fromChain);
          setToChain(pending.toChain);
          setAmount(pending.amount ?? '');
        }
      }
    } catch {
      // Ignore corrupt localStorage
    }
  }, []);

  // Persist bridge state when bridge starts; clear on completion
  useEffect(() => {
    if (bridgeResult) {
      lastResultRef.current = bridgeResult;
    }
  }, [bridgeResult]);

  useEffect(() => {
    if (progress.currentStep === 'completed') {
      localStorage.removeItem(PENDING_BRIDGE_KEY);
      setHasPendingBridge(false);
    }
  }, [progress.currentStep]);

  if (!isOpen) return null;

  const canBridge = evmAdapter && evmAddress && amount && parseFloat(amount) > 0 && !isLoading;

  function buildParams(): BridgeParams | null {
    if (!evmAdapter || !evmAddress || !amount) return null;
    return {
      fromChain,
      toChain,
      amount,
      fromAdapter: evmAdapter,
      toAdapter: evmAdapter,
    };
  }

  async function handleEstimate() {
    const params = buildParams();
    if (!params) return;
    try {
      await estimate(params);
    } catch {
      // error state handled by hook
    }
  }

  async function handleBridge() {
    const params = buildParams();
    if (!params) return;

    // Resolve destination chain ID for wallet switching
    const destChainId = CHAINS.find((c) => c.id === toChain)?.chainId;

    // Switch wallet to source chain first so approve + burn work
    const srcChainId = CHAINS.find((c) => c.id === fromChain)?.chainId;

    // Pre-register custom chains (e.g. Arc Testnet) with MetaMask so that both
    // our explicit switchChainAsync calls and the Circle adapter's internal
    // walletClient.switchChain() work without error 4902.
    try {
      if (srcChainId) await ensureChainInWallet(srcChainId);
      if (destChainId) await ensureChainInWallet(destChainId);
    } catch {
      // User rejected adding the chain — abort
      return;
    }

    if (srcChainId) {
      try {
        await switchChainAsync({ chainId: srcChainId });
      } catch {
        // User rejected — abort
        return;
      }
    }

    // Persist bridge metadata for recovery
    try {
      localStorage.setItem(PENDING_BRIDGE_KEY, JSON.stringify({
        fromChain, toChain, amount, startedAt: Date.now(),
      }));
    } catch {
      // localStorage unavailable — continue anyway
    }

    progress.reset();
    progress.setCurrentStep('approving');
    progress.addLog('Starting bridge transfer\u2026');

    try {
      await bridge(params, {
        onEvent: (evt) => {
          progress.handleEvent(evt);
        },
      });

      // Safety net: kit.bridge() resolved successfully, meaning the CCTP
      // transfer completed on-chain.  If the mint-success event was missed
      // (different shape, timing issue, etc.) ensure the UI reflects completion.
      if (progress.currentStep !== 'completed') {
        progress.addLog('Bridge resolved — marking complete.');
        progress.setCurrentStep('completed');
      }
    } catch {
      if (progress.currentStep !== 'completed') {
        progress.setCurrentStep('error');
      }
    }
  }

  async function handleRetry() {
    const failedResult = lastResultRef.current;
    const params = buildParams();
    if (!failedResult || !params) {
      progress.addLog('No failed transfer to retry. Please start a new bridge.');
      return;
    }

    const destChainId = CHAINS.find((c) => c.id === toChain)?.chainId;

    // Pre-register Arc Testnet with MetaMask for handleRetry too
    try {
      if (destChainId) await ensureChainInWallet(destChainId);
    } catch {
      // continue anyway — adapter will retry internally
    }

    progress.reset();
    progress.setCurrentStep('waiting-attestation');
    progress.addLog('Retrying from last successful step\u2026');

    try {
      await retry(failedResult, params, {
        onEvent: (evt) => {
          progress.handleEvent(evt);
        },
      });

      // Safety net (same as handleBridge)
      if (progress.currentStep !== 'completed') {
        progress.addLog('Retry resolved — marking complete.');
        progress.setCurrentStep('completed');
      }
    } catch {
      if (progress.currentStep !== 'completed') {
        progress.setCurrentStep('error');
      }
    }
  }

  function handleClose() {
    if (isLoading) return;
    clear();
    progress.reset();
    setAmount('');
    setHasPendingBridge(false);
    onClose();
  }

  function handleSetMax() {
    setAmount(fromBalance);
  }

  const fromLabel = CHAINS.find((c) => c.id === fromChain)?.label ?? fromChain;
  const toLabel = CHAINS.find((c) => c.id === toChain)?.label ?? toChain;

  const isActive = progress.currentStep !== 'idle';
  const isDone = progress.currentStep === 'completed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="retro-card retro-card-purple p-5 text-foreground w-96 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-pixel text-[10px] text-gold uppercase tracking-wider">
            Deposit USDC
          </h2>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
            aria-label="Close deposit panel"
          >
            <X size={20} />
          </button>
        </div>

        {/* Pending bridge recovery banner */}
        {hasPendingBridge && !isActive && (
          <div className="mb-4 bg-gold/10 border border-gold/30 rounded-sm p-3 font-retro text-sm text-gold">
            <div className="flex items-center gap-2 mb-1 font-pixel text-[8px]">
              <RotateCw size={12} />
              Interrupted transfer detected
            </div>
            <p className="text-gold/80">
              A previous {fromChain.replace('_', ' ')} &rarr; {toChain.replace('_', ' ')} bridge was interrupted.
              You can start a new bridge to complete the transfer.
            </p>
            <button
              onClick={() => {
                localStorage.removeItem(PENDING_BRIDGE_KEY);
                setHasPendingBridge(false);
              }}
              className="mt-2 text-gold hover:text-foreground underline font-retro text-sm"
            >
              Dismiss
            </button>
          </div>
        )}

        {!isActive ? (
          <>
            {/* From Chain */}
            <div className="mb-3">
              <label htmlFor="from-chain" className="font-pixel text-[8px] text-muted-foreground uppercase mb-1 block">
                From
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    id="from-chain"
                    value={fromChain}
                    onChange={(e) => setFromChain(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-sm px-3 py-2 font-retro text-base text-foreground appearance-none cursor-pointer"
                  >
                    {CHAINS.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              <div className="font-retro text-sm text-muted-foreground mt-1">
                Balance: {balanceLoading ? '\u2026' : `${parseFloat(fromBalance).toFixed(2)} USDC`}
              </div>
            </div>

            {/* Swap Arrow */}
            <div className="flex justify-center my-1">
              <button
                onClick={() => {
                  setFromChain(toChain);
                  setToChain(fromChain);
                }}
                className="bg-primary/20 hover:bg-primary/30 rounded-sm p-1.5 border border-border transition-colors"
                aria-label="Swap chains"
              >
                <ArrowDownUp size={14} className="text-primary" />
              </button>
            </div>

            {/* To Chain */}
            <div className="mb-4">
              <label htmlFor="to-chain" className="font-pixel text-[8px] text-muted-foreground uppercase mb-1 block">
                To
              </label>
              <div className="relative">
                <select
                  id="to-chain"
                  value={toChain}
                  onChange={(e) => setToChain(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-sm px-3 py-2 font-retro text-base text-foreground appearance-none cursor-pointer"
                >
                  {CHAINS.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Amount */}
            <div className="mb-4">
              <label htmlFor="bridge-amount" className="font-pixel text-[8px] text-muted-foreground uppercase mb-1 block">
                Amount (USDC)
              </label>
              <div className="flex gap-2">
                <input
                  id="bridge-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1 bg-secondary border border-border rounded-sm px-3 py-2 font-retro text-base text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  onClick={handleSetMax}
                  className="bracket-btn bracket-btn-blue font-pixel text-[8px] px-3 py-2"
                >
                  Max
                </button>
              </div>
            </div>

            {/* Fee Estimate */}
            {estimateData && (
              <div className="mb-4 bg-secondary/50 rounded-sm p-3 border border-border font-retro text-sm space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Protocol fees:</span>
                  <span className="text-foreground">
                    {estimateData.fees.length > 0
                      ? estimateData.fees.map((f) => `${f.amount ?? '0'} ${f.token}`).join(', ')
                      : 'None'}
                  </span>
                </div>
                {estimateData.gasFees.length > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Gas fees:</span>
                    <span className="text-foreground">
                      {estimateData.gasFees
                        .filter((g) => g.fees)
                        .map((g) => `${g.name}: ${g.token}`)
                        .join(', ') || 'Estimating\u2026'}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>Route:</span>
                  <span className="text-foreground">{fromLabel} &rarr; {toLabel}</span>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mb-3 text-destructive font-retro text-sm bg-destructive/10 rounded-sm p-2 border border-destructive/30">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleEstimate}
                disabled={!canBridge || isEstimating}
                className="flex-1 bracket-btn bracket-btn-blue font-pixel text-[8px] py-2.5 px-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isEstimating && <Loader2 size={14} className="animate-spin" />}
                Estimate
              </button>
              <button
                onClick={handleBridge}
                disabled={!canBridge}
                className="flex-1 arcade-btn arcade-btn-gold font-pixel text-[8px] py-2.5 px-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading && <Loader2 size={14} className="animate-spin" />}
                Bridge
              </button>
            </div>
          </>
        ) : (
          /* Progress View */
          <>
            {/* Step indicators */}
            <div className="mb-4 space-y-2">
              {STEP_ORDER.map((step) => {
                const stepIdx = STEP_ORDER.indexOf(step);
                const currentIdx = STEP_ORDER.indexOf(progress.currentStep);
                const isError = progress.currentStep === 'error';
                let status: 'done' | 'active' | 'pending' = 'pending';
                if (isError && stepIdx <= currentIdx) status = 'active';
                else if (stepIdx < currentIdx || isDone) status = 'done';
                else if (stepIdx === currentIdx) status = 'active';

                return (
                  <div key={step} className="flex items-center gap-3 font-retro text-base">
                    <div className={`w-5 h-5 rounded-sm flex items-center justify-center font-pixel text-[8px] border ${
                      status === 'done'
                        ? 'bg-neon-green/20 border-neon-green text-neon-green'
                        : status === 'active'
                          ? isError ? 'bg-destructive/20 border-destructive text-destructive animate-pulse' : 'bg-gold/20 border-gold text-gold animate-pulse'
                          : 'bg-secondary border-border text-muted-foreground'
                    }`}>
                      {status === 'done' ? <Check size={12} /> : stepIdx + 1}
                    </div>
                    <span className={
                      status === 'done' ? 'text-neon-green' :
                      status === 'active' ? (isError ? 'text-destructive' : 'text-gold') :
                      'text-muted-foreground'
                    }>
                      {STEP_LABELS[step]}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Status */}
            <div className="mb-4 text-center">
              <span className={`font-pixel text-[9px] uppercase ${
                isDone ? 'text-neon-green' :
                progress.currentStep === 'error' ? 'text-destructive' :
                'text-gold'
              }`}>
                {STEP_LABELS[progress.currentStep]}
              </span>
            </div>

            {/* Log output */}
            <div className="bg-background/60 rounded-sm p-3 mb-4 max-h-40 overflow-y-auto font-retro text-sm text-muted-foreground space-y-0.5 border border-border">
              {progress.logs.map((log, i) => (
                <div key={i} className="break-all">{log}</div>
              ))}
            </div>

            {/* Done / Retry / Close buttons */}
            {isDone && (
              <button
                onClick={handleClose}
                className="w-full arcade-btn font-pixel text-[9px] py-2.5 px-4 bg-neon-green/20 border-2 border-neon-green text-neon-green hover:bg-neon-green/30"
              >
                Done
              </button>
            )}
            {progress.currentStep === 'error' && (
              <div className="flex gap-2">
                <button
                  onClick={handleRetry}
                  disabled={isLoading || !lastResultRef.current}
                  className="flex-1 arcade-btn arcade-btn-gold font-pixel text-[9px] py-2.5 px-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <RotateCw size={14} />
                  Retry
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 bracket-btn font-pixel text-[9px] py-2.5 px-4 text-destructive border-destructive/50"
                >
                  Close
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
