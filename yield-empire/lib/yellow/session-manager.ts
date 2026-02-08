/**
 * Yellow Network Session Manager
 * Handles WebSocket connection, authentication, and state channel operations
 */

import { Address, Hex, WalletClient } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import {
  // Auth functions
  createAuthRequestMessage,
  createAuthVerifyMessageFromChallenge,
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

// Yellow Network RPC response types
interface RPCResponse<T = any> {
  res: [number, string, T, number]; // [requestId, method, result, timestamp]
  sig?: string[];
}

interface AuthVerifyResult {
  address: Address;
  sessionKey: Address;
  success: boolean;
  jwtToken?: string;
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
  private initialUsdcAmount: string = '100000000';
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
      // Clean up ping interval and WebSocket on failed connect/auth
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      this.isConnecting = false;
      this.emitState();
      throw error;
    }
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

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
    initialUsdcAmount: string = '100000000' // 100 USDC (6 decimals)
  ): Promise<Hex> {
    if (!this.sessionSigner || !this.brokerAddress) {
      throw new Error('Not authenticated');
    }

    this.initialUsdcAmount = initialUsdcAmount;

    const allocations: RPCAppSessionAllocation[] = [
      { participant: userAddress, asset: 'usdc', amount: this.initialUsdcAmount },
      { participant: this.brokerAddress, asset: 'usdc', amount: '0' },
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
      { participant: userAddress, asset: 'usdc', amount: this.initialUsdcAmount },
      { participant: this.brokerAddress, asset: 'usdc', amount: '0' },
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
      { participant: userAddress, asset: 'usdc', amount: this.initialUsdcAmount },
      { participant: this.brokerAddress, asset: 'usdc', amount: '0' },
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
    this.stateVersion = 0;
    this.initialUsdcAmount = '100000000';
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
    };
  }

  /**
   * Private: Connect WebSocket
   */
  private connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(NETWORKS.YELLOW_ENDPOINT);

      this.ws.onopen = () => {
        this.startPingInterval();
        resolve();
      };

      this.ws.onerror = (error) => {
        reject(new Error('WebSocket connection failed'));
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };

      this.ws.onclose = () => {
        if (this.pingInterval) {
          clearInterval(this.pingInterval);
          this.pingInterval = null;
        }

        // Clear all pending request handlers to prevent closure leaks
        this.requestHandlers.clear();

        this.emitState();
      };

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
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

    // Step 1: Send auth_request
    const allowances: RPCAllowance[] = [{ asset: 'usdc', amount: '1000000000' }]; // 1000 USDC
    const authRequest = await createAuthRequestMessage({
      address: userAddress,
      session_key: this.sessionKey.address,
      application: GAME_PROTOCOL,
      allowances,
      expires_at: BigInt(Math.floor(Date.now() / 1000) + 86400), // 24 hours
      scope: 'game',
    });

    // Auth request returns auth_challenge response (NOT auth_request)
    const rawChallengeResponse = await this.sendAndWaitRaw(authRequest, 'auth_challenge');
    const challengeResponse = parseAuthChallengeResponse(rawChallengeResponse);

    // Step 2: Sign challenge with EIP-712
    const eip712Signer = createEIP712AuthMessageSigner(
      walletClient,
      {
        scope: 'game',
        session_key: this.sessionKey.address,
        expires_at: BigInt(Math.floor(Date.now() / 1000) + 86400),
        allowances,
      },
      { name: 'Yellow' }
    );

    // Step 3: Send auth_verify
    const authVerify = await createAuthVerifyMessageFromChallenge(
      eip712Signer,
      challengeResponse.params.challengeMessage
    );

    const verifyResult = await this.sendAndWait<AuthVerifyResult>(authVerify, 'auth_verify');

    if (!verifyResult.success) {
      throw new Error('Authentication failed');
    }

    this.jwtToken = verifyResult.jwtToken ?? null;
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

      this.requestHandlers.set(requestId, (response: RPCResponse) => {
        clearTimeout(timeout);
        this.requestHandlers.delete(requestId);

        if (response.res && response.res[1] === expectedMethod) {
          // Return raw response string for SDK parsers
          resolve(JSON.stringify(response));
        } else {
          reject(new Error(`Unexpected response for ${expectedMethod}`));
        }
      });

      // Send message
      this.ws.send(message);
    });
  }

  /**
   * Private: Send message and wait for parsed response (legacy method)
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

      this.requestHandlers.set(requestId, (response: RPCResponse<T>) => {
        clearTimeout(timeout);
        this.requestHandlers.delete(requestId);

        if (response.res && response.res[1] === expectedMethod) {
          resolve(response.res[2]); // Return result
        } else {
          reject(new Error(`Unexpected response for ${expectedMethod}`));
        }
      });

      // Send message
      this.ws.send(message);
    });
  }

  /**
   * Private: Handle incoming WebSocket message
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const response: RPCResponse = JSON.parse(event.data);

      if (response.res) {
        const [requestId] = response.res;
        const handler = this.requestHandlers.get(requestId);

        if (handler) {
          handler(response);
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
