'use client';

/**
 * WelcomeModal — Multi-step onboarding tutorial.
 *
 * Shown on game entry unless the user has clicked "Don't Show Again".
 * Explains DeFi building mechanics, APY, compounding, and settlement.
 */

import { useState } from 'react';
import { X, ChevronRight } from 'lucide-react';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDontShowAgain: () => void;
}

const SLIDES = [
  {
    title: 'Welcome to Yield Empire',
    content: [
      'Build your DeFi empire by depositing USDC into protocol buildings.',
      'Each building represents a real DeFi protocol:',
    ],
    buildings: [
      { name: 'AAVE', sprite: '/assets/sprites/shard-building.png', color: '#9b7dff' },
      { name: 'COMPOUND', sprite: '/assets/sprites/treasury-building.png', color: '#00d395' },
      { name: 'UNI-V3', sprite: '/assets/sprites/building1.png', color: '#ff007a' },
      { name: 'CURVE', sprite: '/assets/sprites/building2.png', color: '#ffed4a' },
    ],
  },
  {
    title: 'How APY Works',
    content: [
      'Buildings earn yield based on real protocol rates fetched on-chain.',
      'Rate source badges tell you where the rate comes from:',
    ],
    badges: [
      { label: 'LIVE', color: 'text-green-400', desc: 'Fetched from on-chain contract' },
      { label: 'EST', color: 'text-yellow-400', desc: 'Estimated from protocol data' },
      { label: 'SIM', color: 'text-gray-400', desc: 'Simulated for demo purposes' },
    ],
    formula: 'effectiveAPY = baseAPY \u00d7 (1 + level \u00d7 10%)',
    formulaNote: 'Upgrading to Level 10 doubles the base rate!',
  },
  {
    title: 'Compound & Upgrade',
    content: [
      'Yield accrues automatically while your session is active.',
      'Compound All reinvests accrued yield back into buildings proportionally.',
      'Upgrades cost accrued yield ($5 base, scaling with level).',
      'Contribute yield to your guild for cooperative bonuses.',
    ],
  },
  {
    title: 'Settle On-Chain',
    content: [
      'All actions are gasless via Yellow Network state channels.',
      'When ready, click Settle to execute real DeFi transactions.',
      'Your stats are saved to ENS after settlement \u2014 visible on your profile page.',
      'Check the stats panel to see how much gas you\'ve saved!',
    ],
  },
] as const;

export function WelcomeModal({ isOpen, onClose, onDontShowAgain }: WelcomeModalProps) {
  const [step, setStep] = useState(0);

  if (!isOpen) return null;

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  const handleNext = () => {
    if (isLast) {
      onClose();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-[#16162a] border border-purple-700/50 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-purple-700/30">
          <h2 className="text-lg font-bold text-yellow-400 uppercase tracking-wider">
            {slide.title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-2 pt-4 px-5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                i === step
                  ? 'bg-yellow-400'
                  : i < step
                    ? 'bg-purple-500'
                    : 'bg-purple-800'
              }`}
            />
          ))}
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 min-h-[220px]">
          {/* Text content */}
          <div className="space-y-2">
            {slide.content.map((line, i) => (
              <p key={i} className="text-sm text-gray-300 leading-relaxed">
                {line}
              </p>
            ))}
          </div>

          {/* Slide 1: Building icons */}
          {'buildings' in slide && slide.buildings && (
            <div className="flex justify-center gap-4 pt-2">
              {slide.buildings.map((b) => (
                <div key={b.name} className="flex flex-col items-center gap-1">
                  <div
                    className="w-12 h-12 rounded-lg border-2 flex items-center justify-center bg-purple-900/30"
                    style={{ borderColor: b.color }}
                  >
                    <img
                      src={b.sprite}
                      alt={b.name}
                      width={32}
                      height={32}
                      className="w-8 h-8 object-contain"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono">{b.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Slide 2: Rate badges */}
          {'badges' in slide && slide.badges && (
            <div className="space-y-1.5 pt-1">
              {slide.badges.map((badge) => (
                <div key={badge.label} className="flex items-center gap-2 text-sm">
                  <span className={`font-mono font-bold text-xs ${badge.color}`}>
                    [{badge.label}]
                  </span>
                  <span className="text-gray-400">{badge.desc}</span>
                </div>
              ))}
            </div>
          )}

          {/* Slide 2: Formula */}
          {'formula' in slide && slide.formula && (
            <div className="bg-purple-900/30 rounded-lg px-3 py-2 mt-2">
              <code className="text-xs text-yellow-300 font-mono">{slide.formula}</code>
              {slide.formulaNote && (
                <p className="text-[11px] text-purple-300 mt-1">{slide.formulaNote}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-purple-700/30">
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="bg-gray-700 hover:bg-gray-600 text-gray-200 font-bold py-2 px-4 rounded-lg border-b-2 border-gray-800 uppercase text-xs tracking-wider transition-colors"
            >
              Skip
            </button>
            {step > 0 && (
              <button
                onClick={handleBack}
                className="bg-purple-700 hover:bg-purple-600 text-purple-200 font-bold py-2 px-4 rounded-lg border-b-2 border-purple-800 uppercase text-xs tracking-wider transition-colors"
              >
                Back
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {isLast && (
              <button
                onClick={onDontShowAgain}
                className="bg-purple-800 hover:bg-purple-700 text-purple-300 font-bold py-2 px-3 rounded-lg border-b-2 border-purple-900 uppercase text-[10px] tracking-wider transition-colors"
              >
                Don&apos;t Show Again
              </button>
            )}
            <button
              onClick={handleNext}
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 px-4 rounded-lg border-b-2 border-yellow-700 uppercase text-xs tracking-wider transition-colors flex items-center gap-1"
            >
              {isLast ? 'Start Playing' : (
                <>
                  Next
                  <ChevronRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
