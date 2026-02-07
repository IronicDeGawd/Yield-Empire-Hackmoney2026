/**
 * Testnet contract addresses for DeFi protocol integrations.
 *
 * Token compatibility (from FLOW.md):
 *   - Compound V3 (Sepolia)  → uses Circle USDC directly
 *   - Morpho Blue (Sepolia)  → uses Circle USDC directly
 *   - Uniswap V3 (Sepolia)   → uses Circle USDC directly
 *   - Aave V3 (Base Sepolia) → uses its own test USDC (treasury proxy needed)
 */

export const PROTOCOL_ADDRESSES = {
  AAVE: {
    /** Aave V3 Pool on Base Sepolia */
    POOL: '0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27' as const,
    /** Aave's own test USDC (NOT Circle USDC) */
    USDC: '0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f' as const,
    /** aUSDC receipt token */
    A_USDC: '0x10F1A9D11CDf50041f3f8cB7191CBE2f31750ACC' as const,
    /** Aave faucet on Base Sepolia */
    FAUCET: '0xC959483DBa39aa9E78757139af0e9a2EDEb3f42D' as const,
  },
  COMPOUND: {
    /** Compound V3 Comet (USDC market) on Sepolia */
    COMET_USDC: '0xAec1F48e02Cfb822Be958B68C7957156EB3F0b6e' as const,
  },
  UNISWAP: {
    /** Uniswap V3 SwapRouter on Sepolia */
    ROUTER: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E' as const,
    /** Uniswap V3 Factory on Sepolia */
    FACTORY: '0x0227628f3F023bb0B980b67D528571c95c6DaC1c' as const,
  },
  MORPHO: {
    /** Morpho Blue Core on Sepolia */
    CORE: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb' as const,
    /**
     * Morpho Blue market params for Circle USDC lending on Sepolia.
     * These identify the specific market (loan token, collateral, oracle, IRM, LLTV).
     * Using WETH as collateral token for the USDC lending market.
     */
    MARKET_PARAMS: {
      loanToken: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as const,      // Circle USDC
      collateralToken: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' as const, // WETH Sepolia
      oracle: '0x0000000000000000000000000000000000000000' as const,           // Zero = no oracle needed for supply-only
      irm: '0x0000000000000000000000000000000000000000' as const,              // Zero = default IRM
      lltv: BigInt(0),                                                          // 0 = supply-only (no borrowing)
    },
  },
  /** WETH on Sepolia — used as swap output for Uniswap */
  WETH: {
    SEPOLIA: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' as const,
  },
  /** Treasury Contract on Base Sepolia — mediates Aave supply with pre-funded test USDC */
  TREASURY: {
    BASE_SEPOLIA: (process.env.NEXT_PUBLIC_TREASURY_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
  },
  CIRCLE_USDC: {
    /** Circle USDC on Sepolia (used by Compound, Morpho, Uniswap directly) */
    SEPOLIA: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as const,
    /** Circle USDC on Base Sepolia */
    BASE_SEPOLIA: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const,
    /** USDC on Arc Testnet */
    ARC_TESTNET: '0x3600000000000000000000000000000000000000' as const,
  },
} as const;

/** Chain IDs for settlement routing */
export const SETTLEMENT_CHAINS = {
  SEPOLIA: 11155111,
  BASE_SEPOLIA: 84532,
  ARC_TESTNET: 5042002,
} as const;

/** Maps protocol names to their settlement chain */
export const PROTOCOL_CHAIN_MAP = {
  compound: SETTLEMENT_CHAINS.SEPOLIA,
  aave: SETTLEMENT_CHAINS.BASE_SEPOLIA,
  uniswap: SETTLEMENT_CHAINS.SEPOLIA,
  curve: SETTLEMENT_CHAINS.SEPOLIA, // Morpho Blue (Liquid Pool)
} as const;
