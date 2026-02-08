/**
 * Phase D: Settlement Execution Integration Tests
 *
 * Tests the full settleSession() flow in YellowSessionProvider:
 * close Yellow Network channel → execute protocol transactions per building.
 *
 * Mocks all protocol functions and the YellowSessionManager at module level.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import React, { useContext, type ReactNode } from 'react';
import type { GameEntity } from '@/lib/types';
import { SETTLEMENT_CHAINS } from '@/lib/protocols/addresses';

// ----- Module Mocks -----

const mockSupplyToCompound = jest.fn().mockResolvedValue('0xCompoundHash');
const mockSupplyToAave = jest.fn().mockResolvedValue('0xAaveHash');
const mockSwapOnUniswap = jest.fn().mockResolvedValue('0xUniswapHash');
const mockSupplyToMorpho = jest.fn().mockResolvedValue('0xMorphoHash');

jest.mock('@/lib/protocols/compound', () => ({
  supplyToCompound: (...args: unknown[]) => mockSupplyToCompound(...args),
}));
jest.mock('@/lib/protocols/aave', () => ({
  supplyToAave: (...args: unknown[]) => mockSupplyToAave(...args),
}));
jest.mock('@/lib/protocols/uniswap', () => ({
  swapOnUniswap: (...args: unknown[]) => mockSwapOnUniswap(...args),
}));
jest.mock('@/lib/protocols/morpho', () => ({
  supplyToMorpho: (...args: unknown[]) => mockSupplyToMorpho(...args),
}));

const mockUpdatePlayerProfile = jest.fn().mockResolvedValue([]);
jest.mock('@/lib/ens/guild-manager', () => ({
  updatePlayerProfile: (...args: unknown[]) => mockUpdatePlayerProfile(...args),
}));

// Mock YellowSessionManager
const mockManagerSettleSession = jest.fn().mockResolvedValue(undefined);
const mockManagerDisconnect = jest.fn();

jest.mock('@/lib/yellow/session-manager', () => ({
  YellowSessionManager: jest.fn().mockImplementation((onStateChange: (state: any) => void) => {
    // Immediately set connected + active state
    setTimeout(() => onStateChange({
      isConnected: true,
      isSessionActive: true,
      actionCount: 5,
      gasSaved: 2.50,
      sessionId: 'test-session-123',
      actionBreakdown: { deposit: 3, compound: 2 },
    }), 0);

    return {
      connect: jest.fn(),
      createGameSession: jest.fn(),
      submitGameAction: jest.fn(),
      settleSession: mockManagerSettleSession,
      disconnect: mockManagerDisconnect,
    };
  }),
}));

// Mock wagmi hooks
const mockWalletClient = {
  account: { address: '0xPlayer0000000000000000000000000000000001' },
  writeContract: jest.fn().mockResolvedValue('0xTxHash'),
};

const mockSwitchChainAsync = jest.fn().mockResolvedValue(undefined);
const mockPublicClient = {
  readContract: jest.fn().mockResolvedValue(BigInt(0)),
  waitForTransactionReceipt: jest.fn().mockResolvedValue({ status: 'success' }),
};

jest.mock('wagmi', () => ({
  useAccount: jest.fn().mockReturnValue({
    address: '0xPlayer0000000000000000000000000000000001',
    isConnected: true,
  }),
  useWalletClient: jest.fn().mockReturnValue({ data: mockWalletClient }),
  usePublicClient: jest.fn().mockReturnValue(mockPublicClient),
  useSwitchChain: jest.fn().mockReturnValue({ switchChainAsync: mockSwitchChainAsync }),
}));

// ----- Test Helpers -----

function createEntity(overrides: Partial<GameEntity> & { protocol: GameEntity['protocol'] }): GameEntity {
  return {
    id: `e-${overrides.protocol}`,
    type: 'bank',
    name: overrides.protocol.toUpperCase(),
    level: 1,
    yieldRate: 5,
    deposited: 100,
    position: { x: 0, y: 0 },
    color: '#fff',
    ...overrides,
  };
}

/** Convert USD amount to USDC 6-decimal bigint (mirrors YellowSessionProvider) */
function usdToUsdc6(usdAmount: number): bigint {
  return BigInt(Math.floor(usdAmount * 1_000_000));
}

// ----- Load provider and context -----

let YellowSessionProvider: React.FC<{ children: ReactNode }>;
let YellowSessionContext: React.Context<any>;

beforeAll(async () => {
  const mod = await import('@/components/providers/YellowSessionProvider');
  YellowSessionProvider = mod.YellowSessionProvider;
  YellowSessionContext = mod.YellowSessionContext;
});

