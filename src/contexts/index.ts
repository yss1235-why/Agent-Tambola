/**
 * Contexts index file
 *
 * This file centralizes context exports to simplify imports across the application.
 * Instead of using complex relative paths, contexts can be imported directly from this file.
 */

// Authentication context
export { AuthProvider, useAuth } from './AuthContext';

// Game management context
export { GameProvider, useGame } from './GameContext';