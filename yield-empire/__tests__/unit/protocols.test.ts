/**
 * Phase A: Protocol Contract Unit Tests
 *
 * Verifies each protocol's supply/withdraw/balance functions call the correct
 * contract with correct ABI, args, chain, and account — using mocked viem clients.
 */

import { PROTOCOL_ADDRESSES } from '@/lib/protocols/addresses';

// Mock wagmi/chains to avoid ESM parse issues in Jest
jest.mock('wagmi/chains', () => ({
  baseSepolia: { id: 84532, name: 'Base Sepolia' },
  sepolia: { id: 11155111, name: 'Sepolia' },
}));

// Import the mocked chain objects for test assertions
const baseSepolia = { id: 84532, name: 'Base Sepolia' };
const sepolia = { id: 11155111, name: 'Sepolia' };

const { AAVE, COMPOUND, CIRCLE_USDC, UNISWAP, WETH, MORPHO, TREASURY } = PROTOCOL_ADDRESSES;

// ----- Mock Factories -----

const MOCK_ADDRESS = '0xPlayer0000000000000000000000000000000001' as const;
const MOCK_TX_HASH = '0xMockTxHash0000000000000000000000000000000000000000000000000000001' as const;

function createMockWalletClient(address = MOCK_ADDRESS) {
  return {
    account: { address },
    writeContract: jest.fn().mockResolvedValue(MOCK_TX_HASH),
  };
}

function createMockPublicClient(balance = BigInt(1_000_000)) {
  return {
    readContract: jest.fn().mockResolvedValue(balance),
    waitForTransactionReceipt: jest.fn().mockResolvedValue({ status: 'success' }),
  };
}

// ----- A.1: Aave V3 -----

