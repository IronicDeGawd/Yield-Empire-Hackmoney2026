/**
 * Live APY Fetching Tests
 *
 * Tests the rate-fetching functions (getAaveSupplyAPY, getCompoundSupplyAPY),
 * the useProtocolRates hook (fallback, live updates, error recovery),
 * and the upgrade cost system (getUpgradeCost).
 */

import { PROTOCOL_ADDRESSES } from '@/lib/protocols/addresses';
import { AAVE_POOL_ABI } from '@/lib/protocols/abis';
import { BUILDING_CONFIGS, BASE_UPGRADE_COST, UPGRADE_COST_MULTIPLIER, getUpgradeCost } from '@/lib/constants';

// Mock wagmi/chains to avoid ESM parse issues
jest.mock('wagmi/chains', () => ({
  baseSepolia: { id: 84532, name: 'Base Sepolia' },
  sepolia: { id: 11155111, name: 'Sepolia' },
}));

const { AAVE, COMPOUND } = PROTOCOL_ADDRESSES;

// ----- Mock publicClient factory -----

function createMockPublicClient(responses?: Record<string, unknown>) {
  return {
    readContract: jest.fn().mockImplementation(({ functionName }: { functionName: string }) => {
      if (responses && functionName in responses) {
        const val = responses[functionName];
        if (val instanceof Error) return Promise.reject(val);
        return Promise.resolve(val);
      }
      return Promise.resolve(BigInt(0));
    }),
  };
}

// =====================================================================
// Section 1: getAaveSupplyAPY
// =====================================================================

describe('getAaveSupplyAPY', () => {
  // Use requireActual to get the real implementation (not the jest.mock override)
  const { getAaveSupplyAPY } = jest.requireActual('@/lib/protocols/aave') as typeof import('@/lib/protocols/aave');

  test('converts RAY currentLiquidityRate to APY percentage', async () => {
    // 3.45% APY in RAY = 0.0345 * 1e27 = 3.45e25
    const rate = BigInt('34500000000000000000000000'); // 3.45e25
    const mockClient = createMockPublicClient({
      getReserveData: { currentLiquidityRate: rate },
    });

    const apy = await getAaveSupplyAPY(mockClient as any);

    // 3.45e25 * 10000 / 1e27 = 345 bps, / 100 = 3.45%
    expect(apy).toBe(3.45);
  });

  test('calls readContract with correct pool address and USDC asset', async () => {
    const mockClient = createMockPublicClient({
      getReserveData: { currentLiquidityRate: BigInt(0) },
    });

    await getAaveSupplyAPY(mockClient as any);

    expect(mockClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: AAVE.POOL,
        abi: AAVE_POOL_ABI,
        functionName: 'getReserveData',
        args: [AAVE.USDC],
      }),
    );
  });

  test('returns 0 when currentLiquidityRate is 0', async () => {
    const mockClient = createMockPublicClient({
      getReserveData: { currentLiquidityRate: BigInt(0) },
    });

    const apy = await getAaveSupplyAPY(mockClient as any);
    expect(apy).toBe(0);
  });

  test('handles high APY values correctly', async () => {
    // 12.50% APY = 1.25e26
    const rate = BigInt('125000000000000000000000000');
    const mockClient = createMockPublicClient({
      getReserveData: { currentLiquidityRate: rate },
    });

    const apy = await getAaveSupplyAPY(mockClient as any);
    expect(apy).toBe(12.5);
  });

  test('propagates RPC errors', async () => {
    const mockClient = createMockPublicClient({
      getReserveData: new Error('RPC timeout'),
    });

    await expect(getAaveSupplyAPY(mockClient as any)).rejects.toThrow('RPC timeout');
  });
});

// =====================================================================
// Section 2: getCompoundSupplyAPY
// =====================================================================

