import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const BASE_SEPOLIA_RPC = process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org";
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY;

const TREASURY_ADDRESS = "0x0eF3f12A527Ca207e5024A955F2fA20A43a6e5a1";
const AAVE_USDC = "0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f";

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

const TREASURY_ABI = [
  "function approveAave(uint256 amount)",
  "function owner() view returns (address)",
];

async function main() {
  if (!DEPLOYER_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY not set in .env");
  }

  const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);
  const wallet = new ethers.Wallet(DEPLOYER_KEY, provider);

  const aaveUsdc = new ethers.Contract(AAVE_USDC, ERC20_ABI, wallet);
  const treasury = new ethers.Contract(TREASURY_ADDRESS, TREASURY_ABI, wallet);

  // Check current balances
  const walletBal = await aaveUsdc.balanceOf(wallet.address);
  const treasuryBal = await aaveUsdc.balanceOf(TREASURY_ADDRESS);

  console.log("Deployer Aave USDC:", ethers.formatUnits(walletBal, 6));
  console.log("Treasury Aave USDC:", ethers.formatUnits(treasuryBal, 6));

  if (walletBal === 0n) {
    console.log("\nNo Aave USDC to transfer. Skipping.");
    return;
  }

  // Step 1: Transfer all Aave USDC to treasury
  console.log(`\n1. Transferring ${ethers.formatUnits(walletBal, 6)} Aave USDC to treasury...`);
  const tx1 = await aaveUsdc.transfer(TREASURY_ADDRESS, walletBal);
  await tx1.wait();
  console.log("   tx:", tx1.hash);

  // Step 2: Approve Aave Pool to spend treasury's Aave USDC
  const newTreasuryBal = await aaveUsdc.balanceOf(TREASURY_ADDRESS);
  console.log(`\n2. Approving Aave Pool to spend ${ethers.formatUnits(newTreasuryBal, 6)} Aave USDC...`);
  const tx2 = await treasury.approveAave(newTreasuryBal);
  await tx2.wait();
  console.log("   tx:", tx2.hash);

  console.log("\n✅ Treasury funded and approved!");
  console.log("   Treasury:", TREASURY_ADDRESS);
  console.log("   Aave USDC balance:", ethers.formatUnits(newTreasuryBal, 6));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
