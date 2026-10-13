// TerraChain - Decentralized Land & Property Registry Web3 Frontend
// Uses ethers.js v6 as specified in README

const HARDHAT_DEFAULT_ACCOUNTS = {
  registrar: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  rahul: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  priya: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  amit: "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
};

const DEFAULT_FALLBACK_CONTRACT = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const ABI = [
  "function registerProperty(string _id, string _location, uint256 _area, address _owner)",
  "function transferOwnership(string _id, address _newOwner, uint256 _price)",
  "function getProperty(string _id) view returns (string location, uint256 area, address currentOwner)",
  "function getHistory(string _id) view returns (tuple(address from, address to, uint256 price, uint256 timestamp)[])",
  "function totalProperties() view returns (uint256)",
  "function getAllPropertyIds() view returns (string[])",
  "function registrar() view returns (address)"
];

let contractAddress = localStorage.getItem("terraChainContractAddress") || DEFAULT_FALLBACK_CONTRACT;
let provider;
let signer;
let contract;
let readOnlyContract;
let connectedAccount = null;
let contractRegistrar = null;

// Initialize when DOM is ready
window.addEventListener("DOMContentLoaded", async () => {
  initTabs();
  updateContractDisplay();
  await loadDeploymentInfo();
  await initReadContract();
  await refreshLedgerStats();

  if (window.ethereum) {
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", () => window.location.reload());
    
    // Check if already authorized
    try {
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      if (accounts && accounts.length > 0) {
        await connectWallet();
      }
    } catch (err) {
      console.warn("Could not auto-connect:", err);
    }
  }

  document.getElementById("connectWalletBtn").addEventListener("click", connectWallet);
  document.getElementById("contractPill").addEventListener("click", openContractModal);
  document.getElementById("copyAddressBtn").addEventListener("click", () => {
    if (connectedAccount) copyText(connectedAccount);
  });
});

// Load contract deployment info from local contract-info.json if present
async function loadDeploymentInfo() {
  try {
    const res = await fetch("contract-info.json");
    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        if (!localStorage.getItem("terraChainContractAddress")) {
          contractAddress = data.address;
          updateContractDisplay();
        }
      }
    }
  } catch (e) {
    console.log("No local contract-info.json found, using current address:", contractAddress);
  }
}

function updateContractDisplay() {
  const el = document.getElementById("contractDisplay");
  if (el) {
    el.innerText = shortenAddress(contractAddress);
  }
}

// Fallback JSON-RPC read-only provider for instant queries without MetaMask
async function initReadContract() {
  try {
    let rpcProvider;
    if (window.ethereum) {
      rpcProvider = new ethers.BrowserProvider(window.ethereum);
    } else {
      rpcProvider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    }
    readOnlyContract = new ethers.Contract(contractAddress, ABI, rpcProvider);
    
    try {
      contractRegistrar = await readOnlyContract.registrar();
      const regNotice = document.getElementById("registrarAddressNotice");
      if (regNotice) regNotice.innerText = contractRegistrar;
    } catch (e) {
      console.warn("Registrar query pending or contract not yet deployed:", e.message);
    }
  } catch (err) {
    console.error("Failed to init read provider:", err);
  }
}

// Connect MetaMask
async function connectWallet() {
  if (!window.ethereum) {
    showToast("MetaMask Required", "Please install the MetaMask browser extension to interact with the blockchain.", "error");
    return;
  }

  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    connectedAccount = await signer.getAddress();
    contract = new ethers.Contract(contractAddress, ABI, signer);

    // Update UI
    document.getElementById("account").innerText = shortenAddress(connectedAccount);
    document.getElementById("accountAvatar").innerText = connectedAccount.substring(2, 4).toUpperCase();
    document.getElementById("connectWalletBtn").classList.add("hidden");
    document.getElementById("accountCard").classList.remove("hidden");

    // Fetch network
    const network = await provider.getNetwork();
    const netName = document.getElementById("networkName");
    const netBadge = document.getElementById("networkBadge");
    
    if (network.chainId === 31337n) {
      netName.innerText = "Hardhat Local (31337)";
      if (netBadge) netBadge.style.cursor = "default";
    } else {
      netName.innerText = `Chain ID: ${network.chainId.toString()} (Click to Switch)`;
      if (netBadge) {
        netBadge.style.cursor = "pointer";
        netBadge.title = "Click to switch to Hardhat Local (31337)";
        netBadge.onclick = switchOrAddHardhatNetwork;
      }
      showToast("Wrong Network", "You are on Chain ID " + network.chainId + ". Click here or open MetaMask to switch to Hardhat Local.", "error");
      await switchOrAddHardhatNetwork();
      return;
    }

    // Role detection
    await updateRoleBadge();
    showToast("Wallet Connected", `Connected as ${shortenAddress(connectedAccount)}`, "success");
    await refreshLedgerStats();
  } catch (err) {
    console.error("Connection failed:", err);
    showToast("Connection Error", err.reason || err.message || "Failed to connect wallet", "error");
  }
}