describe('getCompoundSupplyAPY', () => {
  const { getCompoundSupplyAPY } = jest.requireActual('@/lib/protocols/compound') as typeof import('@/lib/protocols/compound');

  test('converts per-second supply rate to APY percentage', async () => {
    // 4% APY → per-second rate = 0.04 / 31536000 * 1e18 ≈ 1268391679 (1.268e9)
    const utilization = BigInt('800000000000000000'); // 80% utilization
    const ratePerSecond = BigInt('1268391679'); // ~4% APY

    const mockClient = createMockPublicClient({
      getUtilization: utilization,
      getSupplyRate: ratePerSecond,
    });

    const apy = await getCompoundSupplyAPY(mockClient as any);

    // 1268391679 * 31536000 / 1e18 * 100 ≈ 4.0%
    expect(apy).toBeCloseTo(4.0, 0);
  });

  test('calls getUtilization first, then getSupplyRate with that value', async () => {
    const utilization = BigInt('500000000000000000'); // 50%
    const mockClient = createMockPublicClient({
      getUtilization: utilization,
      getSupplyRate: BigInt(0),
    });

    await getCompoundSupplyAPY(mockClient as any);

    // First call: getUtilization (no args)
    expect(mockClient.readContract).toHaveBeenNthCalledWith(1,
      expect.objectContaining({
        address: COMPOUND.COMET_USDC,
        functionName: 'getUtilization',
      }),
    );

    // Second call: getSupplyRate with utilization from first call
    expect(mockClient.readContract).toHaveBeenNthCalledWith(2,
      expect.objectContaining({
        address: COMPOUND.COMET_USDC,
        functionName: 'getSupplyRate',
        args: [utilization],
      }),
    );
  });

  test('returns 0 when supply rate is 0', async () => {
    const mockClient = createMockPublicClient({
      getUtilization: BigInt(0),
      getSupplyRate: BigInt(0),
    });

    const apy = await getCompoundSupplyAPY(mockClient as any);
    expect(apy).toBe(0);
  });

  test('propagates RPC errors from getUtilization', async () => {
    const mockClient = createMockPublicClient({
      getUtilization: new Error('Network error'),
    });

    await expect(getCompoundSupplyAPY(mockClient as any)).rejects.toThrow('Network error');
  });

  test('propagates RPC errors from getSupplyRate', async () => {
    const mockClient = createMockPublicClient({
      getUtilization: BigInt('500000000000000000'),
      getSupplyRate: new Error('Rate unavailable'),
    });

    await expect(getCompoundSupplyAPY(mockClient as any)).rejects.toThrow('Rate unavailable');
  });
});

// =====================================================================
// Section 3: useProtocolRates hook
// =====================================================================

// Mock wagmi's usePublicClient
const mockBaseSepoliaClient = createMockPublicClient();
const mockSepoliaClient = createMockPublicClient();

jest.mock('wagmi', () => ({
  usePublicClient: jest.fn(({ chainId }: { chainId: number }) => {
    if (chainId === 84532) return mockBaseSepoliaClient;
    if (chainId === 11155111) return mockSepoliaClient;
    return null;
  }),
}));

// Mock viem to avoid TextEncoder issues in jsdom
jest.mock('viem', () => ({
  formatUnits: jest.fn((value: bigint, decimals: number) => {
    const divisor = BigInt(10 ** decimals);
    const intPart = value / divisor;
    const fracPart = value % divisor;
    if (fracPart === BigInt(0)) return intPart.toString();
    const fracStr = fracPart.toString().padStart(decimals, '0').replace(/0+$/, '');
    return `${intPart}.${fracStr}`;
  }),
}));

// Mock the protocol rate functions directly so we control their behavior
jest.mock('@/lib/protocols/aave', () => {
  const actual = jest.requireActual('@/lib/protocols/aave');
  return {
    ...actual,
    getAaveSupplyAPY: jest.fn(),
  };
});

