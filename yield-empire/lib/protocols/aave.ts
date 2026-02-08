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
import { AAVE_POOL_ABI, AAVE_FAUCET_ABI, ERC20_ABI } from './abis';

/**
 * Fetch Aave V3 supply APY from on-chain reserve data.
 * Uses getReserveData() which returns currentLiquidityRate in RAY (27 decimals).
 */
export async function getAaveSupplyAPY(
  publicClient: PublicClient,
): Promise<number> {
  const reserveData = await publicClient.readContract({
    address: AAVE.POOL,
    abi: AAVE_POOL_ABI,
    functionName: 'getReserveData',
    args: [AAVE.USDC],
  });

  // currentLiquidityRate is at index 2 of the returned struct, in RAY (1e27)
  const currentLiquidityRate = (reserveData as { currentLiquidityRate: bigint }).currentLiquidityRate;
  const RAY = BigInt(10) ** BigInt(27);

  // Convert RAY to percentage: (rate / 1e27) * 100
  const apyBps = Number((currentLiquidityRate * BigInt(10000)) / RAY);
  return apyBps / 100; // e.g. 3.45 for 3.45%
}

const { AAVE, TREASURY } = PROTOCOL_ADDRESSES;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/** Whether a treasury contract is configured */
export function isTreasuryDeployed(): boolean {
  return TREASURY.BASE_SEPOLIA !== ZERO_ADDRESS;
}

/**
 * Primary path: settle Aave allocation via Treasury Relayer API.
 *
 * The treasury holds pre-funded Aave test USDC. On settle, the server-side
 * relayer (which holds the treasury owner key) calls registerBridgeMint()
 * if needed, then settle() on the treasury contract.
 *
 * This pattern keeps the owner key server-side and works for any user.
 * The relayer runs at /api/treasury/settle.
 */
export async function settleAaveViaTreasury(
  _walletClient: WalletClient,
  player: Address,
  amount: bigint,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _publicClient?: PublicClient,
): Promise<Hash> {
  if (!isTreasuryDeployed()) {
    throw new Error('Treasury contract not deployed — set NEXT_PUBLIC_TREASURY_ADDRESS');
  }

  // Call server-side relayer which signs with the treasury owner key
  const res = await fetch('/api/treasury/settle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player, amount: amount.toString() }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? `Treasury relayer failed (${res.status})`);
  }

  if (data.status !== 'confirmed') {
    throw new Error('Treasury settle transaction failed on-chain');
  }

  return data.settleHash as Hash;
}

/**
 * Fallback path: directly approve + supply Aave test USDC from user wallet.
 * Requires the user to have minted Aave test USDC via faucet.
 */
export async function supplyToAaveDirect(
  walletClient: WalletClient,
  publicClient: PublicClient,
  amount: bigint,
  onBehalfOf?: Address,
): Promise<Hash> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet not connected');

  const recipient = onBehalfOf ?? account.address;

  // Step 1: Approve Aave Pool to spend Aave test USDC
  const approveHash = await walletClient.writeContract({
    address: AAVE.USDC,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [AAVE.POOL, amount],
    chain: baseSepolia,
    account,
    gas: BigInt(100_000), // Explicit limit to prevent inflated estimation
  });

  // Wait for approve to be mined before supply
  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  // Step 2: Supply to Aave Pool
  const hash = await walletClient.writeContract({
    address: AAVE.POOL,
    abi: AAVE_POOL_ABI,
    functionName: 'supply',
    args: [AAVE.USDC, amount, recipient, 0],
    chain: baseSepolia,
    account,
    gas: BigInt(400_000), // Explicit limit to prevent inflated estimation
  });

  return hash;
}

/**
 * Supply to Aave V3 — routes through treasury when deployed, falls back to direct.
 */
export async function supplyToAave(
  walletClient: WalletClient,
  publicClient: PublicClient,
  amount: bigint,
  onBehalfOf?: Address,
): Promise<Hash> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet not connected');

  if (isTreasuryDeployed()) {
    return settleAaveViaTreasury(walletClient, onBehalfOf ?? account.address, amount, publicClient);
  }

  return supplyToAaveDirect(walletClient, publicClient, amount, onBehalfOf);
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
    gas: BigInt(400_000), // Explicit limit to prevent inflated estimation
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
    gas: BigInt(300_000), // Explicit limit to prevent inflated estimation
  });

  return hash;
}
