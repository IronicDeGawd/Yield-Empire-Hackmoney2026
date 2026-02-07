/**
 * Aave V3 integration for Base Sepolia.
 *
 * Aave uses its own test USDC (NOT Circle USDC). The primary settlement path
 * is via a Treasury Contract that holds pre-funded Aave test USDC. The treasury
 * accepts Circle USDC as collateral and executes the real Aave supply() on
 * behalf of the player.
 *
 * Fallback: if no treasury is deployed (address is zero), fall back to direct
 * supply using Aave test USDC from the user's wallet (requires faucet mint).
 */

import { type Address, type Hash, type PublicClient, type WalletClient } from 'viem';
import { baseSepolia } from 'wagmi/chains';
import { PROTOCOL_ADDRESSES } from './addresses';
import { AAVE_POOL_ABI, AAVE_FAUCET_ABI, ERC20_ABI, TREASURY_ABI } from './abis';

const { AAVE, TREASURY } = PROTOCOL_ADDRESSES;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/** Whether a treasury contract is configured */
export function isTreasuryDeployed(): boolean {
  return TREASURY.BASE_SEPOLIA !== ZERO_ADDRESS;
}

/**
 * Primary path: settle Aave allocation via Treasury Contract.
 *
 * The treasury holds pre-funded Aave test USDC. On settle, the treasury
 * calls aavePool.supply(aaveUsdc, amount, player, 0) using its own reserves.
 * The player's Circle USDC (already bridged to treasury) serves as collateral.
 *
 * This is an owner-only call on the treasury — the game backend or deployer
 * wallet must sign this. For the hackathon demo, the connected wallet is
 * assumed to be the treasury owner.
 */
export async function settleAaveViaTreasury(
  walletClient: WalletClient,
  player: Address,
  amount: bigint,
): Promise<Hash> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet not connected');

  if (!isTreasuryDeployed()) {
    throw new Error('Treasury contract not deployed — set NEXT_PUBLIC_TREASURY_ADDRESS');
  }

  const hash = await walletClient.writeContract({
    address: TREASURY.BASE_SEPOLIA,
    abi: TREASURY_ABI,
    functionName: 'settle',
    args: [player, amount],
    chain: baseSepolia,
    account,
  });

  return hash;
}

/**
 * Fallback path: directly approve + supply Aave test USDC from user wallet.
 * Requires the user to have minted Aave test USDC via faucet.
 */
export async function supplyToAaveDirect(
  walletClient: WalletClient,
  amount: bigint,
  onBehalfOf?: Address,
): Promise<Hash> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet not connected');

  const recipient = onBehalfOf ?? account.address;

  // Step 1: Approve Aave Pool to spend Aave test USDC
  await walletClient.writeContract({
    address: AAVE.USDC,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [AAVE.POOL, amount],
    chain: baseSepolia,
    account,
  });

  // Step 2: Supply to Aave Pool
  const hash = await walletClient.writeContract({
    address: AAVE.POOL,
    abi: AAVE_POOL_ABI,
    functionName: 'supply',
    args: [AAVE.USDC, amount, recipient, 0],
    chain: baseSepolia,
    account,
  });

  return hash;
}

/**
 * Supply to Aave V3 — routes through treasury when deployed, falls back to direct.
 */
export async function supplyToAave(
  walletClient: WalletClient,
  amount: bigint,
  onBehalfOf?: Address,
): Promise<Hash> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet not connected');

  if (isTreasuryDeployed()) {
    return settleAaveViaTreasury(walletClient, onBehalfOf ?? account.address, amount);
  }

  return supplyToAaveDirect(walletClient, amount, onBehalfOf);
}

/**
 * Withdraw from Aave V3 Pool.
 * Returns the withdraw transaction hash.
 */
export async function withdrawFromAave(
  walletClient: WalletClient,
  amount: bigint,
  to?: Address,
): Promise<Hash> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet not connected');

  const recipient = to ?? account.address;

  const hash = await walletClient.writeContract({
    address: AAVE.POOL,
    abi: AAVE_POOL_ABI,
    functionName: 'withdraw',
    args: [AAVE.USDC, amount, recipient],
    chain: baseSepolia,
    account,
  });

  return hash;
}

/**
 * Get Aave aUSDC balance (receipt token = supplied amount + interest).
 */
export async function getAaveBalance(
  publicClient: PublicClient,
  user: Address,
): Promise<bigint> {
  const balance = await publicClient.readContract({
    address: AAVE.A_USDC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [user],
  });

  return balance;
}

/**
 * Mint test USDC from Aave's Base Sepolia faucet.
 * Useful for demo setup — players can get Aave test USDC to supply.
 */
export async function mintFromAaveFaucet(
  walletClient: WalletClient,
  amount: bigint,
  to?: Address,
): Promise<Hash> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet not connected');

  const recipient = to ?? account.address;

  const hash = await walletClient.writeContract({
    address: AAVE.FAUCET,
    abi: AAVE_FAUCET_ABI,
    functionName: 'mint',
    args: [AAVE.USDC, recipient, amount],
    chain: baseSepolia,
    account,
  });

  return hash;
}
