import { ethers } from "hardhat";

/**
 * Deploy YieldEmpireTreasury to Base Sepolia.
 *
 * Constructor args (from FLOW.md / addresses.ts):
 *   - Circle USDC on Base Sepolia: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
 *   - Aave test USDC on Base Sepolia: 0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f
 *   - Aave V3 Pool on Base Sepolia: 0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27
 *
 * After deployment:
 *   1. Set NEXT_PUBLIC_TREASURY_ADDRESS in yield-empire/.env
 *   2. Mint Aave test USDC from faucet → transfer to treasury
 *   3. Call treasury.approveAave(amount) to let treasury spend Aave USDC
 */

const CIRCLE_USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const AAVE_USDC_BASE_SEPOLIA = "0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f";
const AAVE_POOL_BASE_SEPOLIA = "0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    throw new Error("Deployer has no ETH. Fund the wallet first.");
  }

  console.log("\nConstructor args:");
  console.log("  Circle USDC:", CIRCLE_USDC_BASE_SEPOLIA);
  console.log("  Aave USDC: ", AAVE_USDC_BASE_SEPOLIA);
  console.log("  Aave Pool: ", AAVE_POOL_BASE_SEPOLIA);

  const Treasury = await ethers.getContractFactory("YieldEmpireTreasury");
  const treasury = await Treasury.deploy(
    CIRCLE_USDC_BASE_SEPOLIA,
    AAVE_USDC_BASE_SEPOLIA,
    AAVE_POOL_BASE_SEPOLIA
  );

  await treasury.waitForDeployment();

  const address = await treasury.getAddress();
  console.log("\n✅ YieldEmpireTreasury deployed to:", address);
  console.log("\nNext steps:");
  console.log(`  1. Add to yield-empire/.env:`);
  console.log(`     NEXT_PUBLIC_TREASURY_ADDRESS=${address}`);
  console.log(`  2. Mint Aave test USDC from faucet (https://staging.aave.com/faucet)`);
  console.log(`  3. Transfer ~1000 Aave test USDC to ${address}`);
  console.log(`  4. Call treasury.approveAave(1000000000) to approve Aave Pool`);
  console.log(`\nVerify on Basescan:`);
  console.log(`  npx hardhat verify --network baseSepolia ${address} ${CIRCLE_USDC_BASE_SEPOLIA} ${AAVE_USDC_BASE_SEPOLIA} ${AAVE_POOL_BASE_SEPOLIA}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
