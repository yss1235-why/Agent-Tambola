// src/components/index.ts - FIXED: Removed profile, settings, and history component exports

// Common UI Components
export { default as LoadingSpinner } from './LoadingSpinner';
export { ErrorBoundary } from './Common/ErrorBoundary';
export { default as Toast } from './Common/Toast';
export { default as GameControls } from './GameControls';

// Layout
export { default as MainLayout } from './Layouts/MainLayout';

// Auth components
export { default as Login } from './Auth/Login';
export { default as SubscriptionPage } from './Auth/SubscriptionPage';

// Dashboard components
export { default as Dashboard } from './Dashboard/Dashboard';
export { default as DashboardHeader } from './Dashboard/DashboardHeader';
export { default as GameSetup } from './Dashboard/GamePhases/GameSetup/GameSetup';
export { default as BookingPhase } from './Dashboard/GamePhases/BookingPhase/BookingPhase';
export { default as PlayingPhase } from './Dashboard/GamePhases/PlayingPhase/PlayingPhase';
export { default as PlayingPhaseView } from './Dashboard/GamePhases/PlayingPhase/PlayingPhaseView';
export { default as NumberBoard } from './Dashboard/GamePhases/PlayingPhase/components/NumberBoard';
export { default as WinnerDisplay } from './Dashboard/GamePhases/PlayingPhase/components/WinnerDisplay';
