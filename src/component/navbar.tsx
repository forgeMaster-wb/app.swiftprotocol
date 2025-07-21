import React, { useState, useRef, useEffect, type JSX } from 'react';
import { FaRegCreditCard, FaChevronDown } from 'react-icons/fa';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';

declare global {
  interface Window {
    ethereum?: any;
    phantom?: {
      ethereum?: {
        isPhantom?: boolean;
        request?: (...args: any[]) => Promise<any>;
      };
    };
  }
}

interface WalletOption {
  name: string;
  icon: string;
  target: 'metaMask' | 'phantom' | 'status' | 'apexWallet' | 'avalanche' | 'backpack' | 'bifrost' | 'bitKeep' | 'bitski' | 'blockWallet' | 'braveWallet' | 'coinbaseWallet' | 'dawn' | 'enkrypt' | 'exodus' | 'fireblocks' | 'frame' | 'frontier' | 'gamestop' | 'hyperPay' | 'imToken' | 'keepkey' | 'kardiachain' | 'ledger' | 'mathWallet' | 'okxWallet' | 'oneInch' | 'opera' | 'phantom' | 'rabby' | 'rainbow' | 'safe' | 'safeheron' | 'taho' | 'talisman' | 'tokenPocket' | 'toroWallet' | 'trust' | 'wallet' | 'xdefi' | undefined;
  installed: boolean;
  downloadUrl?: string;
}

