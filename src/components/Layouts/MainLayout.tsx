// src/components/Layouts/MainLayout.tsx - UPDATED: Removed profile, settings, history navigation
import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Menu, X, Home, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Toast } from '../../components/Common/Toast';
import appConfig from '../../config/appConfig';

const MainLayout = () => {
  const navigate = useNavigate();
  const { currentUser, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showWelcomeToast, setShowWelcomeToast] = useState(true);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <button 
                className="md:hidden mr-2 p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                onClick={toggleMenu}
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                {appConfig.appTitle}
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              {currentUser && (
                <>
                  <span className="hidden sm:inline text-gray-600">
                    {currentUser.email}
                  </span>
                  <button
                    onClick={handleSignOut}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 border border-transparent rounded-md 
                      shadow-sm text-sm font-medium text-white bg-blue-600 
                      hover:bg-blue-700 focus:outline-none focus:ring-2 
                      focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Sign Out
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu - Simplified with only dashboard and sign out */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-b shadow-sm">
          <nav className="px-4 py-3">
            <ul className="space-y-2">
              <NavItem
                to="/dashboard"
                icon={<Home size={20} />}
                label="Dashboard"
                onClick={() => setIsMenuOpen(false)}
              />
              <li>
                <button
                  onClick={() => {
                    handleSignOut();
                    setIsMenuOpen(false);
                  }}
                  className="flex items-center w-full px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  <LogOut size={20} className="mr-3 text-gray-500" />
                  <span>Sign Out</span>
                </button>
              </li>
            </ul>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-gray-500 text-sm">
            © {new Date().getFullYear()} {appConfig.companyName}. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Global notifications */}
      {showWelcomeToast && (
        <Toast
          message={`Welcome to ${appConfig.appTitle}`}
          type="info"
          duration={3000}
          onClose={() => setShowWelcomeToast(false)}
        />
      )}
    </div>
  );
};

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, onClick }) => {
  const navigate = useNavigate();
  
  const handleClick = () => {
    navigate(to);
    onClick?.();
  };
  
  return (
    <li>
      <button
        onClick={handleClick}
        className="flex items-center w-full px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md text-left"
      >
        <span className="mr-3 text-gray-500">{icon}</span>
        <span>{label}</span>
      </button>
    </li>
  );
};

export default MainLayout;
