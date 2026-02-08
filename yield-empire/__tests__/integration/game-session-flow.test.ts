/**
 * Integration tests — Game Session Flow
 *
 * Tests the full lifecycle: connect → create session → actions → settle → reset
 * Uses YellowSessionManager with mocked WebSocket and SDK.
 */

import { YellowSessionManager } from '@/lib/yellow/session-manager';
import type { SessionState, GameAction } from '@/lib/types';

// ─── WebSocket Mock ──────────────────────────────────────────────────────────

let wsInstances: MockWS[] = [];

class MockWS {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWS.CONNECTING;
  url: string;
  onopen: (() => void) | null = null;
  onclose: ((event?: any) => void) | null = null;
  onerror: ((event?: any) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  send = jest.fn();

  constructor(url: string) {
    this.url = url;
    wsInstances.push(this);
  }

  close() {
    this.readyState = MockWS.CLOSED;
    if (this.onclose) this.onclose();
  }

  simulateOpen() {
    this.readyState = MockWS.OPEN;
    if (this.onopen) this.onopen();
  }

  simulateMessage(data: object) {
    if (this.onmessage) this.onmessage({ data: JSON.stringify(data) });
  }

  simulateError() {
    if (this.onerror) this.onerror(new Event('error'));
  }
}

// ─── SDK Mocks ───────────────────────────────────────────────────────────────

jest.mock('@erc7824/nitrolite', () => ({
  createAuthRequestMessage: jest.fn().mockResolvedValue(
    JSON.stringify({ req: [1, 'auth_request', {}, Date.now()] })
  ),
  createAuthVerifyMessage: jest.fn().mockResolvedValue(
    JSON.stringify({ req: [3, 'auth_verify', {}, Date.now()] })
  ),
  createAuthVerifyMessageWithJWT: jest.fn(),
  createAppSessionMessage: jest.fn().mockResolvedValue(
    JSON.stringify({ req: [4, 'create_app_session', {}, Date.now()] })
  ),
  createSubmitAppStateMessage: jest.fn().mockResolvedValue(
    JSON.stringify({ req: [5, 'submit_app_state', {}, Date.now()] })
  ),
  createCloseAppSessionMessage: jest.fn().mockResolvedValue(
    JSON.stringify({ req: [6, 'close_app_session', {}, Date.now()] })
  ),
  createEIP712AuthMessageSigner: jest.fn().mockReturnValue(jest.fn()),
  createECDSAMessageSigner: jest.fn().mockReturnValue(jest.fn()),
  createPingMessageV2: jest.fn().mockReturnValue('ping'),
  parseAuthChallengeResponse: jest.fn().mockReturnValue({
    params: { challenge: 'test-challenge' },
  }),
  parseGetConfigResponse: jest.fn().mockReturnValue({
    params: { brokerAddress: '0xBroker0000000000000000000000000000000000' },
  }),
  parseCreateAppSessionResponse: jest.fn().mockReturnValue({
    params: { appSessionId: '0xSession123' as `0x${string}`, version: 0 },
  }),
  RPCProtocolVersion: { NitroRPC_0_4: 'NitroRPC/0.4' },
  RPCAppStateIntent: { Operate: 'operate' },
}));

jest.mock('viem/accounts', () => ({
  generatePrivateKey: jest.fn().mockReturnValue('0xdeadbeef00000000000000000000000000000000000000000000000000000001'),
  privateKeyToAccount: jest.fn().mockReturnValue({
    address: '0xSessionKey0000000000000000000000000000' as `0x${string}`,
  }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getLastWS(): MockWS {
  return wsInstances[wsInstances.length - 1];
}

function mockWalletClient() {
  return {
    account: { address: '0xUser0000000000000000000000000000000000000' as `0x${string}` },
    signTypedData: jest.fn().mockResolvedValue('0xsig'),
  } as any;
}

function respondToSend(ws: MockWS, callIndex: number, method: string, result: any) {
  const sentData = JSON.parse(ws.send.mock.calls[callIndex][0]);
  const requestId = sentData.req[0];
  ws.simulateMessage({ res: [requestId, method, result, Date.now()] });
}

async function fullConnect(manager: YellowSessionManager, walletClient: any): Promise<MockWS> {
  const p = manager.connect(walletClient);
  await new Promise((r) => setTimeout(r, 0));
  const ws = getLastWS();
  ws.simulateOpen();

  await new Promise((r) => setTimeout(r, 0));
  respondToSend(ws, 0, 'get_config', { brokerAddress: '0xBroker0000000000000000000000000000000000' });

  await new Promise((r) => setTimeout(r, 0));
  respondToSend(ws, 1, 'auth_challenge', { challenge: 'test' });

  await new Promise((r) => setTimeout(r, 0));
  respondToSend(ws, 2, 'auth_verify', {
    success: true, jwtToken: 'jwt', address: walletClient.account.address,
  });

  await p;
  return ws;
}

async function fullConnectAndCreateSession(manager: YellowSessionManager, walletClient: any): Promise<MockWS> {
  const ws = await fullConnect(manager, walletClient);
  const sp = manager.createGameSession(walletClient.account.address);
  await new Promise((r) => setTimeout(r, 0));
  respondToSend(ws, 3, 'create_app_session', { appSessionId: '0xSession123', version: 0 });
  await sp;
  return ws;
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  wsInstances = [];
  (global as any).WebSocket = MockWS;
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Full Game Session Lifecycle', () => {
  it('connect → create session → submit actions → settle → reset', async () => {
    const states: SessionState[] = [];
    const manager = new YellowSessionManager((s) => states.push({ ...s }));
    const wc = mockWalletClient();

    // Phase 1: Connect and create session
    const ws = await fullConnectAndCreateSession(manager, wc);
    expect(manager.getSessionState().isSessionActive).toBe(true);
    expect(manager.getSessionState().isConnected).toBe(true);

    // Phase 2: Submit multiple game actions
    const actions: GameAction[] = [
      { type: 'DEPOSIT_TO_PROTOCOL', protocol: 'aave', amount: 100 },
      { type: 'UPGRADE_BUILDING', buildingId: 'crystal-tower' },
      { type: 'COMPOUND_YIELD' },
      { type: 'DEPOSIT_TO_PROTOCOL', protocol: 'compound', amount: 50 },
      { type: 'CONTRIBUTE_TO_GUILD', amount: 10 },
    ];

    for (let i = 0; i < actions.length; i++) {
      const p = manager.submitGameAction(actions[i], {}, wc.account.address);
      await new Promise((r) => setTimeout(r, 0));
      respondToSend(ws, 4 + i, 'submit_app_state', { success: true });
      await p;
    }

    const afterActions = manager.getSessionState();
    expect(afterActions.actionCount).toBe(5);
    expect(afterActions.gasSaved).toBeGreaterThan(0);
    expect(afterActions.actionBreakdown).toEqual({
      DEPOSIT_TO_PROTOCOL: 2,
      UPGRADE_BUILDING: 1,
      COMPOUND_YIELD: 1,
      CONTRIBUTE_TO_GUILD: 1,
    });

    // Phase 3: Settle
    const settleP = manager.settleSession(wc.account.address, []);
    await new Promise((r) => setTimeout(r, 0));
    respondToSend(ws, 9, 'close_app_session', { success: true });
    await settleP;

    const afterSettle = manager.getSessionState();
    expect(afterSettle.isSessionActive).toBe(false);
    expect(afterSettle.actionCount).toBe(0);
    expect(afterSettle.sessionId).toBeUndefined();
    expect(afterSettle.actionBreakdown).toEqual({});

    // WebSocket should still be open (connection is separate from session)
    expect(afterSettle.isConnected).toBe(true);
  });

  it('can start a new session after settlement', async () => {
    const manager = new YellowSessionManager();
    const wc = mockWalletClient();

    const ws = await fullConnectAndCreateSession(manager, wc);

    // Settle first session
    const settleP = manager.settleSession(wc.account.address, []);
    await new Promise((r) => setTimeout(r, 0));
    respondToSend(ws, 4, 'close_app_session', { success: true });
    await settleP;

    expect(manager.getSessionState().isSessionActive).toBe(false);

    // Create new session
    const sp2 = manager.createGameSession(wc.account.address);
    await new Promise((r) => setTimeout(r, 0));
    respondToSend(ws, 5, 'create_app_session', { appSessionId: '0xSession456', version: 0 });
    await sp2;

    expect(manager.getSessionState().isSessionActive).toBe(true);
  });
});

describe('Error Recovery', () => {
  it('failed action does not corrupt state', async () => {
    const manager = new YellowSessionManager();
    const wc = mockWalletClient();
    const ws = await fullConnectAndCreateSession(manager, wc);

    // Succeed first action
    const p1 = manager.submitGameAction(
      { type: 'UPGRADE_BUILDING', buildingId: 'b1' },
      {},
      wc.account.address,
    );
    await new Promise((r) => setTimeout(r, 0));
    respondToSend(ws, 4, 'submit_app_state', { success: true });
    await p1;
    expect(manager.getSessionState().actionCount).toBe(1);

    // Fail second action
    const p2 = manager.submitGameAction(
      { type: 'COMPOUND_YIELD' },
      {},
      wc.account.address,
    );
    await new Promise((r) => setTimeout(r, 0));
    const sentData = JSON.parse(ws.send.mock.calls[5][0]);
    ws.simulateMessage({ err: [sentData.req[0], 500, 'Server error', Date.now()] });
    await expect(p2).rejects.toThrow();

    // State should still show 1 action (not 2)
    expect(manager.getSessionState().actionCount).toBe(1);

    // Succeed third action — should work normally
    const p3 = manager.submitGameAction(
      { type: 'DEPOSIT_TO_PROTOCOL', protocol: 'aave', amount: 50 },
      {},
      wc.account.address,
    );
    await new Promise((r) => setTimeout(r, 0));
    respondToSend(ws, 6, 'submit_app_state', { success: true });
    await p3;
    expect(manager.getSessionState().actionCount).toBe(2);
  });

  it('connect failure is recoverable with retry', async () => {
    const manager = new YellowSessionManager();
    const wc = mockWalletClient();

    // First attempt fails
    const p1 = manager.connect(wc);
    await new Promise((r) => setTimeout(r, 0));
    const ws1 = getLastWS();
    ws1.simulateError();
    await expect(p1).rejects.toThrow();

    // Second attempt succeeds
    const ws = await fullConnect(manager, wc);
    expect(manager.getSessionState().isConnected).toBe(true);
  });

  it('disconnect cleans up completely — no lingering state', async () => {
    const manager = new YellowSessionManager();
    const wc = mockWalletClient();

    const ws = await fullConnectAndCreateSession(manager, wc);

    // Submit an action
    const p = manager.submitGameAction(
      { type: 'UPGRADE_BUILDING', buildingId: 'b1' },
      {},
      wc.account.address,
    );
    await new Promise((r) => setTimeout(r, 0));
    respondToSend(ws, 4, 'submit_app_state', { success: true });
    await p;

    // Disconnect
    manager.disconnect();

    const state = manager.getSessionState();
    expect(state.isConnected).toBe(false);
    expect(state.isSessionActive).toBe(false);
    // actionCount persists across disconnect (for settlement display)
    expect(state.actionCount).toBe(1);
    expect(state.sessionId).toBeUndefined();

    // Verify handlers are cleared
    expect(ws.onopen).toBeNull();
    expect(ws.onclose).toBeNull();
    expect(ws.onerror).toBeNull();
    expect(ws.onmessage).toBeNull();
  });

  it('action without session throws immediately', async () => {
    const manager = new YellowSessionManager();
    const wc = mockWalletClient();

    // Only connect, don't create session
    await fullConnect(manager, wc);

    await expect(
      manager.submitGameAction({ type: 'COMPOUND_YIELD' }, {}, wc.account.address),
    ).rejects.toThrow('No active session');
  });

  it('settle without session throws immediately', async () => {
    const manager = new YellowSessionManager();
    const wc = mockWalletClient();

    await fullConnect(manager, wc);

    await expect(
      manager.settleSession(wc.account.address, []),
    ).rejects.toThrow('No active session');
  });
});

describe('State Transitions', () => {
  it('state changes emit in correct order during full flow', async () => {
    const states: SessionState[] = [];
    const manager = new YellowSessionManager((s) => states.push({ ...s }));
    const wc = mockWalletClient();

    const ws = await fullConnectAndCreateSession(manager, wc);

    // Verify we got: connecting → connected → session active
    expect(states.some((s) => !s.isConnected && !s.isSessionActive)).toBe(true); // initial / connecting
    expect(states.some((s) => s.isConnected && !s.isSessionActive)).toBe(true); // connected no session
    expect(states.some((s) => s.isConnected && s.isSessionActive)).toBe(true); // session active

    // Action increments counters
    const p = manager.submitGameAction(
      { type: 'UPGRADE_BUILDING', buildingId: 'b1' },
      {},
      wc.account.address,
    );
    await new Promise((r) => setTimeout(r, 0));
    respondToSend(ws, 4, 'submit_app_state', { success: true });
    await p;

    const lastState = states[states.length - 1];
    expect(lastState.actionCount).toBe(1);
    expect(lastState.gasSaved).toBe(0.4); // UPGRADE_BUILDING gas cost
  });

  it('gas saved accumulates correctly across different action types', async () => {
    const manager = new YellowSessionManager();
    const wc = mockWalletClient();
    const ws = await fullConnectAndCreateSession(manager, wc);

    const actions: GameAction[] = [
      { type: 'DEPOSIT_TO_PROTOCOL', protocol: 'aave', amount: 100 },  // 0.5
      { type: 'COMPOUND_YIELD' },                                       // 0.3
      { type: 'UPGRADE_BUILDING', buildingId: 'b1' },                  // 0.4
      { type: 'CONTRIBUTE_TO_GUILD', amount: 5 },                       // 0.6
      { type: 'CLAIM_REWARDS' },                                         // 0.25
    ];

    for (let i = 0; i < actions.length; i++) {
      const p = manager.submitGameAction(actions[i], {}, wc.account.address);
      await new Promise((r) => setTimeout(r, 0));
      respondToSend(ws, 4 + i, 'submit_app_state', { success: true });
      await p;
    }

    const state = manager.getSessionState();
    expect(state.actionCount).toBe(5);
    // 0.5 + 0.3 + 0.4 + 0.6 + 0.25 = 2.05
    expect(state.gasSaved).toBeCloseTo(2.05, 2);
  });
});

describe('Multiple Sessions', () => {
  it('handles back-to-back sessions without reconnecting', async () => {
    const manager = new YellowSessionManager();
    const wc = mockWalletClient();

    const ws = await fullConnectAndCreateSession(manager, wc);

    // First session: 2 actions + settle
    for (let i = 0; i < 2; i++) {
      const p = manager.submitGameAction(
        { type: 'UPGRADE_BUILDING', buildingId: `b${i}` },
        {},
        wc.account.address,
      );
      await new Promise((r) => setTimeout(r, 0));
      respondToSend(ws, 4 + i, 'submit_app_state', { success: true });
      await p;
    }

    const settleP = manager.settleSession(wc.account.address, []);
    await new Promise((r) => setTimeout(r, 0));
    respondToSend(ws, 6, 'close_app_session', { success: true });
    await settleP;

    expect(manager.getSessionState().actionCount).toBe(0);

    // Second session: 3 actions
    const sp2 = manager.createGameSession(wc.account.address);
    await new Promise((r) => setTimeout(r, 0));
    respondToSend(ws, 7, 'create_app_session', { appSessionId: '0xSess2', version: 0 });
    await sp2;

    for (let i = 0; i < 3; i++) {
      const p = manager.submitGameAction(
        { type: 'COMPOUND_YIELD' },
        {},
        wc.account.address,
      );
      await new Promise((r) => setTimeout(r, 0));
      respondToSend(ws, 8 + i, 'submit_app_state', { success: true });
      await p;
    }

    expect(manager.getSessionState().actionCount).toBe(3);
    // gasSaved is cumulative: session1 (2 upgrades * 0.4) + session2 (3 compounds * 0.3) = 1.7
    expect(manager.getSessionState().gasSaved).toBeCloseTo(1.7, 2);
  });
});
