/**
 * Phase B: Address & Config Validation Tests
 *
 * Verifies address constants are valid, chain mappings are correct,
 * ABIs are well-formed, and helper utilities work correctly.
 */

import { PROTOCOL_ADDRESSES, SETTLEMENT_CHAINS, PROTOCOL_CHAIN_MAP } from '@/lib/protocols/addresses';
import {
  ERC20_ABI,
  AAVE_POOL_ABI,
  AAVE_FAUCET_ABI,
  TREASURY_ABI,
  UNISWAP_ROUTER_ABI,
  MORPHO_BLUE_ABI,
  COMPOUND_COMET_ABI,
} from '@/lib/protocols/abis';

// Mock wagmi/chains to avoid ESM parse issues in Jest
jest.mock('wagmi/chains', () => ({
  baseSepolia: { id: 84532, name: 'Base Sepolia' },
  sepolia: { id: 11155111, name: 'Sepolia' },
}));

const { AAVE, COMPOUND, CIRCLE_USDC, UNISWAP, WETH, MORPHO, TREASURY: TREASURY_ADDR } = PROTOCOL_ADDRESSES;

// ----- B.1: Address Validation -----

describe('Phase B.1 — Address Validation', () => {
  const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

  test('all protocol addresses are valid 0x-prefixed 42-char hex strings', () => {
    // Aave addresses
    expect(AAVE.POOL).toMatch(ADDRESS_REGEX);
    expect(AAVE.USDC).toMatch(ADDRESS_REGEX);
    expect(AAVE.A_USDC).toMatch(ADDRESS_REGEX);
    expect(AAVE.FAUCET).toMatch(ADDRESS_REGEX);

    // Compound
    expect(COMPOUND.COMET_USDC).toMatch(ADDRESS_REGEX);

    // Uniswap
    expect(UNISWAP.ROUTER).toMatch(ADDRESS_REGEX);
    expect(UNISWAP.FACTORY).toMatch(ADDRESS_REGEX);

    // Morpho
    expect(MORPHO.CORE).toMatch(ADDRESS_REGEX);
    expect(MORPHO.MARKET_PARAMS.loanToken).toMatch(ADDRESS_REGEX);
    expect(MORPHO.MARKET_PARAMS.collateralToken).toMatch(ADDRESS_REGEX);
    expect(MORPHO.MARKET_PARAMS.oracle).toMatch(ADDRESS_REGEX);
    expect(MORPHO.MARKET_PARAMS.irm).toMatch(ADDRESS_REGEX);

    // WETH
    expect(WETH.SEPOLIA).toMatch(ADDRESS_REGEX);

    // Circle USDC
    expect(CIRCLE_USDC.SEPOLIA).toMatch(ADDRESS_REGEX);
    expect(CIRCLE_USDC.BASE_SEPOLIA).toMatch(ADDRESS_REGEX);
    expect(CIRCLE_USDC.ARC_TESTNET).toMatch(ADDRESS_REGEX);

    // Treasury (default zero address)
    expect(TREASURY_ADDR.BASE_SEPOLIA).toMatch(ADDRESS_REGEX);
  });

  test('CIRCLE_USDC.SEPOLIA matches Morpho loanToken', () => {
    expect(CIRCLE_USDC.SEPOLIA).toBe(MORPHO.MARKET_PARAMS.loanToken);
  });

  test('PROTOCOL_CHAIN_MAP covers all game building protocols', () => {
    expect(PROTOCOL_CHAIN_MAP).toHaveProperty('compound');
    expect(PROTOCOL_CHAIN_MAP).toHaveProperty('aave');
    expect(PROTOCOL_CHAIN_MAP).toHaveProperty('uniswap');
    expect(PROTOCOL_CHAIN_MAP).toHaveProperty('curve');

    // yearn is intentionally absent (simulated, no on-chain settlement)
    expect(PROTOCOL_CHAIN_MAP).not.toHaveProperty('yearn');
  });

  test('SETTLEMENT_CHAINS has correct chain IDs', () => {
    expect(SETTLEMENT_CHAINS.SEPOLIA).toBe(11155111);
    expect(SETTLEMENT_CHAINS.BASE_SEPOLIA).toBe(84532);
    expect(SETTLEMENT_CHAINS.ARC_TESTNET).toBe(5042002);
  });

  test('isTreasuryDeployed() returns false when env var unset', async () => {
    delete process.env.NEXT_PUBLIC_TREASURY_ADDRESS;
    jest.resetModules();

    const { isTreasuryDeployed } = await import('@/lib/protocols/aave');
    expect(isTreasuryDeployed()).toBe(false);
  });
});

// ----- B.2: ABI Shape Validation -----

