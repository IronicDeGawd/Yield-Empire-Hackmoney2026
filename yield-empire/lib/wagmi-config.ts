/**
 * Wagmi configuration for Yield Empire
 * Sets up wallet connection with RainbowKit
 */

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, sepolia, polygon, base, baseSepolia, arbitrum, optimism } from 'wagmi/chains';
import { defineChain } from 'viem';

// Arc Testnet chain definition
// Reference: resources/arc-multichain-wallet/lib/circle/gateway-sdk.ts
// Public endpoint works without a key; add a key only if you have one to avoid rate limits.
const arcRpcKey = process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_KEY;
const arcRpcUrl = arcRpcKey
  ? `https://rpc.testnet.arc.network/${arcRpcKey}`
  : 'https://rpc.testnet.arc.network';

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: { http: [arcRpcUrl] },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://explorer.arc.testnet.circle.com' },
  },
  testnet: true,
});

// RainbowKit / Wagmi configuration
export const wagmiConfig = getDefaultConfig({
  appName: 'Yield Empire',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'yield-empire-demo',
  chains: [sepolia, baseSepolia, arcTestnet, mainnet, polygon, base, arbitrum, optimism],
  ssr: true,
});