jest.mock('@/lib/protocols/compound', () => {
  const actual = jest.requireActual('@/lib/protocols/compound');
  return {
    ...actual,
    getCompoundSupplyAPY: jest.fn(),
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderHook, waitFor, act } = require('@testing-library/react');

describe('useProtocolRates hook', () => {
  let useProtocolRates: typeof import('@/hooks/useProtocolRates').useProtocolRates;
  let mockGetAaveAPY: jest.Mock;
  let mockGetCompoundAPY: jest.Mock;

  beforeAll(async () => {
    const hookMod = await import('@/hooks/useProtocolRates');
    useProtocolRates = hookMod.useProtocolRates;

    const aaveMod = await import('@/lib/protocols/aave');
    mockGetAaveAPY = aaveMod.getAaveSupplyAPY as jest.Mock;

    const compoundMod = await import('@/lib/protocols/compound');
    mockGetCompoundAPY = compoundMod.getCompoundSupplyAPY as jest.Mock;
  });

  beforeEach(() => {
    jest.useFakeTimers();
    mockGetAaveAPY.mockReset();
    mockGetCompoundAPY.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('initializes with fallback rates from BUILDING_CONFIGS', () => {
    mockGetAaveAPY.mockResolvedValue(0);
    mockGetCompoundAPY.mockResolvedValue(0);

    const { result } = renderHook(() => useProtocolRates());

    // Before any fetch completes, rates should be fallback values
    expect(result.current.rates.aave.apy).toBe(BUILDING_CONFIGS.aave.baseYield);
    expect(result.current.rates.compound.apy).toBe(BUILDING_CONFIGS.compound.baseYield);
    expect(result.current.rates.uniswap.apy).toBe(BUILDING_CONFIGS.uniswap.baseYield);
    expect(result.current.rates.curve.apy).toBe(BUILDING_CONFIGS.curve.baseYield);
    expect(result.current.rates.yearn.apy).toBe(BUILDING_CONFIGS.yearn.baseYield);
  });

  test('marks Aave and Compound as live when fetch succeeds with non-zero APY', async () => {
    mockGetAaveAPY.mockResolvedValue(3.45);
    mockGetCompoundAPY.mockResolvedValue(2.8);

    const { result } = renderHook(() => useProtocolRates());

    await waitFor(() => {
      expect(result.current.rates.aave.isLive).toBe(true);
    });

    expect(result.current.rates.aave.apy).toBe(3.45);
    expect(result.current.rates.aave.source).toBe('live');

    expect(result.current.rates.compound.apy).toBe(2.8);
    expect(result.current.rates.compound.source).toBe('live');
    expect(result.current.rates.compound.isLive).toBe(true);
  });

  test('keeps fallback when fetched APY is 0 (empty testnet)', async () => {
    mockGetAaveAPY.mockResolvedValue(0);
    mockGetCompoundAPY.mockResolvedValue(0);

    const { result } = renderHook(() => useProtocolRates());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should keep fallback, not mark as live
    expect(result.current.rates.aave.apy).toBe(BUILDING_CONFIGS.aave.baseYield);
    expect(result.current.rates.aave.isLive).toBe(false);
    expect(result.current.rates.aave.source).toBe('estimated');

    expect(result.current.rates.compound.apy).toBe(BUILDING_CONFIGS.compound.baseYield);
    expect(result.current.rates.compound.isLive).toBe(false);
  });

  test('falls back gracefully when RPC call throws', async () => {
    mockGetAaveAPY.mockRejectedValue(new Error('RPC down'));
    mockGetCompoundAPY.mockRejectedValue(new Error('Network error'));

    // Suppress console.warn
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useProtocolRates());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should fall back to BUILDING_CONFIGS values
    expect(result.current.rates.aave.apy).toBe(BUILDING_CONFIGS.aave.baseYield);
    expect(result.current.rates.aave.isLive).toBe(false);
    expect(result.current.rates.compound.apy).toBe(BUILDING_CONFIGS.compound.baseYield);
    expect(result.current.rates.compound.isLive).toBe(false);

    warnSpy.mockRestore();
  });

  test('Uniswap and Yearn always return simulated source', async () => {
    mockGetAaveAPY.mockResolvedValue(3.0);
    mockGetCompoundAPY.mockResolvedValue(2.5);

    const { result } = renderHook(() => useProtocolRates());

    await waitFor(() => {
      expect(result.current.rates.aave.isLive).toBe(true);
    });

    expect(result.current.rates.uniswap.source).toBe('simulated');
    expect(result.current.rates.uniswap.isLive).toBe(false);
    expect(result.current.rates.yearn.source).toBe('simulated');
    expect(result.current.rates.yearn.isLive).toBe(false);
  });

  test('Curve/Morpho returns estimated source', async () => {
    mockGetAaveAPY.mockResolvedValue(3.0);
    mockGetCompoundAPY.mockResolvedValue(2.5);

    const { result } = renderHook(() => useProtocolRates());

    await waitFor(() => {
      expect(result.current.rates.aave.isLive).toBe(true);
    });

    expect(result.current.rates.curve.source).toBe('estimated');
    expect(result.current.rates.curve.isLive).toBe(false);
    expect(result.current.rates.curve.apy).toBe(BUILDING_CONFIGS.curve.baseYield);
  });

  test('sets lastUpdated timestamp on live rates', async () => {
    const before = Date.now();
    mockGetAaveAPY.mockResolvedValue(5.5);
    mockGetCompoundAPY.mockResolvedValue(0);

    const { result } = renderHook(() => useProtocolRates());

    await waitFor(() => {
      expect(result.current.rates.aave.isLive).toBe(true);
    });

    expect(result.current.rates.aave.lastUpdated).toBeGreaterThanOrEqual(before);
  });

  test('exposes refresh function for manual refetch', async () => {
    mockGetAaveAPY.mockResolvedValue(2.0);
    mockGetCompoundAPY.mockResolvedValue(1.5);

    const { result } = renderHook(() => useProtocolRates());

    await waitFor(() => {
      expect(result.current.rates.aave.apy).toBe(2.0);
    });

    // Update mock and manually refresh
    mockGetAaveAPY.mockResolvedValue(4.0);

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.rates.aave.apy).toBe(4.0);
  });
});

// =====================================================================
// Section 4: getUpgradeCost
// =====================================================================

describe('getUpgradeCost', () => {
  test('level 1 upgrade costs BASE_UPGRADE_COST', () => {
    expect(getUpgradeCost(1)).toBe(BASE_UPGRADE_COST);
  });

  test('level 2 upgrade costs BASE * MULTIPLIER', () => {
    const expected = BASE_UPGRADE_COST * UPGRADE_COST_MULTIPLIER;
    expect(getUpgradeCost(2)).toBeCloseTo(expected, 6);
  });

  test('level 5 upgrade costs BASE * MULTIPLIER^4', () => {
    const expected = BASE_UPGRADE_COST * Math.pow(UPGRADE_COST_MULTIPLIER, 4);
    expect(getUpgradeCost(5)).toBeCloseTo(expected, 6);
  });

  test('level 10 upgrade costs BASE * MULTIPLIER^9', () => {
    const expected = BASE_UPGRADE_COST * Math.pow(UPGRADE_COST_MULTIPLIER, 9);
    expect(getUpgradeCost(10)).toBeCloseTo(expected, 6);
  });

  test('cost always increases with level', () => {
    for (let level = 1; level < 20; level++) {
      expect(getUpgradeCost(level + 1)).toBeGreaterThan(getUpgradeCost(level));
    }
  });

  test('cost is always positive', () => {
    for (let level = 1; level <= 50; level++) {
      expect(getUpgradeCost(level)).toBeGreaterThan(0);
    }
  });
});
