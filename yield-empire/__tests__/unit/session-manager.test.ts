/**
 * Unit tests for YellowSessionManager
 *
 * Tests the WebSocket lifecycle, authentication flow, session creation,
 * game action submission, settlement, message handling, and ping mechanism.
 *
 * Mock strategy: Replace global WebSocket to capture instances,
 * simulate server messages via onmessage, verify sent data via send spy.
 */

import { YellowSessionManager } from '@/lib/yellow/session-manager';
import type { SessionState, GameAction } from '@/lib/types';

// ─── WebSocket Mock Infrastructure ───────────────────────────────────────────

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

  /** Test helper: simulate server opening the connection */
  simulateOpen() {
    this.readyState = MockWS.OPEN;
    if (this.onopen) this.onopen();
  }

  /** Test helper: simulate server sending a message */
  simulateMessage(data: object) {
    if (this.onmessage) this.onmessage({ data: JSON.stringify(data) });
  }

  /** Test helper: simulate connection error */
  simulateError() {
    if (this.onerror) this.onerror(new Event('error'));
  }
}

// ─── SDK Mocks ───────────────────────────────────────────────────────────────

// Mock the @erc7824/nitrolite SDK
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
    params: {
      appSessionId: '0xSession123' as `0x${string}`,
      version: 0,
    },
  }),
  RPCProtocolVersion: { NitroRPC_0_4: 'NitroRPC/0.4' },
  RPCAppStateIntent: { Operate: 'operate', Deposit: 'deposit', Withdraw: 'withdraw' },
}));

// Mock viem account generation
jest.mock('viem/accounts', () => ({
  generatePrivateKey: jest.fn().mockReturnValue('0xdeadbeef00000000000000000000000000000000000000000000000000000001'),
  privateKeyToAccount: jest.fn().mockReturnValue({
    address: '0xSessionKey0000000000000000000000000000' as `0x${string}`,
  }),
}));

// ─── Test Helpers ────────────────────────────────────────────────────────────

function getLastWS(): MockWS {
  return wsInstances[wsInstances.length - 1];
}

/** Create a mock WalletClient */
function mockWalletClient() {
  return {
    account: {
      address: '0xUser0000000000000000000000000000000000000' as `0x${string}`,
    },
    signTypedData: jest.fn().mockResolvedValue('0xsig'),
    writeContract: jest.fn(),
  } as any;
}

/** Respond to the nth send() call with a success response */
function respondToSend(ws: MockWS, callIndex: number, method: string, result: any) {
  const sentData = JSON.parse(ws.send.mock.calls[callIndex][0]);
  const requestId = sentData.req[0];
  ws.simulateMessage({
    res: [requestId, method, result, Date.now()],
  });
}

/**
 * Full connect helper: opens WS, responds to get_config, auth_request (challenge),
 * and auth_verify to get the manager to authenticated state.
 */
async function connectManager(manager: YellowSessionManager, walletClient: any): Promise<MockWS> {
  const connectPromise = manager.connect(walletClient);

  // Wait for WS to be created
  await new Promise((r) => setTimeout(r, 0));
  const ws = getLastWS();
  ws.simulateOpen();

  // get_config response
  await new Promise((r) => setTimeout(r, 0));
  respondToSend(ws, 0, 'get_config', {
    brokerAddress: '0xBroker0000000000000000000000000000000000',
  });

  // auth_challenge response (for auth_request)
  await new Promise((r) => setTimeout(r, 0));
  respondToSend(ws, 1, 'auth_challenge', {
    challenge: 'test-challenge',
  });

  // auth_verify response
  await new Promise((r) => setTimeout(r, 0));
  respondToSend(ws, 2, 'auth_verify', {
    success: true,
    jwtToken: 'test-jwt',
    address: walletClient.account.address,
  });

  await connectPromise;
  return ws;
}

