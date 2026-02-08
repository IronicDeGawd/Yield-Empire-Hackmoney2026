/**
 * Yellow Network Session Manager
 * Handles WebSocket connection, authentication, and state channel operations
 */

import { Address, Hex, WalletClient } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import {
  // Auth functions
  createAuthRequestMessage,
  createAuthVerifyMessage,
  createAuthVerifyMessageWithJWT,

  // App session functions
  createAppSessionMessage,
  createSubmitAppStateMessage,
  createCloseAppSessionMessage,

  // Signers
  createEIP712AuthMessageSigner,
  createECDSAMessageSigner,

  // Utilities
  createPingMessageV2,

  // Response parsers
  parseAuthChallengeResponse,
  parseGetConfigResponse,
  parseCreateAppSessionResponse,

  // Types
  type MessageSigner,
  type RPCAppSessionAllocation,
  type RPCAllowance,
  RPCProtocolVersion,
  RPCAppStateIntent,
} from '@erc7824/nitrolite';

import { NETWORKS, GAME_PROTOCOL, CHALLENGE_PERIOD } from '@/lib/config/networks';
import { GameAction, SessionState } from '@/lib/types';
import { GAS_COSTS } from '@/lib/constants';

// Yellow Network RPC message types
// Success: { res: [requestId, method, result, timestamp], sig?: [...] }
// Error:   { err: [requestId, errorCode, errorMessage, timestamp] }
interface RPCMessage {
  res?: [number, string, any, number];
  err?: [number, number, string, number];
  sig?: string[];
}

interface AuthVerifyResult {
  address: Address;
  sessionKey?: Address;
  session_key?: Address;   // broker sends snake_case
  success: boolean;
  jwtToken?: string;
  jwt_token?: string;      // broker sends snake_case
}

/**
 * Yellow Network Session Manager
 * Manages WebSocket connection, auth flow, and app sessions
 */
export class YellowSessionManager {
  private ws: WebSocket | null = null;
  private sessionKey: { address: Address; privateKey: Hex } | null = null;
  private sessionSigner: MessageSigner | null = null;
  private appSessionId: Hex | null = null;
  private stateVersion: number = 0;
  private actionCount: number = 0;
  private gasSavedTotal: number = 0;
  private actionBreakdown: Record<string, number> = {};
  private initialAmount: string = '0'; // zero-deposit session (no custody deposit needed for demo)
  private assetSymbol: string = 'ytest.usd'; // broker's supported asset symbol
  private jwtToken: string | null = null;
  private brokerAddress: Address | null = null;

  // Request/response mapping
  private requestHandlers = new Map<number, (response: any) => void>();
  private requestIdCounter = 1;

  // State management
  private isConnecting = false;
  private isAuthenticated = false;
  private isSessionActive = false;
  private pingInterval: NodeJS.Timeout | null = null;

  // Callbacks
  private onStateChange?: (state: SessionState) => void;

  constructor(onStateChange?: (state: SessionState) => void) {
    this.onStateChange = onStateChange;
  }

