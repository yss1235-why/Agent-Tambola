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
  
  return currentUser ? <>{element}</> : <Navigate to="/login" />;
};

// Routes that require GameContext
const GameRoutes: React.FC<{ element: React.ReactNode }> = ({ element }) => {
  const { currentUser } = useAuth();
  
  // Use configured host ID if present, otherwise use current user's ID
  const hostId = appConfig.hostUID || currentUser?.uid || '';
  
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
                      <GameRoutes element={<PlayingPhase />} />
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