const WalletConnect = () => {
  const { isConnected, address } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const [showSidebar, setShowSidebar] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletOption | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getAvailableWallets = (): WalletOption[] => {
    const wallets: WalletOption[] = [];
    
    // Better Phantom detection
    const hasPhantom = window.phantom?.ethereum?.isPhantom || 
                      (window.ethereum?.isPhantom && !window.ethereum?.isMetaMask) ||
                      (window.phantom && window.phantom.ethereum);
    
    if (window.ethereum?.isMetaMask) {
      wallets.push({
        name: 'MetaMask',
        icon: '🦊',
        target: 'metaMask',
        installed: true
      });
    }
    
    if (hasPhantom) {
      wallets.push({
        name: 'Phantom',
        icon: '👻',
        target: 'phantom',
        installed: true
      });
    }

    // Add uninstalled wallets as options
    if (!window.ethereum?.isMetaMask) {
      wallets.push({
        name: 'MetaMask',
        icon: '🦊',
        target: 'metaMask',
        installed: false,
        downloadUrl: 'https://metamask.io/download.html'
      });
    }

    if (!hasPhantom) {
      wallets.push({
        name: 'Phantom',
        icon: '👻',
        target: 'phantom',
        installed: false,
        downloadUrl: 'https://phantom.app/download'
      });
    }

    return wallets;
  };

  const handleWalletSelect = async (wallet: WalletOption) => {
    if (!wallet.installed) {
      window.open(wallet.downloadUrl, '_blank');
      setShowSidebar(false);
      return;
    }
    setSelectedWallet(wallet);
    setShowConnectModal(true);
  };

  const handleProceedConnect = async () => {
    if (!selectedWallet) return;
    setConnecting(true);
    try {
      await connect({
        connector: injected({
          target: selectedWallet.target as 'metaMask' | 'phantom' | undefined,
        })
      });
      setShowSidebar(false);
      setShowConnectModal(false);
      setSelectedWallet(null);
    } catch (error) {
      alert(`Failed to connect to ${selectedWallet.name}. Please try again.`);
    }
    setConnecting(false);
  };

  const handleCancelConnect = () => {
    setShowConnectModal(false);
    setSelectedWallet(null);
  };

  const handleConnect = () => {
    const availableWallets = getAvailableWallets();
    
    if (availableWallets.length === 0) {
      alert('Please install MetaMask or Phantom wallet extension');
      window.open('https://metamask.io/download.html', '_blank');
      return;
    }

    setShowSidebar(true);
  };

  const handleDisconnect = () => {
    disconnect();
    setShowDropdown(false);
  };

  const shortenAddress = (addr?: `0x${string}`) => {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const WALLET_ICONS: Record<string, JSX.Element> = {
    MetaMask: (
      <img
        src="https://imgs.search.brave.com/y9gb5jGsk7eb0VnpxXEs1dqGNI3X0eRhcnABcLsn1lY/rs:fit:500:0:0:0/g:ce/aHR0cHM6Ly91cGxv/YWQud2lraW1lZGlh/Lm9yZy93aWtpcGVk/aWEvY29tbW9ucy90/aHVtYi8zLzM2L01l/dGFNYXNrX0ZveC5z/dmcvMjUwcHgtTWV0/YU1hc2tfRm94LnN2/Zy5wbmc"
        alt="MetaMask"
        className="w-7 h-7 mr-3"
      />
    ),
    Phantom: (
      <img
        src="https://mintlify.s3.us-west-1.amazonaws.com/phantom-e50e2e68/resources/images/Phantom_SVG_Icon.svg"
        alt="Phantom"
        className="w-7 h-7 mr-3"
      />
    ),
  };

  return (
    <>
      {isConnected && address ? (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="px-4 py-2 bg-gray-50 text-gray-800 rounded-lg hover:bg-gray-100 transition-colors duration-200 border border-gray-200 text-sm font-medium flex items-center gap-2"
          >
            {shortenAddress(address)}
            <FaChevronDown className={`w-3 h-3 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
          </button>
          
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
              <button
                onClick={handleDisconnect}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors duration-200"
              >
                Disconnect Wallet
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={handleConnect}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors duration-200 text-sm font-medium"
        >
          Connect Wallet
        </button>
      )}

      {/* Wallet Selection Sidebar */}
      {showSidebar && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 z-40 backdrop-blur-sm bg-white/30"
            onClick={() => setShowSidebar(false)}
          />
          {/* Sidebar */}
          <div className="fixed right-0 top-0 h-full w-130 bg-gray-50 shadow-lg z-50 transform transition-transform duration-300 ease-in-out">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">Connect Wallet</h2>
                <button
                  onClick={() => setShowSidebar(false)}
                  className="text-gray-500 hover:text-gray-700 text-xl"
                >
                  ✕
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Choose a wallet to connect to Swift Protocol
              </p>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {getAvailableWallets().map((wallet: WalletOption, index: number) => (
                  <button
                    key={index}
                    onClick={() => handleWalletSelect(wallet)}
                    className="w-full flex items-center bg-white justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
                  >
                    <div className="flex items-center">
                      {WALLET_ICONS[wallet.name] || <span className="text-2xl mr-3">{wallet.icon}</span>}
                      <span className="font-medium text-gray-900">{wallet.name}</span>
                    </div>
                    <div className="flex items-center">
                      {wallet.installed ? (
                        <span className="text-green-600 text-sm font-medium">Installed</span>
                      ) : (
                        <span className="text-blue-600 text-sm font-medium">Install</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>New to wallets?</strong> A wallet is needed to connect to decentralized applications. Choose one above to get started.
                </p>
              </div>
            </div>
          </div>
          {/* Connect Modal */}
          {showConnectModal && selectedWallet && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 backdrop-blur-sm bg-white/30" onClick={handleCancelConnect} />
              <div className="relative bg-white rounded-3xl shadow-2xl p-12 w-full max-w-lg flex flex-col items-center border border-gray-200 animate-fadeIn sm:p-12 p-6">
                <div className="mb-6 flex flex-col items-center">
                  <div className="relative mb-4 flex items-center justify-center" style={{ height: 110, width: 110 }}>
                     {/* Loading ring absolutely positioned around the logo */}
                     {connecting && (
                       <span className="absolute inset-0 flex items-center justify-center z-10">
                         <span className="animate-spin rounded-full border-8 border-gray-100 border-t-transparent h-[110px] w-[110px]" />
                       </span>
                     )}
                    <span className="block w-[80px] h-[80px] flex items-center justify-center z-20 mx-auto rounded-full overflow-hidden bg-white">
                      {React.cloneElement(WALLET_ICONS[selectedWallet.name], { className: 'w-[80px] h-[80px] mr-0' })}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Connect with {selectedWallet.name}</h3>
                  <p className="text-gray-600 text-base text-center">You are about to connect with <span className="font-bold">{selectedWallet.name}</span>.</p>
                </div>
                <div className="flex gap-6 mt-6 w-full">
                  <button
                    onClick={handleCancelConnect}
                    className="flex-1 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 font-medium hover:bg-gray-100 transition text-lg"
                    disabled={connecting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      setConnecting(true);
                      setTimeout(async () => {
                        await handleProceedConnect();
                      }, 5000);
                    }}
                    className="flex-1 py-3 rounded-xl bg-black text-white font-semibold hover:bg-gray-900 transition flex items-center justify-center text-lg"
                    disabled={connecting}
                  >
                    {connecting ? 'Connecting...' : 'Proceed'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {/* Responsive adjustments */}
      <style>{`
        @media (max-width: 640px) {
          .max-w-lg { max-width: 95vw !important; }
          .p-12 { padding: 1.5rem !important; }
        }
      `}</style>
    </>
  );
};

const Navbar = () => {
  return (
    <nav className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 shadow-sm">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <FaRegCreditCard className="text-2xl text-gray-800 mr-2" />
          <div className="text-2xl font-bold text-gray-900">Swift Protocol</div>
          <div className="ml-2 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
            Beta
          </div>
        </div>
        <div>
          <WalletConnect />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;