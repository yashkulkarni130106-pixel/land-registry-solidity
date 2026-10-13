# Land / Property Record Registry (Solidity + Ethereum)

A land registry built as a **Solidity smart contract** running on a local Ethereum blockchain (Hardhat). A simple HTML, CSS and JavaScript page talks to the contract through **MetaMask** and **ethers.js**.

The registrar registers properties. Owners transfer their own properties. Every action is stored on the blockchain, so ownership history is permanent and cannot be edited.

---

## 1. Project Goal

- Demonstrate blockchain using a real smart contract (Solidity).
- Keep a permanent, transparent ownership history for each property.
- Prevent fraud: **only the current owner can transfer a property**, so double selling is impossible.

## 2. Features

| Feature | Description |
|---|---|
| Register Property | Only the registrar (contract deployer) can add a property with its first owner |
| Transfer Ownership | Only the current owner can transfer the property to a new wallet address |
| Search Property | View location, area, current owner and full ownership history |
| Events / History | Every registration and transfer is recorded permanently |
| Wallet Login | Users connect with MetaMask; their wallet address is their identity |

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Smart contract | Solidity (^0.8.20) |
| Blockchain / dev environment | Hardhat (local Ethereum network) |
| Wallet | MetaMask |
| Frontend | HTML, CSS, JavaScript |
| Blockchain library | ethers.js v6 (loaded from CDN) |

## 4. Folder Structure

```
land-registry-solidity/
├── contracts/
│   └── LandRegistry.sol       # Smart contract
├── scripts/
│   └── deploy.js              # Deploys the contract
├── test/
│   └── LandRegistry.test.js   # Contract tests
├── frontend/
│   ├── index.html             # UI
│   ├── style.css
│   └── app.js                 # Connects to MetaMask + contract
├── hardhat.config.js
├── package.json
└── README.md
```

## 5. Roles

| Role | Who | Can do |
|---|---|---|
| Registrar | The account that deployed the contract | Register new properties |
| Owner | Wallet address that owns a property | Transfer their own property |
| Anyone | Any wallet or visitor | Search and view properties and history |

## 6. Smart Contract Design

### Data stored

```
Property:  propertyId, location, area, currentOwner, exists
Transfer:  from, to, price, timestamp     (one entry per ownership change)
```

- `mapping(string => Property)` stores every property by its ID.
- `mapping(string => Transfer[])` stores each property's ownership history.

### Functions

| Function | Who can call | Purpose |
|---|---|---|
| `registerProperty(id, location, area, owner)` | Registrar only | Add a new property |
| `transferOwnership(id, newOwner, price)` | Current owner only | Move ownership |
| `getProperty(id)` | Anyone (read-only, free) | Returns location, area, current owner |
| `getHistory(id)` | Anyone (read-only, free) | Returns all ownership records |
| `totalProperties()` | Anyone (read-only, free) | Number of registered properties |

### Rules enforced by the contract

| Rule | Error message |
|---|---|
| Only the registrar can register | "Only registrar" |
| Property ID must be new | "Property already exists" |
| Property must exist for transfer | "Property not found" |
| Caller must be the current owner | "Only current owner can transfer" |
| New owner must be valid and different | "Invalid new owner" |
| Price must be greater than 0 | "Invalid price" |

### Contract code (`contracts/LandRegistry.sol`)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract LandRegistry {
    address public registrar;

    struct Property {
        string propertyId;
        string location;
        uint256 area;           // in sq ft
        address currentOwner;
        bool exists;
    }

    struct Transfer {
        address from;
        address to;
        uint256 price;          // 0 for first registration
        uint256 timestamp;
    }

    mapping(string => Property) private properties;
    mapping(string => Transfer[]) private history;
    string[] private propertyIds;

    event PropertyRegistered(string propertyId, address indexed owner, uint256 timestamp);
    event OwnershipTransferred(
        string propertyId,
        address indexed from,
        address indexed to,
        uint256 price,
        uint256 timestamp
    );

    modifier onlyRegistrar() {
        require(msg.sender == registrar, "Only registrar");
        _;
    }

    constructor() {
        registrar = msg.sender;
    }

    function registerProperty(
        string memory _id,
        string memory _location,
        uint256 _area,
        address _owner
    ) public onlyRegistrar {
        require(!properties[_id].exists, "Property already exists");
        require(_owner != address(0), "Invalid owner");

        properties[_id] = Property(_id, _location, _area, _owner, true);
        propertyIds.push(_id);
        history[_id].push(Transfer(address(0), _owner, 0, block.timestamp));

        emit PropertyRegistered(_id, _owner, block.timestamp);
    }

    function transferOwnership(
        string memory _id,
        address _newOwner,
        uint256 _price
    ) public {
        Property storage p = properties[_id];
        require(p.exists, "Property not found");
        require(msg.sender == p.currentOwner, "Only current owner can transfer");
        require(_newOwner != address(0) && _newOwner != msg.sender, "Invalid new owner");
        require(_price > 0, "Invalid price");

        history[_id].push(Transfer(msg.sender, _newOwner, _price, block.timestamp));
        p.currentOwner = _newOwner;

        emit OwnershipTransferred(_id, msg.sender, _newOwner, _price, block.timestamp);
    }

    function getProperty(string memory _id)
        public
        view
        returns (string memory location, uint256 area, address currentOwner)
    {
        Property storage p = properties[_id];
        require(p.exists, "Property not found");
        return (p.location, p.area, p.currentOwner);
    }

    function getHistory(string memory _id) public view returns (Transfer[] memory) {
        require(properties[_id].exists, "Property not found");
        return history[_id];
    }

    function totalProperties() public view returns (uint256) {
        return propertyIds.length;
    }
}
```

## 7. Workflow

### A. Overall flow

```
        Registrar                Owner / Anyone
            │                         │
            ▼                         ▼
   Web page (HTML/CSS/JS)  ←→  MetaMask (signs transactions)
            │
            ▼
      ethers.js
            │
            ▼
  LandRegistry smart contract  (on Hardhat local blockchain)
```

### B. Register Flow

```
Registrar connects MetaMask (deployer account)
        │
        ▼
Fills form: Property ID, location, area, first owner's wallet address
        │
        ▼
Clicks Register → MetaMask asks to confirm the transaction
        │
        ▼
Contract checks: caller is registrar? ID is new? owner address valid?
   ├── No  → transaction reverts with an error message
   └── Yes → property saved + first history entry + PropertyRegistered event
        │
        ▼
UI shows "Property registered" and the transaction hash
```

### C. Transfer Flow

```
Current owner connects MetaMask
        │
        ▼
Fills form: Property ID, new owner's address, sale price
        │
        ▼
Clicks Transfer → MetaMask confirms
        │
        ▼
Contract checks: property exists? caller is current owner?
                 new owner valid and different? price > 0?
   ├── No  → reverts (e.g. "Only current owner can transfer")
   └── Yes → history entry added, owner updated, OwnershipTransferred event
        │
        ▼
UI shows success and the new owner
```

### D. Search Flow (free, no MetaMask confirmation)

```
Enter Property ID
        │
        ▼
Call getProperty(id) and getHistory(id)
        │
        ▼
Show location, area, current owner and the ownership timeline
```

## 8. Development Steps

### Step 1: Setup the project

```bash
mkdir land-registry-solidity && cd land-registry-solidity
npm init -y
npm install --save-dev hardhat@2 @nomicfoundation/hardhat-toolbox@4
npx hardhat init        # choose "Create a JavaScript project"
```

Delete the sample contract, test and script files that Hardhat creates.

### Step 2: Write the smart contract

Create `contracts/LandRegistry.sol` using the code in section 6.

### Step 3: Compile

```bash
npx hardhat compile
```

### Step 4: Write tests (`test/LandRegistry.test.js`)

```js
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
    expect(p.currentOwner).to.equal(rahul.address);
  });

  it("non-registrar cannot register", async () => {
    await expect(
      registry.connect(rahul).registerProperty("PROP-102", "Pune", 900, rahul.address)
    ).to.be.revertedWith("Only registrar");
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

  it("keeps full history", async () => {
    await registry.registerProperty("PROP-101", "Andheri, Mumbai", 1200, rahul.address);
    await registry.connect(rahul).transferOwnership("PROP-101", priya.address, 8500000);
    const h = await registry.getHistory("PROP-101");
    expect(h.length).to.equal(2);
  });
});
```

Run:
```bash
npx hardhat test
```

### Step 5: Deployment script (`scripts/deploy.js`)

```js
async function main() {
  const registry = await ethers.deployContract("LandRegistry");
  await registry.waitForDeployment();
  console.log("LandRegistry deployed to:", await registry.getAddress());
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
```

### Step 6: Start the local blockchain and deploy

Terminal 1:
```bash
npx hardhat node
```
This starts a local blockchain at `http://127.0.0.1:8545` and prints 20 test accounts with private keys. **Account #0 is the registrar.**

Terminal 2:
```bash
npx hardhat run scripts/deploy.js --network localhost
```
Copy the printed contract address.

### Step 7: Setup MetaMask

1. Add a custom network: RPC URL `http://127.0.0.1:8545`, Chain ID `31337`, currency `ETH`.
2. Import 2 or 3 accounts from the Hardhat node output using their private keys (Account #0 = registrar, #1 = Rahul, #2 = Priya).

These are test accounts with fake ETH. Never use them on a real network.

### Step 8: Build the frontend (`frontend/`)

**`index.html`**
- Load ethers from the CDN: `https://cdnjs.cloudflare.com/ajax/libs/ethers/6.7.0/ethers.umd.min.js`
- A "Connect Wallet" button that shows the connected address
- Three sections: **Register** (registrar), **Transfer** (owner), **Search** (everyone)
- A result/message area for success and error messages

**`app.js`** (core logic)

```js
const CONTRACT_ADDRESS = "PASTE_DEPLOYED_ADDRESS_HERE";

const ABI = [
  "function registerProperty(string _id, string _location, uint256 _area, address _owner)",
  "function transferOwnership(string _id, address _newOwner, uint256 _price)",
  "function getProperty(string _id) view returns (string location, uint256 area, address currentOwner)",
  "function getHistory(string _id) view returns (tuple(address from, address to, uint256 price, uint256 timestamp)[])",
  "function totalProperties() view returns (uint256)"
];

let contract;

async function connectWallet() {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
  document.getElementById("account").innerText = await signer.getAddress();
}

async function registerProperty(id, location, area, owner) {
  try {
    const tx = await contract.registerProperty(id, location, area, owner);
    await tx.wait();
    showMessage("Property registered! Tx: " + tx.hash, true);
  } catch (e) {
    showMessage(e.reason || e.shortMessage || "Transaction failed", false);
  }
}

async function transferOwnership(id, newOwner, price) {
  try {
    const tx = await contract.transferOwnership(id, newOwner, price);
    await tx.wait();
    showMessage("Ownership transferred! Tx: " + tx.hash, true);
  } catch (e) {
    showMessage(e.reason || e.shortMessage || "Transaction failed", false);
  }
}

async function searchProperty(id) {
  try {
    const p = await contract.getProperty(id);
    const history = await contract.getHistory(id);
    // p[0] = location, p[1] = area, p[2] = current owner
    // each history item: [0] = from, [1] = to, [2] = price, [3] = timestamp
    renderProperty(id, p, history);
  } catch (e) {
    showMessage("Property not found", false);
  }
}
```

You write `showMessage()` and `renderProperty()`. `renderProperty()` should show the details and a timeline. Convert `timestamp` with `new Date(Number(item[3]) * 1000)`.

### Step 9: Run the frontend

Serve the `frontend/` folder with the VS Code **Live Server** extension, or:
```bash
npx serve frontend
```
Open it in the browser that has MetaMask.

### Step 10: Test the full flow

| Test | Expected result |
|---|---|
| Registrar registers PROP-101 for Rahul's address | Success |
| Non-registrar tries to register | Rejected: "Only registrar" |
| Register PROP-101 again | Rejected: "Property already exists" |
| Rahul transfers PROP-101 to Priya | Success |
| Rahul tries to transfer PROP-101 again | Rejected: "Only current owner can transfer" |
| Priya (current owner) tries to transfer the property to her own address | Rejected: "Invalid new owner" |
| Search PROP-101 | Current owner Priya, history with 2 entries |
| Search PROP-999 | "Property not found" |

## 9. Demo Script

1. Start the Hardhat node and deploy the contract.
2. Connect MetaMask as the registrar and register **PROP-101** for Rahul.
3. Switch MetaMask to Rahul and transfer the property to Priya.
4. Search PROP-101 and show the ownership timeline.
5. **Fraud attempt:** switch back to Rahul and try to transfer PROP-101 again. The smart contract rejects it.
6. Show the Hardhat node terminal: every transaction is logged with its hash and block number.

## 10. Why Solidity and Blockchain Here?

- The rules (who can register, who can transfer) live in the **smart contract**, not in a server that someone could change.
- Past records cannot be edited. Even the registrar cannot rewrite history.
- Ownership is tied to a wallet address, so a transfer needs the owner's signature through MetaMask.

## 11. Limitations

- It runs on a local Hardhat network, not a public blockchain.
- Wallet addresses are not linked to real-world identities (no KYC).
- Property details are stored on-chain, which is costly on real networks.
- One registrar controls registration. There is no approval workflow.
- It is an educational demo and has no legal validity.

## 12. Future Improvements

- Deploy to a public testnet such as Sepolia (using test ETH from a faucet)
- Transfer approval: the seller proposes, the buyer accepts, and the registrar approves
- Store the sale deed on IPFS and keep only its hash on-chain
- Multiple registrars with an admin role (OpenZeppelin `AccessControl`)
- Show the history using contract events (`PropertyRegistered`, `OwnershipTransferred`)
