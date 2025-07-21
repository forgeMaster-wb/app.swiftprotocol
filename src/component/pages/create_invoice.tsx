import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useAccount, useWalletClient, useChainId } from 'wagmi';
import PayrollABI from '../utils/abis/Payroll.json'; // Adjust the path as necessary
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';


interface InvoiceFormData {
  merchant: string;
  token: string;
  amount: string;
  validForSeconds: string;
  memo: string;
  logoURI: string;
  description: string;
}

// Add TokenOption interface and USDC token list
interface TokenOption {
  name: string;
  address: string;
  logo: string;
}

const USDC_TOKEN_BASE_SEPOLIA: TokenOption = {
  name: 'USDC',
  address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  logo: 'https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1696506694', // public USDC logo
};

const USDT_TOKEN_MORPH_HOLESKY: TokenOption = {
  name: 'USDT',
  address: '0x9E12AD42c4E4d2acFBADE01a96446e48e6764B98',
  logo: 'https://assets.coingecko.com/coins/images/325/standard/Tether.png?1696501661', // public USDC logo
};

// Network configuration for contract addresses
interface NetworkConfig {
  chainId: number;
  name: string;
  contractAddress?: string;
  supportedTokens: TokenOption[];
}

const NETWORK_CONFIGS: Record<number, NetworkConfig> = {
  // Base Sepolia Testnet
  84532: {
    chainId: 84532,
    name: 'Base Sepolia',
    contractAddress: import.meta.env.VITE_INVOICE_CONTRACT_ADDRESS_BASE_SEPOLIA,
    supportedTokens: [USDC_TOKEN_BASE_SEPOLIA]
  },
  
  // Morph Holesky Testnet
  2810: {
    chainId: 2810,
    name: 'Morph Holesky',
    contractAddress: import.meta.env.VITE_BASEPAY_MORPH,
    supportedTokens: [USDT_TOKEN_MORPH_HOLESKY]
  }
};

