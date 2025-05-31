// src/components/History/SessionHistory.tsx - Updated without deleted services

import React, { useState, useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { database } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingSpinner } from '@components';
import { Game } from '../../types/game';
import { exportToCSV } from '../../services'; // Using simplified export function

interface SessionDetails {
  id: string;
  date: string;
  duration: string;
  totalPlayers: number;
  ticketsSold: number;
  revenue: number;
  prizesAwarded: number;
  status: 'completed' | 'interrupted';
}

// Simple error handler replacement
const handleApiError = (error: any, defaultMessage: string): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return defaultMessage;
};

export const SessionHistory: React.FC = () => {
  const { currentUser } = useAuth();
  const [sessions, setSessions] = useState<SessionDetails[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<Game.GameSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSessionHistory();
  }, []);

  const loadSessionHistory = async () => {
    if (!currentUser?.uid) return;

    try {
      const sessionsRef = ref(database, `hosts/${currentUser.uid}/sessions`);
      const snapshot = await get(sessionsRef);

      if (snapshot.exists()) {
        const sessionData: SessionDetails[] = [];
        const allSessions = snapshot.val();
        
        Object.entries(allSessions).forEach(([id, data]) => {
          sessionData.push({
            id,
            ...formatSessionData(data as any)
          });
        });
        
        const sortedSessions = sessionData.sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        
        setSessions(sortedSessions.slice(0, 50));
      }
    } catch (error) {
      console.error('Error loading session history:', error);
      setError(handleApiError(error, 'Failed to load session history'));
    } finally {
      setIsLoading(false);
    }
  };

  const formatSessionData = (data: any): Omit<SessionDetails, 'id'> => {
    return {
      date: new Date(data.startTime).toLocaleDateString(),
      duration: formatDuration(data.endTime - data.startTime),
      totalPlayers: Object.keys(data.players || {}).length,
      ticketsSold: Object.values(data.activeTickets?.bookings || {}).length,
      revenue: calculateRevenue(data),
      prizesAwarded: countPrizesAwarded(data),
      status: data.gameState?.status === 'completed' ? 'completed' : 'interrupted'
    };
  };

  const formatDuration = (milliseconds: number): string => {
    const hours = Math.floor(milliseconds / 3600000);
    const minutes = Math.floor((milliseconds % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const calculateRevenue = (session: any): number => {
    const ticketPrice = 10; // Configure as needed
    return Object.keys(session.activeTickets?.bookings || {}).length * ticketPrice;
  };

  const countPrizesAwarded = (session: any): number => {
    if (!session.gameState || !session.gameState.winners) {
      return 0;
    }
    
    let total = 0;
    const winners = session.gameState.winners;
    
    for (const prizeType in winners) {
      if (Object.prototype.hasOwnProperty.call(winners, prizeType)) {
        const winnerArray = winners[prizeType];
        if (Array.isArray(winnerArray)) {
          total += winnerArray.length;
        }
      }
    }
    
    return total;
  };

  const handleSessionSelect = async (sessionId: string) => {
    if (!currentUser?.uid) return;

    try {
      setIsLoading(true);
      const sessionRef = ref(
        database,
        `hosts/${currentUser.uid}/sessions/${sessionId}`
      );
      const snapshot = await get(sessionRef);
      
      if (snapshot.exists()) {
        setSessionData(snapshot.val() as Game.GameSession);
        setSelectedSession(sessionId);
      }
    } catch (error) {
      console.error('Error loading session details:', error);
      setError(handleApiError(error, 'Failed to load session details'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportSession = async (sessionId: string) => {
    try {
      setIsExporting(true);
      
      const sessionRef = ref(
        database,
        `hosts/${currentUser?.uid}/sessions/${sessionId}`
      );
      const snapshot = await get(sessionRef);
      
      if (snapshot.exists()) {
        const sessionData = snapshot.val();
        
        // Prepare export data
        const exportData = [];
        
        // Add session summary
        exportData.push({
          Type: 'Session Summary',
          Date: new Date(sessionData.startTime).toLocaleDateString(),
          Duration: formatDuration(sessionData.endTime - sessionData.startTime),
          Players: Object.keys(sessionData.players || {}).length,
          Tickets: Object.keys(sessionData.activeTickets?.bookings || {}).length,
          Revenue: calculateRevenue(sessionData),
          Prizes: countPrizesAwarded(sessionData)
        });
        
        // Add player data
        Object.values(sessionData.players || {}).forEach((player: any) => {
          exportData.push({
            Type: 'Player',
            Name: player.name,
            Phone: player.phoneNumber,
            Tickets: player.tickets?.length || 0,
            'Ticket IDs': player.tickets?.join(', ') || ''
          });
        });
        
        // Add winners data
        if (sessionData.gameState?.winners) {
          Object.entries(sessionData.gameState.winners).forEach(([prizeType, winners]) => {
            if (Array.isArray(winners) && winners.length > 0) {
              winners.forEach((ticketId: string) => {
                const booking = sessionData.activeTickets?.bookings?.[ticketId];
                if (booking) {
                  exportData.push({
                    Type: 'Winner',
                    Prize: prizeType.replace(/([A-Z])/g, ' $1').trim(),
                    'Ticket ID': ticketId,
                    Player: booking.playerName,
                    Phone: booking.phoneNumber
                  });
                }
              });
            }
          });
        }
        
        // Export to CSV
        exportToCSV(
          exportData,
          `game_session_${sessionId}_${new Date().toISOString().slice(0, 10)}.csv`
        );
      }
    } catch (error) {
      console.error('Error exporting session:', error);
      setError(handleApiError(error, 'Failed to export session data'));
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-800">
          Game Session History
        </h2>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Players
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tickets
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prizes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sessions.map((session) => (
                <tr
                  key={session.id}
                  className={selectedSession === session.id ? 'bg-blue-50' : ''}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {session.date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {session.duration}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {session.totalPlayers}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {session.ticketsSold}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ₹{session.revenue.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {session.prizesAwarded}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                      ${session.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {session.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleSessionSelect(session.id)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => handleExportSession(session.id)}
                      disabled={isExporting}
                      className="text-green-600 hover:text-green-900"
                    >
                      {isExporting ? 'Exporting...' : 'Export'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSession && sessionData && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Session Details
          </h3>
          <SessionDetails
            session={sessionData}
            onClose={() => setSelectedSession(null)}
          />
        </div>
      )}
    </div>
  );
};

interface SessionDetailsProps {
  session: Game.GameSession;
  onClose: () => void;
}

const SessionDetails: React.FC<SessionDetailsProps> = ({ session, onClose }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <DetailCard
          title="Winner Distribution"
          content={
            <div className="space-y-2">
              {Object.entries(session.gameState.winners || {}).map(([prize, winners]) => (
                <div key={prize} className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {prize.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <span className="font-medium">{Array.isArray(winners) ? winners.length : 0}</span>
                </div>
              ))}
            </div>
          }
        />

        <DetailCard
          title="Number Statistics"
          content={
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Numbers Called</span>
                <span className="font-medium">
                  {session.numberSystem?.calledNumbers?.length || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Average Call Time</span>
                <span className="font-medium">
                  {((session.endTime - session.startTime) / 
                    (session.numberSystem?.calledNumbers?.length || 1) / 1000).toFixed(1)}s
                </span>
              </div>
            </div>
          }
        />

        <DetailCard
          title="Player Statistics"
          content={
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Players</span>
                <span className="font-medium">
                  {Object.keys(session.players || {}).length}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Average Tickets/Player</span>
                <span className="font-medium">
                  {(Object.keys(session.activeTickets?.bookings || {}).length / 
                    Math.max(1, Object.keys(session.players || {}).length)).toFixed(1)}
                </span>
              </div>
            </div>
          }
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md
            hover:bg-gray-200 focus:outline-none focus:ring-2
            focus:ring-gray-500 focus:ring-offset-2"
        >
          Close Details
        </button>
      </div>
    </div>
  );
};

interface DetailCardProps {
  title: string;
  content: React.ReactNode;
}

const DetailCard: React.FC<DetailCardProps> = ({ title, content }) => {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h4 className="text-sm font-medium text-gray-900 mb-3">{title}</h4>
      {content}
    </div>
  );
};

export default SessionHistory;
