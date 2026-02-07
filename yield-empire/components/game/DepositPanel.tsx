'use client';

/**
 * DepositPanel - Cross-chain USDC deposit panel using Circle BridgeKit.
 * Provides chain selection, amount input, fee estimation, and bridge execution
 * with step-by-step progress tracking.
 */

import { useState } from 'react';
import { ArrowDownUp, ChevronDown, Loader2, X, Check } from 'lucide-react';
import { useEvmAdapter } from '@/hooks/useEvmAdapter';
import { useBridge, type BridgeParams } from '@/hooks/useBridge';
import { useUsdcBalance } from '@/hooks/useUsdcBalance';
import { useProgress, type StepKey } from '@/hooks/useProgress';

const CHAINS = [
  { id: 'Ethereum_Sepolia', label: 'Sepolia' },
  { id: 'Base_Sepolia', label: 'Base Sepolia' },
  { id: 'Arc_Testnet', label: 'Arc Testnet' },
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

export function DepositPanel({ isOpen, onClose }: DepositPanelProps) {
  const { evmAdapter, evmAddress } = useEvmAdapter();
  const { bridge, estimate, isLoading, error, isEstimating, estimateData, clear } = useBridge();
  const progress = useProgress();

  const [fromChain, setFromChain] = useState<string>(CHAINS[0].id);
  const [toChain, setToChain] = useState<string>(CHAINS[2].id);
  const [amount, setAmount] = useState('');

  const { balance: fromBalance, loading: balanceLoading } = useUsdcBalance(fromChain, {
    evmAdapter,
    evmAddress,
  });

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

    progress.reset();
    progress.setCurrentStep('approving');
    progress.addLog('Starting bridge transfer\u2026');

    try {
      await bridge(params, {
        onEvent: (evt) => progress.handleEvent(evt),
      });
    } catch {
      progress.setCurrentStep('error');
    }
  }

  function handleClose() {
    if (isLoading) return;
    clear();
    progress.reset();
    setAmount('');
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
      <div className="bg-game-panel border-2 border-game-border rounded-xl p-5 text-white w-96 shadow-2xl font-mono max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold uppercase tracking-wider">
            Deposit USDC
          </h2>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-white disabled:opacity-50"
            aria-label="Close deposit panel"
          >
            <X size={20} />
          </button>
        </div>

        {!isActive ? (
          <>
            {/* From Chain */}
            <div className="mb-3">
              <label htmlFor="from-chain" className="text-xs text-gray-400 uppercase mb-1 block">
                From
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    id="from-chain"
                    value={fromChain}
                    onChange={(e) => setFromChain(e.target.value)}
                    className="w-full bg-purple-900/50 border border-purple-600 rounded-lg px-3 py-2 text-sm appearance-none cursor-pointer"
                  >
                    {CHAINS.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-1">
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
                className="bg-purple-700 hover:bg-purple-600 rounded-full p-1.5 border border-purple-500"
                aria-label="Swap chains"
              >
                <ArrowDownUp size={14} />
              </button>
            </div>

            {/* To Chain */}
            <div className="mb-4">
              <label htmlFor="to-chain" className="text-xs text-gray-400 uppercase mb-1 block">
                To
              </label>
              <div className="relative">
                <select
                  id="to-chain"
                  value={toChain}
                  onChange={(e) => setToChain(e.target.value)}
                  className="w-full bg-purple-900/50 border border-purple-600 rounded-lg px-3 py-2 text-sm appearance-none cursor-pointer"
                >
                  {CHAINS.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Amount */}
            <div className="mb-4">
              <label htmlFor="bridge-amount" className="text-xs text-gray-400 uppercase mb-1 block">
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
                  className="flex-1 bg-purple-900/50 border border-purple-600 rounded-lg px-3 py-2 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  onClick={handleSetMax}
                  className="bg-purple-700 hover:bg-purple-600 text-xs px-3 py-2 rounded-lg border border-purple-500 uppercase"
                >
                  Max
                </button>
              </div>
            </div>

            {/* Fee Estimate */}
            {estimateData && (
              <div className="mb-4 bg-purple-900/30 rounded-lg p-3 text-xs space-y-1">
                <div className="flex justify-between text-gray-300">
                  <span>Protocol fees:</span>
                  <span className="text-white">
                    {estimateData.fees.length > 0
                      ? estimateData.fees.map((f) => `${f.amount ?? '0'} ${f.token}`).join(', ')
                      : 'None'}
                  </span>
                </div>
                {estimateData.gasFees.length > 0 && (
                  <div className="flex justify-between text-gray-300">
                    <span>Gas fees:</span>
                    <span className="text-white">
                      {estimateData.gasFees
                        .filter((g) => g.fees)
                        .map((g) => `${g.name}: ${g.token}`)
                        .join(', ') || 'Estimating\u2026'}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-gray-300">
                  <span>Route:</span>
                  <span className="text-white">{fromLabel} &rarr; {toLabel}</span>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mb-3 text-red-400 text-xs bg-red-900/20 rounded-lg p-2">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleEstimate}
                disabled={!canBridge || isEstimating}
                className="flex-1 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold py-2.5 px-4 rounded-lg border border-purple-500 uppercase flex items-center justify-center gap-2"
              >
                {isEstimating && <Loader2 size={14} className="animate-spin" />}
                Estimate
              </button>
              <button
                onClick={handleBridge}
                disabled={!canBridge}
                className="flex-1 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed text-black text-sm font-bold py-2.5 px-4 rounded-lg border-b-2 border-yellow-800 uppercase flex items-center justify-center gap-2"
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
                  <div key={step} className="flex items-center gap-3 text-sm">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs border ${
                      status === 'done'
                        ? 'bg-green-600 border-green-500'
                        : status === 'active'
                          ? isError ? 'bg-red-600 border-red-500 animate-pulse' : 'bg-yellow-600 border-yellow-500 animate-pulse'
                          : 'bg-purple-900/50 border-purple-600'
                    }`}>
                      {status === 'done' ? <Check size={12} /> : stepIdx + 1}
                    </div>
                    <span className={
                      status === 'done' ? 'text-green-400' :
                      status === 'active' ? (isError ? 'text-red-400' : 'text-yellow-400') :
                      'text-gray-500'
                    }>
                      {STEP_LABELS[step]}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Status */}
            <div className="mb-4 text-center">
              <span className={`text-sm font-bold uppercase ${
                isDone ? 'text-green-400' :
                progress.currentStep === 'error' ? 'text-red-400' :
                'text-yellow-400'
              }`}>
                {STEP_LABELS[progress.currentStep]}
              </span>
            </div>

            {/* Log output */}
            <div className="bg-black/40 rounded-lg p-3 mb-4 max-h-40 overflow-y-auto text-xs text-gray-300 space-y-0.5">
              {progress.logs.map((log, i) => (
                <div key={i} className="break-all">{log}</div>
              ))}
            </div>

            {/* Done / Retry buttons */}
            {(isDone || progress.currentStep === 'error') && (
              <button
                onClick={handleClose}
                className={`w-full font-bold py-2.5 px-4 rounded-lg text-sm uppercase ${
                  isDone
                    ? 'bg-green-700 hover:bg-green-600 text-white border border-green-500'
                    : 'bg-red-700 hover:bg-red-600 text-white border border-red-500'
                }`}
              >
                {isDone ? 'Done' : 'Close'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
