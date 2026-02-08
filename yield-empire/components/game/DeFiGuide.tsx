'use client';

/**
 * DeFiGuide - Rotating educational tips about DeFi protocols and concepts
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface GuideTip {
  title: string;
  content: string;
  icon: string;
  color: string;
}

const GUIDE_TIPS: GuideTip[] = [
  {
    title: "What is DeFi?",
    content: "Decentralized Finance (DeFi) lets you earn yield, borrow, and trade without banks. Your funds stay in your wallet, secured by smart contracts.",
    icon: "💡",
    color: "from-blue-500/20 to-cyan-500/20",
  },
  {
    title: "How Yield Works",
    content: "Your USDC is lent to borrowers on protocols like Aave and Compound. You earn interest (APY) from borrowers' fees, paid continuously on-chain.",
    icon: "📈",
    color: "from-green-500/20 to-emerald-500/20",
  },
  {
    title: "What is APY?",
    content: "Annual Percentage Yield (APY) shows your yearly earnings including compound interest. A 5% APY means $100 becomes ~$105 after one year.",
    icon: "🎯",
    color: "from-purple-500/20 to-pink-500/20",
  },
  {
    title: "Smart Contracts",
    content: "Code that runs on blockchain, handling deposits and withdrawals automatically. No middleman needed—the code executes exactly as written.",
    icon: "📜",
    color: "from-orange-500/20 to-yellow-500/20",
  },
  {
    title: "Compounding",
    content: "Reinvesting your earned yield to grow faster. Like planting seeds from your harvest—each cycle your earnings grow exponentially.",
    icon: "🌱",
    color: "from-lime-500/20 to-green-500/20",
  },
  {
    title: "Gas Fees",
    content: "Each blockchain transaction costs gas (network fees). Yellow Network batches your actions off-chain, then settles once—saving you from paying gas on every move!",
    icon: "⛽",
    color: "from-red-500/20 to-orange-500/20",
  },
  {
    title: "State Channels",
    content: "Like a tab at a bar—you make many moves off-chain, then settle the final balance on-chain. This is how Yellow Network saves gas costs.",
    icon: "⚡",
    color: "from-yellow-500/20 to-amber-500/20",
  },
  {
    title: "Why Multi-Protocol?",
    content: "Different protocols offer different rates and risks. Diversifying across Aave, Compound, and others reduces risk while maximizing yield opportunities.",
    icon: "🏛️",
    color: "from-indigo-500/20 to-blue-500/20",
  },
  {
    title: "TVL (Total Value Locked)",
    content: "The total amount deposited in DeFi protocols. Higher TVL often means more trust and liquidity, but always DYOR (Do Your Own Research).",
    icon: "🔒",
    color: "from-teal-500/20 to-cyan-500/20",
  },
  {
    title: "Building Your Empire",
    content: "Each building represents a protocol position. Upgrade buildings to boost yields, compound to grow faster, and settle when you want to claim your on-chain gains!",
    icon: "🏰",
    color: "from-violet-500/20 to-purple-500/20",
  },
];

export function DeFiGuide() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-rotate every 8 seconds
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % GUIDE_TIPS.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [isPaused]);

  const currentTip = GUIDE_TIPS[currentIndex];

  return (
    <div
      className="w-64 h-auto"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="bg-background/40 backdrop-blur-md border-2 border-purple-500/30 rounded-lg p-3 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-heading text-purple-400 uppercase tracking-wide">
            💎 DeFi Guide
          </h3>
          <div className="flex gap-1">
            {GUIDE_TIPS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  idx === currentIndex
                    ? 'bg-purple-400 w-3'
                    : 'bg-gray-600 hover:bg-gray-500'
                }`}
                aria-label={`Go to tip ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className={`bg-linear-to-br ${currentTip.color} border border-white/10 rounded-lg p-3 min-h-48`}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="text-3xl">{currentTip.icon}</div>
              <div className="w-full text-center">
                <h4 className="text-sm font-semibold text-white mb-2">
                  {currentTip.title}
                </h4>
                <p className="text-xs text-gray-200 leading-relaxed">
                  {currentTip.content}
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="mt-2 flex flex-col items-center gap-1.5 text-xs text-gray-500">
          <div className="flex items-center gap-2 w-full justify-between">
            <button
              onClick={() => setCurrentIndex((prev) => (prev - 1 + GUIDE_TIPS.length) % GUIDE_TIPS.length)}
              className="text-gray-400 hover:text-white transition-colors text-xs"
              aria-label="Previous tip"
            >
              ← Prev
            </button>
            <span className="text-xs">{currentIndex + 1} / {GUIDE_TIPS.length}</span>
            <button
              onClick={() => setCurrentIndex((prev) => (prev + 1) % GUIDE_TIPS.length)}
              className="text-gray-400 hover:text-white transition-colors text-xs"
              aria-label="Next tip"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
