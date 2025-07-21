import {
  FaFileInvoice,
  FaMoneyCheckAlt,
  FaArrowDown,
  FaArrowUp,
  FaExchangeAlt,
  FaPlus,
  FaEllipsisH,
  FaEye,
  FaDownload,
  FaCopy
} from 'react-icons/fa';
import { useAccount, useChainId } from 'wagmi';
import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { toast } from 'react-toastify';

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)"
];
import PayrollABI from './utils/abis/Payroll.json';

// =====================================================================
// NETWORK CONFIGURATION - ADD NEW CHAINS HERE
// =====================================================================
// 
// To add a new blockchain network to the dashboard:
// 
// 1. Add the network to wagmi.config.ts first:
//    - Import the chain or define a custom chain using `defineChain`
//    - Add it to the `chains` array in the wagmi config
//    - Add transport configuration for the RPC endpoint
//
// 2. Add network configuration below:
//    - Get the chain ID from the network documentation
//    - Specify the primary token for balance display (USDC, USDT, etc.)
//    - Get the token contract address from the network
//    - Find the token logo URL (preferably from CoinGecko)
//    - Deploy your Payroll contract to the new network
//    - Set the contract address (can use env vars for different networks)
//
// 3. Update environment variables:
//    - Consider using network-specific env vars like:
//      VITE_INVOICE_CONTRACT_ADDRESS_BASE_SEPOLIA
//      VITE_INVOICE_CONTRACT_ADDRESS_MORPH_HOLESKY
//      VITE_INVOICE_CONTRACT_ADDRESS_POLYGON
//
// 4. Test the integration:
//    - Switch to the new network in MetaMask
//    - Verify balance fetching works
//    - Create and check invoices
//    - Ensure all data displays correctly
//
// =====================================================================
// TROUBLESHOOTING COMMON ISSUES:
// =====================================================================
//
// 1. "Contract not found" error:
//    - Token contract address is incorrect for the network
//    - Token contract is not deployed on the current network
//    - Check the contract address on a block explorer
//    - For Morph Holesky: Use 'NATIVE' to show ETH balance as USDT
//
// 2. "Network mismatch" warning:
//    - User's wallet is on a different network than expected
//    - Check MetaMask network selection
//    - Ensure wagmi config includes the network
//
// 3. "No invoices found" when invoices exist:
//    - Payroll contract address is incorrect for the network
//    - Contract not deployed on the current network
//    - User created invoices on a different network
//    - Make sure VITE_BASEPAY_MORPH env var is set correctly
//
// 4. Balance shows as "0.00" when tokens exist:
//    - Wrong token contract address
//    - Token has different decimals than configured
//    - Network mismatch between wallet and configuration
//    - For Morph: Check if you want native ETH or ERC-20 USDT
//
// =====================================================================

interface NetworkConfig {
  chainId: number;
  name: string;           // Display name for the network
  token: {
    address: string;      // Token contract address on this network
    symbol: string;       // Token symbol (USDC, USDT, DAI, etc.)
    decimals: number;     // Token decimals (usually 6 for USDC/USDT, 18 for DAI)
    logo: string;         // Token logo URL
  };
  contractAddress?: string; // BasePay contract address on this network
}

