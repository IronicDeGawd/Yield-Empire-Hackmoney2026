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
    title: 'Earn $EMPIRE Tokens',
    content: [
      'You earn $EMPIRE tokens based on real protocol APY rates.',
      'Rate source badges show where the rate comes from:',
    ],
    badges: [
      { label: 'LIVE', color: 'text-neon-green', desc: 'Fetched from on-chain contract' },
      { label: 'EST', color: 'text-gold', desc: 'Estimated from protocol data' },
      { label: 'SIM', color: 'text-muted-foreground', desc: 'Simulated for demo purposes' },
    ],
    formula: '$EMPIRE rate = baseAPY \u00d7 (1 + level \u00d7 10%)',
    formulaNote: 'Higher levels = faster $EMPIRE earnings. Level 10 doubles your rate!',
  },
  {
    title: 'Compound & Upgrade',
    content: [
      '$EMPIRE tokens accrue automatically while your session is active.',
      'Compound All reinvests $EMPIRE back into buildings proportionally.',
      'Upgrades cost $EMPIRE tokens (5 base, scaling with level).',
      'Contribute $EMPIRE to your guild for cooperative bonuses.',
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
      <div className="relative retro-card retro-card-gold w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-pixel text-[10px] text-gold uppercase tracking-wider">
            {slide.title}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
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
                  ? 'bg-gold'
                  : i < step
                    ? 'bg-primary'
                    : 'bg-secondary'
              }`}
            />
          ))}
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 min-h-[220px]">
          {/* Text content */}
          <div className="space-y-2">
            {slide.content.map((line, i) => (
              <p key={i} className="font-retro text-lg text-muted-foreground leading-relaxed">
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
                    className="w-12 h-12 rounded-sm border-2 flex items-center justify-center bg-secondary/30"
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
                  <span className="font-pixel text-[8px] text-muted-foreground">{b.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Slide 2: Rate badges */}
          {'badges' in slide && slide.badges && (
            <div className="space-y-1.5 pt-1">
              {slide.badges.map((badge) => (
                <div key={badge.label} className="flex items-center gap-2 font-retro text-base">
                  <span className={`font-pixel text-[8px] font-bold ${badge.color}`}>
                    [{badge.label}]
                  </span>
                  <span className="text-muted-foreground">{badge.desc}</span>
                </div>
              ))}
            </div>
          )}

          {/* Slide 2: Formula */}
          {'formula' in slide && slide.formula && (
            <div className="bg-secondary/50 rounded-sm px-3 py-2 mt-2 border border-border">
              <code className="font-pixel text-[8px] text-gold">{slide.formula}</code>
              {slide.formulaNote && (
                <p className="font-retro text-sm text-primary mt-1">{slide.formulaNote}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border">
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="bracket-btn font-pixel text-[8px] py-2 px-4 text-muted-foreground"
            >
              Skip
            </button>
            {step > 0 && (
              <button
                onClick={handleBack}
                className="bracket-btn bracket-btn-blue font-pixel text-[8px] py-2 px-4"
              >
                Back
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {isLast && (
              <button
                onClick={onDontShowAgain}
                className="bracket-btn font-pixel text-[7px] py-2 px-3 text-muted-foreground"
              >
                Don&apos;t Show Again
              </button>
            )}
            <button
              onClick={handleNext}
              className="arcade-btn arcade-btn-gold font-pixel text-[8px] py-2 px-4 flex items-center gap-1"
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
