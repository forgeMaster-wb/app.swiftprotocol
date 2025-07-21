import { createConfig, http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';
import { defineChain } from 'viem';

// Define Morph Holesky Testnet
const morphHolesky = defineChain({
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
    public: {
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
});

export const config = createConfig({
  chains: [baseSepolia, morphHolesky],
  connectors: [
    injected({ target: 'metaMask' }), // For MetaMask
    injected({ target: 'phantom' }),  // For Phantom
  ],
  transports: {
    [baseSepolia.id]: http(),
    [morphHolesky.id]: http('https://rpc-quicknode-holesky.morphl2.io'),
  },
});