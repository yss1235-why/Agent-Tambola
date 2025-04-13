import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, HelpCircle, LogOut } from 'lucide-react';
import { useAuth } from '@contexts';

interface DashboardHeaderProps {
  username: string;
  subscriptionEnd: number;
}

function DashboardHeader({ username, subscriptionEnd }: DashboardHeaderProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  
  const daysRemaining = Math.ceil((subscriptionEnd - Date.now()) / (1000 * 60 * 60 * 24));
  
  const getSubscriptionStatus = () => {
    if (daysRemaining > 30) {
      return { text: 'Active', className: 'bg-green-100 text-green-800' };
    }
    if (daysRemaining > 0) {
      return { text: 'Expiring Soon', className: 'bg-yellow-100 text-yellow-800' };
    }
    return { text: 'Expired', className: 'bg-red-100 text-red-800' };
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const status = getSubscriptionStatus();

  return (
    <header className="py-4 px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome, {username}
          </h1>
          <div className="mt-1 flex items-center space-x-3">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
              {status.text}
            </span>
            <span className="text-sm text-gray-600">
              {daysRemaining > 0 
                ? `${daysRemaining} days remaining`
                : 'Subscription expired'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/settings')}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>

          <button
            onClick={() => navigate('/support')}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            title="Support"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          <button
            onClick={handleSignOut}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

export default memo(DashboardHeader);