'use client';

/**
 * BuildingPopup - Pixelated tooltip popup for building details on hover
 * Displays building name, protocol, level, APY, and deposited amount
 */

import { GameEntity } from '@/lib/types';

interface BuildingPopupProps {
    entity: GameEntity;
    screenX: number;
    screenY: number;
}

export function BuildingPopup({ entity, screenX, screenY }: BuildingPopupProps) {
    // Real protocol APY (no level inflation)
    const realAPY = entity.yieldRate;

    // Daily $EMPIRE earning rate (includes level multiplier)
    const levelMultiplier = 1 + entity.level * 0.1;
    const dailyEmpire = (entity.deposited * realAPY * levelMultiplier) / 100 / 365;

    return (
        <div
            className="absolute z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150"
            style={{
                left: screenX,
                top: screenY,
                transform: 'translate(-50%, -100%)',
            }}
        >
            {/* Pixelated container with retro styling */}
            <div className="relative bg-[#1a1025] border-4 border-[#4a3f5c] rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] px-4 py-3 min-w-[180px]"
                style={{
                    imageRendering: 'pixelated',
                    boxShadow: 'inset 2px 2px 0 rgba(255,255,255,0.1), inset -2px -2px 0 rgba(0,0,0,0.3), 4px 4px 0 rgba(0,0,0,0.5)'
                }}
            >
                {/* Corner decorations (pixel style) */}
                <div className="absolute -top-1 -left-1 w-2 h-2 bg-[#6b5c7c]" />
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#6b5c7c]" />
                <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-[#6b5c7c]" />
                <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-[#6b5c7c]" />

                {/* Header with building name */}
                <div className="flex items-center gap-2 mb-2 pb-2 border-b-2 border-[#4a3f5c]">
                    <div
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: entity.color }}
                    />
                    <span className="font-bold text-white uppercase tracking-wider text-sm">
                        {entity.name}
                    </span>
                </div>

                {/* Stats grid */}
                <div className="space-y-1 text-xs font-mono">
                    <div className="flex justify-between items-center">
                        <span className="text-purple-400">Level:</span>
                        <span className="text-yellow-400 font-bold">Lv.{entity.level}</span>
                    </div>

                    <div className="flex justify-between items-center">
                        <span className="text-purple-400">APY:</span>
                        <span className="text-green-400 font-bold">
                            {realAPY.toFixed(1)}%
                            {entity.rateSource === 'live' && <span className="text-[8px] text-green-300 ml-1">LIVE</span>}
                            {entity.rateSource === 'estimated' && <span className="text-[8px] text-yellow-300 ml-1">EST</span>}
                            {entity.rateSource === 'simulated' && <span className="text-[8px] text-gray-400 ml-1">SIM</span>}
                        </span>
                    </div>

                    {entity.level > 1 && (
                        <div className="flex justify-between items-center">
                            <span className="text-purple-400">Boost:</span>
                            <span className="text-yellow-400 font-bold">
                                x{levelMultiplier.toFixed(1)} $EMPIRE
                            </span>
                        </div>
                    )}

                    <div className="flex justify-between items-center">
                        <span className="text-purple-400">Deposited:</span>
                        <span className="text-white font-bold">
                            ${entity.deposited.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                    </div>

                    {entity.deposited > 0 && (
                        <div className="flex justify-between items-center pt-1 border-t border-[#4a3f5c]/50">
                            <span className="text-purple-400">Daily:</span>
                            <span className="text-green-300 font-bold">
                                +{dailyEmpire.toFixed(4)} $EMPIRE
                            </span>
                        </div>
                    )}
                </div>

                {/* Protocol badge */}
                <div className="mt-2 pt-2 border-t-2 border-[#4a3f5c]">
                    <span className="inline-block bg-purple-900/50 border border-purple-600 rounded px-2 py-0.5 text-[10px] text-purple-300 uppercase tracking-wider">
                        {entity.protocol}
                    </span>
                </div>
            </div>

            {/* Arrow pointing down */}
            <div className="flex justify-center">
                <div
                    className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-[#4a3f5c]"
                />
            </div>
        </div>
    );
}

export default BuildingPopup;
