'use client';

/**
 * Landing Page - Yield Empire
 * Retro pixel-art hero with animated preview and call to action
 */

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Coins, Shield, Swords } from 'lucide-react';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { StarField } from '@/components/ui/StarField';
import { RetroNav } from '@/components/ui/RetroNav';
import { ArcadeButton } from '@/components/ui/ArcadeButton';
import {
  RetroCard,
  RetroCardHeader,
  RetroCardTitle,
  RetroCardContent,
} from '@/components/ui/RetroCard';
import { IsometricPreview } from '@/components/ui/IsometricPreview';

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
    <div className="page-scrollable bg-background relative overflow-hidden cloud-bg text-foreground">
      {/* Background effects */}
      <StarField />
      <div className="grid-overlay absolute inset-0" />

      {/* Navigation */}
      <RetroNav />

      {/* Hero Section */}
      <main id="main-content" className="relative pt-28 pb-16 px-4">
        <div className="max-w-5xl mx-auto text-center relative z-10">
          {/* Logo */}
          <div className="mb-6">
            <Image
              src="/logo.png"
              alt="Yield Empire"
              width={140}
              height={140}
              className="mx-auto rounded-full drop-shadow-[0_0_20px_rgba(255,215,0,0.3)]"
              priority
            />
          </div>

          {/* Tagline */}
          <div className="mb-4">
            <span className="font-pixel text-[10px] text-gold uppercase tracking-widest">
              ⚡ DeFi Idle Game ⚡
            </span>
          </div>

          {/* Main title */}
          <h1 className="font-pixel text-2xl md:text-3xl lg:text-4xl text-foreground mb-4 leading-relaxed">
            BUILD YOUR
            <br />
            <span className="text-neon-green">YIELD</span>{' '}
            <span className="text-gold">EMPIRE</span>
          </h1>

          <p className="font-retro text-xl md:text-2xl text-muted-foreground max-w-xl mx-auto mb-6">
            Stake, build, and conquer in the ultimate DeFi idle game. Powered by Yellow Network
            &amp; ENS.
          </p>

          {/* Isometric Game Preview */}
          <div className="relative max-w-3xl mx-auto mb-8">
            <div className="rounded-sm retro-card retro-card-purple overflow-hidden relative">
              <IsometricPreview />
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <ArcadeButton variant="gold" size="lg" className="min-w-[180px]" onClick={handlePlay}>
              {isConnected ? 'ENTER EMPIRE' : 'PLAY NOW'}
            </ArcadeButton>
            {!isConnected && (
              <ArcadeButton
                variant="secondary"
                size="lg"
                className="min-w-[180px]"
                onClick={() => openConnectModal?.()}
              >
                CONNECT WALLET
              </ArcadeButton>
            )}
          </div>
        </div>
      </main>

      {/* How It Works Section */}
      <section className="relative py-16 px-4">
        <div className="max-w-4xl mx-auto relative z-10">
          <h2 className="font-pixel text-sm md:text-base text-center text-foreground mb-10">
            HOW IT WORKS
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            <RetroCard borderColor="gold" className="text-center">
              <RetroCardHeader>
                <div className="w-14 h-14 mx-auto mb-3 rounded bg-gold/20 border-2 border-gold flex items-center justify-center">
                  <Coins className="w-7 h-7 text-gold" />
                </div>
                <RetroCardTitle className="justify-center">STAKE</RetroCardTitle>
              </RetroCardHeader>
              <RetroCardContent>
                <p className="text-muted-foreground">
                  Deposit your tokens into real DeFi protocols and start earning passive yields
                  24/7.
                </p>
              </RetroCardContent>
            </RetroCard>

            <RetroCard borderColor="gold" className="text-center">
              <RetroCardHeader>
                <div className="w-14 h-14 mx-auto mb-3 rounded bg-gold/20 border-2 border-gold flex items-center justify-center">
                  <Shield className="w-7 h-7 text-gold" />
                </div>
                <RetroCardTitle className="justify-center">BUILD</RetroCardTitle>
              </RetroCardHeader>
              <RetroCardContent>
                <p className="text-muted-foreground">
                  Construct buildings and expand your empire with gasless, instant actions.
                </p>
              </RetroCardContent>
            </RetroCard>

            <RetroCard borderColor="gold" className="text-center">
              <RetroCardHeader>
                <div className="w-14 h-14 mx-auto mb-3 rounded bg-gold/20 border-2 border-gold flex items-center justify-center">
                  <Swords className="w-7 h-7 text-gold" />
                </div>
                <RetroCardTitle className="justify-center">CONQUER</RetroCardTitle>
              </RetroCardHeader>
              <RetroCardContent>
                <p className="text-muted-foreground">
                  Join guilds via ENS and compete on the leaderboard for supremacy.
                </p>
              </RetroCardContent>
            </RetroCard>
          </div>
        </div>
      </section>

      {/* Sponsors */}
      <section className="relative py-16 px-4 border-t border-border">
        <div className="max-w-4xl mx-auto relative z-10">
          <h2 className="font-pixel text-[10px] text-muted-foreground text-center mb-8 uppercase tracking-widest">
            Powered By
          </h2>
          <div className="flex justify-center items-center gap-12 flex-wrap">
            <span className="font-pixel text-sm text-gold">Yellow Network</span>
            <span className="font-pixel text-sm text-primary">ENS</span>
            <span className="font-pixel text-sm text-neon-blue">Circle</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 px-4 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          <p className="font-pixel text-[8px] text-muted-foreground">
            © 2026 YIELD EMPIRE • BUILT FOR HACKMONEY 2026
          </p>
          <div className="flex justify-center gap-6 mt-3">
            <a
              href="#"
              className="font-retro text-base text-muted-foreground hover:text-gold transition-colors"
            >
              Discord
            </a>
            <a
              href="#"
              className="font-retro text-base text-muted-foreground hover:text-gold transition-colors"
            >
              Twitter
            </a>
            <a
              href="#"
              className="font-retro text-base text-muted-foreground hover:text-gold transition-colors"
            >
              Docs
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
