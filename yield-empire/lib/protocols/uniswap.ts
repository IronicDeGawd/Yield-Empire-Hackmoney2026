/**
 * Uniswap V3 integration for Sepolia.
 *
 * The Exchange Factory building executes swaps (not LP) via SwapRouter02.
 * Uses Circle USDC directly — no treasury needed.
 *
 * Per FLOW.md: "Uniswap V3 LP requires NonfungiblePositionManager + two tokens.
 * For the hackathon, the Exchange Factory building executes swaps via the
 * SwapRouter — representing 'active trading' rather than passive LP."
 */

import { type Address, type Hash, type PublicClient, type WalletClient } from 'viem';
import { sepolia } from 'wagmi/chains';
import { PROTOCOL_ADDRESSES } from './addresses';
import { UNISWAP_ROUTER_ABI, ERC20_ABI } from './abis';

const { UNISWAP, CIRCLE_USDC, WETH } = PROTOCOL_ADDRESSES;

/**
 * Swap Circle USDC → WETH on Uniswap V3 via exactInputSingle.
 *
 * Steps:
 *   1. Approve SwapRouter to spend Circle USDC
 *   2. Call exactInputSingle with USDC→WETH, 0.3% fee tier
 *
 * Returns the swap transaction hash.
 */
export async function swapOnUniswap(
  walletClient: WalletClient,
  publicClient: PublicClient,
  amount: bigint,
): Promise<Hash> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet not connected');

  // Step 1: Approve SwapRouter to spend Circle USDC
  const approveHash = await walletClient.writeContract({
    address: CIRCLE_USDC.SEPOLIA,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [UNISWAP.ROUTER, amount],
    chain: sepolia,
    account,
    gas: BigInt(100_000), // Explicit limit to prevent inflated estimation
  });

  // Wait for approve to be mined before swap
  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  // Step 2: Execute swap — USDC → WETH, 0.3% fee tier, no price limit
  const hash = await walletClient.writeContract({
    address: UNISWAP.ROUTER,
    abi: UNISWAP_ROUTER_ABI,
    functionName: 'exactInputSingle',
    args: [
      {
        tokenIn: CIRCLE_USDC.SEPOLIA,
        tokenOut: WETH.SEPOLIA,
        fee: 3000, // 0.3% fee tier
        recipient: account.address,
        amountIn: amount,
        amountOutMinimum: BigInt(0), // Accept any output for testnet demo
        sqrtPriceLimitX96: BigInt(0), // No price limit
      },
    ],
    chain: sepolia,
    account,
    gas: BigInt(350_000), // Explicit limit to prevent inflated estimation
  });

  return hash;
}