describe('Phase A.1 — Aave V3', () => {
  let supplyToAave: typeof import('@/lib/protocols/aave').supplyToAave;
  let supplyToAaveDirect: typeof import('@/lib/protocols/aave').supplyToAaveDirect;
  let settleAaveViaTreasury: typeof import('@/lib/protocols/aave').settleAaveViaTreasury;
  let withdrawFromAave: typeof import('@/lib/protocols/aave').withdrawFromAave;
  let getAaveBalance: typeof import('@/lib/protocols/aave').getAaveBalance;
  let mintFromAaveFaucet: typeof import('@/lib/protocols/aave').mintFromAaveFaucet;
  let isTreasuryDeployed: typeof import('@/lib/protocols/aave').isTreasuryDeployed;

  beforeEach(() => {
    jest.resetModules();
  });

  async function loadAaveModule() {
    const mod = await import('@/lib/protocols/aave');
    supplyToAave = mod.supplyToAave;
    supplyToAaveDirect = mod.supplyToAaveDirect;
    settleAaveViaTreasury = mod.settleAaveViaTreasury;
    withdrawFromAave = mod.withdrawFromAave;
    getAaveBalance = mod.getAaveBalance;
    mintFromAaveFaucet = mod.mintFromAaveFaucet;
    isTreasuryDeployed = mod.isTreasuryDeployed;
  }

  test('supplyToAave() routes through treasury when deployed', async () => {
    process.env.NEXT_PUBLIC_TREASURY_ADDRESS = '0xTreasury000000000000000000000000000000001';
    await loadAaveModule();

    const wallet = createMockWalletClient();
    const pub = createMockPublicClient();
    const amount = BigInt(1_000_000);

    await supplyToAave(wallet as any, pub as any, amount);

    expect(wallet.writeContract).toHaveBeenCalledTimes(1);
    expect(wallet.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'settle',
        args: [MOCK_ADDRESS, amount],
        chain: baseSepolia,
      })
    );

    delete process.env.NEXT_PUBLIC_TREASURY_ADDRESS;
  });

  test('supplyToAave() falls back to direct when no treasury', async () => {
    delete process.env.NEXT_PUBLIC_TREASURY_ADDRESS;
    await loadAaveModule();

    const wallet = createMockWalletClient();
    const pub = createMockPublicClient();
    const amount = BigInt(1_000_000);

    await supplyToAave(wallet as any, pub as any, amount);

    // Direct path: approve + supply = 2 calls
    expect(wallet.writeContract).toHaveBeenCalledTimes(2);
    // First call: approve
    expect(wallet.writeContract).toHaveBeenNthCalledWith(1,
      expect.objectContaining({
        functionName: 'approve',
        args: [AAVE.POOL, amount],
      })
    );
    // Second call: supply
    expect(wallet.writeContract).toHaveBeenNthCalledWith(2,
      expect.objectContaining({
        functionName: 'supply',
        args: [AAVE.USDC, amount, MOCK_ADDRESS, 0],
        chain: baseSepolia,
      })
    );
  });

  test('supplyToAaveDirect() calls approve then supply', async () => {
    delete process.env.NEXT_PUBLIC_TREASURY_ADDRESS;
    await loadAaveModule();

    const wallet = createMockWalletClient();
    const pub = createMockPublicClient();
    const amount = BigInt(5_000_000);

    const hash = await supplyToAaveDirect(wallet as any, pub as any, amount);

    expect(hash).toBe(MOCK_TX_HASH);
    expect(wallet.writeContract).toHaveBeenCalledTimes(2);

    // Approve: ERC20.approve(Pool, amount) on Aave test USDC
    expect(wallet.writeContract).toHaveBeenNthCalledWith(1,
      expect.objectContaining({
        address: AAVE.USDC,
        functionName: 'approve',
        args: [AAVE.POOL, amount],
        chain: baseSepolia,
      })
    );

    // Supply: Pool.supply(USDC, amount, recipient, 0)
    expect(wallet.writeContract).toHaveBeenNthCalledWith(2,
      expect.objectContaining({
        address: AAVE.POOL,
        functionName: 'supply',
        args: [AAVE.USDC, amount, MOCK_ADDRESS, 0],
        chain: baseSepolia,
      })
    );
  });

  test('supplyToAaveDirect() uses onBehalfOf when provided', async () => {
    delete process.env.NEXT_PUBLIC_TREASURY_ADDRESS;
    await loadAaveModule();

    const wallet = createMockWalletClient();
    const pub = createMockPublicClient();
    const amount = BigInt(2_000_000);
    const customRecipient = '0xCustomRecipient00000000000000000000000001' as `0x${string}`;

    await supplyToAaveDirect(wallet as any, pub as any, amount, customRecipient);

    // Supply call should use the custom recipient
    expect(wallet.writeContract).toHaveBeenNthCalledWith(2,
      expect.objectContaining({
        functionName: 'supply',
        args: [AAVE.USDC, amount, customRecipient, 0],
      })
    );
  });

  test('withdrawFromAave() calls Pool.withdraw()', async () => {
    delete process.env.NEXT_PUBLIC_TREASURY_ADDRESS;
    await loadAaveModule();

    const wallet = createMockWalletClient();
    const amount = BigInt(3_000_000);

    const hash = await withdrawFromAave(wallet as any, amount);

    expect(hash).toBe(MOCK_TX_HASH);
    expect(wallet.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: AAVE.POOL,
        functionName: 'withdraw',
        args: [AAVE.USDC, amount, MOCK_ADDRESS],
        chain: baseSepolia,
      })
    );
  });

  test('getAaveBalance() reads aUSDC balanceOf', async () => {
    delete process.env.NEXT_PUBLIC_TREASURY_ADDRESS;
    await loadAaveModule();

    const mockBalance = BigInt(10_000_000);
    const publicClient = createMockPublicClient(mockBalance);

    const balance = await getAaveBalance(publicClient as any, MOCK_ADDRESS);

    expect(balance).toBe(mockBalance);
    expect(publicClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: AAVE.A_USDC,
        functionName: 'balanceOf',
        args: [MOCK_ADDRESS],
      })
    );
  });

  test('mintFromAaveFaucet() calls faucet.mint()', async () => {
    delete process.env.NEXT_PUBLIC_TREASURY_ADDRESS;
    await loadAaveModule();

    const wallet = createMockWalletClient();
    const amount = BigInt(100_000_000);

    const hash = await mintFromAaveFaucet(wallet as any, amount);

    expect(hash).toBe(MOCK_TX_HASH);
    expect(wallet.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: AAVE.FAUCET,
        functionName: 'mint',
        args: [AAVE.USDC, MOCK_ADDRESS, amount],
        chain: baseSepolia,
      })
    );
  });
});

// ----- A.2: Compound V3 -----