function useTestContext() {
  return useContext(YellowSessionContext);
}

function renderWithProvider() {
  return renderHook(() => useTestContext(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      React.createElement(YellowSessionProvider, null, children),
  });
}

// ----- Reset between tests -----

beforeEach(() => {
  jest.clearAllMocks();
  mockSupplyToCompound.mockResolvedValue('0xCompoundHash');
  mockSupplyToAave.mockResolvedValue('0xAaveHash');
  mockSwapOnUniswap.mockResolvedValue('0xUniswapHash');
  mockSupplyToMorpho.mockResolvedValue('0xMorphoHash');
  mockManagerSettleSession.mockResolvedValue(undefined);
  mockSwitchChainAsync.mockResolvedValue(undefined);
});

// ----- D.1: Happy Path Settlement -----

describe('Phase D.1 — Happy Path Settlement', () => {
  test('settleSession() closes Yellow Network session first', async () => {
    const { result } = renderWithProvider();

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const entities = [createEntity({ protocol: 'compound', deposited: 50 })];

    await act(async () => {
      await result.current.settleSession(entities);
    });

    expect(mockManagerSettleSession).toHaveBeenCalledTimes(1);
    expect(mockManagerSettleSession).toHaveBeenCalledWith(
      '0xPlayer0000000000000000000000000000000001',
      [],
    );
  });

  test('settleSession() executes protocol tx for each entity with deposits > 0', async () => {
    const { result } = renderWithProvider();

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const entities = [
      createEntity({ protocol: 'compound', deposited: 50 }),
      createEntity({ protocol: 'aave', deposited: 30 }),
      createEntity({ protocol: 'uniswap', deposited: 20 }),
      createEntity({ protocol: 'curve', deposited: 10 }),
    ];

    await act(async () => {
      await result.current.settleSession(entities);
    });

    expect(mockSupplyToCompound).toHaveBeenCalledTimes(1);
    expect(mockSupplyToAave).toHaveBeenCalledTimes(1);
    expect(mockSwapOnUniswap).toHaveBeenCalledTimes(1);
    expect(mockSupplyToMorpho).toHaveBeenCalledTimes(1); // curve → morpho
  });

  test('settleSession() skips entities with deposited = 0', async () => {
    const { result } = renderWithProvider();

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const entities = [
      createEntity({ protocol: 'compound', deposited: 0 }),
      createEntity({ protocol: 'aave', deposited: 100 }),
    ];

    await act(async () => {
      await result.current.settleSession(entities);
    });

    expect(mockSupplyToCompound).not.toHaveBeenCalled();
    expect(mockSupplyToAave).toHaveBeenCalledTimes(1);
  });

  test('settleSession() skips yearn/unsupported protocols', async () => {
    const { result } = renderWithProvider();

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const entities = [
      createEntity({ protocol: 'yearn', deposited: 200 }),
      createEntity({ protocol: 'compound', deposited: 50 }),
    ];

    await act(async () => {
      await result.current.settleSession(entities);
    });

    // yearn has no chainId mapping → skipped
    expect(mockSupplyToCompound).toHaveBeenCalledTimes(1);
    // No Morpho/Aave/Uniswap calls from yearn
  });

  test('settleSession() stores SettlementResult with all transaction hashes', async () => {
    const { result } = renderWithProvider();

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const entities = [
      createEntity({ protocol: 'compound', deposited: 50 }),
      createEntity({ protocol: 'aave', deposited: 30 }),
    ];

    await act(async () => {
      await result.current.settleSession(entities);
    });

    expect(result.current.lastSettlement).not.toBeNull();
    const settlement = result.current.lastSettlement!;

    expect(settlement.sessionId).toBe('test-session-123');
    expect(settlement.actionCount).toBe(5);
    expect(settlement.gasSaved).toBe(2.50);
    expect(settlement.transactions).toHaveLength(2);
    expect(settlement.transactions[0].hash).toBe('0xCompoundHash');
    expect(settlement.transactions[0].status).toBe('confirmed');
    expect(settlement.transactions[1].hash).toBe('0xAaveHash');
    expect(settlement.transactions[1].status).toBe('confirmed');
    expect(settlement.timestamp).toBeGreaterThan(0);
  });
});

// ----- D.2: Protocol Routing -----

