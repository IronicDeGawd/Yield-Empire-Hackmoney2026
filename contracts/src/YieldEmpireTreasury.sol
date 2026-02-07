// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

/**
 * @title YieldEmpireTreasury
 * @notice Mediates Aave V3 supply on Base Sepolia where Aave uses its own test USDC.
 *
 * Flow:
 *   1. Treasury is pre-funded with Aave test USDC (from Aave faucet)
 *   2. Player's Circle USDC arrives via BridgeKit (recipientAddress) or deposit()
 *   3. Owner calls settle(player, amount) → treasury supplies Aave test USDC to Aave Pool
 *   4. Player receives aUSDC receipt tokens from Aave
 *
 * Only needed for Aave on Base Sepolia. Compound/Morpho/Uniswap on Sepolia use Circle USDC directly.
 */
contract YieldEmpireTreasury {
    address public owner;

    /// @notice Circle USDC on Base Sepolia (what BridgeKit mints here as collateral)
    IERC20 public circleUsdc;

    /// @notice Aave's own test USDC on Base Sepolia (pre-funded from Aave faucet)
    IERC20 public aaveUsdc;

    /// @notice Aave V3 Pool on Base Sepolia
    IAavePool public aavePool;

    /// @notice Circle USDC collateral per player
    mapping(address => uint256) public playerDeposits;

    /// @notice Amount already settled to Aave per player
    mapping(address => uint256) public aaveAllocations;

    /// @notice Demo limits
    uint256 public constant MAX_DEPOSIT = 50e6;       // 50 USDC per tx (6 decimals)
    uint256 public constant MAX_PER_PLAYER = 200e6;   // 200 USDC total per player

    event Deposited(address indexed player, uint256 amount);
    event Settled(address indexed player, uint256 aaveAmount);
    event Withdrawn(address indexed player, uint256 amount);
    event BridgeMintRegistered(address indexed player, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(
        address _circleUsdc,
        address _aaveUsdc,
        address _aavePool
    ) {
        owner = msg.sender;
        circleUsdc = IERC20(_circleUsdc);
        aaveUsdc = IERC20(_aaveUsdc);
        aavePool = IAavePool(_aavePool);
    }

    /// @notice Player deposits Circle USDC as collateral
    function deposit(uint256 amount) external {
        require(amount <= MAX_DEPOSIT, "Exceeds per-tx limit");
        require(playerDeposits[msg.sender] + amount <= MAX_PER_PLAYER, "Exceeds player limit");

        circleUsdc.transferFrom(msg.sender, address(this), amount);
        playerDeposits[msg.sender] += amount;

        emit Deposited(msg.sender, amount);
    }

    /// @notice Accept ETH (for BridgeKit's recipientAddress direct mint)
    receive() external payable {}

    /// @notice Owner registers a BridgeKit mint for a player (called after bridge completes)
    function registerBridgeMint(address player, uint256 amount) external onlyOwner {
        require(playerDeposits[player] + amount <= MAX_PER_PLAYER, "Exceeds player limit");
        playerDeposits[player] += amount;

        emit BridgeMintRegistered(player, amount);
    }

    /// @notice Settle player's Aave allocation — execute real Aave supply()
    function settle(address player, uint256 aaveAmount) external onlyOwner {
        require(aaveAmount <= playerDeposits[player] - aaveAllocations[player], "Over-allocated");

        if (aaveAmount > 0) {
            aaveUsdc.approve(address(aavePool), aaveAmount);
            aavePool.supply(address(aaveUsdc), aaveAmount, player, 0);
            aaveAllocations[player] += aaveAmount;
            playerDeposits[player] -= aaveAmount;

            emit Settled(player, aaveAmount);
        }
    }

    /// @notice Player withdraws unallocated Circle USDC
    function withdraw(uint256 amount) external {
        uint256 available = playerDeposits[msg.sender] - aaveAllocations[msg.sender];
        require(amount <= available, "Insufficient unallocated balance");
        playerDeposits[msg.sender] -= amount;
        circleUsdc.transfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Owner pre-approves Aave Pool to spend Aave USDC (setup step)
    function approveAave(uint256 amount) external onlyOwner {
        aaveUsdc.approve(address(aavePool), amount);
    }

    /// @notice Transfer ownership
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }
}