const NETWORK_CONFIGS: Record<number, NetworkConfig> = {
  // Base Sepolia Testnet
  84532: {
    chainId: 84532,
    name: 'Base Sepolia',
    token: {
      address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC on Base Sepolia
      symbol: 'USDC',
      decimals: 6,
      logo: 'https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1696506694'
    },
    contractAddress: import.meta.env.VITE_INVOICE_CONTRACT_ADDRESS_BASE_SEPOLIA
  },

  // Morph Holesky Testnet
  2810: {
    chainId: 2810,
    name: 'Morph Holesky',
    token: {
      address: '0x9E12AD42c4E4d2acFBADE01a96446e48e6764B98', // Official Morph Holesky USDT from docs
      symbol: 'USDT',
      decimals: 18, // 18 decimals as verified from contract (different from mainnet USDT's 6 decimals)
      logo: 'https://assets.coingecko.com/coins/images/325/standard/Tether.png?1696501661'
    },
    contractAddress: import.meta.env.VITE_BASEPAY_MORPH // Use Morph-specific contract
  }

  // =====================================================================
  // ADD NEW NETWORKS HERE - EXAMPLE:
  // =====================================================================
  // 
  // // Polygon Mainnet
  // 137: {
  //   chainId: 137,
  //   name: 'Polygon',
  //   token: {
  //     address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC on Polygon
  //     symbol: 'USDC',
  //     decimals: 6,
  //     logo: 'https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1696506694'
  //   },
  //   contractAddress: import.meta.env.VITE_INVOICE_CONTRACT_ADDRESS_POLYGON
  // },
  //
  // // Arbitrum One
  // 42161: {
  //   chainId: 42161,
  //   name: 'Arbitrum One',
  //   token: {
  //     address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC on Arbitrum
  //     symbol: 'USDC',
  //     decimals: 6,
  //     logo: 'https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1696506694'
  //   },
  //   contractAddress: import.meta.env.VITE_INVOICE_CONTRACT_ADDRESS_ARBITRUM
  // },
  //
  // // Optimism
  // 10: {
  //   chainId: 10,
  //   name: 'Optimism',
  //   token: {
  //     address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // USDC on Optimism
  //     symbol: 'USDC',
  //     decimals: 6,
  //     logo: 'https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1696506694'
  //   },
  //   contractAddress: import.meta.env.VITE_INVOICE_CONTRACT_ADDRESS_OPTIMISM
  // }

  // =====================================================================
};

interface DashboardProps {
  sidebarOpen: boolean;
}

