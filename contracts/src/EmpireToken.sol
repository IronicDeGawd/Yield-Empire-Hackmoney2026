// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EmpireToken ($EMPIRE)
 * @notice Game reward token for Yield Empire.
 *
 * Players earn $EMPIRE by depositing real USDC into DeFi protocols and
 * playing the game (upgrades, compounding, guild contributions).
 * On settlement, earned $EMPIRE tokens are minted to the player's wallet.
 *
 * Minting is restricted to authorized minters (the game deployer or a
 * settlement relayer). In production this would use EIP-712 signed claims;
 * for the hackathon demo, owner-managed minter addresses are sufficient.
 *
 * Deployed on Sepolia (chain 11155111) alongside Compound, Morpho, and Uniswap.
 */
contract EmpireToken is ERC20, Ownable {
    /// @notice Addresses authorized to mint tokens (settlement relayers)
    mapping(address => bool) public minters;

    /// @notice Per-address daily mint cap (anti-abuse for testnet)
    uint256 public constant DAILY_MINT_CAP = 10_000 * 1e18; // 10,000 $EMPIRE/day

    /// @notice Tracks daily mints per address (resets each day)
    mapping(address => uint256) public dailyMinted;
    mapping(address => uint256) public lastMintDay;

    event MinterUpdated(address indexed minter, bool authorized);

    constructor() ERC20("Empire Token", "EMPIRE") Ownable(msg.sender) {
        // Owner is automatically a minter
        minters[msg.sender] = true;
    }

    /// @notice Mint $EMPIRE tokens to a player. Callable by authorized minters only.
    function mint(address to, uint256 amount) external {
        require(minters[msg.sender], "Not authorized minter");

        // Daily cap per recipient (resets at day boundary)
        uint256 today = block.timestamp / 1 days;
        if (lastMintDay[to] != today) {
            dailyMinted[to] = 0;
            lastMintDay[to] = today;
        }
        require(dailyMinted[to] + amount <= DAILY_MINT_CAP, "Daily mint cap exceeded");
        dailyMinted[to] += amount;

        _mint(to, amount);
    }

    /// @notice Owner can authorize or revoke minter addresses
    function setMinter(address minter, bool authorized) external onlyOwner {
        minters[minter] = authorized;
        emit MinterUpdated(minter, authorized);
    }
}
