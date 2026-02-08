/**
 * Treasury Relayer API — POST /api/treasury/settle
 *
 * Server-side relayer that uses the treasury owner's private key to execute
 * registerBridgeMint() + settle() on behalf of any player.
 *
 * This pattern is standard in production dapps: the private key stays
 * server-side, and any authenticated user can trigger treasury operations
 * without being the contract owner.
 *
 * Request body: { player: "0x...", amount: "5000000" }  (amount in USDC 6 decimals)
 * Response:     { registerHash?, settleHash, status }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { PROTOCOL_ADDRESSES } from '@/lib/protocols/addresses';
import { TREASURY_ABI } from '@/lib/protocols/abis';

const TREASURY_ADDRESS = PROTOCOL_ADDRESSES.TREASURY.BASE_SEPOLIA;
const DEPLOYER_KEY = process.env.TREASURY_DEPLOYER_KEY;

// Validate env on module load
if (!DEPLOYER_KEY) {
  console.warn('[treasury/settle] TREASURY_DEPLOYER_KEY not set — relayer disabled');
}

export async function POST(req: NextRequest) {
  if (!DEPLOYER_KEY) {
    return NextResponse.json(
      { error: 'Treasury relayer not configured (missing TREASURY_DEPLOYER_KEY)' },
      { status: 503 },
    );
  }

  // Parse request
  let player: Hex;
  let amount: bigint;

  try {
    const body = await req.json();
    if (!body.player || !body.amount) {
      return NextResponse.json({ error: 'Missing player or amount' }, { status: 400 });
    }
    player = body.player as Hex;
    amount = BigInt(body.amount);

    if (amount <= 0n) {
      return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Create owner wallet from deployer key
  const account = privateKeyToAccount(DEPLOYER_KEY as Hex);
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  });
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  try {
    // Step 1: Check on-chain deposits — register if needed
    let registerHash: string | undefined;

    const [currentDeposit, currentAlloc] = await Promise.all([
      publicClient.readContract({
        address: TREASURY_ADDRESS,
        abi: TREASURY_ABI,
        functionName: 'playerDeposits',
        args: [player],
      }),
      publicClient.readContract({
        address: TREASURY_ADDRESS,
        abi: TREASURY_ABI,
        functionName: 'aaveAllocations',
        args: [player],
      }),
    ]);

    const available = currentDeposit - currentAlloc;

    if (available < amount) {
      const deficit = amount - available;
      registerHash = await walletClient.writeContract({
        address: TREASURY_ADDRESS,
        abi: TREASURY_ABI,
        functionName: 'registerBridgeMint',
        args: [player, deficit],
        gas: 200_000n,
      });
      // Wait for registration to be mined
      await publicClient.waitForTransactionReceipt({ hash: registerHash as `0x${string}` });
    }

    // Step 2: Settle (execute Aave supply via treasury)
    const settleHash = await walletClient.writeContract({
      address: TREASURY_ADDRESS,
      abi: TREASURY_ABI,
      functionName: 'settle',
      args: [player, amount],
      gas: 500_000n,
    });

    // Wait for settle to confirm
    const receipt = await publicClient.waitForTransactionReceipt({ hash: settleHash });

    return NextResponse.json({
      status: receipt.status === 'success' ? 'confirmed' : 'failed',
      settleHash,
      registerHash,
      blockNumber: Number(receipt.blockNumber),
    });
  } catch (err) {
    console.error('[treasury/settle] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
