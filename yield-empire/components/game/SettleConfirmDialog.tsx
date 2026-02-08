'use client';

/**
 * SettleConfirmDialog - Rich settlement confirmation modal.
 * Shows a breakdown of which buildings will settle, on which chains,
 * and how much USDC each will receive before the user confirms.
 */

import { X, AlertTriangle } from 'lucide-react';
import { BUILDING_CONFIGS } from '@/lib/constants';
import { PROTOCOL_CHAIN_MAP } from '@/lib/protocols/addresses';
import type { GameEntity, RateSource } from '@/lib/types';

interface SettleConfirmDialogProps {
  isOpen: boolean;
  entities: GameEntity[];
  actionCount: number;
  gasSaved: number;
  onConfirm: () => void;
  onCancel: () => void;
}

function chainLabel(chainId: number): string {
  if (chainId === 84532) return 'Base Sepolia';
  if (chainId === 11155111) return 'Sepolia';
  return `Chain ${chainId}`;
}

function rateSourceBadge(source?: RateSource) {
  if (!source) return null;
  if (source === 'live') return <span className="text-[9px] text-green-400 ml-1">[LIVE]</span>;
  if (source === 'estimated') return <span className="text-[9px] text-yellow-400 ml-1">[EST]</span>;
  return <span className="text-[9px] text-gray-400 ml-1">[SIM]</span>;
}

export function SettleConfirmDialog({
  isOpen,
  entities,
  actionCount,
  gasSaved,
  onConfirm,
  onCancel,
}: SettleConfirmDialogProps) {
  if (!isOpen) return null;

  const settleable = entities.filter(
    (e) => e.deposited > 0 && e.protocol in PROTOCOL_CHAIN_MAP,
  );
  const totalUsdc = settleable.reduce((s, e) => s + e.deposited, 0);
  // Each protocol needs approve + action (2 wallet popups), except aave via treasury (1)
  const walletPopups = settleable.reduce((count, e) => {
    if (e.protocol === 'aave') return count + 1; // Treasury path = single tx
    return count + 2; // approve + supply/swap
  }, 0);
  // Count distinct chains for chain switch popups
  const chainCount = new Set(
    settleable.map((e) => PROTOCOL_CHAIN_MAP[e.protocol as keyof typeof PROTOCOL_CHAIN_MAP]),
  ).size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative bg-[#16162a] border border-purple-700/50 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-purple-700/30">
          <h2 className="text-lg font-bold text-yellow-400 uppercase tracking-wider">
            Settlement Summary
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Protocol breakdown */}
          <div className="space-y-2">
            {settleable.map((entity) => {
              const config = BUILDING_CONFIGS[entity.protocol];
              const chainId = PROTOCOL_CHAIN_MAP[entity.protocol as keyof typeof PROTOCOL_CHAIN_MAP];
              return (
                <div
                  key={entity.id}
                  className="flex items-center justify-between bg-purple-900/30 rounded-lg px-3 py-2"
                >
                  <div>
                    <div className="text-sm font-bold text-white">
                      {config.name}
                      {rateSourceBadge(entity.rateSource)}
                    </div>
                    <div className="text-xs text-gray-400">
                      {chainLabel(chainId)}
                    </div>
                  </div>
                  <div className="text-sm font-mono text-green-400">
                    ${entity.deposited.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div className="border-t border-purple-700/30 pt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Total USDC</span>
              <span className="text-white font-bold">
                ${totalUsdc.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Actions settled</span>
              <span className="text-white">{actionCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Gas saved</span>
              <span className="text-green-400">${gasSaved.toFixed(2)}</span>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 bg-yellow-900/20 border border-yellow-700/30 rounded-lg px-3 py-2">
            <AlertTriangle size={16} className="text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-200">
              You will be asked to approve ~<strong>{walletPopups}</strong> wallet signature{walletPopups !== 1 ? 's' : ''}
              {chainCount > 1 ? ` across ${chainCount} chains` : ''}.
              This includes token approvals and protocol transactions.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-purple-700/30">
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 font-bold py-2 px-4 rounded-lg border-b-2 border-gray-800 uppercase text-sm tracking-wider transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 px-4 rounded-lg border-b-2 border-yellow-700 uppercase text-sm tracking-wider transition-colors"
          >
            Confirm Settle
          </button>
        </div>
      </div>
    </div>
  );
}
