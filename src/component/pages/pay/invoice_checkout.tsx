import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ethers } from 'ethers';
import { useAccount, useWalletClient, useChainId } from 'wagmi';
import { toast } from 'react-toastify';
import { FaCopy, FaArrowLeft } from 'react-icons/fa';
import PayrollABI from '../../utils/abis/Payroll.json';

const ETH_ADDRESS = ethers.ZeroAddress;
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)"
];

// Network configuration for contract addresses and tokens
interface NetworkConfig {
  chainId: number;
  name: string;
  contractAddress?: string;
  tokens: {
    [address: string]: {
      symbol: string;
      decimals: number;
      logo: string;
    };
  };
}
const NETWORK_CONFIGS: Record<number, NetworkConfig> = {
  // Base Sepolia Testnet
  84532: {
    chainId: 84532,
    name: 'Base Sepolia',
    contractAddress: import.meta.env.VITE_INVOICE_CONTRACT_ADDRESS_BASE_SEPOLIA,
    tokens: {
      '0x036CbD53842c5426634e7929541eC2318f3dCF7e': {
        symbol: 'USDC',
        decimals: 6,
        logo: 'https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1696506694'
      },
      [ETH_ADDRESS]: {
        symbol: 'ETH',
        decimals: 18,
        logo: 'https://assets.coingecko.com/coins/images/279/standard/ethereum.png?1696501628'
      }
    }
  },
  
  // Morph Holesky Testnet
  2810: {
    chainId: 2810,
    name: 'Morph Holesky',
    contractAddress: import.meta.env.VITE_BASEPAY_MORPH,
    tokens: {
      '0x9E12AD42c4E4d2acFBADE01a96446e48e6764B98': {
        symbol: 'USDT',
        decimals: 18,
        logo: 'https://assets.coingecko.com/coins/images/325/standard/Tether.png?1696501661'
      },
      [ETH_ADDRESS]: {
        symbol: 'ETH',
        decimals: 18,
        logo: 'https://assets.coingecko.com/coins/images/279/standard/ethereum.png?1696501628'
      }
    }
  }
};

interface InvoiceData {
  merchant: string;
  token: string;
  amount: string;
  dueBy: string;
  isPaid: boolean;
  memo: string;
  logoURI: string;
  description: string;
  paidAt: string;
}