describe('Phase A.2 — Compound V3', () => {
  let supplyToCompound: typeof import('@/lib/protocols/compound').supplyToCompound;
  let withdrawFromCompound: typeof import('@/lib/protocols/compound').withdrawFromCompound;
  let getCompoundBalance: typeof import('@/lib/protocols/compound').getCompoundBalance;

  beforeAll(async () => {
    const mod = await import('@/lib/protocols/compound');
    supplyToCompound = mod.supplyToCompound;
    withdrawFromCompound = mod.withdrawFromCompound;
    getCompoundBalance = mod.getCompoundBalance;
  });

  test('supplyToCompound() calls approve then supply', async () => {
    const wallet = createMockWalletClient();
    const pub = createMockPublicClient();
    const amount = BigInt(1_000_000);

    const hash = await supplyToCompound(wallet as any, pub as any, amount);

    expect(hash).toBe(MOCK_TX_HASH);
    expect(wallet.writeContract).toHaveBeenCalledTimes(2);

    // Approve: ERC20.approve(Comet, amount)
    expect(wallet.writeContract).toHaveBeenNthCalledWith(1,
      expect.objectContaining({
        address: CIRCLE_USDC.SEPOLIA,
        functionName: 'approve',
        args: [COMPOUND.COMET_USDC, amount],
        chain: sepolia,
      })
    );

    // Supply: Comet.supply(USDC, amount)
    expect(wallet.writeContract).toHaveBeenNthCalledWith(2,
      expect.objectContaining({
        address: COMPOUND.COMET_USDC,
        functionName: 'supply',
        args: [CIRCLE_USDC.SEPOLIA, amount],
        chain: sepolia,
      })
    );
  });

  test('supplyToCompound() uses Circle USDC on Sepolia', async () => {
    const wallet = createMockWalletClient();
    const pub = createMockPublicClient();
    const amount = BigInt(500_000);

    await supplyToCompound(wallet as any, pub as any, amount);

    // Verify the token approved is Circle USDC on Sepolia
    expect(wallet.writeContract).toHaveBeenNthCalledWith(1,
      expect.objectContaining({
        address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      })
    );
  });

  test('withdrawFromCompound() calls Comet.withdraw()', async () => {
    const wallet = createMockWalletClient();
    const amount = BigInt(2_000_000);

    const hash = await withdrawFromCompound(wallet as any, amount);

    expect(hash).toBe(MOCK_TX_HASH);
    expect(wallet.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: COMPOUND.COMET_USDC,
        functionName: 'withdraw',
        args: [CIRCLE_USDC.SEPOLIA, amount],
        chain: sepolia,
      })
    );
  });

  test('getCompoundBalance() reads Comet.balanceOf', async () => {
    const mockBalance = BigInt(5_000_000);
    const publicClient = createMockPublicClient(mockBalance);

    const balance = await getCompoundBalance(publicClient as any, MOCK_ADDRESS);

    expect(balance).toBe(mockBalance);
    expect(publicClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: COMPOUND.COMET_USDC,
        functionName: 'balanceOf',
        args: [MOCK_ADDRESS],
      })
    );
  });
});

// ----- A.3: Morpho Blue -----

