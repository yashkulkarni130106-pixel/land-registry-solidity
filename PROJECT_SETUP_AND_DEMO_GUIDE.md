# TerraChain: Complete Setup, Execution & Demo Guide

A complete, beginner-friendly handbook for running the **Land & Property Record Registry** smart contract on a local Ethereum blockchain (Hardhat) and interacting with it using **MetaMask** and the Web3 frontend.

---

## 1. Prerequisites

Make sure you have:
1. **Node.js** (v18 or higher) and **npm** installed.
2. **MetaMask** browser extension installed in Chrome, Brave, or Edge.
3. Git installed.

---

## 2. Project Architecture Overview

```
[ Frontend Browser (http://localhost:3000) ]
                    │
                    ▼ (Web3 user interactions & transaction signing)
             [ MetaMask Wallet ]
                    │
                    ▼ (JSON-RPC requests over http://127.0.0.1:8545)
          [ Hardhat Local Node (EVM) ]
                    │
                    ▼ (Executes immutable bytecode logic)
       [ LandRegistry.sol Smart Contract ]
```

---

## 3. Running the Project (Step-by-Step)

You need **3 terminal windows** open in this project folder (`c:\Users\yashg\OneDrive\Desktop\blockchain project`):

### Terminal 1: Start the Local Blockchain Node
```bash
npm run node
```
* **What this does:** Boots up a local Ethereum network on `http://127.0.0.1:8545` (Chain ID `31337`) with 20 pre-funded test accounts (10,000 ETH each).
* **Important:** Keep this terminal running in the background.

---

### Terminal 2: Deploy the Smart Contract
```bash
npm run deploy
```
* **What this does:** Compiles `LandRegistry.sol`, deploys it using Account #0 (Registrar), and automatically saves the deployed contract address and ABI into `frontend/contract-info.json`.
* **Output:**
  ```text
  Deploying LandRegistry with account: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  LandRegistry deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
  ```

---

### Terminal 3: Start the Web3 Frontend
```bash
npm run serve
```
* **What this does:** Serves the frontend at:
  👉 **`http://localhost:3000`**
* Open this URL in the browser where your MetaMask extension is installed.

---

## 4. MetaMask Setup

### Step A: Add the Hardhat Local Network
1. Open the **MetaMask** extension.
2. Click the network dropdown in the top-left corner (usually says *Ethereum Mainnet*).
3. Click **Add network** (or **Add network manually**).
4. Enter these exact values:
   * **Network Name:** `Hardhat Local`
   * **New RPC URL:** `http://127.0.0.1:8545`
   * **Chain ID:** `31337`
   * **Currency Symbol:** `ETH`
5. Click **Save** and switch to **Hardhat Local**.
   *(Note: If MetaMask shows a yellow warning about "GoChain Testnet", it is completely safe to ignore).*

---

### Step B: Import the 3 Test Profiles
Click the account selector at the top-center of MetaMask ➔ Click **Add wallet** (or **+ Add account**) ➔ Select **Import account** ➔ Paste the private key:

#### 1. Account #0 — Government Registrar (Deployer)
* **Address:** `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
* **Private Key:**
  ```text
  0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
  ```
* *(Rename this account to **Registrar**)*

#### 2. Account #1 — Rahul (First Owner)
* **Address:** `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`
* **Private Key:**
  ```text
  0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
  ```
* *(Rename this account to **Rahul**)*

#### 3. Account #2 — Priya (Buyer)
* **Address:** `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`
* **Private Key:**
  ```text
  0x5de4111afa1a4b94908f83103eb2f954b14e043d4e48a360383e104a3637c010
  ```
* *(Rename this account to **Priya**)*

Each account will display **10,000 ETH** balance.

---

## 5. Complete Testing & Live Demo Walkthrough

### Flow 1: Register a Property (Government Officer)
1. In MetaMask, switch to **Account #0 (Registrar)**.
2. In your browser (`http://localhost:3000`), click **Connect MetaMask** (top-right badge shows `Registrar 👑`).
3. Click the **🏛️ Register Property** tab.
4. Click **"Fill Demo Data"** (pre-fills `PROP-101`, `1200` sq ft, `Andheri West, Mumbai`, Owner: Rahul).
5. Click **"Deploy Property Title to Blockchain"**.
6. In the MetaMask popup, click **Confirm**.
7. ✅ Success notification appears with the transaction hash.

---

### Flow 2: Search & Verify Title (Public User)
1. Click the **🔍 Search & Verify Property** tab.
2. Click the **`PROP-101`** chip and click **"Query Blockchain"** *(This is a free read-only call; no gas or wallet signature required)*.
3. You will see:
   * **Location:** *Andheri West, Mumbai*
   * **Parcel Area:** *1,200 sq ft*
   * **Current Legal Owner:** *Rahul's address (`0x7099...`)*
   * **Timeline:** Genesis Title Registration with block timestamp.

---

### Flow 3: Transfer Ownership from Rahul to Priya
1. In MetaMask, switch your active account to **Rahul (Account #1)**.
2. Go to the **🔁 Transfer Ownership** tab.
3. Click **"Fill Demo Transfer"** (pre-fills `PROP-101`, recipient `0x3C44...` [Priya], price `8500000`).
4. Click **"Sign & Execute Title Transfer"**.
5. In the MetaMask popup, click **Confirm**.
6. ✅ The smart contract validates that Rahul is the genuine owner and writes the deed transfer to the ledger.

---

### Flow 4: Verify the Updated Title & Audit Trail
1. Go back to the **🔍 Search & Verify Property** tab.
2. Query **`PROP-101`** again:
   * **Current Owner** is now **Priya** (`0x3C44...`).
   * **Timeline** now shows **2 permanent entries**:
     1. Genesis Allotment to Rahul.
     2. Transfer #1: From Rahul ➔ Priya for ₹ 8,500,000.

---

### Flow 5: The Fraud Attempt (Double-Selling Prevention)
1. Keep MetaMask on **Rahul (Account #1)** (who sold the land and is no longer the owner).
2. Go to the **Transfer Ownership** tab.
3. Try to transfer `PROP-101` again to Amit or any other address.
4. Click **Sign & Execute Title Transfer**.
5. ❌ **Result:** MetaMask and the smart contract immediately revert with the error:
   ```text
   reverted with reason string 'Only current owner can transfer'
   ```
   **Why this happens:** The smart contract modifier `require(msg.sender == p.currentOwner)` verifies ECDSA signatures at the consensus layer. Double-selling is mathematically impossible on the blockchain.

---

## 6. Useful npm Commands

| Command | Description |
|---|---|
| `npm test` | Runs the automated Hardhat unit tests (8/8 passing) |
| `npm run compile` | Compiles Solidity contracts |
| `npm run node` | Starts local blockchain node at `http://127.0.0.1:8545` |
| `npm run deploy` | Deploys contract to localhost and creates `contract-info.json` |
| `npm run serve` | Serves frontend at `http://localhost:3000` |

---

## 7. Troubleshooting & Common Fixes

* **MetaMask displays "Nonce too high" or transaction hangs:**
  * If you restart `npm run node`, the blockchain resets to block 0.
  * In MetaMask: Go to **Settings ➔ Advanced ➔ Clear activity tab data** (or *Reset account*). This resets the transaction counter without losing your private keys.
* **Contract address not found:**
  * Ensure `npm run deploy` has been run while `npm run node` was active.
  * Check that `frontend/contract-info.json` exists.
* **Wrong network warning in dApp:**
  * Click the green network pill at the top of the TerraChain website to trigger an automatic 1-click switch to `Hardhat Local (31337)`.
