/**
 * Wagmi configuration for Yield Empire
 * Sets up wallet connection with RainbowKit
 */

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, sepolia, polygon, base, arbitrum, optimism } from 'wagmi/chains';

// RainbowKit / Wagmi configuration
export const wagmiConfig = getDefaultConfig({
  appName: 'Yield Empire',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'yield-empire-demo',
  chains: [sepolia, mainnet, polygon, base, arbitrum, optimism],
  ssr: true,
});
