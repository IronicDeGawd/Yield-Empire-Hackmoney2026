'use client';

/**
 * GameUI - Overlay UI for the game with building cards, stats, and controls
 */

import { Settings, Zap, Plus, Lock, ArrowDownUp } from 'lucide-react';
import { GameEntity, PlayerProfile, GuildProfile, SessionState } from '@/lib/types';
import { ConnectButton } from '@rainbow-me/rainbowkit';

interface GameUIProps {
  entities: GameEntity[];
  player?: PlayerProfile;
  guild?: GuildProfile;
  session?: SessionState;
  onUpgrade?: (entityId: string) => void;
  onCompoundAll?: () => void;
  onSettle?: () => void;
  onDeposit?: () => void;
}

export function GameUI({
  entities,
  player,
  guild,
  session,
  onUpgrade,
  onCompoundAll,
  onSettle,
  onDeposit,
}: GameUIProps) {
  // Calculate total stats
  const totalTVL = entities.reduce((sum, e) => sum + e.deposited, 0);
  const totalYield = entities.reduce(
    (sum, e) => sum + (e.deposited * e.yieldRate * (1 + e.level * 0.1)) / 100 / 365,
    0
  );

  return (
    <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between font-mono">
      {/* Top Bar */}
      <header className="flex items-start justify-between w-full pointer-events-auto">
        {/* User Info - Top Left */}
        <div className="bg-game-panel border-2 border-game-border rounded-xl p-2 px-4 flex items-center gap-4 text-white shadow-lg shadow-purple-900/50">
          {player ? (
            <>
              <div className="w-10 h-10 bg-yellow-600 rounded-md border-2 border-white overflow-hidden">
                {player.avatar ? (
                  <img
                    src={player.avatar}
                    alt="avatar"
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                    style={{ imageRendering: 'pixelated' }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500" />
                )}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg tracking-wide">
                    {player.ensName || `${player.address.slice(0, 6)}\u2026${player.address.slice(-4)}`}
                  </span>
                  <span className="text-xs bg-purple-600 px-1 rounded text-purple-200">
                    Lv.{player.empireLevel}
                  </span>
                </div>
                <div className="flex items-center text-yellow-400 text-sm gap-1">
                  <Zap size={14} fill="currentColor" />
                  <span>{session?.actionCount || 0} actions</span>
                </div>
              </div>
            </>
          ) : (
            <ConnectButton showBalance={false} />
          )}
        </div>

        {/* Settle Button - Top Right */}
        {session?.isSessionActive && (
          <button
            onClick={onSettle}
            className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 px-6 rounded-lg border-b-4 border-yellow-700 active:border-b-0 active:translate-y-1 transition-all shadow-lg uppercase tracking-wider"
          >
            [ Settle ]
          </button>
        )}
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex justify-between items-end w-full mt-4">
        {/* Left Sidebar - Building Cards */}
        <div className="flex flex-col justify-center h-full pb-20 pointer-events-auto">
          <aside className="flex flex-col gap-3 w-64">
            {entities.map((entity) => (
              <div
                key={entity.id}
                className="bg-game-panel border-2 border-game-border rounded-xl p-3 text-white relative hover:bg-purple-900/50 transition-colors group"
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2">
                    {/* Color indicator */}
                    <div
                      className="w-6 h-6 rounded border border-white/30"
                      style={{ backgroundColor: entity.color }}
                    />
                    <div>
                      <div className="font-bold uppercase leading-none">{entity.name}</div>
                      <div className="text-xs text-purple-300">Lv{entity.level}</div>
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-300 mb-2 pl-8">
                  {entity.yieldRate * (1 + entity.level * 0.1)}% APY · ${entity.deposited.toLocaleString()}
                </div>
                <button
                  onClick={() => onUpgrade?.(entity.id)}
                  className="w-full bg-yellow-600 hover:bg-yellow-500 text-xs font-bold py-1 px-2 rounded border-b-2 border-yellow-800 text-black uppercase"
                >
                  [ Upgrade ]
                </button>
              </div>
            ))}

            {/* Add Building Button */}
            <button className="flex items-center justify-center gap-2 bg-purple-700 hover:bg-purple-600 border-2 border-purple-400 border-dashed rounded-xl p-3 text-purple-200 font-bold uppercase tracking-wider transition-all">
              <Plus size={18} />
              Add
            </button>
          </aside>
        </div>

        {/* Right Bottom Info Panel */}
        <div className="pointer-events-auto">
          <div className="bg-game-panel border-2 border-game-border rounded-xl p-4 text-white w-72 shadow-2xl">
            <div className="space-y-1 mb-4 text-sm font-mono">
              <div className="flex justify-between text-gray-300">
                <span>TVL:</span>
                <span className="text-white font-bold">${totalTVL.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Yield:</span>
                <span className="text-green-400 font-bold">${totalYield.toFixed(2)}/day</span>
              </div>
              {guild && (
                <div className="flex justify-between text-gray-300 items-center">
                  <span>Guild:</span>
                  <span className="text-white flex items-center gap-1">
                    {guild.name}
                    <Lock size={12} className="text-yellow-500" />
                  </span>
                </div>
              )}
              {session?.isSessionActive && (
                <div className="flex justify-between text-gray-300">
                  <span>Gas saved:</span>
                  <span className="text-green-400 font-bold">
                    ~${session.gasSaved.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={onCompoundAll}
              className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-bold py-3 px-4 rounded-lg border-b-4 border-yellow-800 active:border-b-0 active:translate-y-1 transition-all shadow-lg flex items-center justify-between uppercase"
            >
              <span>[ Compound All ]</span>
              <div className="w-3 h-3 bg-white rotate-45 transform" />
            </button>

            {player && (
              <button
                onClick={onDeposit}
                className="w-full mt-2 bg-purple-700 hover:bg-purple-600 text-white font-bold py-2.5 px-4 rounded-lg border border-purple-500 transition-all flex items-center justify-center gap-2 uppercase text-sm"
              >
                <ArrowDownUp size={14} />
                <span>Deposit from Any Chain</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default GameUI;
