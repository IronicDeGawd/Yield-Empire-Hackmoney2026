/**
 * Compound V3 integration for Sepolia.
 *
 * Compound V3 (Comet) on Sepolia uses Circle's canonical USDC directly,
 * so no treasury proxy is needed — the player approves + supplies in one flow.
 */

import { type Address, type Hash, type PublicClient, type WalletClient } from 'viem';
import { sepolia } from 'wagmi/chains';
import { PROTOCOL_ADDRESSES } from './addresses';
import { COMPOUND_COMET_ABI, ERC20_ABI } from './abis';

const { COMPOUND, CIRCLE_USDC } = PROTOCOL_ADDRESSES;

/**
 * Approve Compound Comet to spend Circle USDC, then supply.
 * Returns the supply transaction hash.
 */
export async function supplyToCompound(
  walletClient: WalletClient,
  amount: bigint,
): Promise<Hash> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet not connected');

  // Step 1: Approve Comet to spend Circle USDC
  await walletClient.writeContract({
    address: CIRCLE_USDC.SEPOLIA,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [COMPOUND.COMET_USDC, amount],
    chain: sepolia,
    account,
  });

  // Step 2: Supply Circle USDC to Compound Comet
  const hash = await walletClient.writeContract({
    address: COMPOUND.COMET_USDC,
    abi: COMPOUND_COMET_ABI,
    functionName: 'supply',
    args: [CIRCLE_USDC.SEPOLIA, amount],
    chain: sepolia,
    account,
  });

  return hash;
}

/**
 * Withdraw USDC from Compound V3 Comet.
 * Returns the withdraw transaction hash.
 */
export async function withdrawFromCompound(
  walletClient: WalletClient,
  amount: bigint,
): Promise<Hash> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet not connected');

  const hash = await walletClient.writeContract({
    address: COMPOUND.COMET_USDC,
    abi: COMPOUND_COMET_ABI,
    functionName: 'withdraw',
    args: [CIRCLE_USDC.SEPOLIA, amount],
    chain: sepolia,
    account,
  });

  return hash;
}

/**
 * Get Compound Comet balance for a user (supplied USDC + interest).
 */
export async function getCompoundBalance(
  publicClient: PublicClient,
  user: Address,
): Promise<bigint> {
  const balance = await publicClient.readContract({
    address: COMPOUND.COMET_USDC,
    abi: COMPOUND_COMET_ABI,
    functionName: 'balanceOf',
    args: [user],
  });

  return balance;
}
