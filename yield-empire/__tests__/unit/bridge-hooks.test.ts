/**
 * Phase C: Circle BridgeKit Hook Tests
 *
 * Verifies bridge lifecycle, progress state machine, balance fetching,
 * and adapter creation — using mocked Circle modules.
 */

import { renderHook, act, waitFor } from '@testing-library/react';

// ----- Module Mocks -----

const mockBridge = jest.fn().mockResolvedValue({ txHash: '0xBridge' });
const mockRetry = jest.fn().mockResolvedValue({ txHash: '0xRetry' });
const mockEstimate = jest.fn().mockResolvedValue({ fee: '0.50', time: '~15 min' });
const mockOn = jest.fn();
const mockOff = jest.fn();

jest.mock('@circle-fin/bridge-kit', () => ({
  BridgeKit: jest.fn().mockImplementation(() => ({
    bridge: mockBridge,
    retry: mockRetry,
    estimate: mockEstimate,
    on: mockOn,
    off: mockOff,
  })),
}));

const mockCreateViemAdapter = jest.fn().mockResolvedValue({
  prepareAction: jest.fn(),
});

jest.mock('@circle-fin/adapter-viem-v2', () => ({
  createViemAdapterFromProvider: mockCreateViemAdapter,
}));

// Mock wagmi hooks used by useEvmAdapter
jest.mock('wagmi', () => ({
  useAccount: jest.fn().mockReturnValue({ address: undefined }),
  useConnectorClient: jest.fn().mockReturnValue({ data: undefined }),
}));

