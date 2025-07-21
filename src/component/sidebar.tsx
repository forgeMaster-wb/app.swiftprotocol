import React from 'react';
import { FaChartBar, FaFileInvoice, FaUsers, FaMoneyBillWave, FaCog, FaChevronLeft, FaChevronRight, FaDiscord, FaTwitter, FaAddressCard } from 'react-icons/fa';
import { Link } from 'react-router-dom';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const menuItems = [
  { icon: <FaChartBar />, label: 'Dashboard', to: '/' },
  { icon: <FaFileInvoice />, label: 'Create Invoice', to: '/create-invoice' },
  { icon: <FaUsers />, label: 'Checkout', active: false, to: '/pay/invoice_checkout' },
  { icon: <FaMoneyBillWave />, label: 'Transactions', to: '/transactions' },
];

const businessMenuItems = [
  
  { icon: <FaAddressCard />, label: 'Payment', to: '/paymentautomation' },
];

const settingsMenuItems = [
  { icon: <FaCog />, label: 'Settings', active: false, to: '/settings' },
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
  return (
    <aside
      className={`h-screen sticky top-0 z-30 bg-white transition-all duration-300 ease-in-out ${
        isOpen ? 'w-64' : 'w-20'
      } flex flex-col border-r border-gray-100`}
    >
      {/* Toggle Button */}
      <div className="p-4 flex justify-end">
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-50 transition-colors"
          aria-label="Toggle sidebar"
        >
          <span className="text-gray-800 text-xl">
            {isOpen ? <FaChevronLeft /> : <FaChevronRight />}
          </span>
        </button>
      </div>
      
      {/* Divider */}
      <div className="border-b border-gray-100 mx-4" />
      
      {/* Navigation Menu */}
      <nav className="flex-1 py-6 px-2">
        {/* Main Menu Items */}
        <ul className="space-y-2">
          {menuItems.map((item, index) => (
            <li key={index}>
              {item.to ? (
                <Link
                  to={item.to}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 text-base font-medium text-gray-800 hover:bg-gray-50`}
                >
                  <span className="text-2xl text-gray-600 hover:text-gray-800">{item.icon}</span>
                  {isOpen && <span className="truncate">{item.label}</span>}
                </Link>
              ) : (
                <button
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 text-base font-medium text-gray-800 hover:bg-gray-50`}
                >
                  <span className="text-2xl text-gray-600 hover:text-gray-800">{item.icon}</span>
                  {isOpen && <span className="truncate">{item.label}</span>}
                </button>
              )}
            </li>
          ))}
        </ul>

        {/* Business Section */}
        <div className="mt-8">
          {/* Section Divider */}
          <div className="border-b border-gray-200 mx-4 mb-4" />
          
          {/* Business Section Title */}
          {isOpen && (
            <div className="px-4 mb-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Business
              </h3>
            </div>
          )}
          
          {/* Business Menu Items */}
          <ul className="space-y-2">
            {businessMenuItems.map((item, index) => (
              <li key={index}>
                {item.to ? (
                  <Link
                    to={item.to}
                    className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 text-base font-medium text-gray-800 hover:bg-gray-50`}
                  >
                    <span className="text-2xl text-gray-600 hover:text-gray-800">{item.icon}</span>
                    {isOpen && <span className="truncate">{item.label}</span>}
                  </Link>
                ) : (
                  <button
                    className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 text-base font-medium text-gray-800 hover:bg-gray-50`}
                  >
                    <span className="text-2xl text-gray-600 hover:text-gray-800">{item.icon}</span>
                    {isOpen && <span className="truncate">{item.label}</span>}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Settings Section */}
        <div className="mt-8">
          {/* Section Divider */}
          <div className="border-b border-gray-200 mx-4 mb-4" />
          
          {/* Settings Menu Items */}
          <ul className="space-y-2">
            {settingsMenuItems.map((item, index) => (
              <li key={index}>
                {item.to ? (
                  <Link
                    to={item.to}
                    className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 text-base font-medium text-gray-800 hover:bg-gray-50`}
                  >
                    <span className="text-2xl text-gray-600 hover:text-gray-800">{item.icon}</span>
                    {isOpen && <span className="truncate">{item.label}</span>}
                  </Link>
                ) : (
                  <button
                    className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 text-base font-medium text-gray-800 hover:bg-gray-50`}
                  >
                    <span className="text-2xl text-gray-600 hover:text-gray-800">{item.icon}</span>
                    {isOpen && <span className="truncate">{item.label}</span>}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </nav>
      {/* Social Icons */}
      <div className="flex justify-center items-center gap-4 pb-6 mt-auto">
        <a href="https://discord.com/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-indigo-600 transition text-2xl">
          <FaDiscord />
        </a>
        <a href="https://x.com/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-black transition text-2xl">
          <FaTwitter />
        </a>
      </div>
    </aside>
  );
};

export default Sidebar;