const CreateInvoice = () => {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  
  // Get current network configuration based on connected chain ID
  // Falls back to Base Sepolia (84532) if the current network is not supported
  const currentNetwork = NETWORK_CONFIGS[chainId] || NETWORK_CONFIGS[84532];
  
  const [formData, setFormData] = useState<InvoiceFormData>({
    merchant: '',
    token: currentNetwork.supportedTokens[0]?.address || USDC_TOKEN_BASE_SEPOLIA.address, // Default to first supported token
    amount: '',
    validForSeconds: '86400', // Default 1 day
    memo: '',
    logoURI: '',
    description: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, setInvoiceHash] = useState('');
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [, setCreationLog] = useState<string[]>([]);
  const [, setInvoiceCreated] = useState(false);

  // Initialize contract when walletClient is available
  useEffect(() => {
    if (walletClient && currentNetwork.contractAddress) {
      const contractAddress = currentNetwork.contractAddress;
      if (!contractAddress) {
        setCreationLog(logs => [
          ...logs,
          `Error: Contract address is not set for ${currentNetwork.name}. Please check your environment variables.`
        ]);
        return;
      }
      const getSigner = async () => {
        const provider = new ethers.BrowserProvider(walletClient.transport);
        const signer = await provider.getSigner();
        const PayrollContract = new ethers.Contract(
          contractAddress,
          PayrollABI.abi,
          signer
        );
        setContract(PayrollContract);
      };
      getSigner();
    }
  }, [walletClient, currentNetwork]);

  useEffect(() => {
    // Auto-fill merchant with connected address
    if (address) {
      setFormData(prev => ({ ...prev, merchant: address }));
    }
  }, [address]);

  useEffect(() => {
    // Update token selection when network changes
    setFormData(prev => ({ 
      ...prev, 
      token: currentNetwork.supportedTokens[0]?.address || USDC_TOKEN_BASE_SEPOLIA.address 
    }));
  }, [currentNetwork]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Add a separate handler for select changes
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const generateInvoiceHash = () => {
    const randomBytes = ethers.randomBytes(32);
    return ethers.keccak256(randomBytes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract || !address) {
      toast.error('Error: Wallet not connected or contract not initialized.');
      return;
    }
    setIsSubmitting(true);
    setInvoiceCreated(false);
    setInvoiceHash('');
    toast.loading('Creating invoice...');
    try {
      // Generate unique invoice hash
      const hash = generateInvoiceHash();
      toast.info(`Generated invoice hash: ${hash}`);
      // Convert values to appropriate formats using correct token decimals
      let amountWei;
      if (formData.token === ethers.ZeroAddress) {
        amountWei = ethers.parseEther(formData.amount);
      } else {
        // Determine decimals based on selected token
        let tokenDecimals = 18; // Default
        
        if (formData.token === '0x036CbD53842c5426634e7929541eC2318f3dCF7e') {
          tokenDecimals = 6; // USDC on Base Sepolia
        } else if (formData.token === '0x9E12AD42c4E4d2acFBADE01a96446e48e6764B98') {
          tokenDecimals = 18; // USDT on Morph Holesky
        }
        
        amountWei = ethers.parseUnits(formData.amount, tokenDecimals);
      }
      const validForSeconds = parseInt(formData.validForSeconds);
      // Call the contract with correct arguments (hash as first argument)
      const tx = await contract.createInvoice(
        hash,
        formData.token || USDC_TOKEN_BASE_SEPOLIA.address,
        amountWei,
        validForSeconds,
        formData.memo,
        formData.logoURI,
        formData.description
      );
      await tx.wait();
      setInvoiceHash(hash);
      setInvoiceCreated(true);
      toast.dismiss();
      toast.success(<div>Invoice created successfully!<br/><span className='break-all'>Hash: {hash}</span></div>);
    } catch (error: any) {
      setInvoiceCreated(false);
      setInvoiceHash('');
      toast.dismiss();
      toast.error(`Error creating invoice: ${error.message || error}`);
      console.error('Error creating invoice:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto my-16 flex flex-col md:flex-row gap-8">
      {/* Form Section */}
      <div className="flex-1">
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-3xl font-extrabold text-gray-900">Create New Invoice</h1>
          <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full">
            <img 
              src={currentNetwork.supportedTokens[0]?.logo} 
              alt={currentNetwork.supportedTokens[0]?.name} 
              className="w-4 h-4"
            />
            <span className="text-sm font-medium text-gray-700">{currentNetwork.name}</span>
          </div>
        </div>
        <p className="text-gray-500 mb-8">Easily generate and send invoices to your clients on {currentNetwork.name}.</p>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Merchant Address</label>
              <input
                type="text"
                name="merchant"
                value={formData.merchant}
                onChange={handleChange}
                placeholder="Merchant address"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-base focus:ring-2 focus:ring-black focus:border-black transition placeholder-gray-400"
                readOnly={!!address} // Make read-only if connected
              />
              {address && (
                <p className="text-xs text-gray-400 mt-1">Connected: {address}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valid For (seconds)</label>
              <input
                type="number"
                name="validForSeconds"
                value={formData.validForSeconds}
                onChange={handleChange}
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-base focus:ring-2 focus:ring-black focus:border-black transition placeholder-gray-400"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
              <input
                type="text"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                placeholder="0.1"
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-base focus:ring-2 focus:ring-black focus:border-black transition placeholder-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Token</label>
              <div className="relative">
                <select
                  name="token"
                  value={formData.token || USDC_TOKEN_BASE_SEPOLIA.address}
                  onChange={handleSelectChange}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-base focus:ring-2 focus:ring-black focus:border-black transition appearance-none pr-10"
                >
                  {currentNetwork.supportedTokens.map((token) => (
                    <option key={token.address} value={token.address}>{token.name}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <img 
                    src={currentNetwork.supportedTokens.find(t => t.address === (formData.token || currentNetwork.supportedTokens[0]?.address))?.logo || currentNetwork.supportedTokens[0]?.logo} 
                    alt={currentNetwork.supportedTokens.find(t => t.address === (formData.token || currentNetwork.supportedTokens[0]?.address))?.name || "Token"} 
                    className="w-6 h-6 inline-block align-middle" 
                  />
                </div>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Memo</label>
            <input
              type="text"
              name="memo"
              value={formData.memo}
              onChange={handleChange}
              required
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-base focus:ring-2 focus:ring-black focus:border-black transition placeholder-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Logo URI (optional)</label>
            <input
              type="text"
              name="logoURI"
              value={formData.logoURI}
              onChange={handleChange}
              placeholder="https://..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-base focus:ring-2 focus:ring-black focus:border-black transition placeholder-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-base focus:ring-2 focus:ring-black focus:border-black transition placeholder-gray-400"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting || !address}
            className={`w-full rounded-full bg-black hover:bg-gray-900 text-white font-semibold py-3 px-6 text-lg transition-colors shadow-none focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 flex items-center justify-center gap-2
            ${!address ? 'bg-gray-400 cursor-not-allowed' : isSubmitting ? 'bg-gray-700 cursor-not-allowed' : ''}`}
          >
            {isSubmitting ? 'Creating...' : 'Create Invoice'}
          </button>
        </form>
        { /* Toast notifications */ }
        <ToastContainer position="top-right" autoClose={5000} hideProgressBar={false} newestOnTop closeOnClick pauseOnFocusLoss draggable pauseOnHover />
        {!address && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-md">
            <p className="font-medium">⚠️ Wallet Not Connected</p>
            <p className="text-sm mt-1">Please connect your wallet to create an invoice.</p>
          </div>
        )}
      </div>
      {/* Preview Section */}
      <div className="flex-1 max-w-md w-full">
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 shadow-sm">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Invoice Preview</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-600">Merchant:</span>
              <span className="text-gray-900 break-all">{formData.merchant || address || '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-600">Token:</span>
              <span className="flex items-center gap-2">
                {currentNetwork.supportedTokens.find(t => t.address === (formData.token || currentNetwork.supportedTokens[0]?.address)) && (
                  <img src={currentNetwork.supportedTokens.find(t => t.address === (formData.token || currentNetwork.supportedTokens[0]?.address))!.logo} alt="token" className="w-5 h-5 inline-block" />
                )}
                <span>{currentNetwork.supportedTokens.find(t => t.address === (formData.token || currentNetwork.supportedTokens[0]?.address))?.name || '—'}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-600">Amount:</span>
              <span className="text-gray-900">{formData.amount || '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-600">Valid For:</span>
              <span className="text-gray-900">{formData.validForSeconds || '—'} seconds</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-600">Memo:</span>
              <span className="text-gray-900">{formData.memo || '—'}</span>
            </div>
            {formData.logoURI && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-600">Logo:</span>
                <img src={formData.logoURI} alt="Logo" className="w-10 h-10 rounded-full border border-gray-200" />
              </div>
            )}
            <div>
              <span className="font-medium text-gray-600">Description:</span>
              <div className="text-gray-900 mt-1 whitespace-pre-line">{formData.description || '—'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateInvoice;