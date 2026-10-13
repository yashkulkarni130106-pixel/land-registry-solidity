const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying LandRegistry with account:", deployer.address);

  const registry = await hre.ethers.deployContract("LandRegistry");
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log("LandRegistry deployed to:", address);

  // Export contract address and ABI for frontend
  const artifact = await hre.artifacts.readArtifact("LandRegistry");
  const contractInfo = {
    address: address,
    registrar: deployer.address,
    abi: artifact.abi,
    network: hre.network.name,
    chainId: hre.network.config.chainId || 31337,
    deployedAt: new Date().toISOString()
  };

  const frontendDir = path.join(__dirname, "..", "frontend");
  if (!fs.existsSync(frontendDir)) {
    fs.mkdirSync(frontendDir, { recursive: true });
  }

  const outputPath = path.join(frontendDir, "contract-info.json");
  fs.writeFileSync(outputPath, JSON.stringify(contractInfo, null, 2));
  console.log("Wrote contract deployment info to:", outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
