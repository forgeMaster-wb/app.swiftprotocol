import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import type { JsonRpcSigner } from "ethers";
import { useAccount, useChainId, useWalletClient } from "wagmi";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
// @ts-ignore
import BasePayAutomationArtifact from "../utils/abis/CrossChainAutomation.json";
const BasePayAutomationABI = BasePayAutomationArtifact.abi;

// Network Configuration
interface NetworkConfig {
  chainId: number;
  name: string;
  contractAddress: string;
  token: {
    address: string;
    symbol: string;
    decimals: number;
    logo: string;
  };
}

const NETWORK_CONFIGS: Record<number, NetworkConfig> = {
  // Base Sepolia - uses USDC
  84532: {
    chainId: 84532,
    name: 'Base Sepolia',
    contractAddress: import.meta.env.VITE_CROSSCHAIN_AUTOMATION_BASE_SEPOLIA || '',
    token: {
      address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      symbol: 'USDC',
      decimals: 6,
      logo: 'https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1696506694'
    }
  },
  // Morph Holesky - uses USDT
  2810: {
    chainId: 2810,
    name: 'Morph Holesky',
    contractAddress: import.meta.env.VITE_CROSSCHAIN_AUTOMATION_MORPH_HOLESKY || '',
    token: {
      address: '0x9E12AD42c4E4d2acFBADE01a96446e48e6764B98',
      symbol: 'USDT',
      decimals: 18, // 18 decimals on Morph Holesky
      logo: 'https://assets.coingecko.com/coins/images/325/standard/Tether.png?1696501661'
    }
  }
};

interface PaymentData {
  id: string;
  creator: string;
  totalAmount: string;
  recipients: string[];
  amountPerRecipient: string;
  scheduledTime: number;
  executed: boolean;
  txHash?: string;
}

