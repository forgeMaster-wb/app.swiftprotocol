import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { useAccount } from 'wagmi';
import { FaArrowUp, FaArrowDown, FaFileInvoice, FaMoneyCheckAlt } from 'react-icons/fa';

const ETHERSCAN_API_KEY = import.meta.env.VITE_ETHERSCAN_API_KEY;
const ETHERSCAN_V2_API = 'https://api.etherscan.io/v2/api';
const BASE_SEPOLIA_CHAINID = 84532;
const PAYROLL_CONTRACT_ADDRESS = import.meta.env.VITE_INVOICE_CONTRACT_ADDRESS_BASE_SEPOLIA?.toLowerCase();

// Function selectors (first 4 bytes of keccak256 hash of function signature)
const CREATE_INVOICE_SELECTOR = '0x09f6d5e8'; // createInvoice(bytes32,address,uint256,uint256,string,string,string)
const PAY_INVOICE_SELECTOR = '0xf8a8a076'; // payInvoice(bytes32)

interface Transaction {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  transactionIndex: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  isError: string;
  txreceipt_status: string;
  input: string;
  contractAddress: string;
  cumulativeGasUsed: string;
  gasUsed: string;
  confirmations: string;
}

type TxType = 'Created Invoice' | 'Paid Invoice' | 'Received' | 'Sent' | 'Other';

const getTxType = (tx: Transaction, wallet: string): TxType => {
  const to = tx.to?.toLowerCase();
  const from = tx.from?.toLowerCase();
  if (to === PAYROLL_CONTRACT_ADDRESS && tx.input.startsWith(CREATE_INVOICE_SELECTOR)) {
    return 'Created Invoice';
  }
  if (to === PAYROLL_CONTRACT_ADDRESS && tx.input.startsWith(PAY_INVOICE_SELECTOR)) {
    return 'Paid Invoice';
  }
  if (to === wallet && from !== PAYROLL_CONTRACT_ADDRESS) {
    return 'Received';
  }
  if (from === wallet && to !== PAYROLL_CONTRACT_ADDRESS) {
    return 'Sent';
  }
  return 'Other';
};

const typeTheme = {
  'Created Invoice': {
    icon: <FaFileInvoice className="text-blue-600" />, badge: 'bg-blue-50 text-blue-700 border-blue-200'
  },
  'Paid Invoice': {
    icon: <FaMoneyCheckAlt className="text-green-600" />, badge: 'bg-green-50 text-green-700 border-green-200'
  },
  'Received': {
    icon: <FaArrowDown className="text-green-600" />, badge: 'bg-green-50 text-green-700 border-green-200'
  },
  'Sent': {
    icon: <FaArrowUp className="text-yellow-600" />, badge: 'bg-yellow-50 text-yellow-700 border-yellow-200'
  },
  'Other': {
    icon: <FaFileInvoice className="text-gray-400" />, badge: 'bg-gray-50 text-gray-700 border-gray-200'
  }
};

const Transactions: React.FC = () => {
  const { address } = useAccount();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setTransactions([]);
      setLoading(false);
      return;
    }
    const fetchTransactions = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `${ETHERSCAN_V2_API}?chainid=${BASE_SEPOLIA_CHAINID}&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        console.log('Etherscan V2 API response:', data); // Debug log
        if (data.status !== '1') {
          setError(data.result || data.message || 'No transactions found.');
          setTransactions([]);
        } else {
          setTransactions(data.result);
        }
      } catch (e: any) {
        setError('Failed to fetch transactions.');
        setTransactions([]);
      }
      setLoading(false);
    };
    fetchTransactions();
  }, [address]);

  const formatAge = (timestamp: string) => {
    const now = Date.now() / 1000;
    const diff = Math.floor(now - Number(timestamp));
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="max-w-8xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Wallet Transactions</h1>
      <p className="text-gray-500 mb-8">All historical transactions for your wallet on Base Sepolia.</p>
      {!address ? (
        <div className="text-center py-10 text-gray-400 text-lg">Connect your wallet to view your transactions.</div>
      ) : loading ? (
        <div className="text-center py-10 text-gray-400 text-lg">Loading transactions...</div>
      ) : error ? (
        <div className="text-center py-10 text-red-500 text-lg">{error}</div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-lg">No transactions found for your wallet.</div>
      ) : (
        <div className="bg-gray-50 rounded-xl shadow-xs border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto" style={{ maxHeight: 400, overflowY: 'auto' }}>
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tx Hash</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Block</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value (ETH)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {transactions.map(tx => {
                  const txType = getTxType(tx, address?.toLowerCase() || '');
                  const theme = typeTheme[txType];
                  const valueColor = txType === 'Received' ? 'text-green-700' : txType === 'Sent' ? 'text-yellow-700' : txType === 'Created Invoice' ? 'text-blue-700' : txType === 'Paid Invoice' ? 'text-green-700' : 'text-gray-700';
                  return (
                    <tr key={tx.hash} className="hover:bg-gray-50 transition-colors duration-150 group">
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium ${theme.badge}`} title={txType}>
                          {theme.icon}
                          <span className="hidden md:inline">{txType}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-blue-700 truncate max-w-[120px]">
                        <a href={`https://base-sepolia.basescan.org/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" className="underline" title={tx.hash}>{tx.hash.slice(0, 10)}...</a>
                      </td>
                      <td className="px-6 py-4">{tx.blockNumber}</td>
                      <td className="px-6 py-4">{formatAge(tx.timeStamp)}</td>
                      <td className="px-6 py-4 font-mono text-xs truncate max-w-[100px]" title={tx.from}>{tx.from.slice(0, 8)}...{tx.from.slice(-4)}</td>
                      <td className="px-6 py-4 font-mono text-xs truncate max-w-[100px]" title={tx.to}>{tx.to.slice(0, 8)}...{tx.to.slice(-4)}</td>
                      <td className={`px-6 py-4 font-semibold ${valueColor}`}>{ethers.formatEther(tx.value)}</td>
                      <td className="px-6 py-4">
                        {tx.isError === '0' && tx.txreceipt_status === '1' ? (
                          <span className="inline-block px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs font-semibold">Success</span>
                        ) : (
                          <span className="inline-block px-2 py-1 bg-red-50 text-red-700 rounded-full text-xs font-semibold">Failed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;
