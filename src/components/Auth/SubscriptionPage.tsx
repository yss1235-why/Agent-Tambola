import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts';
import { LoadingSpinner } from '@components';

interface SubscriptionInfo {
  endDate: number;
  status: 'active' | 'inactive';
  daysRemaining: number;
  username: string;
}

const ErrorIcon: React.FC = () => (
  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" 
      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" 
      clipRule="evenodd" 
    />
  </svg>
);

const WarningIcon: React.FC = () => (
  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" 
      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" 
      clipRule="evenodd" 
    />
  </svg>
);

const SuccessIcon: React.FC = () => (
  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" 
      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
      clipRule="evenodd" 
    />
  </svg>
);

const SubscriptionPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile, isSubscriptionValid } = useAuth();
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    if (userProfile) {
      const now = Date.now();
      const daysRemaining = Math.ceil((userProfile.subscriptionEnd - now) / (1000 * 60 * 60 * 24));

      setSubscriptionInfo({
        endDate: userProfile.subscriptionEnd,
        status: userProfile.status,
        daysRemaining: Math.max(0, daysRemaining),
        username: userProfile.username
      });
      setIsLoading(false);
    } else {
      setError('Subscription information not available');
      setIsLoading(false);
    }
  }, [currentUser, userProfile, navigate]);

  // We're not redirecting if subscription is valid anymore
  // This allows users to view subscription details even when valid

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full space-y-8 p-6">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <ErrorIcon />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-2">{error}</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || 'support@example.com';
  const isExpiring = subscriptionInfo?.daysRemaining && subscriptionInfo.daysRemaining <= 7 && subscriptionInfo.daysRemaining > 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Subscription Status
          </h2>
          {subscriptionInfo?.username && (
            <p className="mt-2 text-center text-sm text-gray-600">
              Welcome back, {subscriptionInfo.username}
            </p>
          )}
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-center">
            <div className={`mx-auto flex items-center justify-center h-24 w-24 rounded-full ${
              subscriptionInfo?.status === 'active' 
                ? subscriptionInfo.daysRemaining > 0 
                  ? 'bg-green-100' 
                  : 'bg-red-100'
                : 'bg-red-100'
            }`}>
              {subscriptionInfo?.status === 'active' && subscriptionInfo.daysRemaining > 0 ? (
                isExpiring ? <WarningIcon /> : <SuccessIcon />
              ) : (
                <ErrorIcon />
              )}
            </div>

            <h3 className="mt-4 text-lg font-medium text-gray-900">
              {subscriptionInfo?.status === 'active' 
                ? subscriptionInfo.daysRemaining > 0
                  ? isExpiring
                    ? 'Subscription Expiring Soon'
                    : 'Subscription Active'
                  : 'Subscription Expired'
                : 'Subscription Inactive'
              }
            </h3>

            {subscriptionInfo?.status === 'active' && subscriptionInfo.daysRemaining > 0 ? (
              <div className="mt-2 text-sm text-gray-500">
                <p>Your subscription is valid for {subscriptionInfo.daysRemaining} more days</p>
                <p className="mt-1">
                  Expires on {new Date(subscriptionInfo.endDate).toLocaleDateString()}
                </p>
              </div>
            ) : (
              <div className="mt-2">
                <p className="text-sm text-red-600 font-medium">
                  Your subscription has expired
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Please renew your subscription to continue using all features
                </p>
              </div>
            )}
          </div>

          {/* Expired or Expiring Warning */}
          {(!isSubscriptionValid || isExpiring) && (
            <div className={`mt-6 p-4 rounded-md ${isExpiring ? 'bg-yellow-50 border border-yellow-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  {isExpiring ? <WarningIcon /> : <ErrorIcon />}
                </div>
                <div className="ml-3">
                  <h3 className={`text-sm font-medium ${isExpiring ? 'text-yellow-800' : 'text-red-800'}`}>
                    {isExpiring ? 'Subscription Expiring Soon' : 'Subscription Expired'}
                  </h3>
                  <div className={`mt-2 text-sm ${isExpiring ? 'text-yellow-700' : 'text-red-700'}`}>
                    <p>
                      {isExpiring 
                        ? `Your subscription will expire in ${subscriptionInfo?.daysRemaining} days. Please renew soon to avoid interruption.`
                        : 'Your subscription has expired. You cannot create or manage games until you renew your subscription.'
                      }
                    </p>
                  </div>
                  <div className="mt-4">
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      {!isSubscriptionValid && (
                        <>
                          <li>Creating new games is disabled</li>
                          <li>Managing existing games is disabled</li>
                          <li>Access to analytics and reports is limited</li>
                        </>
                      )}
                      {isExpiring && (
                        <li>Renew now to maintain uninterrupted service</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 space-y-4">
            {isSubscriptionValid ? (
              <>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Continue to Dashboard
                </button>
                {isExpiring && (
                  <button
                    onClick={() => navigate('/subscription/renew')}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    Renew Subscription
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate('/subscription/renew')}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Renew Subscription
                </button>
                <a
                  href={`mailto:${supportEmail}`}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Contact Support
                </a>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Back to Login
                </button>
              </>
            )}
          </div>
        </div>

        {/* Subscription Details */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Subscription Details
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-500">Status</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                isSubscriptionValid 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {isSubscriptionValid ? 'Active' : 'Expired'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-500">Subscription End</span>
              <span className="font-medium">
                {new Date(subscriptionInfo?.endDate || 0).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-500">Days Remaining</span>
              <span className={`font-medium ${
                (subscriptionInfo?.daysRemaining || 0) <= 0 
                  ? 'text-red-600' 
                  : (subscriptionInfo?.daysRemaining || 0) <= 7 
                    ? 'text-yellow-600' 
                    : 'text-green-600'
              }`}>
                {subscriptionInfo?.daysRemaining || 0} days
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;