describe('Phase A.3 — Morpho Blue', () => {
  let supplyToMorpho: typeof import('@/lib/protocols/morpho').supplyToMorpho;
  let withdrawFromMorpho: typeof import('@/lib/protocols/morpho').withdrawFromMorpho;

  beforeAll(async () => {
    const mod = await import('@/lib/protocols/morpho');
    supplyToMorpho = mod.supplyToMorpho;
    withdrawFromMorpho = mod.withdrawFromMorpho;
  });

  test('supplyToMorpho() calls approve then supply with market params', async () => {
    const wallet = createMockWalletClient();
    const pub = createMockPublicClient();
    const amount = BigInt(3_000_000);

    const hash = await supplyToMorpho(wallet as any, pub as any, amount);

    expect(hash).toBe(MOCK_TX_HASH);
    expect(wallet.writeContract).toHaveBeenCalledTimes(2);

    // Approve Morpho Core
    expect(wallet.writeContract).toHaveBeenNthCalledWith(1,
      expect.objectContaining({
        address: CIRCLE_USDC.SEPOLIA,
        functionName: 'approve',
        args: [MORPHO.CORE, amount],
        chain: sepolia,
      })
    );

    // Supply with full market params tuple
    expect(wallet.writeContract).toHaveBeenNthCalledWith(2,
      expect.objectContaining({
        address: MORPHO.CORE,
        functionName: 'supply',
        args: [
          {
            loanToken: MORPHO.MARKET_PARAMS.loanToken,
            collateralToken: MORPHO.MARKET_PARAMS.collateralToken,
            oracle: MORPHO.MARKET_PARAMS.oracle,
            irm: MORPHO.MARKET_PARAMS.irm,
            lltv: MORPHO.MARKET_PARAMS.lltv,
          },
          amount,
          BigInt(0),
          MOCK_ADDRESS,
          '0x',
        ],
        chain: sepolia,
      })
    );
  });

  test('supplyToMorpho() uses onBehalf when provided', async () => {
    const wallet = createMockWalletClient();
    const pub = createMockPublicClient();
    const amount = BigInt(1_000_000);
    const customRecipient = '0xCustomRecipient00000000000000000000000001' as `0x${string}`;

    await supplyToMorpho(wallet as any, pub as any, amount, customRecipient);

    // Supply should use custom recipient for onBehalf
    expect(wallet.writeContract).toHaveBeenNthCalledWith(2,
      expect.objectContaining({
        functionName: 'supply',
        args: expect.arrayContaining([
          expect.any(Object), // market params
          amount,
          BigInt(0),
          customRecipient,
          '0x',
        ]),
      })
    );
  });

  test('supplyToMorpho() passes empty callback data (0x)', async () => {
    const wallet = createMockWalletClient();
    const pub = createMockPublicClient();
    const amount = BigInt(1_000_000);

    await supplyToMorpho(wallet as any, pub as any, amount);

    const supplyCall = wallet.writeContract.mock.calls[1][0];
    // Last arg in the supply args array should be '0x'
    expect(supplyCall.args[4]).toBe('0x');
  });

  test('withdrawFromMorpho() calls withdraw with correct args', async () => {
    const wallet = createMockWalletClient();
    const amount = BigInt(2_000_000);

    const hash = await withdrawFromMorpho(wallet as any, amount);

    expect(hash).toBe(MOCK_TX_HASH);
    expect(wallet.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: MORPHO.CORE,
        functionName: 'withdraw',
        args: [
          {
            loanToken: MORPHO.MARKET_PARAMS.loanToken,
            collateralToken: MORPHO.MARKET_PARAMS.collateralToken,
            oracle: MORPHO.MARKET_PARAMS.oracle,
            irm: MORPHO.MARKET_PARAMS.irm,
            lltv: MORPHO.MARKET_PARAMS.lltv,
          },
          amount,
          BigInt(0),
          MOCK_ADDRESS,    // onBehalf = caller
          MOCK_ADDRESS,    // receiver = caller (default)
        ],
        chain: sepolia,
      })
    );
  });
});

// ----- A.4: Uniswap V3 -----

describe('Phase A.4 — Uniswap V3', () => {
  let swapOnUniswap: typeof import('@/lib/protocols/uniswap').swapOnUniswap;

  beforeAll(async () => {
    const mod = await import('@/lib/protocols/uniswap');
    swapOnUniswap = mod.swapOnUniswap;
  });

  test('swapOnUniswap() calls approve then exactInputSingle', async () => {
    const wallet = createMockWalletClient();
    const pub = createMockPublicClient();
    const amount = BigInt(10_000_000);

    const hash = await swapOnUniswap(wallet as any, pub as any, amount);

    expect(hash).toBe(MOCK_TX_HASH);
    expect(wallet.writeContract).toHaveBeenCalledTimes(2);

    // Approve SwapRouter
    expect(wallet.writeContract).toHaveBeenNthCalledWith(1,
      expect.objectContaining({
        address: CIRCLE_USDC.SEPOLIA,
        functionName: 'approve',
        args: [UNISWAP.ROUTER, amount],
        chain: sepolia,
      })
    );

    // Swap
    expect(wallet.writeContract).toHaveBeenNthCalledWith(2,
      expect.objectContaining({
        address: UNISWAP.ROUTER,
        functionName: 'exactInputSingle',
        chain: sepolia,
      })
    );
  });

  test('swapOnUniswap() uses 0.3% fee tier (3000)', async () => {
    const wallet = createMockWalletClient();
    const pub = createMockPublicClient();
    const amount = BigInt(5_000_000);

    await swapOnUniswap(wallet as any, pub as any, amount);

    const swapCall = wallet.writeContract.mock.calls[1][0];
    expect(swapCall.args[0].fee).toBe(3000);
  });

  test('swapOnUniswap() sets amountOutMinimum and sqrtPriceLimitX96 to 0', async () => {
    const wallet = createMockWalletClient();
    const pub = createMockPublicClient();
    const amount = BigInt(5_000_000);

    await swapOnUniswap(wallet as any, pub as any, amount);

    const swapCall = wallet.writeContract.mock.calls[1][0];
    const params = swapCall.args[0];
    expect(params.amountOutMinimum).toBe(BigInt(0));
    expect(params.sqrtPriceLimitX96).toBe(BigInt(0));
    expect(params.tokenIn).toBe(CIRCLE_USDC.SEPOLIA);
    expect(params.tokenOut).toBe(WETH.SEPOLIA);
    expect(params.recipient).toBe(MOCK_ADDRESS);
    expect(params.amountIn).toBe(amount);
  });
});

