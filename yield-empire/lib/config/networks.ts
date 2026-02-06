/**
 * Network configuration for Yield Empire
 * Supports Yellow Network state channels and ENS integration
 */

export const NETWORKS = {
  // Yellow Network ClearNode endpoint
  YELLOW_ENDPOINT: 'wss://clearnet-sandbox.yellow.com/ws',

  // ENS network (sepolia for testnet, mainnet for production)
  ENS_NETWORK: 'sepolia' as const,

  // Supported chains for Yellow Network state channels
  SUPPORTED_CHAINS: [1, 137, 8453, 42161, 10] as const, // ETH, Polygon, Base, Arbitrum, Optimism
} as const;

// ENS Contract addresses (from official ENS documentation)
export const ENS_CONTRACTS = {
  sepolia: {
    REGISTRY: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e' as const,
    PUBLIC_RESOLVER: '0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5' as const,
    NAME_WRAPPER: '0x0635513f179D50A207757E05759CbD106d7dFcE8' as const,
  },
  mainnet: {
    REGISTRY: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e' as const,
    PUBLIC_RESOLVER: '0xF29100983E058B709F3D539b0c765937B804AC15' as const,
    NAME_WRAPPER: '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401' as const,
  },
} as const;

// Yellow Network contract addresses (from Yellow Network docs)
export const YELLOW_CONTRACTS = {
  sepolia: {
    CUSTODY: '0x18c00f054DFAD43629Df682CEEABc3A39b74e09A' as const,
    ADJUDICATOR: '0x39E794Dc807B4a33D1000F33A73413423c3f9Af1' as const,
    GUESTBOOK: '0xa2cB11Ba00c8408227470dbCF1b76D92a8118F73' as const,
  },
  mainnet: {
    CUSTODY: '' as const, // TBD for mainnet
    ADJUDICATOR: '' as const,
    GUESTBOOK: '' as const,
  },
} as const;

// Game protocol identifier for Yellow Network app sessions
export const GAME_PROTOCOL = 'yield-empire-v1';

// Challenge period for state channel disputes (in seconds)
export const CHALLENGE_PERIOD = 86400; // 24 hours
