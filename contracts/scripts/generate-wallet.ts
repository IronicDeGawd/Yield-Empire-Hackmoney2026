import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

/**
 * Generates a fresh deployer wallet for contract deployment.
 * Outputs the private key and address, and optionally writes to .env.
 *
 * Usage: npm run generate-wallet
 */

function main() {
  const wallet = ethers.Wallet.createRandom();

  console.log("========================================");
  console.log("  Yield Empire — Deployer Wallet");
  console.log("========================================");
  console.log("");
  console.log("Address:     ", wallet.address);
  console.log("Private Key: ", wallet.privateKey);
  console.log("");
  console.log("⚠️  SAVE THE PRIVATE KEY — it cannot be recovered!");
  console.log("");
  console.log("Next steps:");
  console.log(`  1. Fund ${wallet.address} with Base Sepolia ETH`);
  console.log("     Faucets:");
  console.log("       - https://www.alchemy.com/faucets/base-sepolia");
  console.log("       - https://faucet.quicknode.com/base/sepolia");
  console.log("  2. Run: npm run deploy");
  console.log("");

  // Write to .env file
  const envPath = path.join(__dirname, "..", ".env");
  const envExists = fs.existsSync(envPath);

  if (envExists) {
    const content = fs.readFileSync(envPath, "utf-8");
    if (content.includes("DEPLOYER_PRIVATE_KEY=") && !content.includes("DEPLOYER_PRIVATE_KEY=\n") && !content.includes("DEPLOYER_PRIVATE_KEY=\r")) {
      console.log("⚠️  .env already has a DEPLOYER_PRIVATE_KEY set. Not overwriting.");
      console.log("   Delete it manually if you want to regenerate.");
      return;
    }
  }

  const envContent = envExists
    ? fs.readFileSync(envPath, "utf-8").replace(
        /DEPLOYER_PRIVATE_KEY=.*/,
        `DEPLOYER_PRIVATE_KEY=${wallet.privateKey}`
      )
    : `DEPLOYER_PRIVATE_KEY=${wallet.privateKey}\n`;

  // If the key wasn't in the file, append it
  const finalContent = envContent.includes(wallet.privateKey)
    ? envContent
    : envContent.trimEnd() + `\nDEPLOYER_PRIVATE_KEY=${wallet.privateKey}\n`;

  fs.writeFileSync(envPath, finalContent);
  console.log("✅ Written to .env");
}

main();