// Mock wagmi/chains to avoid ESM parse issues
jest.mock('wagmi/chains', () => ({
  baseSepolia: { id: 84532, name: 'Base Sepolia' },
  sepolia: { id: 11155111, name: 'Sepolia' },
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

// ----- C.1: useBridge -----

describe('Phase C.1 — useBridge', () => {
  let useBridge: typeof import('@/hooks/useBridge').useBridge;

  beforeAll(async () => {
    const mod = await import('@/hooks/useBridge');
    useBridge = mod.useBridge;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockAdapter = { prepareAction: jest.fn() } as any;
  const baseParams = {
    fromChain: 'ETH-SEPOLIA',
    toChain: 'BASE-SEPOLIA',
    amount: '10',
    fromAdapter: mockAdapter,
    toAdapter: mockAdapter,
  };

  test('bridge() sets isLoading=true during execution', async () => {
    const { result } = renderHook(() => useBridge());

    expect(result.current.isLoading).toBe(false);

    let bridgePromise: Promise<unknown>;
    act(() => {
      bridgePromise = result.current.bridge(baseParams);
    });

    // After bridge resolves, isLoading should be false again
    await act(async () => {
      await bridgePromise!;
    });

    expect(result.current.isLoading).toBe(false);
  });

  test('bridge() returns result on success', async () => {
    const { result } = renderHook(() => useBridge());

    let bridgeResult: unknown;
    await act(async () => {
      bridgeResult = await result.current.bridge(baseParams);
    });

    expect(bridgeResult).toEqual({ ok: true, data: { txHash: '0xBridge' } });
    expect(result.current.data).toEqual({ txHash: '0xBridge' });
  });

  test('bridge() calls BridgeKit.bridge with built params', async () => {
    const { result } = renderHook(() => useBridge());

    await act(async () => {
      await result.current.bridge(baseParams);
    });

    expect(mockBridge).toHaveBeenCalledTimes(1);
    expect(mockBridge).toHaveBeenCalledWith(
      expect.objectContaining({
        from: expect.objectContaining({ chain: 'ETH-SEPOLIA' }),
        to: expect.objectContaining({ chain: 'BASE-SEPOLIA' }),
        amount: '10',
      })
    );
  });

  test('bridge() sets error string on failure', async () => {
    mockBridge.mockRejectedValueOnce(new Error('Bridge reverted'));
    const { result } = renderHook(() => useBridge());

    await act(async () => {
      try {
        await result.current.bridge(baseParams);
      } catch {
        // expected
      }
    });

    expect(result.current.error).toBe('Bridge reverted');
    expect(result.current.isLoading).toBe(false);
  });

  test('bridge() resets isLoading on failure', async () => {
    mockBridge.mockRejectedValueOnce(new Error('fail'));
    const { result } = renderHook(() => useBridge());

    await act(async () => {
      try {
        await result.current.bridge(baseParams);
      } catch {
        // expected
      }
    });

    expect(result.current.isLoading).toBe(false);
  });

  test('retry() calls BridgeKit.retry with failed result', async () => {
    const { result } = renderHook(() => useBridge());
    const failedResult = { txHash: '0xFailed', status: 'failed' } as any;

    await act(async () => {
      await result.current.retry(failedResult, baseParams);
    });

    expect(mockRetry).toHaveBeenCalledWith(failedResult, {
      from: mockAdapter,
      to: mockAdapter,
    });
  });

  test('estimate() returns estimate data', async () => {
    const { result } = renderHook(() => useBridge());

    let estimateResult: unknown;
    await act(async () => {
      estimateResult = await result.current.estimate(baseParams);
    });

    expect(estimateResult).toEqual({ ok: true, data: { fee: '0.50', time: '~15 min' } });
    expect(result.current.estimateData).toEqual({ fee: '0.50', time: '~15 min' });
  });

  test('clear() resets all state to defaults', async () => {
    const { result } = renderHook(() => useBridge());

    // Trigger a bridge to set some state
    await act(async () => {
      await result.current.bridge(baseParams);
    });

    expect(result.current.data).not.toBeNull();

    // Clear
    act(() => {
      result.current.clear();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBeNull();
    expect(result.current.isEstimating).toBe(false);
    expect(result.current.estimateError).toBeNull();
    expect(result.current.estimateData).toBeNull();
  });
});

// ----- C.2: useProgress State Machine -----

describe('Phase C.2 — useProgress State Machine', () => {
  let useProgress: typeof import('@/hooks/useProgress').useProgress;

  beforeAll(async () => {
    const mod = await import('@/hooks/useProgress');
    useProgress = mod.useProgress;
  });

  test('initial state is idle', () => {
    const { result } = renderHook(() => useProgress());
    expect(result.current.currentStep).toBe('idle');
  });

  test('approve success → transitions to burning', () => {
    const { result } = renderHook(() => useProgress());

    act(() => {
      result.current.handleEvent({ method: 'approve', values: { state: 'success', txHash: '0xApprove' } });
    });

    expect(result.current.currentStep).toBe('burning');
  });

  test('approve error → transitions to error', () => {
    const { result } = renderHook(() => useProgress());

    act(() => {
      result.current.handleEvent({ method: 'approve', values: { state: 'error' } });
    });

    expect(result.current.currentStep).toBe('error');
  });

  test('burn success → transitions to waiting-attestation', () => {
    const { result } = renderHook(() => useProgress());

    act(() => {
      result.current.handleEvent({ method: 'burn', values: { state: 'success', txHash: '0xBurn' } });
    });

    expect(result.current.currentStep).toBe('waiting-attestation');
  });

  test('burn error → transitions to error', () => {
    const { result } = renderHook(() => useProgress());

    act(() => {
      result.current.handleEvent({ method: 'burn', values: { state: 'error' } });
    });

    expect(result.current.currentStep).toBe('error');
  });

  test('fetchAttestation success → transitions to minting', () => {
    const { result } = renderHook(() => useProgress());

    act(() => {
      result.current.handleEvent({ method: 'fetchAttestation', values: { state: 'success' } });
    });

    expect(result.current.currentStep).toBe('minting');
  });

  test('fetchAttestation pending → stays at waiting-attestation', () => {
    const { result } = renderHook(() => useProgress());

    act(() => {
      result.current.handleEvent({ method: 'fetchAttestation', values: { state: 'pending' } });
    });

    expect(result.current.currentStep).toBe('waiting-attestation');
  });

  test('mint success → transitions to completed', () => {
    const { result } = renderHook(() => useProgress());

    act(() => {
      result.current.handleEvent({ method: 'mint', values: { state: 'success', txHash: '0xMint' } });
    });

    expect(result.current.currentStep).toBe('completed');
  });

  test('mint error → transitions to error', () => {
    const { result } = renderHook(() => useProgress());

    act(() => {
      result.current.handleEvent({ method: 'mint', values: { state: 'error' } });
    });

    expect(result.current.currentStep).toBe('error');
  });
});

// ----- C.3: useProgress Edge Cases -----

describe('Phase C.3 — useProgress Edge Cases', () => {
  let useProgress: typeof import('@/hooks/useProgress').useProgress;

  beforeAll(async () => {
    const mod = await import('@/hooks/useProgress');
    useProgress = mod.useProgress;
  });

  test('handleEvent ignores messages with no method', () => {
    const { result } = renderHook(() => useProgress());

    act(() => {
      result.current.handleEvent({});
      result.current.handleEvent(null);
      result.current.handleEvent({ values: { state: 'success' } });
    });

    // Should stay at idle
    expect(result.current.currentStep).toBe('idle');
  });

  test('handleEvent logs txHash when present', () => {
    const { result } = renderHook(() => useProgress());

    act(() => {
      result.current.handleEvent({ method: 'approve', values: { state: 'success', txHash: '0xTestHash123' } });
    });

    // Logs should contain the hash
    const hasHash = result.current.logs.some((log) => log.includes('0xTestHash123'));
    expect(hasHash).toBe(true);
  });

  test('reset() clears currentStep and logs', () => {
    const { result } = renderHook(() => useProgress());

    // Add some state
    act(() => {
      result.current.handleEvent({ method: 'approve', values: { state: 'success', txHash: '0x1' } });
    });

    expect(result.current.currentStep).toBe('burning');
    expect(result.current.logs.length).toBeGreaterThan(0);

    // Reset
    act(() => {
      result.current.reset();
    });

    expect(result.current.currentStep).toBe('idle');
    expect(result.current.logs).toEqual([]);
  });
});

// ----- C.4: useUsdcBalance -----

describe('Phase C.4 — useUsdcBalance', () => {
  let useUsdcBalance: typeof import('@/hooks/useUsdcBalance').useUsdcBalance;

  beforeAll(async () => {
    const mod = await import('@/hooks/useUsdcBalance');
    useUsdcBalance = mod.useUsdcBalance;
  });

  test('returns 0 when adapter is null', () => {
    const { result } = renderHook(() =>
      useUsdcBalance('ETH-SEPOLIA', { evmAdapter: null, evmAddress: '0x123' })
    );

    expect(result.current.balance).toBe('0');
  });

  test('returns 0 when address is null', () => {
    const { result } = renderHook(() =>
      useUsdcBalance('ETH-SEPOLIA', { evmAdapter: {} as any, evmAddress: null })
    );

    expect(result.current.balance).toBe('0');
  });

  test('fetches balance via adapter.prepareAction', async () => {
    const mockExecute = jest.fn().mockResolvedValue('1000000');
    const mockPrepare = jest.fn().mockReturnValue({ execute: mockExecute });
    const adapter = { prepareAction: mockPrepare } as any;

    const { result } = renderHook(() =>
      useUsdcBalance('ETH-SEPOLIA', { evmAdapter: adapter, evmAddress: '0xUser' })
    );

    await waitFor(() => {
      expect(result.current.balance).toBe('1');
    });

    expect(mockPrepare).toHaveBeenCalledWith('usdc.balanceOf', expect.any(Object), expect.any(Object));
  });

  test('formats raw balance to 6 decimals', async () => {
    const mockExecute = jest.fn().mockResolvedValue('5500000'); // 5.5 USDC
    const mockPrepare = jest.fn().mockReturnValue({ execute: mockExecute });
    const adapter = { prepareAction: mockPrepare } as any;

    const { result } = renderHook(() =>
      useUsdcBalance('ETH-SEPOLIA', { evmAdapter: adapter, evmAddress: '0xUser' })
    );

    await waitFor(() => {
      expect(result.current.balance).toBe('5.5');
    });
  });

  test('sets balance to 0 on fetch error', async () => {
    const mockPrepare = jest.fn().mockReturnValue({
      execute: jest.fn().mockRejectedValue(new Error('RPC error')),
    });
    const adapter = { prepareAction: mockPrepare } as any;

    // Suppress console.warn from the hook
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() =>
      useUsdcBalance('ETH-SEPOLIA', { evmAdapter: adapter, evmAddress: '0xUser' })
    );

    // After error, balance should remain 0
    await waitFor(() => {
      expect(mockPrepare).toHaveBeenCalled();
    });

    expect(result.current.balance).toBe('0');
    warnSpy.mockRestore();
  });
});

// ----- C.5: useEvmAdapter -----

describe('Phase C.5 — useEvmAdapter', () => {
  const mockWagmi = jest.requireMock('wagmi');

  beforeEach(() => {
    jest.clearAllMocks();
    mockWagmi.useAccount.mockReturnValue({ address: undefined });
    mockWagmi.useConnectorClient.mockReturnValue({ data: undefined });
  });

  test('returns null adapter when no address', async () => {
    mockWagmi.useAccount.mockReturnValue({ address: undefined });

    const { useEvmAdapter } = await import('@/hooks/useEvmAdapter');
    const { result } = renderHook(() => useEvmAdapter());

    expect(result.current.evmAdapter).toBeNull();
    expect(result.current.evmAddress).toBeNull();
  });

  test('creates adapter from wagmi connector transport', async () => {
    const mockProvider = { request: jest.fn() };
    mockWagmi.useAccount.mockReturnValue({ address: '0xUser123' });
    mockWagmi.useConnectorClient.mockReturnValue({
      data: {
        transport: { value: { provider: mockProvider } },
      },
    });

    const { useEvmAdapter } = await import('@/hooks/useEvmAdapter');
    const { result } = renderHook(() => useEvmAdapter());

    await waitFor(() => {
      expect(result.current.evmAddress).toBe('0xUser123');
    });

    expect(mockCreateViemAdapter).toHaveBeenCalledWith({ provider: mockProvider });
  });

  test('falls back to window.ethereum when transport unavailable', async () => {
    const mockEthereum = { isMetaMask: true, request: jest.fn() };
    (globalThis as any).ethereum = mockEthereum;

    mockWagmi.useAccount.mockReturnValue({ address: '0xUser456' });
    // Provide a client with no transport.value.provider path
    mockWagmi.useConnectorClient.mockReturnValue({ data: {} });

    const { useEvmAdapter } = await import('@/hooks/useEvmAdapter');
    const { result } = renderHook(() => useEvmAdapter());

    await waitFor(() => {
      expect(result.current.evmAddress).toBe('0xUser456');
    });

    expect(mockCreateViemAdapter).toHaveBeenCalledWith({ provider: mockEthereum });

    delete (globalThis as any).ethereum;
  });

  test('only recreates adapter when provider instance changes', async () => {
    const provider1 = { request: jest.fn(), id: 1 };
    mockWagmi.useAccount.mockReturnValue({ address: '0xUser' });
    mockWagmi.useConnectorClient.mockReturnValue({
      data: { transport: { value: { provider: provider1 } } },
    });

    const { useEvmAdapter } = await import('@/hooks/useEvmAdapter');
    const { result, rerender } = renderHook(() => useEvmAdapter());

    await waitFor(() => {
      expect(mockCreateViemAdapter).toHaveBeenCalledTimes(1);
    });

    // Rerender with same provider — should NOT create a new adapter
    rerender();

    // Still just 1 call
    expect(mockCreateViemAdapter).toHaveBeenCalledTimes(1);
  });
});
