'use client';

/**
 * Web3 Provider - wraps the app with wagmi, RainbowKit, and React Query
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { wagmiConfig } from '@/lib/wagmi-config';
import { YellowSessionProvider } from '@/components/providers/YellowSessionProvider';
import { useEffect, useState } from 'react';

import '@rainbow-me/rainbowkit/styles.css';

interface Web3ProviderProps {
  children: React.ReactNode;
}

export function Web3Provider({ children }: Web3ProviderProps) {
  // Suppress browser extension errors (e.g. MetaMask) in dev mode
  useEffect(() => {
    const handler = (e: ErrorEvent) => {
      if (e.filename?.startsWith('chrome-extension://')) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    };
    window.addEventListener('error', handler, true);
    return () => window.removeEventListener('error', handler, true);
  }, []);

  // Create a client inside the component to avoid SSR issues
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
          },
        },
      })
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#7C3AED', // Violet to match game theme
            accentColorForeground: 'white',
            borderRadius: 'medium',
            fontStack: 'system',
          })}
          modalSize="compact"
        >
          <YellowSessionProvider>
            {children}
          </YellowSessionProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
