'use client';

import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Gamepad2, Trophy, Users, LayoutDashboard, Home } from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: 'HOME', href: '/', icon: <Home className="w-4 h-4" /> },
  { label: 'PLAY', href: '/game', icon: <Gamepad2 className="w-4 h-4" /> },
  { label: 'SETTLE', href: '/settlement', icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: 'RANKS', href: '/leaderboard', icon: <Trophy className="w-4 h-4" /> },
  { label: 'GUILD', href: '/guild', icon: <Users className="w-4 h-4" /> },
];

export const RetroNav = () => {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b-2 border-border">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded bg-gold/20 border-2 border-gold flex items-center justify-center">
              <span className="font-pixel text-gold text-[8px]">YE</span>
            </div>
            <span className="font-pixel text-[10px] text-foreground hidden sm:block">
              YIELD<span className="text-gold">EMPIRE</span>
            </span>
          </Link>

          {/* Nav Items */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 font-pixel text-[8px] uppercase tracking-wider transition-all duration-150 rounded-sm',
                  pathname === item.href
                    ? 'text-gold border border-gold/50 bg-gold/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </div>

          {/* Connect Wallet Button */}
          <ConnectButton showBalance={false} />
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden border-t border-border bg-background/95">
        <div className="flex justify-around py-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-1 font-pixel text-[6px] uppercase transition-all duration-150',
                pathname === item.href ? 'text-gold' : 'text-muted-foreground',
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
};
