import { useState } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { FaCog, FaNetworkWired, FaCheckCircle } from 'react-icons/fa';
import { toast } from 'react-toastify';

// Import the custom chain from wagmi config
const morphHolesky = {
  id: 2810,
  name: 'Morph Holesky Testnet',
  network: 'morph-holesky',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc-quicknode-holesky.morphl2.io'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Morph Holesky Explorer',
      url: 'https://explorer-holesky.morphl2.io',
    },
  },
  testnet: true,
};

const supportedChains = [
  baseSepolia,
  morphHolesky,
];

const Settings = () => {
  const { isConnected } = useAccount();
  const currentChainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  const [selectedChainId, setSelectedChainId] = useState(currentChainId);

  const handleChainSwitch = async (chainId: number) => {
    if (!isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      setSelectedChainId(chainId);
      await switchChain({ chainId });
      toast.success('Chain switched successfully!');
    } catch (error) {
      console.error('Error switching chain:', error);
      toast.error('Failed to switch chain. Please try again.');
      setSelectedChainId(currentChainId);
    }
  };

  const getChainStatus = (chainId: number) => {
    if (currentChainId === chainId) {
      return 'active';
    }
    return 'inactive';
  };

  const getCurrentChain = () => {
    return supportedChains.find(chain => chain.id === currentChainId);
  };

  return (
    <div className="flex-1 bg-white min-h-screen">
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <FaCog className="text-2xl text-gray-700" />
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          </div>
          <p className="text-gray-500">Manage your application settings and preferences</p>
        </div>

        {/* Network Settings Section */}
        <div className="bg-gray-50 rounded-xl shadow-xs border border-gray-200 p-6 mb-6">
          <div className="flex items-center space-x-3 mb-6">
            <FaNetworkWired className="text-xl text-gray-700" />
            <h2 className="text-xl font-semibold text-gray-900">Network Settings</h2>
          </div>

          {/* Current Network Display */}
          {isConnected && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Current Network</h3>
              <div className="flex items-center space-x-2">
                <FaCheckCircle className="text-blue-600" />
                <span className="text-blue-800 font-medium">
                  {getCurrentChain()?.name || `Chain ID: ${currentChainId}`}
                </span>
              </div>
            </div>
          )}

          {/* Chain Selection */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Supported Networks</h3>
            <div className="space-y-3">
              {supportedChains.map((chain) => (
                <div
                  key={chain.id}
                  className={`p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                    getChainStatus(chain.id) === 'active'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => handleChainSwitch(chain.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 rounded-full ${
                        getChainStatus(chain.id) === 'active' 
                          ? 'bg-green-500' 
                          : 'bg-gray-300'
                      }`} />
                      <div>
                        <h4 className="font-medium text-gray-900">{chain.name}</h4>
                        <p className="text-sm text-gray-500">
                          Chain ID: {chain.id} • {chain.testnet ? 'Testnet' : 'Mainnet'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getChainStatus(chain.id) === 'active' && (
                        <span className="px-3 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                          Active
                        </span>
                      )}
                      {isPending && selectedChainId === chain.id && (
                        <span className="px-3 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                          Switching...
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Chain Details */}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">Native Currency:</span>
                        <span className="ml-2 font-medium text-gray-900">
                          {chain.nativeCurrency.symbol}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Explorer:</span>
                        <a
                          href={chain.blockExplorers?.default?.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-blue-600 hover:text-blue-800 underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View Explorer
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Connection Status */}
          {!isConnected && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800">
                Connect your wallet to switch between networks
              </p>
            </div>
          )}
        </div>

        {/* Additional Settings Section (for future use) */}
        <div className="bg-gray-50 rounded-xl shadow-xs border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">General Settings</h2>
          <p className="text-gray-500">Additional settings will be available here in future updates.</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;