async function switchOrAddHardhatNetwork() {
  if (!window.ethereum) return;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x7a69" }]
    });
  } catch (switchError) {
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0x7a69",
              chainName: "Hardhat Local",
              rpcUrls: ["http://127.0.0.1:8545"],
              nativeCurrency: {
                name: "Ethereum",
                symbol: "ETH",
                decimals: 18
              }
            }
          ]
        });
      } catch (addError) {
        console.error("Failed to add network:", addError);
      }
    } else {
      console.error("Failed to switch network:", switchError);
    }
  }
}

async function handleAccountsChanged(accounts) {
  if (!accounts || accounts.length === 0) {
    connectedAccount = null;
    document.getElementById("connectWalletBtn").classList.remove("hidden");
    document.getElementById("accountCard").classList.add("hidden");
    showToast("Disconnected", "Wallet disconnected", "info");
  } else {
    await connectWallet();
  }
}

async function updateRoleBadge() {
  const roleEl = document.getElementById("roleBadge");
  if (!connectedAccount) {
    roleEl.className = "role-pill";
    roleEl.innerText = "Visitor";
    return;
  }

  try {
    if (!contractRegistrar && readOnlyContract) {
      contractRegistrar = await readOnlyContract.registrar();
    }
    
    if (contractRegistrar && connectedAccount.toLowerCase() === contractRegistrar.toLowerCase()) {
      roleEl.className = "role-pill role-registrar";
      roleEl.innerText = "Registrar 👑";
      return;
    }
  } catch (e) {
    console.warn("Role check error:", e);
  }

  roleEl.className = "role-pill role-owner";
  roleEl.innerText = "Connected";
}

