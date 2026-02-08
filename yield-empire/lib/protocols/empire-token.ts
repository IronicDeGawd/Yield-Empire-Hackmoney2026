/**
 * $EMPIRE token integration helpers.
 *
 * Provides balance reading for the EmpireToken ERC-20 contract on Sepolia.
 * Uses the standard ERC-20 balanceOf ABI — no custom ABI needed.
 */

import type { PublicClient, Address } from 'viem';
import { PROTOCOL_ADDRESSES } from './addresses';

const ERC20_BALANCE_OF_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * Read a player's $EMPIRE token balance on Sepolia.
 * Returns the raw bigint value (18 decimals).
 */
export async function getEmpireBalance(
  publicClient: PublicClient,
  address: Address,
): Promise<bigint> {
  const tokenAddress = PROTOCOL_ADDRESSES.EMPIRE_TOKEN.SEPOLIA;

  if (tokenAddress === '0x0000000000000000000000000000000000000000') {
    return BigInt(0);
  }

  return publicClient.readContract({
    address: tokenAddress,
    abi: ERC20_BALANCE_OF_ABI,
    functionName: 'balanceOf',
    args: [address],
  });
}
