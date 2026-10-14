const hre = require("hardhat");

async function main() {
  const priyaAddresses = [
    "0xf48962f381b9A88CBFdC1A18DCf41b9752c16561", // User's active Priya address
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"  // Default Hardhat Account #2
  ];
  const rahulAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

  // Refill Rahul
  await hre.network.provider.send("hardhat_setBalance", [
    rahulAddress,
    "0x21E19E0C9BAB2400000" // 10,000 ETH
  ]);

  // Refill Priya
  for (const addr of priyaAddresses) {
    await hre.network.provider.send("hardhat_setBalance", [
      addr,
      "0x21E19E0C9BAB2400000" // 10,000 ETH
    ]);
    const balance = await hre.ethers.provider.getBalance(addr);
    console.log(`Refilled ${addr} to: ${hre.ethers.formatEther(balance)} ETH`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
