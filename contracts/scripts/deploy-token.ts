import { ethers } from "hardhat";

/**
 * Deploy EmpireToken ($EMPIRE) to Sepolia.
 *
 * The token is an ERC-20 game reward token. Players earn $EMPIRE by
 * depositing USDC into DeFi protocols and playing the game. On settlement,
 * earned tokens are minted to the player's wallet by an authorized minter.
 *
 * After deployment:
 *   1. Set NEXT_PUBLIC_EMPIRE_TOKEN_ADDRESS in yield-empire/.env
 *   2. The deployer is automatically registered as a minter
 *   3. Optionally add more minters via setMinter(address, true)
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    throw new Error("Deployer has no ETH. Fund the wallet first.");
  }

  const EmpireToken = await ethers.getContractFactory("EmpireToken");
  const token = await EmpireToken.deploy();

  await token.waitForDeployment();

  const address = await token.getAddress();
  console.log("\n✅ EmpireToken ($EMPIRE) deployed to:", address);
  console.log("\nNext steps:");
  console.log(`  1. Add to yield-empire/.env:`);
  console.log(`     NEXT_PUBLIC_EMPIRE_TOKEN_ADDRESS=${address}`);
  console.log(`  2. Deployer (${deployer.address}) is already a minter`);
  console.log(`  3. To add more minters: token.setMinter(address, true)`);
  console.log(`\nVerify on Etherscan:`);
  console.log(`  npx hardhat verify --network sepolia ${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