// ----- A.5: Error Handling -----

describe('Phase A.5 — Error Handling', () => {
  test('all supply functions throw when walletClient.account is null', async () => {
    const walletNoAccount = { account: null, writeContract: jest.fn() };
    const pub = createMockPublicClient();
    const amount = BigInt(1_000_000);

    const { supplyToAaveDirect } = await import('@/lib/protocols/aave');
    const { supplyToCompound } = await import('@/lib/protocols/compound');
    const { supplyToMorpho } = await import('@/lib/protocols/morpho');
    const { swapOnUniswap } = await import('@/lib/protocols/uniswap');

    await expect(supplyToAaveDirect(walletNoAccount as any, pub as any, amount)).rejects.toThrow('Wallet not connected');
    await expect(supplyToCompound(walletNoAccount as any, pub as any, amount)).rejects.toThrow('Wallet not connected');
    await expect(supplyToMorpho(walletNoAccount as any, pub as any, amount)).rejects.toThrow('Wallet not connected');
    await expect(swapOnUniswap(walletNoAccount as any, pub as any, amount)).rejects.toThrow('Wallet not connected');
  });

  test('settleAaveViaTreasury() throws when treasury not deployed', async () => {
    delete process.env.NEXT_PUBLIC_TREASURY_ADDRESS;
    jest.resetModules();

    const { settleAaveViaTreasury } = await import('@/lib/protocols/aave');
    const wallet = createMockWalletClient();
    const amount = BigInt(1_000_000);

    await expect(
      settleAaveViaTreasury(wallet as any, MOCK_ADDRESS, amount)
    ).rejects.toThrow('Treasury contract not deployed');
  });

  test('supplyToCompound() propagates writeContract rejection', async () => {
    const { supplyToCompound } = await import('@/lib/protocols/compound');
    const wallet = createMockWalletClient();
    const pub = createMockPublicClient();
    // First call (approve) succeeds, second call (supply) fails
    wallet.writeContract
      .mockResolvedValueOnce(MOCK_TX_HASH)
      .mockRejectedValueOnce(new Error('Supply reverted'));

    const amount = BigInt(1_000_000);

    await expect(supplyToCompound(wallet as any, pub as any, amount)).rejects.toThrow('Supply reverted');
  });

  test('supplyToAaveDirect() propagates error if supply fails after approve', async () => {
    delete process.env.NEXT_PUBLIC_TREASURY_ADDRESS;
    jest.resetModules();

    const { supplyToAaveDirect } = await import('@/lib/protocols/aave');
    const wallet = createMockWalletClient();
    const pub = createMockPublicClient();
    wallet.writeContract
      .mockResolvedValueOnce(MOCK_TX_HASH) // approve succeeds
      .mockRejectedValueOnce(new Error('Supply reverted')); // supply fails

    await expect(supplyToAaveDirect(wallet as any, pub as any, BigInt(1_000_000))).rejects.toThrow('Supply reverted');
    // Approve was still called
    expect(wallet.writeContract).toHaveBeenCalledTimes(2);
  });

  test('withdrawFromMorpho() propagates writeContract rejection', async () => {
    const { withdrawFromMorpho } = await import('@/lib/protocols/morpho');
    const wallet = createMockWalletClient();
    wallet.writeContract.mockRejectedValue(new Error('Withdraw failed'));

    await expect(
      withdrawFromMorpho(wallet as any, BigInt(1_000_000))
    ).rejects.toThrow('Withdraw failed');
  });
});