describe('Phase D.2 — Protocol Routing', () => {
  test('compound entity → calls supplyToCompound()', async () => {
    const { result } = renderWithProvider();
    await waitFor(() => expect(result.current.isConnected).toBe(true));

    const entities = [createEntity({ protocol: 'compound', deposited: 75 })];

    await act(async () => {
      await result.current.settleSession(entities);
    });

    expect(mockSupplyToCompound).toHaveBeenCalledWith(mockWalletClient, mockPublicClient, usdToUsdc6(75));
  });

  test('aave entity → calls supplyToAave()', async () => {
    const { result } = renderWithProvider();
    await waitFor(() => expect(result.current.isConnected).toBe(true));

    const entities = [createEntity({ protocol: 'aave', deposited: 50 })];

    await act(async () => {
      await result.current.settleSession(entities);
    });

    expect(mockSupplyToAave).toHaveBeenCalledWith(mockWalletClient, mockPublicClient, usdToUsdc6(50));
  });

  test('uniswap entity → calls swapOnUniswap()', async () => {
    const { result } = renderWithProvider();
    await waitFor(() => expect(result.current.isConnected).toBe(true));

    const entities = [createEntity({ protocol: 'uniswap', deposited: 25 })];

    await act(async () => {
      await result.current.settleSession(entities);
    });

    expect(mockSwapOnUniswap).toHaveBeenCalledWith(mockWalletClient, mockPublicClient, usdToUsdc6(25));
  });

  test('curve entity → calls supplyToMorpho() (Liquid Pool maps to Morpho Blue)', async () => {
    const { result } = renderWithProvider();
    await waitFor(() => expect(result.current.isConnected).toBe(true));

    const entities = [createEntity({ protocol: 'curve', deposited: 60 })];

    await act(async () => {
      await result.current.settleSession(entities);
    });

    expect(mockSupplyToMorpho).toHaveBeenCalledWith(mockWalletClient, mockPublicClient, usdToUsdc6(60));
  });
});

// ----- D.3: USD to USDC Conversion -----

describe('Phase D.3 — USD to USDC Conversion', () => {
  test('entity with deposited=100 → amount=BigInt(100_000_000)', async () => {
    const { result } = renderWithProvider();
    await waitFor(() => expect(result.current.isConnected).toBe(true));

    const entities = [createEntity({ protocol: 'compound', deposited: 100 })];

    await act(async () => {
      await result.current.settleSession(entities);
    });

    expect(mockSupplyToCompound).toHaveBeenCalledWith(mockWalletClient, mockPublicClient, BigInt(100_000_000));
  });

  test('entity with deposited=0.01 → amount=BigInt(10_000)', async () => {
    const { result } = renderWithProvider();
    await waitFor(() => expect(result.current.isConnected).toBe(true));

    const entities = [createEntity({ protocol: 'compound', deposited: 0.01 })];

    await act(async () => {
      await result.current.settleSession(entities);
    });

    expect(mockSupplyToCompound).toHaveBeenCalledWith(mockWalletClient, mockPublicClient, BigInt(10_000));
  });

  test('entity with deposited=999999.99 → correct bigint', async () => {
    const { result } = renderWithProvider();
    await waitFor(() => expect(result.current.isConnected).toBe(true));

    const entities = [createEntity({ protocol: 'compound', deposited: 999999.99 })];

    await act(async () => {
      await result.current.settleSession(entities);
    });

    expect(mockSupplyToCompound).toHaveBeenCalledWith(mockWalletClient, mockPublicClient, BigInt(999_999_990_000));
  });
});

// ----- D.4: Partial Failure Handling -----

