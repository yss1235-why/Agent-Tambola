// src/components/Dashboard/SubscriptionExpiredPrompt.tsx

import React from 'react';
import { useNavigate } from 'react-router-dom';

const SubscriptionExpiredPrompt: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="mt-6 bg-white rounded-lg shadow-sm border p-6 max-w-lg mx-auto">
      <div className="flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
      </div>
      
      <h3 className="mt-4 text-lg font-medium text-center text-gray-900">
        Subscription Expired
      </h3>
      
      <p className="mt-2 text-center text-gray-600">
        Your subscription has expired. You need an active subscription to create and manage games.
      </p>
      
      <div className="mt-6 space-y-3">
        <button
          onClick={() => navigate('/subscription/renew')}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Renew Subscription
        </button>
        
        <button
          onClick={() => navigate('/subscription')}
          className="w-full px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-md 
            hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          View Subscription Details
        </button>
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-sm text-center text-gray-500">
          If you believe this is an error, please contact our support team.
        </p>
      </div>
    </div>
  );
};

export default SubscriptionExpiredPrompt;