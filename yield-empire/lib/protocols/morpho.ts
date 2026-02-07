/**
 * Morpho Blue integration for Sepolia.
 *
 * Morpho Blue on Sepolia uses Circle's canonical USDC directly,
 * so no treasury proxy is needed. The player approves + supplies in one flow.
 *
 * Per FLOW.md: "morpho.supply(marketParams, 3e6, 0, player, '')"
 */

import { type Address, type Hash, type WalletClient } from 'viem';
import { sepolia } from 'wagmi/chains';
import { PROTOCOL_ADDRESSES } from './addresses';
import { MORPHO_BLUE_ABI, ERC20_ABI } from './abis';

const { MORPHO, CIRCLE_USDC } = PROTOCOL_ADDRESSES;

/**
 * Approve Morpho Blue to spend Circle USDC, then supply to a lending market.
 *
 * Steps:
 *   1. Approve Morpho Blue Core to spend Circle USDC
 *   2. Call supply() with market params, assets amount, 0 shares, onBehalf, empty data
 *
 * Returns the supply transaction hash.
 */
export async function supplyToMorpho(
  walletClient: WalletClient,
  amount: bigint,
  onBehalf?: Address,
): Promise<Hash> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet not connected');

  const recipient = onBehalf ?? account.address;

  // Step 1: Approve Morpho Blue to spend Circle USDC
  await walletClient.writeContract({
    address: CIRCLE_USDC.SEPOLIA,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [MORPHO.CORE, amount],
    chain: sepolia,
    account,
  });

  // Step 2: Supply Circle USDC to Morpho Blue market
  const hash = await walletClient.writeContract({
    address: MORPHO.CORE,
    abi: MORPHO_BLUE_ABI,
    functionName: 'supply',
    args: [
      {
        loanToken: MORPHO.MARKET_PARAMS.loanToken,
        collateralToken: MORPHO.MARKET_PARAMS.collateralToken,
        oracle: MORPHO.MARKET_PARAMS.oracle,
        irm: MORPHO.MARKET_PARAMS.irm,
        lltv: MORPHO.MARKET_PARAMS.lltv,
      },
      amount,       // assets to supply
      BigInt(0),    // shares = 0 (supply by assets amount)
      recipient,    // onBehalf
      '0x',         // callback data (empty)
    ],
    chain: sepolia,
    account,
  });

  return hash;
}

/**
 * Withdraw Circle USDC from Morpho Blue market.
 */
export async function withdrawFromMorpho(
  walletClient: WalletClient,
  amount: bigint,
  receiver?: Address,
): Promise<Hash> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet not connected');

  const to = receiver ?? account.address;

  const hash = await walletClient.writeContract({
    address: MORPHO.CORE,
    abi: MORPHO_BLUE_ABI,
    functionName: 'withdraw',
    args: [
      {
        loanToken: MORPHO.MARKET_PARAMS.loanToken,
        collateralToken: MORPHO.MARKET_PARAMS.collateralToken,
        oracle: MORPHO.MARKET_PARAMS.oracle,
        irm: MORPHO.MARKET_PARAMS.irm,
        lltv: MORPHO.MARKET_PARAMS.lltv,
      },
      amount,       // assets to withdraw
      BigInt(0),    // shares = 0 (withdraw by assets amount)
      account.address, // onBehalf (must be supplier)
      to,           // receiver
    ],
    chain: sepolia,
    account,
  });

  return hash;
}