const InvoiceCheckout = () => {
  const [searchParams] = useSearchParams();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  
  // Get current network configuration based on connected chain ID
  // Falls back to Base Sepolia (84532) if the current network is not supported
  const currentNetwork = NETWORK_CONFIGS[chainId] || NETWORK_CONFIGS[84532];
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  
  const hash = searchParams.get('hash');

  useEffect(() => {
    const fetchInvoice = async () => {
      if (!hash || !window.ethereum) {
        setLoading(false);
        return;
      }

      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const network = await provider.getNetwork();
        
        console.log('🔧 INVOICE CHECKOUT NETWORK DETECTION:', {
          wagmiChainId: chainId,
          providerChainId: Number(network.chainId),
          targetNetwork: currentNetwork.name,
          contractAddress: currentNetwork.contractAddress
        });
        
        // Use direct RPC provider if there's a network mismatch
        let contractProvider: ethers.BrowserProvider | ethers.JsonRpcProvider = provider;
        if (Number(network.chainId) !== currentNetwork.chainId) {
          console.warn(`⚠️ CHECKOUT PROVIDER/WAGMI MISMATCH (using direct RPC):
            - Provider reports chain ${Number(network.chainId)}
            - Wagmi reports chain ${chainId} ✅
          `);
          // Use direct RPC provider for the correct network
          const rpcUrl = currentNetwork.chainId === 2810 
            ? 'https://rpc-quicknode-holesky.morphl2.io'
            : currentNetwork.chainId === 84532 
            ? 'https://sepolia.base.org'
            : undefined;
          if (rpcUrl) {
            contractProvider = new ethers.JsonRpcProvider(rpcUrl);
            console.warn('⚠️ Using direct RPC provider for invoice lookup');
          }
        }
        
        const contractAddress = currentNetwork.contractAddress;
        if (!contractAddress) {
          toast.error(`Contract not deployed on ${currentNetwork.name}`);
          setLoading(false);
          return;
        }
        const Payroll = new ethers.Contract(contractAddress, PayrollABI.abi, contractProvider);
        
        const inv = await Payroll.invoices(hash);
        console.log('Raw invoice data:', inv);
        
        // Check if invoice exists (merchant address is not zero)
        if (inv[0] === ethers.ZeroAddress || inv[0] === '0x0000000000000000000000000000000000000000') {
          console.log('Invoice not found on', currentNetwork.name);
          
          // Try to find the invoice on other networks
          const otherNetworks = Object.values(NETWORK_CONFIGS).filter(net => net.chainId !== currentNetwork.chainId);
          let foundOnNetwork = null;
          
          for (const network of otherNetworks) {
            if (!network.contractAddress) continue;
            try {
              const testProvider = new ethers.JsonRpcProvider(
                network.chainId === 84532 ? 'https://sepolia.base.org' :
                network.chainId === 2810 ? 'https://rpc-quicknode-holesky.morphl2.io' : undefined
              );
              if (!testProvider) continue;
              
              const testContract = new ethers.Contract(network.contractAddress, PayrollABI.abi, testProvider);
              const testInv = await testContract.invoices(hash);
              
              if (testInv[0] !== ethers.ZeroAddress && testInv[0] !== '0x0000000000000000000000000000000000000000') {
                foundOnNetwork = network.name;
                break;
              }
            } catch (e) {
              // Ignore errors from other networks
            }
          }
          
          if (foundOnNetwork) {
            toast.error(`Invoice found on ${foundOnNetwork}. Please switch your wallet to ${foundOnNetwork} to view this invoice.`);
          } else {
            toast.error(`Invoice not found on ${currentNetwork.name}. Please check the invoice hash.`);
          }
          setLoading(false);
          return;
        }
        
        console.log('Token address:', inv[1]);
        console.log('Is ZeroAddress:', inv[1] === ethers.ZeroAddress);
        
        const mappedInv = {
          merchant: inv[0],
          token: inv[1],
          amount: inv[2],
          dueBy: inv[3],
          isPaid: inv[4],
          memo: inv[5],
          logoURI: inv[6],
          description: inv[7],
          paidAt: inv[8]
        };
        
        console.log('Mapped invoice data:', mappedInv);
        setInvoiceData(mappedInv);
      } catch (error) {
        console.error('Error fetching invoice:', error);
        toast.error('Failed to load invoice');
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [hash, currentNetwork]);

  useEffect(() => {
    if (walletClient && window.ethereum && currentNetwork.contractAddress) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const getSigner = async () => {
        const signer = await provider.getSigner();
        const contractAddress = currentNetwork.contractAddress!; // Non-null assertion since we check above
        const PayrollContract = new ethers.Contract(contractAddress, PayrollABI.abi, signer);
        setContract(PayrollContract);
      };
      getSigner();
    }
  }, [walletClient, currentNetwork]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied to clipboard!');
    });
  };

  const handlePay = async () => {
    console.log('Pay button clicked');
    console.log('Contract:', contract);
    console.log('Address:', address);
    console.log('Invoice data:', invoiceData);
    console.log('Hash:', hash);
    
    if (!contract || !address || !invoiceData) {
      console.log('Missing required data for payment');
      return;
    }

    setPaying(true);
    try {
      console.log('Starting payment process...');
      console.log('Token address:', invoiceData.token);
      console.log('Amount:', invoiceData.amount);
      
      // For token payments, we need to approve the contract first
      if (invoiceData.token !== ETH_ADDRESS) {
        const tokenInfo = currentNetwork.tokens[invoiceData.token];
        const tokenSymbol = tokenInfo?.symbol || 'Token';
        console.log(`Processing ${tokenSymbol} payment...`);
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const network = await provider.getNetwork();
        
        console.log('🔧 PAYMENT NETWORK DETECTION:', {
          wagmiChainId: chainId,
          providerChainId: Number(network.chainId),
          targetNetwork: currentNetwork.name,
          tokenAddress: invoiceData.token
        });
        
        // Use direct RPC provider for token operations if there's a network mismatch
        let paymentProvider: ethers.BrowserProvider | ethers.JsonRpcProvider = provider;
        if (Number(network.chainId) !== currentNetwork.chainId) {
          if (chainId === currentNetwork.chainId) {
            console.warn(`⚠️ PAYMENT PROVIDER/WAGMI MISMATCH (using direct RPC for token operations):
              - Provider reports chain ${Number(network.chainId)}
              - Wagmi reports chain ${chainId} ✅
            `);
            // Use direct RPC provider for token contract operations
            const rpcUrl = currentNetwork.chainId === 2810 
              ? 'https://rpc-quicknode-holesky.morphl2.io'
              : currentNetwork.chainId === 84532 
              ? 'https://sepolia.base.org'
              : undefined;
            if (rpcUrl) {
              paymentProvider = new ethers.JsonRpcProvider(rpcUrl);
              console.warn('⚠️ Using direct RPC provider for token contract operations');
            }
          } else {
            console.error(`❌ NETWORK MISMATCH: MetaMask is on chain ${Number(network.chainId)}, but need chain ${currentNetwork.chainId} (${currentNetwork.name})`);
            toast.error(`Network mismatch: Please switch MetaMask to ${currentNetwork.name} to complete payment`);
            setPaying(false);
            return;
          }
        }
        
        const tokenContract = new ethers.Contract(invoiceData.token, ERC20_ABI, paymentProvider);
        
        // Check current allowance
        const contractAddress = currentNetwork.contractAddress;
        console.log('Contract address:', contractAddress);
        
        let allowance;
        try {
          console.log('🔍 Checking token contract existence...');
          // First check if the token contract exists (using correct provider)
          const code = await paymentProvider.getCode(invoiceData.token);
          console.log('Token contract code length:', code.length);
          if (code === '0x') {
            console.error(`❌ ${tokenSymbol} token contract not found on ${currentNetwork.name}`);
            toast.error(`${tokenSymbol} token contract not found on ${currentNetwork.name}`);
            setPaying(false);
            return;
          }
          
          console.log('✅ Token contract exists, checking allowance...');
          allowance = await tokenContract.allowance(address, contractAddress);
          console.log('✅ Current allowance:', allowance.toString());
          console.log('Required amount:', invoiceData.amount);
        } catch (allowanceError) {
          console.error('Error checking allowance:', allowanceError);
          toast.error(`Failed to check ${tokenSymbol} allowance. Please ensure you're on the correct network.`);
          setPaying(false);
          return;
        }
        
        // If allowance is insufficient, approve using wagmi walletClient
        if (allowance < invoiceData.amount) {
          console.log('Approval needed...');
          toast.loading(`Approving ${tokenSymbol}...`);
          
          if (!walletClient) {
            toast.error('Wallet not connected');
            setPaying(false);
            return;
          }
          
          // Use wagmi to send the approval transaction
          const hash = await walletClient.writeContract({
            address: invoiceData.token as `0x${string}`,
            abi: [{
              "name": "approve",
              "type": "function", 
              "stateMutability": "nonpayable",
              "inputs": [
                {"name": "spender", "type": "address"},
                {"name": "amount", "type": "uint256"}
              ],
              "outputs": [{"name": "", "type": "bool"}]
            }],
            functionName: 'approve',
            args: [contractAddress as `0x${string}`, BigInt(invoiceData.amount)]
          });
          
          console.log('Approval transaction:', hash);
          toast.dismiss();
          console.log('Approval completed');
        } else {
          console.log('Sufficient allowance already exists');
        }
      }
      
      // Now pay the invoice using wagmi
      console.log('Calling payInvoice...');
      console.log('Token is ZeroAddress:', invoiceData.token === ethers.ZeroAddress);
      console.log('Amount:', invoiceData.amount);
      
      if (!walletClient) {
        toast.error('Wallet not connected');
        setPaying(false);
        return;
      }
      
      // Send ETH value only if the invoice is for ETH (ZeroAddress)
      const paymentHash = await walletClient.writeContract({
        address: currentNetwork.contractAddress! as `0x${string}`,
        abi: PayrollABI.abi,
        functionName: 'payInvoice',
        args: [hash],
        value: invoiceData.token === ETH_ADDRESS ? BigInt(invoiceData.amount) : BigInt(0)
      });
      console.log('Payment transaction:', paymentHash);
      
      toast.loading('Processing payment...');
      toast.dismiss();
      toast.success('Payment successful!');
      console.log('Payment completed successfully');
      
      // Refresh invoice data - use network-aware provider and longer timeout
      setTimeout(async () => {
        try {
          const refreshProvider = new ethers.BrowserProvider(window.ethereum);
          const refreshNetwork = await refreshProvider.getNetwork();
          
          // Use direct RPC provider if there's still a network mismatch after payment
          let finalProvider: ethers.BrowserProvider | ethers.JsonRpcProvider = refreshProvider;
          if (Number(refreshNetwork.chainId) !== currentNetwork.chainId) {
            console.warn('⚠️ Network mismatch during refresh, using direct RPC');
            const rpcUrl = currentNetwork.chainId === 2810 
              ? 'https://rpc-quicknode-holesky.morphl2.io'
              : currentNetwork.chainId === 84532 
              ? 'https://sepolia.base.org'
              : undefined;
            if (rpcUrl) {
              finalProvider = new ethers.JsonRpcProvider(rpcUrl);
            }
          }
          
          const refreshContract = new ethers.Contract(
            currentNetwork.contractAddress!, 
            PayrollABI.abi, 
            finalProvider
          );
          const inv = await refreshContract.invoices(hash);
          
          console.log('Refreshed invoice data:', inv);
          setInvoiceData({
            merchant: inv[0],
            token: inv[1],
            amount: inv[2],
            dueBy: inv[3],
            isPaid: inv[4],
            memo: inv[5],
            logoURI: inv[6],
            description: inv[7],
            paidAt: inv[8]
          });
        } catch (refreshError) {
          console.warn('Could not refresh invoice data:', refreshError);
        }
      }, 3000); // Wait 3 seconds for blockchain to update
    } catch (error: any) {
      toast.dismiss();
      console.error('Payment error:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        data: error.data,
        stack: error.stack
      });
      toast.error(`Payment failed: ${error.message || error}`);
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (!invoiceData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invoice Not Found</h1>
          <p className="text-gray-600">The invoice you're looking for doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  // Get token info for amount calculation
  const tokenInfo = currentNetwork.tokens[invoiceData.token];
  const tokenDecimals = tokenInfo?.decimals || 18;
  const tokenSymbol = tokenInfo?.symbol || 'Token';
  
  const amount = Number(invoiceData.amount) / (10 ** tokenDecimals);
  const isExpired = Number(invoiceData.dueBy) !== 0 && Date.now() / 1000 > Number(invoiceData.dueBy);
  
  console.log('Amount calculation:', {
    rawAmount: invoiceData.amount,
    token: invoiceData.token,
    tokenSymbol,
    calculatedAmount: amount,
    decimals: tokenDecimals
  });

  return (
    <div className="min-h-screen bg-white py-8">
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button 
            onClick={() => window.history.back()}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <FaArrowLeft className="mr-2" />
            Back
          </button>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Invoice Payment</h1>
          <p className="text-gray-500">Complete your payment securely.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Invoice Details Section */}
          <div className="flex-1">
            <div className="bg-gray-50 border border-gray-200 rounded-3xl shadow-sm p-8">
              <div className="flex items-center gap-4 mb-6">
                <h2 className="text-xl font-bold text-gray-800">Invoice Details</h2>
                <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full">
                  <img 
                    src={tokenInfo?.logo || 'https://assets.coingecko.com/coins/images/279/standard/ethereum.png?1696501628'} 
                    alt={currentNetwork.name} 
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700">{currentNetwork.name}</span>
                </div>
              </div>
              
              {/* Status Badge */}
              <div className="mb-6">
                {invoiceData.isPaid ? (
                  <span className="inline-flex px-4 py-2 text-sm font-medium rounded-full bg-green-50 text-green-700 border border-green-200">
                    Paid
                  </span>
                ) : isExpired ? (
                  <span className="inline-flex px-4 py-2 text-sm font-medium rounded-full bg-red-50 text-red-700 border border-red-200">
                    Expired
                  </span>
                ) : (
                  <span className="inline-flex px-4 py-2 text-sm font-medium rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
                    Pending Payment
                  </span>
                )}
              </div>

              {/* Invoice Info */}
              <div className="space-y-4">
                {invoiceData.memo && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-600">Memo:</span>
                    <span className="text-gray-900">{invoiceData.memo}</span>
                  </div>
                )}

                {invoiceData.description && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-600">Description:</span>
                    <span className="text-gray-900">{invoiceData.description}</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-600">Due Date:</span>
                  <span className="text-gray-900">
                    {invoiceData.dueBy && Number(invoiceData.dueBy) !== 0
                      ? new Date(Number(invoiceData.dueBy) * 1000).toLocaleDateString()
                      : 'No due date'
                    }
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-600">Token:</span>
                  <span className="flex items-center gap-2">
                    {invoiceData.token === ETH_ADDRESS ? (
                      <>
                        <img src="https://assets.coingecko.com/coins/images/279/standard/ethereum.png?1696501628" alt="ETH" className="w-5 h-5 inline-block" />
                        <span>ETH</span>
                      </>
                    ) : (
                      <>
                        <img src={tokenInfo?.logo || 'https://assets.coingecko.com/coins/images/279/standard/ethereum.png?1696501628'} alt={tokenSymbol} className="w-5 h-5 inline-block" />
                        <span>{tokenSymbol}</span>
                      </>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-600">Invoice Hash:</span>
                  <div className="flex items-center gap-2">
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded text-gray-700">
                      {hash?.slice(0, 8)}...{hash?.slice(-6)}
                    </code>
                    <button 
                      onClick={() => copyToClipboard(hash || '')}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                      title="Copy full hash"
                    >
                      <FaCopy className="text-xs text-gray-500 hover:text-gray-700" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Section */}
          <div className="flex-1 max-w-md w-full">
            <div className="bg-gray-50 border border-gray-200 rounded-3xl shadow-sm p-8">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Payment</h2>
              
              {/* Amount Display */}
              <div className="text-center mb-8">
                <div className="text-4xl font-bold text-gray-900 mb-4">
                  {amount.toFixed(tokenDecimals === 6 ? 2 : 4)} {tokenSymbol}
                </div>
                {invoiceData.logoURI && (
                  <img src={invoiceData.logoURI} alt="Logo" className="w-16 h-16 rounded-full mx-auto mb-4 border border-gray-200" />
                )}
              </div>

              {/* Pay Button */}
              {!invoiceData.isPaid && !isExpired && (
                <button
                  onClick={handlePay}
                  disabled={!address || paying}
                  className={`w-full rounded-full bg-black hover:bg-gray-900 text-white font-semibold py-3 px-6 text-lg transition-colors shadow-none focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 flex items-center justify-center gap-2
                    ${!address 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : paying 
                        ? 'bg-gray-700 cursor-not-allowed' 
                        : ''
                    }`}
                >
                  {!address ? 'Connect Wallet to Pay' : paying ? 'Processing...' : 'Pay Invoice'}
                </button>
              )}

              {invoiceData.isPaid && (
                <div className="text-center">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                    <p className="text-green-700 font-medium">Payment Successful!</p>
                    <p className="text-sm text-green-600 mt-1">
                      Paid at: {new Date(Number(invoiceData.paidAt) * 1000).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              {isExpired && !invoiceData.isPaid && (
                <div className="text-center">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-red-700 font-medium">Invoice Expired</p>
                    <p className="text-sm text-red-600 mt-1">This invoice can no longer be paid.</p>
                  </div>
                </div>
              )}

              {!address && !invoiceData.isPaid && !isExpired && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-xl">
                  <p className="font-medium">⚠️ Wallet Not Connected</p>
                  <p className="text-sm mt-1">Please connect your wallet to pay this invoice.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceCheckout;
