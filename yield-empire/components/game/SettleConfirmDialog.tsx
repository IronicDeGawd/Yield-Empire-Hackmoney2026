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
  if (source === 'live') return <span className="font-pixel text-[7px] text-neon-green ml-1">[LIVE]</span>;
  if (source === 'estimated') return <span className="font-pixel text-[7px] text-gold ml-1">[EST]</span>;
  return <span className="font-pixel text-[7px] text-muted-foreground ml-1">[SIM]</span>;
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
      <div className="relative retro-card retro-card-gold w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-pixel text-[10px] text-gold uppercase tracking-wider">
            Settlement Summary
          </h2>
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground transition-colors"
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
                  className="flex items-center justify-between bg-secondary/50 rounded-sm px-3 py-2 border border-border"
                >
                  <div>
                    <div className="font-pixel text-[9px] text-foreground">
                      {config.name}
                      {rateSourceBadge(entity.rateSource)}
                    </div>
                    <div className="font-retro text-sm text-muted-foreground">
                      {chainLabel(chainId)}
                    </div>
                  </div>
                  <div className="font-retro text-base text-neon-green">
                    ${entity.deposited.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div className="border-t border-border pt-3 space-y-1">
            <div className="flex justify-between font-retro text-base">
              <span className="text-muted-foreground">Total USDC</span>
              <span className="text-foreground font-bold">
                ${totalUsdc.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between font-retro text-base">
              <span className="text-muted-foreground">Actions settled</span>
              <span className="text-foreground">{actionCount}</span>
            </div>
            <div className="flex justify-between font-retro text-base">
              <span className="text-muted-foreground">Gas saved</span>
              <span className="text-neon-green">${gasSaved.toFixed(2)}</span>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 bg-gold/10 border border-gold/30 rounded-sm px-3 py-2">
            <AlertTriangle size={16} className="text-gold shrink-0 mt-0.5" />
            <p className="font-retro text-sm text-gold">
              You will be asked to approve ~<strong>{walletPopups}</strong> wallet signature{walletPopups !== 1 ? 's' : ''}
              {chainCount > 1 ? ` across ${chainCount} chains` : ''}.
              This includes token approvals and protocol transactions.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-border">
          <button
            onClick={onCancel}
            className="flex-1 bracket-btn font-pixel text-[9px] py-2 px-4 text-muted-foreground"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 arcade-btn arcade-btn-gold font-pixel text-[9px] py-2 px-4"
          >
            Confirm Settle
          </button>
        </div>
      </div>
    </div>
  );
}
