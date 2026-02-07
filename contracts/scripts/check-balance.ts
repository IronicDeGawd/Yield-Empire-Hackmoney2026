import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const BASE_SEPOLIA_RPC = process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org";
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY;

// Base Sepolia addresses
const CIRCLE_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const AAVE_USDC = "0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f";

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

async function main() {
  if (!DEPLOYER_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY not set in .env");
  }

  const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);
  const wallet = new ethers.Wallet(DEPLOYER_KEY, provider);

  console.log("========================================");
  console.log("  Deployer Balance Check — Base Sepolia");
  console.log("========================================");
  console.log("");
  console.log("Address:", wallet.address);
  console.log("");

  // ETH balance
  const ethBal = await provider.getBalance(wallet.address);
  console.log("ETH:         ", ethers.formatEther(ethBal), "ETH");

  // Circle USDC
  const circleUsdc = new ethers.Contract(CIRCLE_USDC, ERC20_ABI, provider);
  const circleBal = await circleUsdc.balanceOf(wallet.address);
  console.log("Circle USDC: ", ethers.formatUnits(circleBal, 6), "USDC");

  // Aave test USDC
  const aaveUsdc = new ethers.Contract(AAVE_USDC, ERC20_ABI, provider);
  const aaveBal = await aaveUsdc.balanceOf(wallet.address);
  console.log("Aave USDC:   ", ethers.formatUnits(aaveBal, 6), "USDC");

  console.log("");

  // Deployment readiness
  const ready = ethBal > 0n;
  if (ready) {
    console.log("✅ Ready to deploy (has ETH for gas)");
  } else {
    console.log("❌ Need ETH for gas fees");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
