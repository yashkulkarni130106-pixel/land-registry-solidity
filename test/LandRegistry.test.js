const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LandRegistry", function () {
  let registry, registrar, rahul, priya, amit;

  beforeEach(async () => {
    [registrar, rahul, priya, amit] = await ethers.getSigners();
    registry = await ethers.deployContract("LandRegistry");
  });

  it("registrar can register a property", async () => {
    await registry.registerProperty("PROP-101", "Andheri, Mumbai", 1200, rahul.address);
    const p = await registry.getProperty("PROP-101");
    expect(p.location).to.equal("Andheri, Mumbai");
    expect(p.area).to.equal(1200n);
    expect(p.currentOwner).to.equal(rahul.address);
  });

  it("non-registrar cannot register", async () => {
    await expect(
      registry.connect(rahul).registerProperty("PROP-102", "Pune", 900, rahul.address)
    ).to.be.revertedWith("Only registrar");
  });

  it("cannot register duplicate property ID", async () => {
    await registry.registerProperty("PROP-101", "Andheri, Mumbai", 1200, rahul.address);
    await expect(
      registry.registerProperty("PROP-101", "Bandra, Mumbai", 1500, priya.address)
    ).to.be.revertedWith("Property already exists");
  });

  it("owner can transfer", async () => {
    await registry.registerProperty("PROP-101", "Andheri, Mumbai", 1200, rahul.address);
    await registry.connect(rahul).transferOwnership("PROP-101", priya.address, 8500000);
    const p = await registry.getProperty("PROP-101");
    expect(p.currentOwner).to.equal(priya.address);
  });

  it("blocks double selling", async () => {
    await registry.registerProperty("PROP-101", "Andheri, Mumbai", 1200, rahul.address);
    await registry.connect(rahul).transferOwnership("PROP-101", priya.address, 8500000);
    await expect(
      registry.connect(rahul).transferOwnership("PROP-101", amit.address, 9000000)
    ).to.be.revertedWith("Only current owner can transfer");
  });

  it("prevents transfer to self or invalid address or 0 price", async () => {
    await registry.registerProperty("PROP-101", "Andheri, Mumbai", 1200, rahul.address);
    await expect(
      registry.connect(rahul).transferOwnership("PROP-101", rahul.address, 8500000)
    ).to.be.revertedWith("Invalid new owner");

    await expect(
      registry.connect(rahul).transferOwnership("PROP-101", priya.address, 0)
    ).to.be.revertedWith("Invalid price");
  });

  it("keeps full history", async () => {
    await registry.registerProperty("PROP-101", "Andheri, Mumbai", 1200, rahul.address);
    await registry.connect(rahul).transferOwnership("PROP-101", priya.address, 8500000);
    const h = await registry.getHistory("PROP-101");
    expect(h.length).to.equal(2);
    expect(h[0].from).to.equal(ethers.ZeroAddress);
    expect(h[0].to).to.equal(rahul.address);
    expect(h[1].from).to.equal(rahul.address);
    expect(h[1].to).to.equal(priya.address);
    expect(h[1].price).to.equal(8500000n);
  });

  it("tracks total properties count and IDs list", async () => {
    expect(await registry.totalProperties()).to.equal(0n);
    await registry.registerProperty("PROP-101", "Andheri, Mumbai", 1200, rahul.address);
    await registry.registerProperty("PROP-102", "Pune", 900, priya.address);
    expect(await registry.totalProperties()).to.equal(2n);
    const ids = await registry.getAllPropertyIds();
    expect(ids).to.deep.equal(["PROP-101", "PROP-102"]);
  });
});