describe('Phase D.4 — Partial Failure Handling', () => {
  test('one protocol fails, others succeed → mixed status', async () => {
    mockSupplyToCompound.mockRejectedValue(new Error('Compound reverted'));

    const { result } = renderWithProvider();
    await waitFor(() => expect(result.current.isConnected).toBe(true));

    const entities = [
      createEntity({ protocol: 'compound', deposited: 50 }),
      createEntity({ protocol: 'aave', deposited: 30 }),
      createEntity({ protocol: 'uniswap', deposited: 20 }),
    ];

    await act(async () => {
      await result.current.settleSession(entities);
    });

    const settlement = result.current.lastSettlement!;
    expect(settlement.transactions).toHaveLength(3);

    const compoundTx = settlement.transactions.find((t: any) => t.protocol === 'compound');
    const aaveTx = settlement.transactions.find((t: any) => t.protocol === 'aave');
    const uniswapTx = settlement.transactions.find((t: any) => t.protocol === 'uniswap');

    expect(compoundTx!.status).toBe('failed');
    expect(aaveTx!.status).toBe('confirmed');
    expect(uniswapTx!.status).toBe('confirmed');
  });

  test('failed tx records error message', async () => {
    mockSupplyToAave.mockRejectedValue(new Error('Insufficient Aave USDC'));

    const { result } = renderWithProvider();
    await waitFor(() => expect(result.current.isConnected).toBe(true));

    const entities = [createEntity({ protocol: 'aave', deposited: 100 })];

    await act(async () => {
      await result.current.settleSession(entities);
    });

    const settlement = result.current.lastSettlement!;
    const aaveTx = settlement.transactions[0];
    expect(aaveTx.status).toBe('failed');
    expect(aaveTx.error).toBe('Insufficient Aave USDC');
  });

  test('settlement result still stored on partial failure', async () => {
    mockSupplyToCompound.mockRejectedValue(new Error('fail'));
    mockSupplyToAave.mockRejectedValue(new Error('fail'));

    const { result } = renderWithProvider();
    await waitFor(() => expect(result.current.isConnected).toBe(true));

    const entities = [
      createEntity({ protocol: 'compound', deposited: 50 }),
      createEntity({ protocol: 'aave', deposited: 30 }),
    ];

    await act(async () => {
      await result.current.settleSession(entities);
    });

    expect(result.current.lastSettlement).not.toBeNull();
    expect(result.current.lastSettlement!.transactions).toHaveLength(2);
    expect(result.current.lastSettlement!.transactions.every((t: any) => t.status === 'failed')).toBe(true);
  });

  test('Yellow Network close fails → entire settlement throws', async () => {
    mockManagerSettleSession.mockRejectedValue(new Error('Channel close failed'));

    const { result } = renderWithProvider();
    await waitFor(() => expect(result.current.isConnected).toBe(true));

    const entities = [createEntity({ protocol: 'compound', deposited: 50 })];

    await act(async () => {
      try {
        await result.current.settleSession(entities);
      } catch (err: any) {
        expect(err.message).toBe('Channel close failed');
      }
    });

    // No protocol functions should have been called
    expect(mockSupplyToCompound).not.toHaveBeenCalled();
  });
});

// ----- D.5: Settlement State Management -----

describe('Phase D.5 — Settlement State Management', () => {
  test('isSettling is true during execution', async () => {
    // Make compound supply take a moment
    let resolveCompound: (v: string) => void;
    mockSupplyToCompound.mockImplementation(
      () => new Promise((resolve) => { resolveCompound = resolve; })
    );

    const { result } = renderWithProvider();
    await waitFor(() => expect(result.current.isConnected).toBe(true));

    const entities = [createEntity({ protocol: 'compound', deposited: 50 })];

    let settlePromise: Promise<void>;
    act(() => {
      settlePromise = result.current.settleSession(entities);
    });

    // isSettling should be true while waiting
    await waitFor(() => {
      expect(result.current.isSettling).toBe(true);
    });

    // Resolve the supply
    await act(async () => {
      resolveCompound!('0xCompoundHash');
      await settlePromise!;
    });

    expect(result.current.isSettling).toBe(false);
  });

  test('isSettling resets to false after completion', async () => {
    const { result } = renderWithProvider();
    await waitFor(() => expect(result.current.isConnected).toBe(true));

    const entities = [createEntity({ protocol: 'compound', deposited: 50 })];

    await act(async () => {
      await result.current.settleSession(entities);
    });

    expect(result.current.isSettling).toBe(false);
  });

  test('isSettling resets to false after error', async () => {
    mockManagerSettleSession.mockRejectedValue(new Error('fail'));

    const { result } = renderWithProvider();
    await waitFor(() => expect(result.current.isConnected).toBe(true));

    const entities = [createEntity({ protocol: 'compound', deposited: 50 })];

    await act(async () => {
      try {
        await result.current.settleSession(entities);
      } catch {
        // expected
      }
    });

    expect(result.current.isSettling).toBe(false);
  });

  test('settleSession() returns early when wallet not connected', async () => {
    // Override useAccount to return no address
    const wagmi = jest.requireMock('wagmi');
    wagmi.useAccount.mockReturnValue({ address: undefined, isConnected: false });
    wagmi.useWalletClient.mockReturnValue({ data: undefined });
    wagmi.usePublicClient.mockReturnValue(undefined);

    const { result } = renderWithProvider();

    await act(async () => {
      await result.current.settleSession([]);
    });

    // No protocol calls and no settlement stored
    expect(mockManagerSettleSession).not.toHaveBeenCalled();
    expect(result.current.lastSettlement).toBeNull();

    // Restore
    wagmi.useAccount.mockReturnValue({
      address: '0xPlayer0000000000000000000000000000000001',
      isConnected: true,
    });
    wagmi.useWalletClient.mockReturnValue({ data: mockWalletClient });
    wagmi.usePublicClient.mockReturnValue(mockPublicClient);
  });
});