const PaymentAutomation: React.FC = () => {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  const [amount, setAmount] = useState<string>("");
  const [recipients, setRecipients] = useState<string[]>([""]);
  const [scheduled, setScheduled] = useState<boolean>(false);
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [scheduledPayments, setScheduledPayments] = useState<PaymentData[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentData[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [executablePayments, setExecutablePayments] = useState<Set<string>>(new Set());
  const [autoExecuteEnabled, setAutoExecuteEnabled] = useState<boolean>(true);

  // Get current network configuration
  const currentNetwork = NETWORK_CONFIGS[chainId] || NETWORK_CONFIGS[84532]; // Fallback to Base Sepolia

  // Load payment data when wallet connects, network changes, or wallet client is available
  useEffect(() => {
    if (isConnected && address && walletClient && currentNetwork.contractAddress) {
      console.log('🔄 Wallet/Network change detected, loading data...');
      loadPaymentData();
      loadAuthorizationStatus();
    }
  }, [isConnected, address, walletClient, chainId, currentNetwork.contractAddress]);

  // Auto-execution timer
  useEffect(() => {
    if (!autoExecuteEnabled || !isConnected || !address) return;

    const interval = setInterval(async () => {
      try {
        await autoExecuteOverduePayments();
      } catch (error) {
        console.error('Auto-execution error:', error);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [autoExecuteEnabled, isConnected, address, scheduledPayments]);

  // Load authorization status
  const loadAuthorizationStatus = async () => {
    if (!isConnected || !address || !currentNetwork.contractAddress || !walletClient) return;
    
    try {
      console.log('🔐 Loading authorization status...');
      const signer = await getSigner();
      const contract = new ethers.Contract(currentNetwork.contractAddress, BasePayAutomationABI, signer);
      
      // Check if user is owner
      const owner = await contract.owner();
      const userIsOwner = owner.toLowerCase() === address.toLowerCase();
      console.log('- Contract owner:', owner);
      console.log('- User is owner:', userIsOwner);
      setIsOwner(userIsOwner);
      
      // Check if user is authorized controller
      const userIsAuthorized = await contract.authorizedControllers(address);
      console.log('- User is authorized:', userIsAuthorized);
      setIsAuthorized(userIsAuthorized || userIsOwner);
      
    } catch (error) {
      console.error('❌ Error loading authorization status:', error);
      setIsOwner(false);
      setIsAuthorized(false);
    }
  };

  // Load payment data from contract
  const loadPaymentData = async () => {
    if (!isConnected || !address || !currentNetwork.contractAddress || !walletClient) return;
    
    setIsLoadingData(true);
    try {
      console.log('🔄 Loading payment data...');
      console.log('- Address:', address);
      console.log('- Network:', currentNetwork.name);
      console.log('- Contract:', currentNetwork.contractAddress);
      
      const signer = await getSigner();
      const contract = new ethers.Contract(currentNetwork.contractAddress, BasePayAutomationABI, signer);
      
      // Get next payment ID to know how many payments exist
      console.log('📊 Fetching payment count...');
      const nextPaymentId = await contract.nextPaymentId();
      const paymentCount = Number(nextPaymentId);
      console.log('- Payment count:', paymentCount);
      
      const scheduled: PaymentData[] = [];
      const history: PaymentData[] = [];
      
      // Fetch all payments
      for (let i = 0; i < paymentCount; i++) {
        try {
          console.log(`📋 Fetching payment ${i}...`);
          const paymentDetails = await contract.getPaymentDetails(i);
          const recipients = await contract.getPaymentRecipients(i);
          
          console.log(`- Payment ${i} creator:`, paymentDetails.creator);
          console.log(`- Current user:`, address);
          
          // Only include payments created by current user
          if (paymentDetails.creator.toLowerCase() === address.toLowerCase()) {
            const payment: PaymentData = {
              id: i.toString(),
              creator: paymentDetails.creator,
              totalAmount: ethers.formatUnits(paymentDetails.totalAmount, currentNetwork.token.decimals),
              recipients: recipients,
              amountPerRecipient: ethers.formatUnits(paymentDetails.amountPerRecipient, currentNetwork.token.decimals),
              scheduledTime: Number(paymentDetails.scheduledTime),
              executed: paymentDetails.executed
            };
            
            console.log(`✅ Added payment ${i}:`, payment);
            
            if (paymentDetails.executed) {
              history.push(payment);
            } else {
              scheduled.push(payment);
            }
          }
        } catch (error) {
          console.error(`❌ Error fetching payment ${i}:`, error);
        }
      }
      
      // Sort by scheduled time (newest first)
      scheduled.sort((a, b) => b.scheduledTime - a.scheduledTime);
      history.sort((a, b) => b.scheduledTime - a.scheduledTime);
      
      console.log('✅ Payment data loaded:');
      console.log('- Scheduled payments:', scheduled.length);
      console.log('- Payment history:', history.length);
      
      setScheduledPayments(scheduled);
      setPaymentHistory(history);
      
      // Check which payments are executable by current user
      await checkExecutablePayments(scheduled);
      
    } catch (error: any) {
      console.error('❌ Error loading payment data:', error);
      console.error('Error details:', error);
      toast.error('Failed to load payment data: ' + (error?.message || String(error)));
    }
    setIsLoadingData(false);
  };

  // Check which payments can be executed by current user
  const checkExecutablePayments = async (payments: PaymentData[]) => {
    if (!isConnected || !address) return;
    
    const executableSet = new Set<string>();
    
    try {
      for (const payment of payments) {
        // Only check overdue payments
        if (isPaymentOverdue(payment.scheduledTime)) {
          const canExecute = await canExecutePayment(payment.id);
          if (canExecute) {
            executableSet.add(payment.id);
          }
        }
      }
    } catch (error) {
      console.error('Error checking executable payments:', error);
    }
    
    setExecutablePayments(executableSet);
  };

  // Get signer using Wagmi wallet client
  const getSigner = async (): Promise<JsonRpcSigner> => {
    if (!walletClient) {
      throw new Error("Wallet not connected");
    }
    
    if (!address) {
      throw new Error("No wallet address found");
    }
    
    // Check network - ensure we're on the correct network for current config
    if (chainId !== currentNetwork.chainId) {
      throw new Error(`Please switch to ${currentNetwork.name} (Chain ID: ${currentNetwork.chainId})`);
    }
    
    // Create provider from wallet client transport
    const ethProvider = new ethers.BrowserProvider(walletClient.transport);
    const signer = await ethProvider.getSigner();
    
    console.log("✅ Wallet Info:");
    console.log("- Connected Address:", address);
    console.log("- Chain ID:", chainId);
    console.log("- Network:", currentNetwork.name);
    console.log("- Signer Address:", await signer.getAddress());
    
    return signer;
  };

  // Handle recipient input changes
  const handleRecipientChange = (idx: number, value: string) => {
    const newRecipients = [...recipients];
    newRecipients[idx] = value;
    setRecipients(newRecipients);
  };

  // Add new recipient field
  const addRecipient = () => {
    setRecipients([...recipients, ""]);
  };

  // Remove recipient field
  const removeRecipient = (idx: number) => {
    if (recipients.length === 1) return;
    setRecipients(recipients.filter((_, i) => i !== idx));
  };

  // Check token balance
  const checkTokenBalance = async (tokenAddress: string, amountRaw: bigint, signer: JsonRpcSigner) => {
    try {
      // Use the wagmi address for consistency
      if (!address) {
        throw new Error("Wallet address not available");
      }
      const userAddress = address;
      console.log('🔍 Balance Check Debug Info:');
      console.log('- Wagmi Address:', address);
      console.log('- Signer Address:', await signer.getAddress());
      console.log('- Using Address:', userAddress);
      console.log('- Token Contract:', tokenAddress);
      console.log('- Expected Decimals:', currentNetwork.token.decimals);
      console.log('- Network:', currentNetwork.name);
      
      const tokenContract = new ethers.Contract(tokenAddress, [
        "function balanceOf(address account) view returns (uint256)",
        "function decimals() view returns (uint8)"
      ], signer);
      
      // Get balance and actual decimals from contract
      const [balance, contractDecimals] = await Promise.all([
        tokenContract.balanceOf(userAddress),
        tokenContract.decimals().catch(() => currentNetwork.token.decimals)
      ]);
      
      console.log('- Raw Balance:', balance.toString());
      console.log('- Contract Decimals:', contractDecimals.toString());
      console.log('- Formatted with Config Decimals:', ethers.formatUnits(balance, currentNetwork.token.decimals));
      console.log('- Formatted with Contract Decimals:', ethers.formatUnits(balance, contractDecimals));
      
      // Use contract decimals if different from config
      const actualDecimals = Number(contractDecimals);
      const formattedBalance = ethers.formatUnits(balance, actualDecimals);
      
      console.log(`✅ Final ${currentNetwork.token.symbol} Balance:`, formattedBalance);
      
      if (balance < amountRaw) {
        throw new Error(`Insufficient ${currentNetwork.token.symbol} balance. Required: ${ethers.formatUnits(amountRaw, actualDecimals)}, Available: ${formattedBalance}`);
      }
    } catch (err: any) {
      console.error('❌ Balance check error:', err);
      throw new Error("Balance check failed: " + (err.message || String(err)));
    }
  };

  // Approve token spending
  const approveToken = async (tokenAddress: string, amountRaw: bigint, signer: JsonRpcSigner) => {
    try {
      if (!address) {
        throw new Error("Wallet address not available");
      }
      
      const tokenContract = new ethers.Contract(tokenAddress, [
        "function approve(address spender, uint256 amount) public returns (bool)",
        "function allowance(address owner, address spender) public view returns (uint256)"
      ], signer);
      
      // Check current allowance
      const currentAllowance = await tokenContract.allowance(address, currentNetwork.contractAddress);
      console.log('💰 Approval Debug Info:');
      console.log('- User Address:', address);
      console.log('- Contract Address:', currentNetwork.contractAddress);
      console.log('- Token Address:', tokenAddress);
      console.log('- Required Amount:', ethers.formatUnits(amountRaw, currentNetwork.token.decimals));
      console.log('- Current Allowance:', ethers.formatUnits(currentAllowance, currentNetwork.token.decimals));
      
      // Only approve if current allowance is insufficient
      if (currentAllowance < amountRaw) {
        console.log('🔄 Submitting approval transaction...');
        const tx = await tokenContract.approve(currentNetwork.contractAddress, amountRaw);
        console.log('📋 Approval tx hash:', tx.hash);
        
        toast.info("Approval transaction sent, waiting for confirmation...");
        const receipt = await tx.wait();
        console.log('✅ Approval confirmed in block:', receipt.blockNumber);
        
        // Verify the approval worked
        const newAllowance = await tokenContract.allowance(address, currentNetwork.contractAddress);
        console.log('✅ New Allowance:', ethers.formatUnits(newAllowance, currentNetwork.token.decimals));
        
        if (newAllowance < amountRaw) {
          throw new Error(`Approval verification failed. Expected: ${ethers.formatUnits(amountRaw, currentNetwork.token.decimals)}, Got: ${ethers.formatUnits(newAllowance, currentNetwork.token.decimals)}`);
        }
      } else {
        console.log('✅ Sufficient allowance already exists');
      }
    } catch (err: any) {
      console.error('❌ Approval error:', err);
      throw new Error(`${currentNetwork.token.symbol} approval failed: ` + (err && (err.reason || err.message || String(err))));
    }
  };

  // Submit payment
  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    console.log("submitPayment called");
    
    try {
      if (!isConnected || !address) throw new Error("Wallet not connected");
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) throw new Error("Invalid amount");
      
      // Filter out empty recipient addresses
      const validRecipients = recipients.filter(addr => addr.trim() !== "" && ethers.isAddress(addr.trim()));
      if (validRecipients.length === 0) throw new Error("At least one valid recipient address required");
      
      // Check if there are any invalid addresses
      const invalidAddresses = recipients.filter(addr => addr.trim() !== "" && !ethers.isAddress(addr.trim()));
      if (invalidAddresses.length > 0) throw new Error(`Invalid recipient address(es): ${invalidAddresses.join(", ")}`);
      
      if (!currentNetwork.contractAddress) throw new Error(`Contract address not configured for ${currentNetwork.name}`);
      
      // Get signer
      const signer = await getSigner();
      
      const contract = new ethers.Contract(currentNetwork.contractAddress, BasePayAutomationABI, signer);
      const tokenAddress = currentNetwork.token.address;
      const amountRaw = ethers.parseUnits(amount, currentNetwork.token.decimals);
      
      console.log("Contract details:", { 
        contractAddress: currentNetwork.contractAddress, 
        tokenAddress, 
        tokenSymbol: currentNetwork.token.symbol,
        network: currentNetwork.name,
        amountRaw: amountRaw.toString(),
        validRecipients 
      });
      
      // Check token balance
      toast.info(`Checking ${currentNetwork.token.symbol} balance...`);
      await checkTokenBalance(tokenAddress, amountRaw, signer);
      
      // Approve token spending
      toast.info(`Approving ${currentNetwork.token.symbol} spending...`);
      await approveToken(tokenAddress, amountRaw, signer);
      
      let tx;
      if (scheduled) {
        if (!scheduledDate) throw new Error("Scheduled date required");
        const unixTime = Math.floor(new Date(scheduledDate).getTime() / 1000);
        console.log("Scheduling payment", { amountRaw: amountRaw.toString(), validRecipients, unixTime });
        toast.info("Scheduling payment...");
        tx = await contract.schedulePaymentWithToken(tokenAddress, amountRaw, validRecipients, unixTime);
      } else {
        console.log("Executing payment now", { amountRaw: amountRaw.toString(), validRecipients });
        toast.info("Executing payment...");
        tx = await contract.executePaymentNowWithToken(tokenAddress, amountRaw, validRecipients);
      }
      
      console.log("Transaction sent:", tx.hash);
      toast.info("Transaction sent, waiting for confirmation...");
      await tx.wait();
      
      if (scheduled) {
        toast.success("Payment scheduled successfully!");
      } else {
        toast.success("Payment executed successfully!");
      }
      
      // Reset form
      setAmount("");
      setRecipients([""]);
      setScheduled(false);
      setScheduledDate("");
      
      // Reload payment data
      await loadPaymentData();
      
    } catch (err: any) {
      console.error("Transaction error:", err);
      if (err.code === 4001) {
        toast.warn("Transaction cancelled by user");
      } else if (err.code === -32603) {
        toast.error("Transaction failed: " + (err.data?.message || err.message));
      } else {
        toast.error("Transaction failed: " + (err.reason || err.message || "Unknown error"));
      }
    }
    setIsLoading(false);
  };

  // Format date for display
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  // Format address for display
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Execute scheduled payment
  const executeScheduledPayment = async (paymentId: string) => {
    if (!isConnected || !address) return;
    
    setIsLoading(true);
    try {
      // Check if user can execute this specific payment
      const canExecute = await canExecutePayment(paymentId);
      if (!canExecute) {
        toast.error("You are not authorized to execute this payment. Only the payment creator, contract owner, or authorized controllers can execute it.");
        setIsLoading(false);
        return;
      }

      const signer = await getSigner();
      const contract = new ethers.Contract(currentNetwork.contractAddress, BasePayAutomationABI, signer);
      
      // Get payment details to validate
      const paymentDetails = await contract.getPaymentDetails(paymentId);
      
      if (paymentDetails.executed) {
        toast.error("Payment has already been executed");
        setIsLoading(false);
        return;
      }
      
      if (Date.now() / 1000 < Number(paymentDetails.scheduledTime)) {
        toast.error("Payment time has not been reached yet");
        setIsLoading(false);
        return;
      }
      
      toast.info("Executing scheduled payment...");
      const tx = await contract.executeScheduledPayment(paymentId);
      
      console.log("Execution transaction sent:", tx.hash);
      toast.info("Transaction sent, waiting for confirmation...");
      await tx.wait();
      
      toast.success("Payment executed successfully!");
      
      // Reload payment data
      await loadPaymentData();
      
    } catch (err: any) {
      console.error("Execution error:", err);
      if (err.code === 4001) {
        toast.warn("Transaction cancelled by user");
      } else if (err.code === -32603) {
        toast.error("Execution failed: " + (err.data?.message || err.message));
      } else if (err.code === "CALL_EXCEPTION") {
        toast.error("Execution failed: You may not be authorized to execute this payment or the payment requirements are not met");
      } else {
        toast.error("Execution failed: " + (err.reason || err.message || "Unknown error"));
      }
    }
    setIsLoading(false);
  };

  // Check if payment is overdue
  const isPaymentOverdue = (scheduledTime: number) => {
    return Date.now() / 1000 > scheduledTime;
  };

  // Check if current user can execute a specific payment
  const canExecutePayment = async (paymentId: string) => {
    if (!isConnected || !address) return false;
    
    try {
      const signer = await getSigner();
      const contract = new ethers.Contract(currentNetwork.contractAddress, BasePayAutomationABI, signer);
      
      // Get payment details to check creator
      const paymentDetails = await contract.getPaymentDetails(paymentId);
      
      // Check if user is payment creator
      if (paymentDetails.creator.toLowerCase() === address.toLowerCase()) {
        return true;
      }
      
      // Check if user is owner
      const owner = await contract.owner();
      if (owner.toLowerCase() === address.toLowerCase()) {
        return true;
      }
      
      // Check if user is authorized controller
      const isAuthorizedController = await contract.authorizedControllers(address);
      return isAuthorizedController;
    } catch (error) {
      console.error('Error checking payment execution authorization:', error);
      return false;
    }
  };

  // Auto-execute overdue payments
  const autoExecuteOverduePayments = async () => {
    if (!isConnected || !address || scheduledPayments.length === 0) return;

    try {
      for (const payment of scheduledPayments) {
        // Check if payment is overdue and executable
        if (isPaymentOverdue(payment.scheduledTime) && executablePayments.has(payment.id)) {
          console.log(`Auto-executing overdue payment ${payment.id}`);
          
          const signer = await getSigner();
          const contract = new ethers.Contract(currentNetwork.contractAddress, BasePayAutomationABI, signer);
          
          // Execute without user interaction
          const tx = await contract.executeScheduledPayment(payment.id);
          console.log(`Auto-execution tx sent: ${tx.hash}`);
          
          // Don't wait for confirmation to avoid blocking other executions
          tx.wait().then(() => {
            console.log(`Payment ${payment.id} auto-executed successfully`);
            toast.success(`Payment ${payment.id} executed automatically!`);
            loadPaymentData(); // Reload data after successful execution
          }).catch((error: any) => {
            console.error(`Auto-execution failed for payment ${payment.id}:`, error);
          });
          
          // Small delay between executions to avoid nonce issues
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      console.error('Auto-execution batch error:', error);
    }
  };


  // Add current user as controller (only owner can do this)
  const addController = async () => {
    if (!isConnected || !address) return;
    
    setIsLoading(true);
    try {
      const signer = await getSigner();
      const contract = new ethers.Contract(currentNetwork.contractAddress, BasePayAutomationABI, signer);
      
      toast.info("Adding controller authorization...");
      const tx = await contract.addController(address);
      
      console.log("Add controller transaction sent:", tx.hash);
      toast.info("Transaction sent, waiting for confirmation...");
      await tx.wait();
      
      toast.success("Controller added successfully!");
      
      // Reload authorization status
      await loadAuthorizationStatus();
      
    } catch (err: any) {
      console.error("Add controller error:", err);
      if (err.code === 4001) {
        toast.warn("Transaction cancelled by user");
      } else if (err.code === -32603) {
        toast.error("Add controller failed: " + (err.data?.message || err.message));
      } else {
        toast.error("Add controller failed: " + (err.reason || err.message || "Unknown error"));
      }
    }
    setIsLoading(false);
  };

  return (
    <div className="max-w-8xl mx-auto p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Payment Form */}
        <div className="lg:col-span-1">
          <div className="bg-gray-50 rounded-xl shadow-xs border border-gray-200 p-6 hover:shadow-sm transition-all duration-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Payment</h2>
            
            {!isConnected ? (
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">Please connect your wallet to continue</p>
                <div className="text-sm text-gray-500">Use the connect button in the navbar above</div>
              </div>
            ) : (
              <form onSubmit={submitPayment} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">{currentNetwork.token.symbol} Amount</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step={currentNetwork.token.decimals === 6 ? "0.01" : "0.000001"}
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      required
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 pr-16 focus:ring-2 focus:ring-black focus:border-black transition text-gray-900"
                      placeholder={`Enter amount in ${currentNetwork.token.symbol}`}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <img src={currentNetwork.token.logo} alt={currentNetwork.token.symbol} className="w-4 h-4" />
                      <span className="ml-1 text-sm text-gray-500">{currentNetwork.token.symbol}</span>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Network: {currentNetwork.name}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Recipient Addresses</label>
                  <div className="space-y-2">
                    {recipients.map((addr, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input
                          type="text"
                          value={addr}
                          onChange={e => handleRecipientChange(idx, e.target.value)}
                          placeholder="0x..."
                          required
                          className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-black focus:border-black transition text-gray-900"
                        />
                        <button 
                          type="button" 
                          onClick={() => removeRecipient(idx)} 
                          disabled={recipients.length === 1}
                          className="px-3 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                        >
                          -
                        </button>
                        {idx === recipients.length - 1 && (
                          <button 
                            type="button" 
                            onClick={addRecipient}
                            className="px-3 py-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 border border-green-200 transition-colors duration-200"
                          >
                            +
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
                    <input
                      type="checkbox"
                      checked={scheduled}
                      onChange={e => setScheduled(e.target.checked)}
                      className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black focus:ring-2"
                    />
                    Schedule for later
                  </label>
                </div>
                
                {scheduled && (
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">Scheduled Date/Time</label>
                    <input
                      type="datetime-local"
                      value={scheduledDate}
                      onChange={e => setScheduledDate(e.target.value)}
                      required={scheduled}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-black focus:border-black transition text-gray-900"
                    />
                  </div>
                )}
                
                <button 
                  type="submit" 
                  disabled={isLoading || !isConnected}
                  className="w-full bg-gray-900 text-white rounded-xl py-3 px-4 font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {isLoading ? "Processing..." : scheduled ? "Schedule Payment" : "Pay Now"}
                </button>
              </form>
            )}
          </div>

          {/* Authorization Status */}
          {isConnected && (
            <div className="bg-gray-50 rounded-xl shadow-xs border border-gray-200 p-6 hover:shadow-sm transition-all duration-200 mt-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Execution Permissions</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Role:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {isOwner ? 'Contract Owner' : isAuthorized ? 'Authorized Controller' : 'Payment Creator'}
                  </span>
                </div>
                
                <div className="text-xs text-gray-600 space-y-1">
                  <p>• You can execute your own scheduled payments</p>
                  {isAuthorized && <p>• You can execute any scheduled payment (authorized controller)</p>}
                  {isOwner && <p>• You can execute any scheduled payment (contract owner)</p>}
                </div>
                
                {!isAuthorized && isOwner && (
                  <div className="pt-2">
                    <button
                      onClick={addController}
                      disabled={isLoading}
                      className="w-full bg-blue-600 text-white rounded-xl py-2 px-4 font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                    >
                      {isLoading ? "Processing..." : "Become Authorized Controller"}
                    </button>
                    <p className="text-xs text-gray-500 mt-1">
                      Optional: Add yourself as controller to execute any payment
                    </p>
                  </div>
                )}
                
                <div className="pt-3 border-t border-gray-200">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
                    <input
                      type="checkbox"
                      checked={autoExecuteEnabled}
                      onChange={e => setAutoExecuteEnabled(e.target.checked)}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 focus:ring-2"
                    />
                    Auto-execute payments
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Automatically execute overdue payments in the background (every 30s)
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Scheduled Payments */}
        <div className="lg:col-span-2">
          <div className="bg-gray-50 rounded-xl shadow-xs border border-gray-200 p-6 hover:shadow-sm transition-all duration-200 mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Scheduled Payments</h3>
            
            {isLoadingData ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-900 border-t-transparent mx-auto"></div>
                <p className="text-gray-600 mt-2">Loading scheduled payments...</p>
              </div>
            ) : scheduledPayments.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No scheduled payments found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {scheduledPayments.map((payment) => (
                  <div key={payment.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow duration-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3 flex-1">
                        <img 
                          src={currentNetwork.token.logo} 
                          alt={currentNetwork.token.symbol}
                          className="w-6 h-6 rounded-full flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">
                              {payment.totalAmount} {currentNetwork.token.symbol}
                            </span>
                            <span className="text-xs text-gray-500">
                              • {payment.amountPerRecipient} per recipient
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-600">
                              {payment.recipients.length} recipient{payment.recipients.length > 1 ? 's' : ''}
                            </span>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-gray-600">
                              {formatDate(payment.scheduledTime)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isPaymentOverdue(payment.scheduledTime) ? (
                          <>
                            {executablePayments.has(payment.id) && (
                              <button
                                onClick={() => executeScheduledPayment(payment.id)}
                                disabled={isLoading}
                                className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                              >
                                {isLoading ? "Processing..." : "Execute"}
                              </button>
                            )}
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                              Overdue
                            </span>
                          </>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                            Scheduled
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-1">
                      {payment.recipients.map((recipient, idx) => (
                        <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                          {formatAddress(recipient)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment History */}
          <div className="bg-gray-50 rounded-xl shadow-xs border border-gray-200 p-6 hover:shadow-sm transition-all duration-200">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Payment History</h3>
            
            {isLoadingData ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-900 border-t-transparent mx-auto"></div>
                <p className="text-gray-600 mt-2">Loading payment history...</p>
              </div>
            ) : paymentHistory.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No payment history found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {paymentHistory.map((payment) => (
                  <div key={payment.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow duration-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3 flex-1">
                        <img 
                          src={currentNetwork.token.logo} 
                          alt={currentNetwork.token.symbol}
                          className="w-6 h-6 rounded-full flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">
                              {payment.totalAmount} {currentNetwork.token.symbol}
                            </span>
                            <span className="text-xs text-gray-500">
                              • {payment.amountPerRecipient} per recipient
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-600">
                              {payment.recipients.length} recipient{payment.recipients.length > 1 ? 's' : ''}
                            </span>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-gray-600">
                              {formatDate(payment.scheduledTime)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200 flex-shrink-0">
                        Completed
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-1">
                      {payment.recipients.map((recipient, idx) => (
                        <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                          {formatAddress(recipient)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </div>
  );
};

export default PaymentAutomation;