const Dashboard = ({ sidebarOpen: _ }: DashboardProps) => {
  const [selectedPeriod, setSelectedPeriod] = useState('This Week');
  const { address } = useAccount();
  const chainId = useChainId();
  const [tokenBalance, setTokenBalance] = useState<string | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [activeInvoices, setActiveInvoices] = useState<number | null>(null);
  const [totalInvoices, setTotalInvoices] = useState<number | null>(null);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invoiceList, setInvoiceList] = useState<any[]>([]);

  // =====================================================================
  // NETWORK DETECTION AND FALLBACK LOGIC
  // =====================================================================
  // Get current network configuration based on the connected chain ID
  // Falls back to Base Sepolia (84532) if the current network is not supported
  // When adding new networks, users will see Base Sepolia data until they switch
  // to a supported network or you add their network to NETWORK_CONFIGS above
  const currentNetwork = NETWORK_CONFIGS[chainId] || NETWORK_CONFIGS[84532];

  // Debug: Log the current network detection
  console.log('🔧 DASHBOARD NETWORK DETECTION:', {
    wagmiChainId: chainId,
    detectedNetwork: currentNetwork,
    availableNetworks: Object.keys(NETWORK_CONFIGS),
    isNetworkSupported: !!NETWORK_CONFIGS[chainId]
  });

  useEffect(() => {
    const fetchBalance = async () => {
      if (!address || !window.ethereum) return;
      setLoadingBalance(true);

      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const network = await provider.getNetwork();

        // Check network match - allow if wagmi reports correct chain (timing issue)
        if (Number(network.chainId) !== currentNetwork.chainId) {
          if (chainId === currentNetwork.chainId) {
            console.warn(`⚠️ BALANCE PROVIDER/WAGMI MISMATCH (proceeding anyway):
            - Provider reports chain ${Number(network.chainId)}
            - Wagmi reports chain ${chainId} ✅
          `);
            // Continue with balance fetch using wagmi's chain ID
          } else {
            console.warn(`❌ Network mismatch: Connected to ${network.chainId}, expected ${currentNetwork.chainId}`);
            setTokenBalance('Network mismatch');
            return;
          }
        }

        // Check contract existence - if provider/wagmi mismatch, skip this check
        if (Number(network.chainId) === currentNetwork.chainId) {
          const code = await provider.getCode(currentNetwork.token.address);

          if (code === '0x') {
            // Fallback to ETH balance if USDT contract not found
            const ethBalance = await provider.getBalance(address);
            const ethFormatted = ethers.formatEther(ethBalance);
            setTokenBalance(`${ethFormatted} ETH (USDT not found)`);
            return;
          }
        } else {
          // Skip contract check when provider/wagmi mismatch - proceed directly to balance fetch
          console.warn('⚠️ Skipping contract existence check due to provider/wagmi mismatch');
        }

        // Get USDT balance - use direct RPC if provider/wagmi mismatch
        let contractProvider: ethers.BrowserProvider | ethers.JsonRpcProvider = provider;
        if (Number(network.chainId) !== currentNetwork.chainId) {
          // Use direct RPC provider for the correct network
          const rpcUrl = currentNetwork.chainId === 2810 
            ? 'https://rpc-quicknode-holesky.morphl2.io'
            : undefined;
          if (rpcUrl) {
            contractProvider = new ethers.JsonRpcProvider(rpcUrl);
            console.warn('⚠️ Using direct RPC provider due to network mismatch');
          }
        }
        
        const tokenContract = new ethers.Contract(
          currentNetwork.token.address,
          ERC20_ABI,
          contractProvider
        );

        const [balance, decimals] = await Promise.all([
          tokenContract.balanceOf(address),
          tokenContract.decimals().catch(() => currentNetwork.token.decimals) // Fallback to config
        ]);

        const formattedBalance = ethers.formatUnits(balance, decimals);
        setTokenBalance(`${formattedBalance} ${currentNetwork.token.symbol}`);

      } catch (error) {
        console.error('Error fetching balance:', error);
        setTokenBalance('Error loading balance');
      } finally {
        setLoadingBalance(false);
      }
    };

    fetchBalance();
  }, [address, chainId, currentNetwork]);

  useEffect(() => {
    const fetchActiveInvoices = async () => {
      if (!address || !window.ethereum || !currentNetwork.contractAddress) {
        console.log('Skipping invoice fetch:', {
          hasAddress: !!address,
          hasEthereum: !!window.ethereum,
          hasContract: !!currentNetwork.contractAddress
        });
        return;
      }
      setLoadingInvoices(true);
      try {
        console.log('Fetching invoices for:', {
          address,
          network: currentNetwork.name,
          contractAddress: currentNetwork.contractAddress,
          chainId
        });

        const provider = new ethers.BrowserProvider(window.ethereum);

        // Use direct RPC provider if there's a network mismatch
        let contractProvider: ethers.BrowserProvider | ethers.JsonRpcProvider = provider;
        const network = await provider.getNetwork();
        
        if (Number(network.chainId) !== currentNetwork.chainId) {
          // Allow if wagmi reports correct chain (timing issue)
          if (chainId === currentNetwork.chainId) {
            console.warn(`⚠️ INVOICE PROVIDER/WAGMI MISMATCH (using direct RPC):
                - Provider reports chain ${Number(network.chainId)}
                - Wagmi reports chain ${chainId} ✅
              `);
            // Use direct RPC provider for the correct network
            const rpcUrl = currentNetwork.chainId === 2810 
              ? 'https://rpc-quicknode-holesky.morphl2.io'
              : undefined;
            if (rpcUrl) {
              contractProvider = new ethers.JsonRpcProvider(rpcUrl);
              console.warn('⚠️ Using direct RPC provider for invoices');
            }
          } else {
            console.warn('❌ Network mismatch for invoices - wallet may not be on correct network');
            setActiveInvoices(0);
            setTotalInvoices(0);
            setInvoiceList([]);
            setLoadingInvoices(false);
            return;
          }
        }

        // Check if Payroll contract exists
        const code = await contractProvider.getCode(currentNetwork.contractAddress);
        if (code === '0x') {
          console.error('Payroll contract not found at address:', currentNetwork.contractAddress);
          setActiveInvoices(0);
          setTotalInvoices(0);
          setInvoiceList([]);
          setLoadingInvoices(false);
          return;
        }

        const Pay_roll = new ethers.Contract(currentNetwork.contractAddress, PayrollABI.abi, contractProvider);

        // Check if the contract has the getInvoicesByMerchant function
        try {
          console.log('🔍 Attempting to fetch invoices...');
          
          // Check if the function exists before calling it
          if (typeof Pay_roll.getInvoicesByMerchant !== 'function') {
            console.log('⚠️ getInvoicesByMerchant function not found in contract');
            throw new Error('Function not available in this contract version');
          }

          // Try to get invoices using getInvoicesByMerchant function
          const invoiceHashes = await Pay_roll.getInvoicesByMerchant(address);
          console.log('Invoice hashes found:', invoiceHashes);

          // Get details for each invoice
          const invoices = await Promise.all(
            invoiceHashes.map((hash: string) => Pay_roll.invoices(hash).then((inv: any) => {
              console.log('Raw invoice data for hash', hash, ':', inv);
              // Map the indexed properties to named properties
              const mappedInv = {
                merchant: inv[0],
                token: inv[1],
                amount: inv[2],
                dueBy: inv[3],
                isPaid: inv[4],
                memo: inv[5],
                logoURI: inv[6],
                description: inv[7],
                paidAt: inv[8],
                hash: hash
              };
              console.log('Mapped invoice data:', mappedInv);
              return mappedInv;
            }))
          );

          // Count unpaid invoices (active)
          const active = invoices.filter((i: any) => !i.isPaid).length;
          const total = invoices.length;
          console.log('Invoice counts:', { total, active, invoices });
          setActiveInvoices(active);
          setTotalInvoices(total);
          setInvoiceList(invoices);

        } catch (contractError) {
          console.error('❌ Contract method error:', contractError);
          
          if (currentNetwork.chainId === 2810) {
            console.log('⚠️ Morph Holesky: Contract may not have getInvoicesByMerchant function');
            console.log('💡 This is normal - contract may be a different version or not fully deployed');
          } else {
            console.log('⚠️ The deployed contract may not have getInvoicesByMerchant function');
            console.log('💡 This is normal if using a different contract version');
          }

          // Set default values when contract doesn't support the function
          setActiveInvoices(0);
          setTotalInvoices(0);
          setInvoiceList([]);
        }
      } catch (e: any) {
        console.error('Error fetching invoices:', e);
        setActiveInvoices(null);
        setTotalInvoices(null);
        setInvoiceList([]);
      }
      setLoadingInvoices(false);
    };
    fetchActiveInvoices();
  }, [address, chainId, currentNetwork]);

  const getCurrentWeekDays = (): Date[] => {
    // Returns array of Date objects for Mon-Sun of current week
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  };

  const getPreviousWeekDays = (): Date[] => {
    // Returns array of Date objects for Mon-Sun of previous week
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - ((now.getDay() + 6) % 7) - 7); // Previous Monday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  };

  const getLast30Days = (): Date[] => {
    // Returns array of Date objects for last 30 days
    const now = new Date();
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (29 - i));
      return d;
    });
  };

  const getLast12Months = (): Date[] => {
    // Returns array of Date objects for first day of last 12 months
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      return d;
    });
  };

  const getDayLabel = (date: Date): string => {
    return date.toLocaleDateString(undefined, { weekday: 'short' }); // 'Mon', 'Tue', etc.
  };

  const getDateLabel = (date: Date): string => {
    return date.toLocaleDateString(undefined, { day: 'numeric' }); // '1', '2', etc.
  };

  const getMonthLabel = (date: Date): string => {
    return date.toLocaleDateString(undefined, { month: 'short' }); // 'Jan', 'Feb', etc.
  };

  // Get analytics data based on selected view
  const getAnalyticsData = (): { label: string; value: number; date: Date }[] => {
    let dates: Date[] = [];
    let labelFunction: (date: Date) => string = getDayLabel;
    let compareFunction: (paidDate: Date, targetDate: Date) => boolean;

    // Update analytics view based on selected period
    if (selectedPeriod === 'This Week' || selectedPeriod === 'Last Week') {
      dates = selectedPeriod === 'This Week' ? getCurrentWeekDays() : getPreviousWeekDays();
      labelFunction = getDayLabel;
      compareFunction = (paidDate, targetDate) =>
        paidDate.getUTCFullYear() === targetDate.getUTCFullYear() &&
        paidDate.getUTCMonth() === targetDate.getUTCMonth() &&
        paidDate.getUTCDate() === targetDate.getUTCDate();
    } else if (selectedPeriod === 'Last 30 Days') {
      dates = getLast30Days();
      labelFunction = getDateLabel;
      compareFunction = (paidDate, targetDate) =>
        paidDate.getUTCFullYear() === targetDate.getUTCFullYear() &&
        paidDate.getUTCMonth() === targetDate.getUTCMonth() &&
        paidDate.getUTCDate() === targetDate.getUTCDate();
    } else if (selectedPeriod === 'Last 12 Months') {
      dates = getLast12Months();
      labelFunction = getMonthLabel;
      compareFunction = (paidDate, targetDate) =>
        paidDate.getUTCFullYear() === targetDate.getUTCFullYear() &&
        paidDate.getUTCMonth() === targetDate.getUTCMonth();
    }

    return dates.map((date: Date) => {
      const total = invoiceList
        .filter(inv => inv.isPaid && inv.paidAt && Number(inv.paidAt) > 0 && !isNaN(Number(inv.paidAt)))
        .filter(inv => {
          const paidAtDate = new Date(Number(inv.paidAt) * 1000);
          return compareFunction(paidAtDate, date);
        })
        .reduce((sum, inv) => {
          // Use correct decimals based on the invoice token
          let tokenDecimals = 18; // Default
          if (inv.token === '0x036CbD53842c5426634e7929541eC2318f3dCF7e') {
            tokenDecimals = 6; // USDC on Base Sepolia
          } else if (inv.token === '0x9E12AD42c4E4d2acFBADE01a96446e48e6764B98') {
            tokenDecimals = 18; // USDT on Morph Holesky
          }
          return sum + (Number(inv.amount) / 10 ** tokenDecimals);
        }, 0);

      return {
        label: labelFunction(date),
        value: total,
        date: date,
      };
    });
  };

  // Compute analytics for selected period
  type AnalyticsBar = { label: string; value: number; date: Date };
  const analytics: AnalyticsBar[] = getAnalyticsData();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-50 text-green-700 border-green-200';
      case 'pending': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'overdue': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Invoice hash copied to clipboard!');
    });
  };

  const truncateHash = (hash: string) => {
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  const isConnected = !!address;

  return (
    <div className="flex-1 bg-white min-h-screen">
      <div className="p-6 max-w-8xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full">
                  <img
                    src={currentNetwork.token.logo}
                    alt={currentNetwork.token.symbol}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700">{currentNetwork.name}</span>
                </div>
              </div>
              <p className="text-gray-500">Welcome back! Here's your business overview on {currentNetwork.name}.</p>
            </div>
            <div className="flex items-center space-x-3">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option>This Week</option>
                <option>Last Week</option>
                <option>Last 30 Days</option>
                <option>Last 12 Months</option>
              </select>
              <button className="px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors duration-200 flex items-center space-x-2">
                <FaPlus className="text-sm" />
                <span>New Invoice</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-50 rounded-xl shadow-xs border border-gray-200 p-6 hover:shadow-sm transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gray-100 rounded-lg">
                <FaMoneyCheckAlt className="text-gray-800 text-xl" />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {!isConnected ? '--' : loadingBalance ? 'Loading...' : tokenBalance !== null ? tokenBalance : '--'}
              </div>
              {(tokenBalance === 'Contract not found' || tokenBalance === 'No USDT contract') && (
                <div className="mt-1 text-xs text-red-500">
                  USDT contract not deployed on {currentNetwork.name}
                </div>
              )}
              {(tokenBalance === 'Invalid contract' || tokenBalance === 'Invalid USDT contract') && (
                <div className="mt-1 text-xs text-red-500">
                  Invalid USDT contract address
                </div>
              )}
              {tokenBalance === 'Balance fetch failed' && (
                <div className="mt-1 text-xs text-red-500">
                  Failed to fetch USDT balance
                </div>
              )}
              {(tokenBalance === 'Network error' || tokenBalance === 'Network mismatch') && (
                <div className="mt-1 text-xs text-red-500">
                  Please switch MetaMask to {currentNetwork.name}
                </div>
              )}
            </div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Total Balance</h3>
          </div>

          <div className="bg-gray-50 rounded-xl shadow-xs border border-gray-200 p-6 hover:shadow-sm transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gray-100 rounded-lg">
                <FaFileInvoice className="text-gray-800 text-xl" />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {!isConnected ? '--' : loadingInvoices ? 'Loading...' : totalInvoices !== null ? String(totalInvoices) : '--'}
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Total Invoices</h3>
          </div>

          <div className="bg-gray-50 rounded-xl shadow-xs border border-gray-200 p-6 hover:shadow-sm transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gray-100 rounded-lg">
                <FaFileInvoice className="text-gray-800 text-xl" />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {!isConnected ? '--' : loadingInvoices ? 'Loading...' : activeInvoices !== null ? String(activeInvoices) : '--'}
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Active Invoices</h3>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Analytics Chart */}
          <div className="lg:col-span-2 bg-gray-50 rounded-xl shadow-xs border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Revenue Analytics</h3>
                <p className="text-sm text-gray-500 mt-1">Track your payment history and trends</p>
              </div>
              <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                <FaEllipsisH />
              </button>
            </div>

            {!isConnected ? (
              <div className="flex items-center justify-center h-40 text-gray-400 text-lg font-medium">Connect your wallet to view analytics.</div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-gray-800 rounded-full"></div>
                      <span className="text-sm text-gray-600">Revenue</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      Total: ${analytics.reduce((sum, bar) => sum + bar.value, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {selectedPeriod}
                  </div>
                </div>

                <div className="flex items-end h-40 gap-2">
                  {analytics.map((bar, idx) => (
                    <div key={idx} className="flex flex-col items-center flex-1">
                      <div className="relative w-full flex flex-col items-center group">
                        <div
                          className={`w-full rounded-t-lg transition-all duration-500 hover:bg-gray-700 cursor-pointer ${bar.value === 0
                              ? 'bg-gray-200'
                              : 'bg-gray-800'
                            }`}
                          style={{
                            height: `${Math.max(bar.value / Math.max(...analytics.map(b => b.value), 1) * 140, 8)}px`,
                            minHeight: '8px'
                          }}
                          title={`${bar.label}: $${bar.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                        >
                          {bar.value > 0 && (
                            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-2 py-1 rounded-lg text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                              ${bar.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="mt-3 text-xs text-gray-500 font-medium">{bar.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-gray-50 rounded-xl shadow-xs border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h3>
            <div className="space-y-3">
              <button className="w-full flex items-center p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors duration-200 border border-gray-100">
                <div className="p-2 bg-gray-800 rounded-lg mr-3">
                  <FaArrowDown className="text-white" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-gray-900">Receive Payment</div>
                  <div className="text-sm text-gray-500">Accept crypto payments</div>
                </div>
              </button>

              <button className="w-full flex items-center p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors duration-200 border border-gray-100">
                <div className="p-2 bg-gray-800 rounded-lg mr-3">
                  <FaArrowUp className="text-white" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-gray-900">Send Payment</div>
                  <div className="text-sm text-gray-500">Pay suppliers & vendors</div>
                </div>
              </button>

              <button className="w-full flex items-center p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors duration-200 border border-gray-100">
                <div className="p-2 bg-gray-800 rounded-lg mr-3">
                  <FaExchangeAlt className="text-white" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-gray-900">Exchange</div>
                  <div className="text-sm text-gray-500">Convert currencies</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Recent Payments */}
        <div className="bg-gray-50 rounded-xl shadow-xs border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Recent Payments</h3>
              <div className="flex items-center space-x-2">
                <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                  <FaEye />
                </button>
                <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                  <FaDownload />
                </button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto" style={{ maxHeight: 400, overflowY: 'auto' }}>
            {!isConnected ? (
              <div className="flex items-center justify-center h-40 text-gray-400 text-lg font-medium">Connect your wallet to view recent payments.</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice Hash</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Logo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Memo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Share</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {loadingInvoices ? (
                    <tr><td colSpan={8} className="text-center py-6 text-gray-400">Loading...</td></tr>
                  ) : invoiceList.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-6 text-gray-400">No invoices found.</td></tr>
                  ) : (
                    invoiceList.map((inv) => (
                      <tr key={inv.hash} className="hover:bg-gray-50 transition-colors duration-200">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-blue-600">
                          <div className="flex items-center gap-2">
                            <span>{truncateHash(inv.hash)}</span>
                            <button
                              onClick={() => copyToClipboard(inv.hash)}
                              className="p-1 hover:bg-gray-100 rounded transition-colors"
                              title="Copy full hash"
                            >
                              <FaCopy className="text-xs text-gray-500 hover:text-gray-700" />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {inv.logoURI ? (
                            <img src={inv.logoURI} alt="Logo" className="w-8 h-8 rounded-full border border-gray-200" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                              <span className="text-xs text-gray-500">—</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                          {(() => {
                            // Determine the correct token decimals and symbol based on the invoice token address
                            let tokenDecimals = 18; // Default
                            let tokenSymbol = 'ETH'; // Default
                            
                            if (inv.token === '0x036CbD53842c5426634e7929541eC2318f3dCF7e') {
                              // USDC on Base Sepolia
                              tokenDecimals = 6;
                              tokenSymbol = 'USDC';
                            } else if (inv.token === '0x9E12AD42c4E4d2acFBADE01a96446e48e6764B98') {
                              // USDT on Morph Holesky
                              tokenDecimals = 18;
                              tokenSymbol = 'USDT';
                            } else if (inv.token === '0x0000000000000000000000000000000000000000') {
                              // Native ETH
                              tokenDecimals = 18;
                              tokenSymbol = 'ETH';
                            }
                            
                            let amount = '0.00';
                            if (!isNaN(Number(inv.amount)) && Number(inv.amount) > 0) {
                              const rawAmount = Number(inv.amount) / 10 ** tokenDecimals;
                              if (rawAmount >= 0.01) {
                                amount = rawAmount.toFixed(2);
                              } else if (rawAmount >= 0.000001) {
                                amount = rawAmount.toFixed(6);
                              } else {
                                amount = rawAmount.toExponential(2);
                              }
                            }
                            
                            return `${amount} ${tokenSymbol}`;
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(inv.isPaid ? 'paid' : (inv.dueBy && inv.dueBy !== 0 && !isNaN(Number(inv.dueBy)) && Date.now() / 1000 > Number(inv.dueBy)) ? 'overdue' : 'pending')}`}>
                            {inv.isPaid ? 'paid' : (inv.dueBy && inv.dueBy !== 0 && !isNaN(Number(inv.dueBy)) && Date.now() / 1000 > Number(inv.dueBy)) ? 'overdue' : 'pending'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {inv.dueBy && inv.dueBy !== 0 && !isNaN(Number(inv.dueBy)) ?
                            new Date(Number(inv.dueBy) * 1000).toLocaleDateString() : 'No Due Date'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 max-w-xs truncate">
                          {inv.memo && inv.memo !== '' ? inv.memo : '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                          {inv.description && inv.description !== '' ? inv.description : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => copyToClipboard(`http://localhost:5173/pay/invoice_checkout?hash=${inv.hash}`)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Copy share URL"
                          >
                            <FaEye className="text-sm text-gray-500 hover:text-gray-700" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;