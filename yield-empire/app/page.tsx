'use client';

/**
 * Landing Page - Yield Empire
 * Hero with animated preview and call to action
 */

import { useRouter } from 'next/navigation';
import { Zap, Users, Coins, ArrowRight } from 'lucide-react';
import { ConnectButton, useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

// Pre-computed star positions to avoid hydration mismatch
const STAR_POSITIONS = [
  { top: 15, left: 25, size: 2, duration: 3 },
  { top: 45, left: 68, size: 1.5, duration: 4 },
  { top: 78, left: 12, size: 2.5, duration: 2.5 },
  { top: 23, left: 89, size: 1.8, duration: 3.5 },
  { top: 56, left: 34, size: 2.2, duration: 4.5 },
  { top: 89, left: 56, size: 1.2, duration: 3.2 },
  { top: 12, left: 78, size: 2.8, duration: 2.8 },
  { top: 67, left: 45, size: 1.6, duration: 4.2 },
  { top: 34, left: 90, size: 2.4, duration: 3.8 },
  { top: 91, left: 23, size: 1.4, duration: 2.2 },
  { top: 5, left: 50, size: 2.1, duration: 3.6 },
  { top: 72, left: 82, size: 1.9, duration: 4.8 },
  { top: 38, left: 15, size: 2.6, duration: 2.6 },
  { top: 85, left: 72, size: 1.3, duration: 3.4 },
  { top: 48, left: 8, size: 2.3, duration: 4.4 },
  { top: 18, left: 62, size: 1.7, duration: 2.4 },
  { top: 62, left: 95, size: 2.7, duration: 3.9 },
  { top: 95, left: 38, size: 1.1, duration: 4.1 },
  { top: 28, left: 5, size: 2.9, duration: 2.9 },
  { top: 52, left: 48, size: 1.5, duration: 3.3 },
];

export default function Home() {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const router = useRouter();

  const handlePlay = () => {
    if (isConnected) {
      router.push('/game');
    } else if (openConnectModal) {
      openConnectModal();
    }
  };

  return (
    <div className="page-scrollable bg-game-bg text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-game-bg/80 backdrop-blur-md border-b border-game-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg" />
            <span className="font-bold text-xl">Yield Empire</span>
          </div>
          <ConnectButton showBalance={false} />
        </div>
      </header>

      {/* Hero Section */}
      <main className="pt-24 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Hero Content */}
          <div className="text-center py-20">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-pink-400 to-yellow-400 bg-clip-text text-transparent">
              Build Your DeFi Empire
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto mb-8">
              An idle game where instant, gasless transactions make playing feel like a real game.
              Powered by Yellow Network & ENS.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handlePlay}
                className="btn-gold flex items-center justify-center gap-2 text-lg"
              >
                {isConnected ? 'Enter Empire' : 'Connect Wallet to Play'}
                <ArrowRight size={20} />
              </button>
              <a
                href="#features"
                className="px-6 py-3 rounded-lg border-2 border-purple-500 text-purple-400 hover:bg-purple-500/10 transition-colors"
              >
                Learn More
              </a>
            </div>
          </div>

          {/* Animated Preview */}
          <div className="relative max-w-4xl mx-auto mb-20">
            <div className="aspect-video rounded-2xl bg-game-panel border-2 border-game-border overflow-hidden relative">
              {/* Placeholder for game preview */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl animate-float" />
                  <p className="text-gray-400">Game Preview</p>
                </div>
              </div>
              {/* Decorative stars - pre-computed positions to avoid hydration mismatch */}
              {STAR_POSITIONS.map((star, i) => (
                <div
                  key={i}
                  className="absolute rounded-full bg-white opacity-60 animate-pulse"
                  style={{
                    top: `${star.top}%`,
                    left: `${star.left}%`,
                    width: `${star.size}px`,
                    height: `${star.size}px`,
                    animationDuration: `${star.duration}s`,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Features Section */}
          <section id="features" className="py-20">
            <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="bg-game-panel border-2 border-game-border rounded-xl p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-yellow-500/20 rounded-full flex items-center justify-center">
                  <Coins className="text-yellow-500" size={32} />
                </div>
                <h3 className="text-xl font-bold mb-2">Deposit & Build</h3>
                <p className="text-gray-400">
                  Deposit into DeFi protocols and watch your buildings generate yield automatically.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-game-panel border-2 border-game-border rounded-xl p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-purple-500/20 rounded-full flex items-center justify-center">
                  <Zap className="text-purple-500" size={32} />
                </div>
                <h3 className="text-xl font-bold mb-2">Instant Actions</h3>
                <p className="text-gray-400">
                  Yellow Network enables hundreds of gasless actions. Settle once when you're done.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-game-panel border-2 border-game-border rounded-xl p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-pink-500/20 rounded-full flex items-center justify-center">
                  <Users className="text-pink-500" size={32} />
                </div>
                <h3 className="text-xl font-bold mb-2">Join a Guild</h3>
                <p className="text-gray-400">
                  Team up with others using ENS names. Complete quests and climb the leaderboard.
                </p>
              </div>
            </div>
          </section>

          {/* Sponsors */}
          <section className="py-20 border-t border-game-border">
            <h2 className="text-xl text-gray-400 text-center mb-8">Powered By</h2>
            <div className="flex justify-center items-center gap-12 flex-wrap">
              <div className="text-2xl font-bold text-yellow-500">Yellow Network</div>
              <div className="text-2xl font-bold text-purple-500">ENS</div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-game-border py-8 px-6">
        <div className="max-w-7xl mx-auto text-center text-gray-500 text-sm">
          <p>Built for HackMoney 2026</p>
        </div>
      </footer>
    </div>
  );
}
