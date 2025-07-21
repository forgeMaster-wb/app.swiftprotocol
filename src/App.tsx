import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Config
import { config } from './component/utils/wagmi.config';

// Components
import Navbar from './component/navbar';
import Sidebar from './component/sidebar';
import Dashboard from './component/dashboard';
import CreateInvoice from './component/pages/create_invoice';
import InvoiceCheckout from './component/pages/pay/invoice_checkout';
import Settings from './component/setting';

// Styles
import './App.css';
import Transactions from './component/pages/transactions';
import PaymentAutomation from './component/pages/paymentAutomation';

const queryClient = new QueryClient();

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  useEffect(() => {
    // Simulate loading time and then hide the loading screen
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 10000); // Show loading for 10 seconds

    return () => clearTimeout(timer);
  }, []);

  // Loading screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white animate-pulse">Swift Protocol</h1>
        </div>
      </div>
    );
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <Router>
          <div className="min-h-screen bg-white text-black">
            <Navbar />
            <div className="flex">
              <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
              <div className="flex-1 transition-all duration-300">
                <Routes>
                  <Route path="/" element={<Dashboard sidebarOpen={sidebarOpen} />} />
                  <Route path="/create-invoice" element={<CreateInvoice />} />
                  <Route path="/pay/invoice_checkout" element={<InvoiceCheckout />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path='/paymentautomation' element={<PaymentAutomation />} />
                  <Route path="/settings" element={<Settings />} />
                  {/* Add more routes as needed */}
                </Routes>
              </div>
            </div>
          </div>
        </Router>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;