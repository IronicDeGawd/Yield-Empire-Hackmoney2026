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

const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;

/**
 * Fetch Compound V3 supply APY from on-chain rate data.
 * Gets current utilization, then queries supply rate at that utilization.
 * Supply rate is per-second, scaled by 1e18.
 */
export async function getCompoundSupplyAPY(
  publicClient: PublicClient,
): Promise<number> {
  const utilization = await publicClient.readContract({
    address: COMPOUND.COMET_USDC,
    abi: COMPOUND_COMET_ABI,
    functionName: 'getUtilization',
  });

  const supplyRate = await publicClient.readContract({
    address: COMPOUND.COMET_USDC,
    abi: COMPOUND_COMET_ABI,
    functionName: 'getSupplyRate',
    args: [utilization as bigint],
  });

  // supplyRate is per-second, 18 decimals
  // APY ≈ supplyRate * secondsPerYear / 1e18 * 100
  const apy = (Number(supplyRate) * SECONDS_PER_YEAR) / 1e18 * 100;
  return apy;
}

const { COMPOUND, CIRCLE_USDC } = PROTOCOL_ADDRESSES;

/**
 * Approve Compound Comet to spend Circle USDC, then supply.
 * Returns the supply transaction hash.
 */
export async function supplyToCompound(
  walletClient: WalletClient,
  publicClient: PublicClient,
  amount: bigint,
): Promise<Hash> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet not connected');

  // Step 1: Approve Comet to spend Circle USDC
  const approveHash = await walletClient.writeContract({
    address: CIRCLE_USDC.SEPOLIA,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [COMPOUND.COMET_USDC, amount],
    chain: sepolia,
    account,
    gas: BigInt(100_000), // Explicit limit to prevent inflated estimation
  });

  // Wait for approve to be mined before supply
  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  // Step 2: Supply Circle USDC to Compound Comet
  const hash = await walletClient.writeContract({
    address: COMPOUND.COMET_USDC,
    abi: COMPOUND_COMET_ABI,
    functionName: 'supply',
    args: [CIRCLE_USDC.SEPOLIA, amount],
    chain: sepolia,
    account,
    gas: BigInt(250_000), // Explicit limit to prevent inflated estimation
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
    gas: BigInt(250_000), // Explicit limit to prevent inflated estimation
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