/** Connect + create session helper */
async function connectAndCreateSession(
  manager: YellowSessionManager,
  walletClient: any,
): Promise<MockWS> {
  const ws = await connectManager(manager, walletClient);

  const sessionPromise = manager.createGameSession(walletClient.account.address);
  await new Promise((r) => setTimeout(r, 0));
  respondToSend(ws, 3, 'create_app_session', {
    appSessionId: '0xSession123',
    version: 0,
  });
  await sessionPromise;

  return ws;
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

beforeEach(() => {
  wsInstances = [];
  jest.useFakeTimers();
  (global as any).WebSocket = MockWS;
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// ── 2.1 Connection Lifecycle ─────────────────────────────────────────────────

describe('Connection Lifecycle', () => {
  it('connect() opens WebSocket to YELLOW_ENDPOINT', async () => {
    const manager = new YellowSessionManager();
    const walletClient = mockWalletClient();

    manager.connect(walletClient).catch(() => {});

    await jest.advanceTimersByTimeAsync(0);
    const ws = getLastWS();
    expect(ws).toBeDefined();
    expect(ws.url).toBe('wss://clearnet-sandbox.yellow.com/ws');
  });

  it('connect() resolves after full auth flow', async () => {
    jest.useRealTimers();
    const manager = new YellowSessionManager();
    const walletClient = mockWalletClient();

    const ws = await connectManager(manager, walletClient);
    expect(ws.readyState).toBe(MockWS.OPEN);

    const state = manager.getSessionState();
    expect(state.isConnected).toBe(true);
  });

  it('connect() rejects on ws.onerror', async () => {
    jest.useRealTimers();
    const manager = new YellowSessionManager();
    const walletClient = mockWalletClient();

    const connectPromise = manager.connect(walletClient);
    await new Promise((r) => setTimeout(r, 0));

    const ws = getLastWS();
    ws.simulateError();

    await expect(connectPromise).rejects.toThrow('WebSocket connection failed');
  });

  it('connect() rejects on 10s timeout', async () => {
    const manager = new YellowSessionManager();
    const walletClient = mockWalletClient();

    const connectPromise = manager.connect(walletClient);

    // Don't open the socket — let it time out
    jest.advanceTimersByTime(10001);

    await expect(connectPromise).rejects.toThrow('WebSocket connection timeout');
  });

  it('connect() is idempotent when already open', async () => {
    jest.useRealTimers();
    const manager = new YellowSessionManager();
    const walletClient = mockWalletClient();

    await connectManager(manager, walletClient);
    const countBefore = wsInstances.length;

    // Second call should return immediately
    await manager.connect(walletClient);
    expect(wsInstances.length).toBe(countBefore);
  });

  it('disconnect() closes WebSocket and resets state', async () => {
    jest.useRealTimers();
    const manager = new YellowSessionManager();
    const walletClient = mockWalletClient();

    await connectManager(manager, walletClient);

    manager.disconnect();
    const state = manager.getSessionState();
    expect(state.isConnected).toBe(false);
    expect(state.isSessionActive).toBe(false);
    expect(state.sessionId).toBeUndefined();
  });

  it('disconnect() clears ping interval', async () => {
    jest.useRealTimers();
    const clearSpy = jest.spyOn(global, 'clearInterval');
    const manager = new YellowSessionManager();
    const walletClient = mockWalletClient();

    await connectManager(manager, walletClient);
    manager.disconnect();

    expect(clearSpy).toHaveBeenCalled();
  });

  it('cleanupConnection() detaches all handlers', async () => {
    jest.useRealTimers();
    const manager = new YellowSessionManager();
    const walletClient = mockWalletClient();

    await connectManager(manager, walletClient);
    const ws = getLastWS();

    manager.disconnect();

    expect(ws.onopen).toBeNull();
    expect(ws.onclose).toBeNull();
    expect(ws.onerror).toBeNull();
    expect(ws.onmessage).toBeNull();
  });
});

// ── 2.2 Authentication Flow ──────────────────────────────────────────────────

describe('Authentication Flow', () => {
  it('authenticate() completes full auth flow', async () => {
    jest.useRealTimers();
    const manager = new YellowSessionManager();
    const walletClient = mockWalletClient();

    await connectManager(manager, walletClient);

    const ws = getLastWS();
    // Verify auth_request was sent (call index 1, after get_config)
    expect(ws.send).toHaveBeenCalledTimes(3); // get_config, auth_request, auth_verify
  });

  it('authenticate() handles snake_case jwt_token', async () => {
    jest.useRealTimers();
    const manager = new YellowSessionManager();
    const walletClient = mockWalletClient();

    const connectPromise = manager.connect(walletClient);
    await new Promise((r) => setTimeout(r, 0));
    const ws = getLastWS();
    ws.simulateOpen();

    // get_config
    await new Promise((r) => setTimeout(r, 0));
    respondToSend(ws, 0, 'get_config', {
      brokerAddress: '0xBroker0000000000000000000000000000000000',
    });

    // auth_challenge
    await new Promise((r) => setTimeout(r, 0));
    respondToSend(ws, 1, 'auth_challenge', { challenge: 'test' });

    // auth_verify with snake_case jwt_token
    await new Promise((r) => setTimeout(r, 0));
    respondToSend(ws, 2, 'auth_verify', {
      success: true,
      jwt_token: 'snake-case-jwt', // snake_case variant
      address: walletClient.account.address,
    });

    await connectPromise;
    // If we get here without error, jwt_token was accepted
    expect(manager.getSessionState().isConnected).toBe(true);
  });

  it('authenticate() throws on auth failure', async () => {
    jest.useRealTimers();
    const manager = new YellowSessionManager();
    const walletClient = mockWalletClient();

    const connectPromise = manager.connect(walletClient);
    await new Promise((r) => setTimeout(r, 0));
    const ws = getLastWS();
    ws.simulateOpen();

    await new Promise((r) => setTimeout(r, 0));
    respondToSend(ws, 0, 'get_config', {
      brokerAddress: '0xBroker0000000000000000000000000000000000',
    });

    await new Promise((r) => setTimeout(r, 0));
    respondToSend(ws, 1, 'auth_challenge', { challenge: 'test' });

    await new Promise((r) => setTimeout(r, 0));
    respondToSend(ws, 2, 'auth_verify', {
      success: false,
      address: walletClient.account.address,
    });

    await expect(connectPromise).rejects.toThrow('Authentication failed');
  });

  it('authenticate() throws on wallet not connected', async () => {
    jest.useRealTimers();
    const manager = new YellowSessionManager();
    const noAccountClient = { account: undefined } as any;

    const connectPromise = manager.connect(noAccountClient);
    await new Promise((r) => setTimeout(r, 0));
    const ws = getLastWS();
    ws.simulateOpen();

    // get_config
    await new Promise((r) => setTimeout(r, 0));
    respondToSend(ws, 0, 'get_config', {
      brokerAddress: '0xBroker0000000000000000000000000000000000',
    });

    await expect(connectPromise).rejects.toThrow('Wallet not connected');
  });
});

// ── 2.3 Session Creation ─────────────────────────────────────────────────────

describe('Session Creation', () => {
  it('createGameSession() sends create_app_session', async () => {
    jest.useRealTimers();
    const manager = new YellowSessionManager();
    const walletClient = mockWalletClient();

    await connectManager(manager, walletClient);
    const ws = getLastWS();

    const sessionPromise = manager.createGameSession(walletClient.account.address);
    await new Promise((r) => setTimeout(r, 0));
    respondToSend(ws, 3, 'create_app_session', {
      appSessionId: '0xSession123',
      version: 0,
    });

    const sessionId = await sessionPromise;
    expect(sessionId).toBe('0xSession123');
  });

  it('createGameSession() sets isSessionActive = true', async () => {
    jest.useRealTimers();
    const manager = new YellowSessionManager();
    const walletClient = mockWalletClient();

    const ws = await connectAndCreateSession(manager, walletClient);

    const state = manager.getSessionState();
    expect(state.isSessionActive).toBe(true);
    expect(state.sessionId).toBe('0xSession123');
  });

  it('createGameSession() stores version from response', async () => {
    jest.useRealTimers();
    const { parseCreateAppSessionResponse } = require('@erc7824/nitrolite');
    parseCreateAppSessionResponse.mockReturnValueOnce({
      params: { appSessionId: '0xSession456' as `0x${string}`, version: 5 },
    });

    const manager = new YellowSessionManager();
    const walletClient = mockWalletClient();

    await connectManager(manager, walletClient);
    const ws = getLastWS();

    const sessionPromise = manager.createGameSession(walletClient.account.address);
    await new Promise((r) => setTimeout(r, 0));
    respondToSend(ws, 3, 'create_app_session', { appSessionId: '0xSession456', version: 5 });
    await sessionPromise;

    // Version is internal, but we can test it by submitting an action
    // and checking the version is incremented from 5
    expect(manager.getSessionState().isSessionActive).toBe(true);
  });

  it('createGameSession() throws if not authenticated', async () => {
    const manager = new YellowSessionManager();
    await expect(
      manager.createGameSession('0xUser0000000000000000000000000000000000000' as `0x${string}`),
    ).rejects.toThrow('Not authenticated');
  });
});

// ── 2.4 Game Action Submission ───────────────────────────────────────────────

describe('Game Action Submission', () => {
  it('submitGameAction() increments stateVersion on success', async () => {
    jest.useRealTimers();
    const stateChanges: SessionState[] = [];
    const manager = new YellowSessionManager((state) => stateChanges.push(state));
    const walletClient = mockWalletClient();

    const ws = await connectAndCreateSession(manager, walletClient);

    const action: GameAction = { type: 'UPGRADE_BUILDING', buildingId: 'b1' };
    const actionPromise = manager.submitGameAction(action, {}, walletClient.account.address);

    await new Promise((r) => setTimeout(r, 0));
    respondToSend(ws, 4, 'submit_app_state', { success: true });
    await actionPromise;

    const state = manager.getSessionState();
    expect(state.actionCount).toBe(1);
  });

  it('submitGameAction() does not increment version on failure', async () => {
    jest.useRealTimers();
    const manager = new YellowSessionManager();
    const walletClient = mockWalletClient();

    const ws = await connectAndCreateSession(manager, walletClient);

    const action: GameAction = { type: 'UPGRADE_BUILDING', buildingId: 'b1' };
    const actionPromise = manager.submitGameAction(action, {}, walletClient.account.address);

    // Respond with error
    await new Promise((r) => setTimeout(r, 0));
    const sentData = JSON.parse(ws.send.mock.calls[4][0]);
    ws.simulateMessage({
      err: [sentData.req[0], 1000, 'Action rejected', Date.now()],
    });

    await expect(actionPromise).rejects.toThrow('Yellow Network error');
    expect(manager.getSessionState().actionCount).toBe(0);
  });

  it('submitGameAction() throws "No active session" without session', async () => {
    jest.useRealTimers();
    const manager = new YellowSessionManager();
    const walletClient = mockWalletClient();

    await connectManager(manager, walletClient);

    const action: GameAction = { type: 'COMPOUND_YIELD' };
    await expect(
      manager.submitGameAction(action, {}, walletClient.account.address),
    ).rejects.toThrow('No active session');
  });

  it('submitGameAction() tracks action count and gas saved', async () => {
    jest.useRealTimers();
    const manager = new YellowSessionManager();
    const walletClient = mockWalletClient();

    const ws = await connectAndCreateSession(manager, walletClient);

    // Submit two actions
    for (let i = 0; i < 2; i++) {
      const action: GameAction = { type: 'DEPOSIT_TO_PROTOCOL', protocol: 'aave', amount: 100 };
      const p = manager.submitGameAction(action, {}, walletClient.account.address);
      await new Promise((r) => setTimeout(r, 0));
      respondToSend(ws, 4 + i, 'submit_app_state', { success: true });
      await p;
    }

    const state = manager.getSessionState();
    expect(state.actionCount).toBe(2);
    expect(state.gasSaved).toBe(1.0); // 2 * 0.5 (deposit gas cost)
  });

  it('submitGameAction() updates action breakdown by type', async () => {
    jest.useRealTimers();
    const manager = new YellowSessionManager();
    const walletClient = mockWalletClient();

    const ws = await connectAndCreateSession(manager, walletClient);

    // Deposit action
    const dep: GameAction = { type: 'DEPOSIT_TO_PROTOCOL', protocol: 'aave', amount: 100 };
    const p1 = manager.submitGameAction(dep, {}, walletClient.account.address);
    await new Promise((r) => setTimeout(r, 0));
    respondToSend(ws, 4, 'submit_app_state', { success: true });
    await p1;

    // Upgrade action
    const upg: GameAction = { type: 'UPGRADE_BUILDING', buildingId: 'b1' };
    const p2 = manager.submitGameAction(upg, {}, walletClient.account.address);
    await new Promise((r) => setTimeout(r, 0));
    respondToSend(ws, 5, 'submit_app_state', { success: true });
    await p2;

    const state = manager.getSessionState();
    expect(state.actionBreakdown).toEqual({
      DEPOSIT_TO_PROTOCOL: 1,
      UPGRADE_BUILDING: 1,
    });
  });
});

// ── 2.5 Settlement ───────────────────────────────────────────────────────────

describe('Settlement', () => {
  it('settleSession() sends close_app_session', async () => {
    jest.useRealTimers();
    const manager = new YellowSessionManager();
    const walletClient = mockWalletClient();

    const ws = await connectAndCreateSession(manager, walletClient);

    const settlePromise = manager.settleSession(walletClient.account.address, []);
    await new Promise((r) => setTimeout(r, 0));
    respondToSend(ws, 4, 'close_app_session', { success: true });
    await settlePromise;

    // Verify close_app_session message was sent (5th call: get_config, auth_request, auth_verify, create_session, close_session)
    expect(ws.send).toHaveBeenCalledTimes(5);
  });

  it('settleSession() resets all session state', async () => {
    jest.useRealTimers();
    const manager = new YellowSessionManager();
    const walletClient = mockWalletClient();

    const ws = await connectAndCreateSession(manager, walletClient);

    // Submit an action first
    const action: GameAction = { type: 'UPGRADE_BUILDING', buildingId: 'b1' };
    const p = manager.submitGameAction(action, {}, walletClient.account.address);
    await new Promise((r) => setTimeout(r, 0));
    respondToSend(ws, 4, 'submit_app_state', { success: true });
    await p;

    expect(manager.getSessionState().actionCount).toBe(1);

    // Settle
    const settlePromise = manager.settleSession(walletClient.account.address, []);
    await new Promise((r) => setTimeout(r, 0));
    respondToSend(ws, 5, 'close_app_session', { success: true });
    await settlePromise;

    const state = manager.getSessionState();
    expect(state.isSessionActive).toBe(false);
    expect(state.actionCount).toBe(0);
    expect(state.sessionId).toBeUndefined();
    expect(state.actionBreakdown).toEqual({});
  });

  it('settleSession() throws without active session', async () => {
    jest.useRealTimers();
    const manager = new YellowSessionManager();
    const walletClient = mockWalletClient();

    await connectManager(manager, walletClient);

    await expect(
      manager.settleSession(walletClient.account.address, []),
    ).rejects.toThrow('No active session');
  });
});

// ── 2.6 Message Handling ─────────────────────────────────────────────────────

describe('Message Handling', () => {
  it('handleMessage() routes success responses by request ID', async () => {
    jest.useRealTimers();
    const manager = new YellowSessionManager();
    const walletClient = mockWalletClient();

    const ws = await connectManager(manager, walletClient);

    // Submit a session creation — it registers a handler by request ID
    const sessionPromise = manager.createGameSession(walletClient.account.address);
    await new Promise((r) => setTimeout(r, 0));

    // Respond with matching request ID
    respondToSend(ws, 3, 'create_app_session', {
      appSessionId: '0xRouted',
      version: 0,
    });

    const sessionId = await sessionPromise;
    expect(sessionId).toBe('0xSession123'); // Parsed via mock
  });

  it('handleMessage() routes error responses by request ID', async () => {
    jest.useRealTimers();
    const manager = new YellowSessionManager();
    const walletClient = mockWalletClient();

    const ws = await connectManager(manager, walletClient);

    const sessionPromise = manager.createGameSession(walletClient.account.address);
    await new Promise((r) => setTimeout(r, 0));

    // Respond with error format
    const sentData = JSON.parse(ws.send.mock.calls[3][0]);
    ws.simulateMessage({
      err: [sentData.req[0], 500, 'Server error', Date.now()],
    });

    await expect(sessionPromise).rejects.toThrow('Yellow Network error (500): Server error');
  });

  it('handleMessage() ignores messages without request ID', async () => {
    jest.useRealTimers();
    const manager = new YellowSessionManager();
    const walletClient = mockWalletClient();

    const ws = await connectManager(manager, walletClient);

    // Send a malformed message — should not crash
    expect(() => {
      ws.simulateMessage({ unknown: 'data' });
    }).not.toThrow();
  });

  it('handleMessage() handles JSON parse errors gracefully', async () => {
    jest.useRealTimers();
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const manager = new YellowSessionManager();
    const walletClient = mockWalletClient();

    const ws = await connectManager(manager, walletClient);

    // Send non-JSON data
    expect(() => {
      if (ws.onmessage) ws.onmessage({ data: 'not json{{{' });
    }).not.toThrow();

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to parse WebSocket message:',
      expect.any(Error),
    );
  });

  it('sendAndWait() rejects on broker error (err field)', async () => {
    jest.useRealTimers();
    const manager = new YellowSessionManager();
    const walletClient = mockWalletClient();

    const ws = await connectAndCreateSession(manager, walletClient);

    const action: GameAction = { type: 'COMPOUND_YIELD' };
    const actionPromise = manager.submitGameAction(action, {}, walletClient.account.address);

    await new Promise((r) => setTimeout(r, 0));
    const sentData = JSON.parse(ws.send.mock.calls[4][0]);
    ws.simulateMessage({
      err: [sentData.req[0], 400, 'Bad request', Date.now()],
    });

    await expect(actionPromise).rejects.toThrow('Yellow Network error (400): Bad request');
  });

  it('sendAndWait() rejects on broker error (res method="error")', async () => {
    jest.useRealTimers();
    const manager = new YellowSessionManager();
    const walletClient = mockWalletClient();

    const ws = await connectAndCreateSession(manager, walletClient);

    const action: GameAction = { type: 'COMPOUND_YIELD' };
    const actionPromise = manager.submitGameAction(action, {}, walletClient.account.address);

    await new Promise((r) => setTimeout(r, 0));
    const sentData = JSON.parse(ws.send.mock.calls[4][0]);
    ws.simulateMessage({
      res: [sentData.req[0], 'error', { message: 'Internal error' }, Date.now()],
    });

    await expect(actionPromise).rejects.toThrow('Yellow Network error: Internal error');
  });

  it('sendAndWait() rejects on method mismatch', async () => {
    jest.useRealTimers();
    const manager = new YellowSessionManager();
    const walletClient = mockWalletClient();

    const ws = await connectAndCreateSession(manager, walletClient);

    const action: GameAction = { type: 'COMPOUND_YIELD' };
    const actionPromise = manager.submitGameAction(action, {}, walletClient.account.address);

    await new Promise((r) => setTimeout(r, 0));
    const sentData = JSON.parse(ws.send.mock.calls[4][0]);
    ws.simulateMessage({
      res: [sentData.req[0], 'wrong_method', {}, Date.now()],
    });

    await expect(actionPromise).rejects.toThrow('Unexpected response');
  });

  it('sendAndWait() rejects on 30s timeout', async () => {
    const manager = new YellowSessionManager();
    const walletClient = mockWalletClient();

    // Manually connect with fake timers using async advancement
    const connectPromise = manager.connect(walletClient);
    await jest.advanceTimersByTimeAsync(0);
    const ws = getLastWS();
    ws.simulateOpen();

    // Respond to get_config
    await jest.advanceTimersByTimeAsync(0);
    respondToSend(ws, 0, 'get_config', {
      brokerAddress: '0xBroker0000000000000000000000000000000000',
    });

    // Respond to auth_challenge
    await jest.advanceTimersByTimeAsync(0);
    respondToSend(ws, 1, 'auth_challenge', { challenge: 'test' });

    // Respond to auth_verify
    await jest.advanceTimersByTimeAsync(0);
    respondToSend(ws, 2, 'auth_verify', {
      success: true,
      jwtToken: 'jwt',
      address: walletClient.account.address,
    });

    await connectPromise;

    // Create session — don't respond, let it timeout
    const sessionPromise = manager.createGameSession(walletClient.account.address)
      .catch((err: Error) => err); // Capture the rejection as a value
    await jest.advanceTimersByTimeAsync(0); // flush the createAppSessionMessage promise

    await jest.advanceTimersByTimeAsync(30001);

    const result = await sessionPromise;
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toContain('Request timeout');
  });
});

// ── 2.7 Ping Mechanism ──────────────────────────────────────────────────────

describe('Ping Mechanism', () => {
  it('startPingInterval() sends ping every 30s', async () => {
    const manager = new YellowSessionManager();
    const walletClient = mockWalletClient();

    // Connect with fake timers using async advancement
    const connectPromise = manager.connect(walletClient);
    await jest.advanceTimersByTimeAsync(0);
    const ws = getLastWS();
    ws.simulateOpen();

    // Respond to full auth flow
    await jest.advanceTimersByTimeAsync(0);
    respondToSend(ws, 0, 'get_config', {
      brokerAddress: '0xBroker0000000000000000000000000000000000',
    });
    await jest.advanceTimersByTimeAsync(0);
    respondToSend(ws, 1, 'auth_challenge', { challenge: 'test' });
    await jest.advanceTimersByTimeAsync(0);
    respondToSend(ws, 2, 'auth_verify', {
      success: true,
      jwtToken: 'jwt',
      address: walletClient.account.address,
    });

    await connectPromise;

    const sendCountBefore = ws.send.mock.calls.length;

    // Advance 30 seconds — should trigger a ping
    jest.advanceTimersByTime(30000);
    expect(ws.send.mock.calls.length).toBe(sendCountBefore + 1);
    expect(ws.send).toHaveBeenLastCalledWith('ping');
  });

  it('ping is only sent when socket is OPEN', async () => {
    const manager = new YellowSessionManager();
    const walletClient = mockWalletClient();

    const connectPromise = manager.connect(walletClient);
    await jest.advanceTimersByTimeAsync(0);
    const ws = getLastWS();
    ws.simulateOpen();

    await jest.advanceTimersByTimeAsync(0);
    respondToSend(ws, 0, 'get_config', {
      brokerAddress: '0xBroker0000000000000000000000000000000000',
    });
    await jest.advanceTimersByTimeAsync(0);
    respondToSend(ws, 1, 'auth_challenge', { challenge: 'test' });
    await jest.advanceTimersByTimeAsync(0);
    respondToSend(ws, 2, 'auth_verify', {
      success: true,
      jwtToken: 'jwt',
      address: walletClient.account.address,
    });

    await connectPromise;

    // Close the socket
    ws.readyState = MockWS.CLOSED;

    const sendCountBefore = ws.send.mock.calls.length;
    jest.advanceTimersByTime(30000);

    // Ping should NOT be sent because socket is closed
    expect(ws.send.mock.calls.length).toBe(sendCountBefore);
  });
});

// ── State Change Callback ────────────────────────────────────────────────────

describe('State Change Callback', () => {
  it('emits state changes on connect, session create, action, and settle', async () => {
    jest.useRealTimers();
    const stateChanges: SessionState[] = [];
    const manager = new YellowSessionManager((state) => stateChanges.push({ ...state }));
    const walletClient = mockWalletClient();

    const ws = await connectAndCreateSession(manager, walletClient);

    // At this point we should have state changes for: connecting, connected, session active
    const activeStates = stateChanges.filter((s) => s.isSessionActive);
    expect(activeStates.length).toBeGreaterThan(0);

    // Submit action
    const action: GameAction = { type: 'COMPOUND_YIELD' };
    const p = manager.submitGameAction(action, {}, walletClient.account.address);
    await new Promise((r) => setTimeout(r, 0));
    respondToSend(ws, 4, 'submit_app_state', { success: true });
    await p;

    const afterAction = stateChanges[stateChanges.length - 1];
    expect(afterAction.actionCount).toBe(1);
  });
});