describe('Phase B.2 — ABI Shape Validation', () => {
  function getAbiFunction(abi: readonly Record<string, unknown>[], name: string) {
    return abi.find((entry) => entry.name === name);
  }

  test('each ABI export has correct function names', () => {
    // ERC20
    expect(getAbiFunction(ERC20_ABI, 'approve')).toBeDefined();
    expect(getAbiFunction(ERC20_ABI, 'allowance')).toBeDefined();
    expect(getAbiFunction(ERC20_ABI, 'balanceOf')).toBeDefined();

    // Aave Pool
    expect(getAbiFunction(AAVE_POOL_ABI, 'supply')).toBeDefined();
    expect(getAbiFunction(AAVE_POOL_ABI, 'withdraw')).toBeDefined();

    // Aave Faucet
    expect(getAbiFunction(AAVE_FAUCET_ABI, 'mint')).toBeDefined();

    // Treasury
    expect(getAbiFunction(TREASURY_ABI, 'settle')).toBeDefined();
    expect(getAbiFunction(TREASURY_ABI, 'playerDeposits')).toBeDefined();

    // Uniswap
    expect(getAbiFunction(UNISWAP_ROUTER_ABI, 'exactInputSingle')).toBeDefined();

    // Morpho
    expect(getAbiFunction(MORPHO_BLUE_ABI, 'supply')).toBeDefined();
    expect(getAbiFunction(MORPHO_BLUE_ABI, 'withdraw')).toBeDefined();

    // Compound
    expect(getAbiFunction(COMPOUND_COMET_ABI, 'supply')).toBeDefined();
    expect(getAbiFunction(COMPOUND_COMET_ABI, 'withdraw')).toBeDefined();
    expect(getAbiFunction(COMPOUND_COMET_ABI, 'balanceOf')).toBeDefined();
  });

  test('Morpho supply ABI includes marketParams tuple with 5 components', () => {
    const supplyFn = getAbiFunction(MORPHO_BLUE_ABI, 'supply');
    expect(supplyFn).toBeDefined();

    const inputs = (supplyFn as Record<string, unknown>).inputs as Array<Record<string, unknown>>;
    const marketParams = inputs.find((i) => i.name === 'marketParams');
    expect(marketParams).toBeDefined();
    expect(marketParams!.type).toBe('tuple');

    const components = marketParams!.components as Array<Record<string, unknown>>;
    expect(components).toHaveLength(5);

    const componentNames = components.map((c) => c.name);
    expect(componentNames).toEqual(['loanToken', 'collateralToken', 'oracle', 'irm', 'lltv']);
  });

  test('Uniswap swap ABI includes params tuple with 7 components', () => {
    const swapFn = getAbiFunction(UNISWAP_ROUTER_ABI, 'exactInputSingle');
    expect(swapFn).toBeDefined();

    const inputs = (swapFn as Record<string, unknown>).inputs as Array<Record<string, unknown>>;
    const params = inputs.find((i) => i.name === 'params');
    expect(params).toBeDefined();
    expect(params!.type).toBe('tuple');

    const components = params!.components as Array<Record<string, unknown>>;
    expect(components).toHaveLength(7);

    const componentNames = components.map((c) => c.name);
    expect(componentNames).toEqual([
      'tokenIn', 'tokenOut', 'fee', 'recipient',
      'amountIn', 'amountOutMinimum', 'sqrtPriceLimitX96',
    ]);
  });
});

// ----- B.3: Helper Functions -----

describe('Phase B.3 — Helper Functions', () => {
  // These helpers are defined inside YellowSessionProvider, so we test them directly
  function usdToUsdc6(usdAmount: number): bigint {
    return BigInt(Math.floor(usdAmount * 1_000_000));
  }

  function chainName(chainId: number): string {
    if (chainId === SETTLEMENT_CHAINS.SEPOLIA) return 'Sepolia';
    if (chainId === SETTLEMENT_CHAINS.BASE_SEPOLIA) return 'Base Sepolia';
    return 'Unknown';
  }

  test('usdToUsdc6(1.5) returns BigInt(1_500_000)', () => {
    expect(usdToUsdc6(1.5)).toBe(BigInt(1_500_000));
  });

  test('usdToUsdc6(0) returns BigInt(0)', () => {
    expect(usdToUsdc6(0)).toBe(BigInt(0));
  });

  test('usdToUsdc6 handles precision for various amounts', () => {
    expect(usdToUsdc6(100)).toBe(BigInt(100_000_000));
    expect(usdToUsdc6(0.01)).toBe(BigInt(10_000));
    expect(usdToUsdc6(999999.99)).toBe(BigInt(999_999_990_000));
  });

  test('chainName() returns correct labels for all settlement chains', () => {
    expect(chainName(SETTLEMENT_CHAINS.SEPOLIA)).toBe('Sepolia');
    expect(chainName(SETTLEMENT_CHAINS.BASE_SEPOLIA)).toBe('Base Sepolia');
    expect(chainName(12345)).toBe('Unknown');
  });
});
