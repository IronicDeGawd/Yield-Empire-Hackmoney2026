import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("EmpireToken", function () {
  async function deployFixture() {
    const [owner, minter, player, other] = await ethers.getSigners();
    const EmpireToken = await ethers.getContractFactory("EmpireToken");
    const token = await EmpireToken.deploy();
    return { token, owner, minter, player, other };
  }

  describe("Deployment", function () {
    it("has correct name and symbol", async function () {
      const { token } = await loadFixture(deployFixture);
      expect(await token.name()).to.equal("Empire Token");
      expect(await token.symbol()).to.equal("EMPIRE");
    });

    it("has 18 decimals", async function () {
      const { token } = await loadFixture(deployFixture);
      expect(await token.decimals()).to.equal(18);
    });

    it("sets deployer as owner", async function () {
      const { token, owner } = await loadFixture(deployFixture);
      expect(await token.owner()).to.equal(owner.address);
    });

    it("registers deployer as minter", async function () {
      const { token, owner } = await loadFixture(deployFixture);
      expect(await token.minters(owner.address)).to.be.true;
    });

    it("starts with zero total supply", async function () {
      const { token } = await loadFixture(deployFixture);
      expect(await token.totalSupply()).to.equal(0);
    });
  });

  describe("Minting", function () {
    it("owner can mint tokens", async function () {
      const { token, owner, player } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("100");
      await token.connect(owner).mint(player.address, amount);
      expect(await token.balanceOf(player.address)).to.equal(amount);
    });

    it("authorized minter can mint tokens", async function () {
      const { token, owner, minter, player } = await loadFixture(deployFixture);
      await token.connect(owner).setMinter(minter.address, true);
      const amount = ethers.parseEther("50");
      await token.connect(minter).mint(player.address, amount);
      expect(await token.balanceOf(player.address)).to.equal(amount);
    });

    it("non-minter cannot mint", async function () {
      const { token, other, player } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("100");
      await expect(
        token.connect(other).mint(player.address, amount)
      ).to.be.revertedWith("Not authorized minter");
    });

    it("emits Transfer event from address(0) on mint", async function () {
      const { token, owner, player } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("100");
      await expect(token.connect(owner).mint(player.address, amount))
        .to.emit(token, "Transfer")
        .withArgs(ethers.ZeroAddress, player.address, amount);
    });

    it("enforces daily mint cap per recipient", async function () {
      const { token, owner, player } = await loadFixture(deployFixture);
      const cap = ethers.parseEther("10000");
      // Mint exactly at the cap
      await token.connect(owner).mint(player.address, cap);
      // One more wei should fail
      await expect(
        token.connect(owner).mint(player.address, 1n)
      ).to.be.revertedWith("Daily mint cap exceeded");
    });

    it("daily cap resets on new day", async function () {
      const { token, owner, player } = await loadFixture(deployFixture);
      const cap = ethers.parseEther("10000");
      await token.connect(owner).mint(player.address, cap);

      // Advance time by 1 day
      await ethers.provider.send("evm_increaseTime", [86400]);
      await ethers.provider.send("evm_mine", []);

      // Should be able to mint again
      await token.connect(owner).mint(player.address, cap);
      expect(await token.balanceOf(player.address)).to.equal(cap * 2n);
    });

    it("DAILY_MINT_CAP is 10,000 tokens", async function () {
      const { token } = await loadFixture(deployFixture);
      expect(await token.DAILY_MINT_CAP()).to.equal(ethers.parseEther("10000"));
    });
  });

  describe("Minter management", function () {
    it("owner can add a minter", async function () {
      const { token, owner, minter } = await loadFixture(deployFixture);
      await token.connect(owner).setMinter(minter.address, true);
      expect(await token.minters(minter.address)).to.be.true;
    });

    it("owner can revoke a minter", async function () {
      const { token, owner, minter } = await loadFixture(deployFixture);
      await token.connect(owner).setMinter(minter.address, true);
      await token.connect(owner).setMinter(minter.address, false);
      expect(await token.minters(minter.address)).to.be.false;
    });

    it("non-owner cannot set minter", async function () {
      const { token, other, minter } = await loadFixture(deployFixture);
      await expect(
        token.connect(other).setMinter(minter.address, true)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("emits MinterUpdated event", async function () {
      const { token, owner, minter } = await loadFixture(deployFixture);
      await expect(token.connect(owner).setMinter(minter.address, true))
        .to.emit(token, "MinterUpdated")
        .withArgs(minter.address, true);
    });
  });

  describe("ERC-20 standard", function () {
    it("transfer works", async function () {
      const { token, owner, player, other } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("100");
      await token.connect(owner).mint(player.address, amount);
      await token.connect(player).transfer(other.address, amount);
      expect(await token.balanceOf(other.address)).to.equal(amount);
      expect(await token.balanceOf(player.address)).to.equal(0);
    });

    it("approve and transferFrom works", async function () {
      const { token, owner, player, other } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("100");
      await token.connect(owner).mint(player.address, amount);
      await token.connect(player).approve(other.address, amount);
      await token.connect(other).transferFrom(player.address, other.address, amount);
      expect(await token.balanceOf(other.address)).to.equal(amount);
    });
  });
});
