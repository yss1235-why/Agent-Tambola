// src/types/game.ts

export namespace Game {
  export interface Ticket {
    id: string;
    numbers: number[][];
    status: 'available' | 'booked';
    position: number;
    sheetNumber: number;
  }
  
  export interface TicketRowData {
    setId: number;
    ticketId: number;
    rowId: number;
    numbers: number[];
  }
  
  export interface TicketSet {
    id: number;
    name: string;
    description?: string;
    tickets: Record<string, Ticket>;
    totalTickets: number;
  }
  
  export interface TicketSetMetadata {
    id: number;
    name: string;
    description?: string;
    totalTickets: number;
    isLoaded: boolean;
    isLoading: boolean;
    error?: string;
  }
  
  export interface Booking {
    number: number;
    playerName: string;
    phoneNumber: string;
    status: 'booked';
    timestamp?: number;
    playerId?: string;
  }
  
  export interface Winners {
    quickFive: string[];
    topLine: string[];
    middleLine: string[];
    bottomLine: string[];
    corners: string[];
    starCorners: string[];
    halfSheet: string[];
    fullSheet: string[];
    fullHouse: string[];
    secondFullHouse: string[];
  }
  
  export interface Settings {
    selectedTicketSet: number;
    maxTickets: number;
    callDelay: number;
    hostPhone: string;
    prizes: {
      quickFive: boolean;
      topLine: boolean;
      middleLine: boolean;
      bottomLine: boolean;
      corners: boolean;
      starCorners: boolean;
      halfSheet: boolean;
      fullSheet: boolean;
      fullHouse: boolean;
      secondFullHouse: boolean;
    };
  }
  
  export interface NumberSystem {
    callDelay: number;
    currentNumber: number | null;
    calledNumbers: number[];
    queue: number[];
    lastCalledTime?: number;
  }
  
  export interface AudioSettings {
    volume: number;
    useCustomAudio: boolean;
    numberCallDelay: number;
    announceWinners: boolean;
  }
  
  export interface GameState {
    phase: 1 | 2 | 3 | 4; // 1: Setup, 2: Booking, 3: Playing, 4: Completed
    status: 'setup' | 'active' | 'paused' | 'ended' | 'booking';
    isAutoCalling: boolean;
    soundEnabled: boolean;
    winners: Winners;
    allPrizesWon?: boolean; // New field to track when all active prizes have been won
    lastUpdated?: number;
  }
  
  export interface ActiveTickets {
    tickets: Record<string, Ticket>;
    bookings: Record<string, Booking>;
  }
  
  export interface Player {
    id: string;
    name: string;
    phoneNumber: string;
    tickets: string[];
    bookingTime: number;
    totalTickets: number;
  }
  
  export interface BookingMetrics {
    startTime: number;  // Fixed: Added missing startTime property
    lastBookingTime: number;
    totalBookings: number;
    totalPlayers: number;
  }
  
  export interface CurrentGame {
    settings: Settings;
    gameState: GameState;
    numberSystem: NumberSystem;
    activeTickets: ActiveTickets;
    startTime: number;
    endTime?: number;
    bookingMetrics?: BookingMetrics;
    players?: Record<string, Player>;
  }
  
  export interface GameSession extends CurrentGame {
    id: string;
    hostId: string;
    endTime: number;
    endReason?: string;
    statistics?: {
      duration: number;
      totalPlayers: number;
      totalTickets: number;
      averageTicketsPerPlayer: number;
    };
  }
  
  // Prize Types
  export type PrizeType = keyof Winners;
  
  // Utility Types
  export type ValidationStatus = 'valid' | 'invalid' | 'pending';
  export type BookingStatus = 'available' | 'booked' | 'cancelled';
  export type CallMode = 'manual' | 'auto';
}

// Game Constants
export const GAME_PHASES = {
  SETUP: 1,
  BOOKING: 2,
  PLAYING: 3,
  COMPLETED: 4
} as const;

export const GAME_STATUSES = {
  SETUP: 'setup',
  ACTIVE: 'active',
  PAUSED: 'paused',
  ENDED: 'ended',
  BOOKING: 'booking' // Added this status for the booking phase
} as const;

// Initial State Defaults
export const DEFAULT_GAME_STATE: Game.GameState = {
  phase: GAME_PHASES.SETUP,
  status: GAME_STATUSES.SETUP,
  isAutoCalling: false,
  soundEnabled: true,
  allPrizesWon: false,
  winners: {
    quickFive: [],
    topLine: [],
    middleLine: [],
    bottomLine: [],
    corners: [],
    starCorners: [],
    halfSheet: [],
    fullSheet: [],
    fullHouse: [],
    secondFullHouse: []
  }
};

export const DEFAULT_PRIZE_SETTINGS: Game.Settings['prizes'] = {
  quickFive: true,
  topLine: true,
  middleLine: true,
  bottomLine: true,
  corners: true,
  starCorners: false,
  halfSheet: true,
  fullSheet: true,
  fullHouse: true,
  secondFullHouse: false
};

export const DEFAULT_NUMBER_SYSTEM: Game.NumberSystem = {
  callDelay: 5,
  currentNumber: null,
  calledNumbers: [],
  queue: []
};

// Game Configuration Constants
export const MAX_QUEUE_SIZE = 10;
export const MIN_CALL_DELAY = 3;
export const MAX_CALL_DELAY = 10;
export const MAX_TICKETS = 600;
export const TICKETS_PER_SHEET = 6;
export const NUMBERS_PER_TICKET = 15;

// Type exports
export type GamePhase = typeof GAME_PHASES[keyof typeof GAME_PHASES];
export type GameStatus = typeof GAME_STATUSES[keyof typeof GAME_STATUSES];
export type GameSettings = Game.Settings;
export type GameState = Game.GameState;
export type CurrentGame = Game.CurrentGame;
export type Booking = Game.Booking;