  /**
   * Connect to Yellow Network and authenticate
   */
  async connect(walletClient: WalletClient): Promise<void> {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;
    this.emitState();

    try {
      // Generate ephemeral session key
      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);
      this.sessionKey = {
        address: account.address,
        privateKey,
      };
      this.sessionSigner = createECDSAMessageSigner(privateKey);

      // Connect WebSocket
      await this.connectWebSocket();

      // Get broker config
      await this.getBrokerConfig();

      // Authenticate
      await this.authenticate(walletClient);

      this.isConnecting = false;
      this.emitState();
    } catch (error) {
      this.cleanupConnection();
      this.isConnecting = false;
      this.emitState();
      throw error;
    }
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    this.cleanupConnection();
    this.isAuthenticated = false;
    this.isSessionActive = false;
    this.appSessionId = null;
    this.emitState();
  }

  /**
   * Create game session with initial allocation
   */
  async createGameSession(
    userAddress: Address,
    initialAmount: string = '0' // zero-deposit for demo
  ): Promise<Hex> {
    if (!this.sessionSigner || !this.brokerAddress) {
      throw new Error('Not authenticated');
    }

    this.initialAmount = initialAmount;

    const allocations: RPCAppSessionAllocation[] = [
      { participant: userAddress, asset: this.assetSymbol, amount: this.initialAmount },
      { participant: this.brokerAddress, asset: this.assetSymbol, amount: '0' },
    ];

    const message = await createAppSessionMessage(
      this.sessionSigner,
      {
        definition: {
          application: GAME_PROTOCOL,
          protocol: RPCProtocolVersion.NitroRPC_0_4,
          participants: [userAddress, this.brokerAddress],
          weights: [100, 0],
          quorum: 100,
          challenge: CHALLENGE_PERIOD,
          nonce: Date.now(),
        },
        allocations,
        session_data: JSON.stringify({
          version: 1,
          timestamp: Date.now(),
        }),
      }
    );

    const rawResponse = await this.sendAndWaitRaw(message, 'create_app_session');
    const result = parseCreateAppSessionResponse(rawResponse);

    this.appSessionId = result.params.appSessionId;
    this.isSessionActive = true;
    this.stateVersion = result.params.version; // Use version from response, not hard-coded
    this.emitState();

    return this.appSessionId;
  }

  /**
   * Submit game action via state channel
   */
  async submitGameAction(action: GameAction, gameState: object, userAddress: Address): Promise<void> {
    if (!this.appSessionId || !this.sessionSigner || !this.brokerAddress) {
      throw new Error('No active session');
    }

    const nextVersion = this.stateVersion + 1;

    // Allocations must include ALL participants and maintain total balance
    const allocations: RPCAppSessionAllocation[] = [
      { participant: userAddress, asset: this.assetSymbol, amount: this.initialAmount },
      { participant: this.brokerAddress, asset: this.assetSymbol, amount: '0' },
    ];

    const message = await createSubmitAppStateMessage<RPCProtocolVersion.NitroRPC_0_4>(
      this.sessionSigner,
      {
        app_session_id: this.appSessionId,
        intent: RPCAppStateIntent.Operate,
        version: nextVersion,
        allocations,
        session_data: JSON.stringify({
          action,
          gameState,
          timestamp: Date.now(),
        }),
      }
    );

    await this.sendAndWait(message, 'submit_app_state');

    // Only increment after successful confirmation
    this.stateVersion = nextVersion;
    this.actionCount++;
    this.gasSavedTotal += this.getActionGasCost(action);
    this.actionBreakdown[action.type] = (this.actionBreakdown[action.type] || 0) + 1;
    this.emitState();
  }

  /**
   * Settle session and close state channel
   */
  async settleSession(userAddress: Address, finalAllocations: RPCAppSessionAllocation[]): Promise<void> {
    if (!this.appSessionId || !this.sessionSigner || !this.brokerAddress) {
      throw new Error('No active session');
    }

    // close_app_session requires final allocations for ALL participants
    // If no allocations provided, default returns all funds to user
    const allocations = finalAllocations.length > 0 ? finalAllocations : [
      { participant: userAddress, asset: this.assetSymbol, amount: this.initialAmount },
      { participant: this.brokerAddress, asset: this.assetSymbol, amount: '0' },
    ];

    const message = await createCloseAppSessionMessage(this.sessionSigner, {
      app_session_id: this.appSessionId,
      allocations,
      session_data: JSON.stringify({
        finalVersion: this.stateVersion,
        timestamp: Date.now(),
      }),
    });

    await this.sendAndWait(message, 'close_app_session');

    this.isSessionActive = false;
    this.appSessionId = null;
    this.actionCount = 0;
    this.actionBreakdown = {};
    this.stateVersion = 0;
    this.initialAmount = '0';
    this.emitState();
  }

  /**
   * Get current session state
   */
  getSessionState(): SessionState {
    return {
      isConnected: this.ws?.readyState === WebSocket.OPEN,
      isSessionActive: this.isSessionActive,
      sessionId: this.appSessionId ?? undefined,
      actionCount: this.actionCount,
      gasSaved: this.gasSavedTotal,
      actionBreakdown: { ...this.actionBreakdown },
    };
  }

  /**
   * Private: Tear down WebSocket + ping without triggering reconnect side effects
   */
  private cleanupConnection(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.ws) {
      // Detach handlers so the closing socket can't interfere with future connections
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }
    this.requestHandlers.clear();
  }

  /**
   * Private: Check if the Yellow Network endpoint is reachable before
   * attempting a WebSocket connection. A 503 means the service is down.
   */
  private async checkEndpointHealth(): Promise<void> {
    // Convert wss:// → https:// for the HTTP health probe
    const httpUrl = NETWORKS.YELLOW_ENDPOINT
      .replace('wss://', 'https://')
      .replace('ws://', 'http://');

    try {
      const res = await fetch(httpUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });

      if (res.status === 503) {
        throw new Error(
          'Yellow Network is currently down (503 Service Unavailable). Please try again later.',
        );
      }
      // Other non-success codes: could be 426 (Upgrade Required — normal for WS endpoints)
      // or 101, which is fine. Only block on 503.
    } catch (err) {
      if (err instanceof Error && err.message.includes('503')) {
        throw err; // Re-throw our specific 503 error
      }
      // Network errors (CORS, DNS, etc.) — let the WebSocket attempt proceed
      // because the HTTP probe may fail due to CORS while WS still works
    }
  }

  /**
   * Private: Connect WebSocket
   */
  private async connectWebSocket(): Promise<void> {
    // Ensure any stale socket is fully torn down before opening a new one
    this.cleanupConnection();

    // Pre-flight health check — surfaces a clear "service down" message
    await this.checkEndpointHealth();

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(NETWORKS.YELLOW_ENDPOINT);
      this.ws = ws;

      ws.onopen = () => {
        this.startPingInterval();
        resolve();
      };

      ws.onerror = () => {
        reject(new Error('WebSocket connection failed'));
      };

      ws.onmessage = (event) => {
        this.handleMessage(event);
      };

      ws.onclose = () => {
        // Only act if this is still the active socket
        if (this.ws !== ws) return;

        if (this.pingInterval) {
          clearInterval(this.pingInterval);
          this.pingInterval = null;
        }

        this.requestHandlers.clear();
        this.emitState();
      };

      // Timeout after 10 seconds
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Private: Get broker configuration
   */
  private async getBrokerConfig(): Promise<void> {
    const message = JSON.stringify({
      req: [this.requestIdCounter++, 'get_config', {}, Date.now()],
    });

    const rawResponse = await this.sendAndWaitRaw(message, 'get_config');
    const parsed = parseGetConfigResponse(rawResponse);
    this.brokerAddress = parsed.params.brokerAddress;
  }

  /**
   * Private: Authenticate with Yellow Network
   */
  private async authenticate(walletClient: WalletClient): Promise<void> {
    if (!walletClient.account?.address || !this.sessionKey) {
      throw new Error('Wallet not connected or session key missing');
    }

    const userAddress = walletClient.account.address;
    const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 86400); // 24 hours

    // Auth params — shared between auth_request and EIP-712 signer
    // Reference: resources/nitrolite/integration/common/auth.ts
    const authParams = {
      address: userAddress,
      session_key: this.sessionKey.address,
      application: GAME_PROTOCOL,
      allowances: [{ asset: this.assetSymbol, amount: '1000000000' }] as RPCAllowance[], // 1000 ytest.usd spending cap
      expires_at: expiresAt,
      scope: 'console',
    };

    // Step 1: Create EIP-712 signer (must use same params as auth_request)
    // Domain name must match the application field
    const eip712Signer = createEIP712AuthMessageSigner(
      walletClient,
      {
        scope: authParams.scope,
        session_key: authParams.session_key,
        expires_at: authParams.expires_at,
        allowances: authParams.allowances,
      },
      { name: authParams.application }
    );

    // Step 2: Send auth_request
    const authRequest = await createAuthRequestMessage(authParams);

    // Auth request returns auth_challenge response (NOT auth_request)
    const rawChallengeResponse = await this.sendAndWaitRaw(authRequest, 'auth_challenge');
    const challengeResponse = parseAuthChallengeResponse(rawChallengeResponse);

    // Step 3: Send auth_verify with full parsed challenge response
    const authVerify = await createAuthVerifyMessage(
      eip712Signer,
      challengeResponse
    );

    const verifyResult = await this.sendAndWait<AuthVerifyResult>(authVerify, 'auth_verify');

    if (!verifyResult.success) {
      throw new Error('Authentication failed');
    }

    // Broker may send snake_case (jwt_token) or camelCase (jwtToken)
    this.jwtToken = verifyResult.jwtToken ?? verifyResult.jwt_token ?? null;
    this.isAuthenticated = true;
  }

  /**
   * Private: Send message and wait for raw response (for SDK parsers)
   */
  private sendAndWaitRaw(message: string, expectedMethod: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('WebSocket not connected'));
      }

      // Parse message to get request ID
      const parsed = JSON.parse(message);
      const requestId = parsed.req?.[0] ?? this.requestIdCounter++;

      // Store handler
      const timeout = setTimeout(() => {
        this.requestHandlers.delete(requestId);
        reject(new Error(`Request timeout for ${expectedMethod}`));
      }, 30000); // 30 second timeout

      this.requestHandlers.set(requestId, (response: RPCMessage) => {
        clearTimeout(timeout);
        this.requestHandlers.delete(requestId);

        // Handle error responses from broker
        if (response.err) {
          const [, code, errMsg] = response.err;
          reject(new Error(`Yellow Network error (${code}): ${errMsg}`));
          return;
        }

        // Broker sometimes returns errors as res with method="error"
        if (response.res && response.res[1] === 'error') {
          const errorData = response.res[2];
          const errMsg = typeof errorData === 'string' ? errorData
            : errorData?.message ?? errorData?.error ?? JSON.stringify(errorData);
          reject(new Error(`Yellow Network error: ${errMsg}`));
          return;
        }

        if (response.res && response.res[1] === expectedMethod) {
          // Return raw response string for SDK parsers
          resolve(JSON.stringify(response));
        } else {
          const actualMethod = response.res?.[1] ?? 'unknown';
          reject(new Error(`Unexpected response for ${expectedMethod}: got ${actualMethod}`));
        }
      });

      // Send message
      this.ws.send(message);
    });
  }

  /**
   * Private: Send message and wait for parsed response
   */
  private sendAndWait<T = any>(message: string, expectedMethod: string): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('WebSocket not connected'));
      }

      // Parse message to get request ID
      const parsed = JSON.parse(message);
      const requestId = parsed.req?.[0] ?? this.requestIdCounter++;

      // Store handler
      const timeout = setTimeout(() => {
        this.requestHandlers.delete(requestId);
        reject(new Error(`Request timeout for ${expectedMethod}`));
      }, 30000); // 30 second timeout

      this.requestHandlers.set(requestId, (response: RPCMessage) => {
        clearTimeout(timeout);
        this.requestHandlers.delete(requestId);

        // Handle error responses from broker
        if (response.err) {
          const [, code, errMsg] = response.err;
          reject(new Error(`Yellow Network error (${code}): ${errMsg}`));
          return;
        }

        // Broker sometimes returns errors as res with method="error"
        if (response.res && response.res[1] === 'error') {
          const errorData = response.res[2];
          const errMsg = typeof errorData === 'string' ? errorData
            : errorData?.message ?? errorData?.error ?? JSON.stringify(errorData);
          reject(new Error(`Yellow Network error: ${errMsg}`));
          return;
        }

        if (response.res && response.res[1] === expectedMethod) {
          resolve(response.res[2] as T); // Return result
        } else {
          const actualMethod = response.res?.[1] ?? 'unknown';
          reject(new Error(`Unexpected response for ${expectedMethod}: got ${actualMethod}`));
        }
      });

      // Send message
      this.ws.send(message);
    });
  }

  /**
   * Private: Handle incoming WebSocket message
   * Dispatches both success (res) and error (err) responses by request ID
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message: RPCMessage = JSON.parse(event.data);

      // Extract request ID from either res or err
      let requestId: number | undefined;
      if (message.res) {
        requestId = message.res[0];
      } else if (message.err) {
        requestId = message.err[0];
      }

      if (requestId !== undefined) {
        const handler = this.requestHandlers.get(requestId);
        if (handler) {
          handler(message);
        }
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  /**
   * Private: Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        const ping = createPingMessageV2();
        this.ws.send(ping);
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Private: Get gas cost for a specific action type
   */
  private getActionGasCost(action: GameAction): number {
    switch (action.type) {
      case 'DEPOSIT_TO_PROTOCOL': return GAS_COSTS.deposit;
      case 'COMPOUND_YIELD': return GAS_COSTS.compound;
      case 'UPGRADE_BUILDING': return GAS_COSTS.upgrade;
      case 'CONTRIBUTE_TO_GUILD': return GAS_COSTS.guildContribute;
      case 'CLAIM_REWARDS': return GAS_COSTS.claim;
      default: return 0.4;
    }
  }

  /**
   * Private: Emit state change
   */
  private emitState(): void {
    if (this.onStateChange) {
      this.onStateChange(this.getSessionState());
    }
  }
}