// Register Property (Section 8 Step 8)
async function registerProperty(id, location, area, owner) {
  if (!contract) {
    await connectWallet();
    if (!contract) return;
  }

  const submitBtn = document.getElementById("btnRegisterSubmit");
  const origText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span>Mining Transaction... ⏳</span>`;

  try {
    showToast("Transaction Submitted", "Please confirm registration in MetaMask...", "info");
    const tx = await contract.registerProperty(id, location, area, owner);
    showToast("Mining Block", `Tx sent: ${shortenAddress(tx.hash)}. Awaiting confirmation...`, "info");
    
    const receipt = await tx.wait();
    showToast("Property Registered!", `Parcel ${id} recorded on-chain! Tx: ${shortenAddress(receipt.hash)}`, "success");
    
    // Clear form
    document.getElementById("registerForm").reset();
    
    // Refresh directory & stats
    await refreshLedgerStats();
    await loadAllProperties();
    
    // Switch to Search tab and show new property
    quickSearch(id);
  } catch (e) {
    console.error("Registration error:", e);
    const msg = extractErrorMessage(e);
    showToast("Registration Failed", msg, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = origText;
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const id = document.getElementById("regId").value.trim();
  const location = document.getElementById("regLocation").value.trim();
  const area = document.getElementById("regArea").value.trim();
  const owner = document.getElementById("regOwner").value.trim();

  if (!id || !location || !area || !owner) {
    showToast("Validation Error", "All fields are required.", "error");
    return;
  }

  await registerProperty(id, location, area, owner);
}

// Transfer Ownership (Section 8 Step 8)
async function transferOwnership(id, newOwner, price) {
  if (!contract) {
    await connectWallet();
    if (!contract) return;
  }

  const submitBtn = document.getElementById("btnTransferSubmit");
  const origText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span>Executing Transfer... ⏳</span>`;

  try {
    showToast("Transaction Submitted", "Please confirm title transfer in MetaMask...", "info");
    const tx = await contract.transferOwnership(id, newOwner, price);
    showToast("Transfer Mining", `Tx sent: ${shortenAddress(tx.hash)}. Waiting for block confirmation...`, "info");
    
    const receipt = await tx.wait();
    showToast("Ownership Transferred!", `Title for ${id} transferred successfully! Tx: ${shortenAddress(receipt.hash)}`, "success");
    
    // Clear form
    document.getElementById("transferForm").reset();
    
    // Refresh directory & stats
    await refreshLedgerStats();
    await loadAllProperties();
    
    // Refresh searched property view
    await searchProperty(id);
  } catch (e) {
    console.error("Transfer error:", e);
    const msg = extractErrorMessage(e);
    showToast("Transfer Failed", msg, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = origText;
  }
}

async function handleTransfer(e) {
  e.preventDefault();
  const id = document.getElementById("transId").value.trim();
  const newOwner = document.getElementById("transNewOwner").value.trim();
  const price = document.getElementById("transPrice").value.trim();

  if (!id || !newOwner || !price) {
    showToast("Validation Error", "All fields are required.", "error");
    return;
  }

  await transferOwnership(id, newOwner, price);
}

// Search Property (Section 8 Step 8)
async function searchProperty(id) {
  const targetContract = contract || readOnlyContract;
  if (!targetContract) {
    await initReadContract();
  }

  const activeContract = contract || readOnlyContract;
  const searchBtn = document.getElementById("searchBtn");
  const origText = searchBtn ? searchBtn.innerHTML : "";
  if (searchBtn) {
    searchBtn.disabled = true;
    searchBtn.innerHTML = "<span>Querying Ledger...</span>";
  }

  try {
    const p = await activeContract.getProperty(id);
    const history = await activeContract.getHistory(id);
    renderProperty(id, p, history);
  } catch (e) {
    console.error("Search error:", e);
    document.getElementById("searchResultArea").classList.add("hidden");
    showToast("Query Result", `Property '${id}' not found on the blockchain.`, "error");
  } finally {
    if (searchBtn) {
      searchBtn.disabled = false;
      searchBtn.innerHTML = origText;
    }
  }
}

function handleSearch(e) {
  e.preventDefault();
  const id = document.getElementById("searchPropertyId").value.trim();
  if (id) {
    searchProperty(id);
  }
}

function quickSearch(id) {
  switchTab("searchTab");
  document.getElementById("searchPropertyId").value = id;
  searchProperty(id);
}

// Render Property & Timeline (Section 8 Step 8)
function renderProperty(id, p, history) {
  // p[0] = location, p[1] = area, p[2] = current owner
  const location = p[0];
  const area = p[1].toString();
  const currentOwner = p[2];

  document.getElementById("resultPropertyId").innerText = id;
  document.getElementById("resultLocation").innerText = location;
  document.getElementById("resultArea").innerText = `${Number(area).toLocaleString()} sq ft`;
  document.getElementById("resultOwner").innerText = currentOwner;
  
  const historyTimeline = document.getElementById("historyTimeline");
  document.getElementById("historyCount").innerText = `${history.length} Event${history.length > 1 ? 's' : ''}`;
  historyTimeline.innerHTML = "";

  // Render each history item: [0] = from, [1] = to, [2] = price, [3] = timestamp
  history.forEach((item, index) => {
    const fromAddr = item[0];
    const toAddr = item[1];
    const price = item[2].toString();
    const timestampMs = Number(item[3]) * 1000;
    const dateFormatted = timestampMs > 0 ? new Date(timestampMs).toLocaleString() : "Genesis";

    const isGenesis = fromAddr === "0x0000000000000000000000000000000000000000";

    const itemDiv = document.createElement("div");
    itemDiv.className = `timeline-item ${isGenesis ? 'genesis' : ''}`;

    itemDiv.innerHTML = `
      <div class="timeline-dot"></div>
      <div class="timeline-card">
        <div class="timeline-top">
          <span class="event-type-badge ${isGenesis ? 'reg' : 'trans'}">
            ${isGenesis ? '🏛️ Initial Title Registration' : `🔁 Ownership Transfer #${index}`}
          </span>
          <span class="timeline-date font-mono">📅 ${dateFormatted}</span>
        </div>
        <div class="timeline-details">
          <div class="timeline-row">
            <span class="party-tag">From:</span>
            <span class="font-mono text-dim">${isGenesis ? 'Consensus Ledger (Mint)' : shortenAddress(fromAddr)}</span>
          </div>
          <div class="timeline-row">
            <span class="party-tag">To:</span>
            <span class="font-mono text-cyan">${shortenAddress(toAddr)}</span>
            <button class="copy-btn" onclick="copyText('${toAddr}')" title="Copy Address">📋</button>
          </div>
          <div class="timeline-row price-tag">
            <span>Price: ${isGenesis ? '0 (Initial Allotment)' : '₹ ' + Number(price).toLocaleString() + ' (Recorded Value)'}</span>
          </div>
        </div>
      </div>
    `;

    historyTimeline.appendChild(itemDiv);
  });

  const resultArea = document.getElementById("searchResultArea");
  resultArea.classList.remove("hidden");
  resultArea.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Refresh overall metrics and directory
async function refreshLedgerStats() {
  const targetContract = contract || readOnlyContract;
  if (!targetContract) return;

  try {
    const total = await targetContract.totalProperties();
    document.getElementById("statTotalProperties").innerText = total.toString();

    let totalArea = 0n;
    let totalTransfers = 0;

    if (total > 0n && targetContract.getAllPropertyIds) {
      const ids = await targetContract.getAllPropertyIds();
      for (const id of ids) {
        try {
          const p = await targetContract.getProperty(id);
          totalArea += BigInt(p[1]);
          const hist = await targetContract.getHistory(id);
          if (hist.length > 1) {
            totalTransfers += (hist.length - 1);
          }
        } catch (e) {
          console.warn("Property load err:", e);
        }
      }
    }

    document.getElementById("statTotalTransfers").innerText = totalTransfers.toString();
    document.getElementById("statTotalArea").innerText = `${totalArea.toLocaleString()} sq ft`;
  } catch (e) {
    console.warn("Stats refresh failed:", e.message);
  }
}

// Load all properties for the Explorer tab
async function loadAllProperties() {
  const container = document.getElementById("directoryContainer");
  const targetContract = contract || readOnlyContract;
  if (!targetContract) return;

  container.innerHTML = `<div class="loading-state">Querying smart contract for parcels...</div>`;

  try {
    const count = await targetContract.totalProperties();
    if (count === 0n) {
      container.innerHTML = `<div class="empty-state">No properties registered yet. Go to <strong>Register Property</strong> tab to create one.</div>`;
      return;
    }

    const ids = await targetContract.getAllPropertyIds();
    container.innerHTML = "";

    for (const id of ids) {
      try {
        const p = await targetContract.getProperty(id);
        const hist = await targetContract.getHistory(id);

        const card = document.createElement("div");
        card.className = "directory-card";
        card.onclick = () => quickSearch(id);

        card.innerHTML = `
          <div class="dir-header">
            <span class="dir-id">${id}</span>
            <span class="chip-sm">${hist.length} record${hist.length > 1 ? 's' : ''}</span>
          </div>
          <div class="dir-meta">📍 ${p[0]}</div>
          <div class="dir-meta">📐 ${Number(p[1]).toLocaleString()} sq ft</div>
          <div class="dir-owner" title="${p[2]}">👤 Owner: ${shortenAddress(p[2])}</div>
        `;

        container.appendChild(card);
      } catch (err) {
        console.warn(`Error loading property ${id}:`, err);
      }
    }
  } catch (e) {
    container.innerHTML = `<div class="empty-state text-dim">Could not load properties: ${e.message}</div>`;
  }
}

// Tab Switching
function initTabs() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      switchTab(tabId);
    });
  });
}

function switchTab(tabId) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

  const targetBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  const targetContent = document.getElementById(tabId);

  if (targetBtn) targetBtn.classList.add("active");
  if (targetContent) targetContent.classList.add("active");

  if (tabId === "directoryTab") {
    loadAllProperties();
  }
}

// Prefill helper functions for demo and testing
function fillTestAccount(role) {
  const addr = HARDHAT_DEFAULT_ACCOUNTS[role];
  if (!addr) return;

  const regOwnerInput = document.getElementById("regOwner");
  const transNewOwnerInput = document.getElementById("transNewOwner");

  // Check which tab is active or fill clipboard
  copyText(addr);
  showToast("Address Copied", `Copied ${role.toUpperCase()} address: ${shortenAddress(addr)}`, "info");

  if (document.getElementById("registerTab").classList.contains("active")) {
    regOwnerInput.value = addr;
  } else if (document.getElementById("transferTab").classList.contains("active")) {
    transNewOwnerInput.value = addr;
  }
}

function prefillRegisterDemo() {
  const randomNum = Math.floor(100 + Math.random() * 900);
  document.getElementById("regId").value = `PROP-${randomNum}`;
  document.getElementById("regLocation").value = "Andheri West, Mumbai";
  document.getElementById("regArea").value = "1200";
  document.getElementById("regOwner").value = HARDHAT_DEFAULT_ACCOUNTS.rahul;
  showToast("Demo Data Loaded", `Sample property PROP-${randomNum} with Rahul as owner pre-filled.`, "info");
}

function prefillTransferDemo() {
  document.getElementById("transId").value = "PROP-101";
  document.getElementById("transNewOwner").value = HARDHAT_DEFAULT_ACCOUNTS.priya;
  document.getElementById("transPrice").value = "8500000";
  checkOwnerOnFieldChange("PROP-101");
  showToast("Demo Transfer Loaded", "Prefilled PROP-101 transfer to Priya for 8,500,000", "info");
}

async function checkOwnerOnFieldChange(id) {
  const hint = document.getElementById("transCurrentOwnerHint");
  if (!id) return;
  const targetContract = contract || readOnlyContract;
  if (!targetContract) return;

  try {
    const p = await targetContract.getProperty(id);
    hint.innerHTML = `Current recorded owner: <span class="font-mono text-cyan">${shortenAddress(p[2])}</span>`;
  } catch (e) {
    hint.innerHTML = `<span style="color:var(--rose)">Property not found on chain.</span>`;
  }
}

// Contract Modal Handlers
function openContractModal() {
  document.getElementById("customContractInput").value = contractAddress;
  document.getElementById("contractModal").classList.remove("hidden");
}

function closeContractModal() {
  document.getElementById("contractModal").classList.add("hidden");
}

async function saveCustomContract() {
  const val = document.getElementById("customContractInput").value.trim();
  if (val && ethers.isAddress(val)) {
    contractAddress = val;
    localStorage.setItem("terraChainContractAddress", val);
    updateContractDisplay();
    closeContractModal();
    await initReadContract();
    if (signer) {
      contract = new ethers.Contract(contractAddress, ABI, signer);
    }
    await refreshLedgerStats();
    showToast("Contract Updated", `Connected to ${shortenAddress(val)}`, "success");
  } else {
    showToast("Invalid Address", "Please provide a valid Ethereum contract address.", "error");
  }
}

// Helper Utilities
function shortenAddress(addr) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast("Copied!", text, "info");
  }).catch(() => {
    prompt("Copy address:", text);
  });
}

function extractErrorMessage(err) {
  if (err.reason) return err.reason;
  if (err.shortMessage) return err.shortMessage;
  if (err.data && err.data.message) return err.data.message;
  if (err.info && err.info.error && err.info.error.message) return err.info.error.message;
  if (err.message) {
    const match = err.message.match(/reverted with reason string '([^']+)'/);
    if (match) return match[1];
    return err.message.substring(0, 120);
  }
  return "Transaction failed or rejected.";
}

// Toast Notifications
function showToast(title, message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  const icon = type === "success" ? "✅" : (type === "error" ? "❌" : "ℹ️");

  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${message}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(40px)";
      setTimeout(() => toast.remove(), 300);
    }
  }, 5000);
}

// Expose handlers to window for HTML inline handlers
window.handleSearch = handleSearch;
window.handleRegister = handleRegister;
window.handleTransfer = handleTransfer;
window.quickSearch = quickSearch;
window.fillTestAccount = fillTestAccount;
window.prefillRegisterDemo = prefillRegisterDemo;
window.prefillTransferDemo = prefillTransferDemo;
window.checkOwnerOnFieldChange = checkOwnerOnFieldChange;
window.openContractModal = openContractModal;
window.closeContractModal = closeContractModal;
window.saveCustomContract = saveCustomContract;
window.copyText = copyText;
window.loadAllProperties = loadAllProperties;
window.switchOrAddHardhatNetwork = switchOrAddHardhatNetwork;
