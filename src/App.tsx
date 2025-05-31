// src/App.tsx

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { GameProvider } from './contexts/GameContext';
import MainLayout from './components/Layouts/MainLayout';
import Dashboard from './components/Dashboard/Dashboard';
import Login from './components/Auth/Login';
import SubscriptionPage from './components/Auth/SubscriptionPage';
import PlayingPhase from './components/Dashboard/GamePhases/PlayingPhase/PlayingPhase';
import UserProfile from './components/Profile/UserProfile';
import UserSettings from './components/Settings/UserSettings';
import SessionHistory from './components/History/SessionHistory';
import { ErrorBoundary } from './components/Common/ErrorBoundary';
import appConfig from './config/appConfig';

// Define the default props for PlayingPhase to satisfy TypeScript
const defaultPlayingPhaseProps = {
  // These will be replaced by properties from GameProvider
};

// Security component that ensures only the designated host can access the app
const HostSecurityCheck: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  // Security check: Only allow the designated host UID
  if (currentUser && currentUser.uid !== appConfig.hostUID) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="mt-2 text-lg font-medium text-gray-900">Access Denied</h3>
            <p className="mt-1 text-sm text-gray-500">
              You don't have permission to access this host application.
            </p>
            <p className="mt-2 text-xs text-gray-400">
              Current user: {currentUser.email}<br/>
              User ID: {currentUser.uid}<br/>
              Expected: {appConfig.hostUID}
            </p>
            <div className="mt-5">
              <button
                onClick={() => window.location.href = '/login'}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Sign in with correct account
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
};

// Protected route component that checks for authentication
const ProtectedRoute: React.FC<{ element: React.ReactNode }> = ({ element }) => {
  const { currentUser, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  return currentUser ? (
    <HostSecurityCheck>
      {element}
    </HostSecurityCheck>
  ) : (
    <Navigate to="/login" />
  );
};

// Routes that require GameContext - SECURE VERSION (No Fallback)
const GameRoutes: React.FC<{ element: React.ReactNode }> = ({ element }) => {
  const { currentUser } = useAuth();
  
  // SECURITY: Only use the designated host ID from config
  // NO fallback to currentUser?.uid to prevent unauthorized access
  const hostId = appConfig.hostUID;
  
  // Validate that we have a designated host ID configured
  if (!hostId) {
    console.error('🚨 SECURITY ERROR: No hostUID configured in appConfig');
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="mt-2 text-xl font-bold text-red-600">Configuration Error</h2>
            <p className="mt-1 text-sm text-red-700">
              No host UID configured in application settings.
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Please contact the administrator to configure the hostUID in appConfig.
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  // Additional security check: ensure current user matches designated host
  if (currentUser?.uid !== hostId) {
    console.error('🚨 SECURITY WARNING: Current user does not match designated host');
    console.error('Current user UID:', currentUser?.uid);
    console.error('Expected host UID:', hostId);
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="mt-2 text-xl font-bold text-red-600">Access Denied</h2>
            <p className="mt-1 text-sm text-red-700">
              You are not authorized to access this host instance.
            </p>
            <div className="mt-3 p-3 bg-gray-100 rounded text-xs text-left">
              <div><strong>Current user:</strong> {currentUser?.email || 'Not logged in'}</div>
              <div><strong>Current UID:</strong> {currentUser?.uid || 'None'}</div>
              <div><strong>Expected UID:</strong> {hostId}</div>
            </div>
            <div className="mt-5">
              <button
                onClick={() => {
                  // Force logout and redirect to login
                  window.location.href = '/login';
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Sign in with authorized account
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  console.log('🔒 SECURITY PASS: Using designated hostId:', hostId, 'for authorized user:', currentUser?.email);
  
  return (
    <GameProvider hostId={hostId}>
      {element}
    </GameProvider>
  );
};

const App: React.FC = () => {
  // Set document title from config
  React.useEffect(() => {
    document.title = appConfig.appTitle;
  }, []);
  
  // Debug log on app startup
  React.useEffect(() => {
    console.log('🚀 App starting with configuration:');
    console.log('- App Title:', appConfig.appTitle);
    console.log('- Designated Host UID:', appConfig.hostUID);
    console.log('- Host UID type:', typeof appConfig.hostUID);
    console.log('- Host UID length:', appConfig.hostUID?.length || 0);
  }, []);
  
  return (
    <Router>
      <ErrorBoundary>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/subscription" element={<ProtectedRoute element={<SubscriptionPage />} />} />
            
            {/* Layout with protected routes */}
            <Route path="/" element={<MainLayout />}>
              {/* Dashboard route with GameProvider */}
              <Route 
                path="/" 
                element={
                  <ProtectedRoute 
                    element={
                      <GameRoutes element={<Dashboard />} />
                    } 
                  />
                } 
              />
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute 
                    element={
                      <GameRoutes element={<Dashboard />} />
                    } 
                  />
                } 
              />
              
              {/* Game phase routes with GameProvider */}
              <Route 
                path="/playing-phase" 
                element={
                  <ProtectedRoute 
                    element={
                      <GameRoutes element={<PlayingPhase {...defaultPlayingPhaseProps} />} />
                    } 
                  />
                } 
              />
              
              {/* History route with GameProvider */}
              <Route 
                path="/history" 
                element={
                  <ProtectedRoute 
                    element={
                      <GameRoutes element={<SessionHistory />} />
                    } 
                  />
                } 
              />
              
              {/* User settings routes */}
              <Route path="/profile" element={<ProtectedRoute element={<UserProfile />} />} />
              <Route path="/settings" element={<ProtectedRoute element={<UserSettings />} />} />
            </Route>
            
            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </AuthProvider>
      </ErrorBoundary>
    </Router>
  );
};

export default App;
