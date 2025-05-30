// src/components/Dashboard/GamePhases/PlayingPhase/components/WinnerDisplay.tsx - Updated for simplified system
import { useState, useEffect, useCallback, useRef } from 'react';
import { UserCircle, Phone, Clock, Trophy, Award, Download, Printer } from 'lucide-react';
import type { Game } from '../../../../../types/game';
import { exportToCSV } from '../../../../../services'; // Using simplified export function

// Define default prizes configuration
const DEFAULT_PRIZES: Game.Settings['prizes'] = {
  quickFive: false,
  topLine: false,
  middleLine: false,
  bottomLine: false,
  corners: false,
  starCorners: false,
  halfSheet: false,
  fullSheet: false,
  fullHouse: false,
  secondFullHouse: false,
};

interface WinnerInfo {
  prizeType: string;
  ticketId: string;
  playerName: string;
  phoneNumber: string;
  timestamp?: number;
}

interface WinnerDisplayProps {
  winners?: Game.Winners;
  tickets: Record<string, Game.Ticket>;
  bookings: Record<string, Game.Booking>;
  prizes?: Game.Settings['prizes'];
  showAllPrizes?: boolean;
  onWinnerNotification?: (prizeType: string, playerName: string) => void;
}

export const WinnerDisplay: React.FC<WinnerDisplayProps> = ({ 
  winners = {},
  tickets = {}, 
  bookings = {}, 
  prizes = DEFAULT_PRIZES,
  showAllPrizes = false,
  onWinnerNotification
}) => {
  const [displayedWinners, setDisplayedWinners] = useState<WinnerInfo[]>([]);
  const [activeTab, setActiveTab] = useState<'recent' | 'all'>('recent');
  const [highlightedWinner, setHighlightedWinner] = useState<string | null>(null);
  const [prizeStatistics, setPrizeStatistics] = useState<Record<string, number>>({});
  const prevWinnersCountRef = useRef<number>(0);

  // Process winners data
  useEffect(() => {
    const formattedWinners: WinnerInfo[] = [];
    const prizeStats: Record<string, number> = {};
    
    if (winners) {
      Object.entries(winners).forEach(([prizeType, ticketIds]) => {
        // Skip prizes that aren't enabled
        if (!prizes[prizeType as keyof typeof prizes]) return;
        
        // Count for statistics
        prizeStats[prizeType] = Array.isArray(ticketIds) ? ticketIds.length : 0;
        
        if (Array.isArray(ticketIds)) {
          ticketIds.forEach((ticketId: string) => {
            const booking = bookings[ticketId];
            if (booking) {
              formattedWinners.push({
                prizeType: prizeType.replace(/([A-Z])/g, ' $1').trim(),
                ticketId,
                playerName: booking.playerName,
                phoneNumber: booking.phoneNumber,
                timestamp: booking.timestamp
              });
            }
          });
        }
      });
    }

    // Sort by timestamp, most recent first
    const sortedWinners = formattedWinners.sort((a, b) => 
      (b.timestamp || 0) - (a.timestamp || 0)
    );
    
    // Detect new winners
    const currentCount = formattedWinners.length;
    if (currentCount > prevWinnersCountRef.current && prevWinnersCountRef.current > 0) {
      const newestWinner = sortedWinners[0];
      setHighlightedWinner(`${newestWinner.ticketId}-${newestWinner.prizeType}`);
      
      // Trigger notification callback
      if (onWinnerNotification) {
        onWinnerNotification(
          newestWinner.prizeType,
          newestWinner.playerName
        );
      }
      
      // Clear highlight after 5 seconds
      setTimeout(() => {
        setHighlightedWinner(null);
      }, 5000);
    }
    
    prevWinnersCountRef.current = currentCount;
    setDisplayedWinners(sortedWinners);
    setPrizeStatistics(prizeStats);
  }, [winners, bookings, prizes, onWinnerNotification]);

  const getStatusColor = (prizeType: string): string => {
    const type = prizeType.toLowerCase();
    if (type.includes('house')) return 'bg-purple-100 text-purple-800';
    if (type.includes('sheet')) return 'bg-green-100 text-green-800';
    if (type.includes('line')) return 'bg-blue-100 text-blue-800';
    if (type.includes('corner')) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getPrizeTypeColor = (prizeType: string): string => {
    const type = prizeType.toLowerCase();
    if (type.includes('house')) return 'text-purple-500';
    if (type.includes('sheet')) return 'text-green-500';
    if (type.includes('line')) return 'text-blue-500';
    if (type.includes('corner')) return 'text-yellow-500';
    return 'text-gray-500';
  };

  const formatPhoneNumber = (phone: string): string => {
    return phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  };

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const printWinnersList = useCallback(() => {
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      alert('Please allow popups to print winners list');
      return;
    }
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Tambola Game Winners</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #2563EB; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #E5E7EB; padding: 8px; text-align: left; }
            td { padding: 8px; border-bottom: 1px solid #E5E7EB; }
            .prize { font-weight: bold; }
            .timestamp { color: #6B7280; font-size: 0.9em; }
            .footer { margin-top: 30px; text-align: center; font-size: 0.8em; color: #6B7280; }
          </style>
        </head>
        <body>
          <h1>Tambola Game Winners</h1>
          <p>Date: ${new Date().toLocaleDateString()}</p>
          <table>
            <thead>
              <tr>
                <th>Prize</th>
                <th>Ticket #</th>
                <th>Player Name</th>
                <th>Phone</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              ${displayedWinners.map((winner) => `
                <tr>
                  <td class="prize">${winner.prizeType}</td>
                  <td>${winner.ticketId}</td>
                  <td>${winner.playerName}</td>
                  <td>${formatPhoneNumber(winner.phoneNumber)}</td>
                  <td class="timestamp">${winner.timestamp ? formatTimestamp(winner.timestamp) : 'N/A'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">
            <p>Generated from Tambola Host System</p>
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.print();
  }, [displayedWinners]);

  // Export winners using simplified export function
  const exportWinnersAsCsv = useCallback(() => {
    if (displayedWinners.length === 0) return;
    
    const exportData = displayedWinners.map((winner) => ({
      'Prize Type': winner.prizeType,
      'Ticket ID': winner.ticketId,
      'Player Name': winner.playerName,
      'Phone Number': winner.phoneNumber,
      'Timestamp': winner.timestamp 
        ? new Date(winner.timestamp).toLocaleString() 
        : 'N/A'
    }));
    
    exportToCSV(
      exportData,
      `tambola-winners-${new Date().toISOString().slice(0, 10)}.csv`
    );
  }, [displayedWinners]);

  // If no winners data exists yet
  if (!winners || Object.values(winners).every(arr => !arr || arr.length === 0)) {
    return (
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Winners</h3>
        </div>
        <div className="text-center py-8 text-gray-500">
          <Trophy className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p>No winners yet</p>
          <p className="text-sm text-gray-400 mt-2">Winners will appear here as prizes are claimed</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Trophy className="w-5 h-5 text-yellow-500 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Winners</h3>
          </div>
          <div className="text-sm text-gray-500">
            {displayedWinners.length} prize{displayedWinners.length !== 1 ? 's' : ''} claimed
          </div>
        </div>

        {showAllPrizes && (
          <div className="mt-4 flex space-x-2">
            <button
              onClick={() => setActiveTab('recent')}
              className={`px-3 py-1 rounded-md text-sm font-medium
                ${activeTab === 'recent' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'text-gray-600 hover:text-gray-800'}`}
            >
              Recent
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-md text-sm font-medium
                ${activeTab === 'all' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'text-gray-600 hover:text-gray-800'}`}
            >
              All Prizes
            </button>
          </div>
        )}
      </div>

      {activeTab === 'recent' && (
        <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
          {displayedWinners.map((winner, index) => {
            const winnerId = `${winner.ticketId}-${winner.prizeType}-${index}`;
            const isHighlighted = winnerId === highlightedWinner;
            
            return (
              <div 
                key={winnerId} 
                className={`p-3 sm:p-4 transition-colors duration-500 ${
                  isHighlighted ? 'bg-yellow-50' : ''
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center flex-wrap">
                      <UserCircle className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 mr-1 sm:mr-2" />
                      <span className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                        {winner.playerName}
                      </span>
                      {isHighlighted && (
                        <span className="ml-2 px-1.5 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] sm:text-xs rounded-full animate-pulse">
                          New!
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-1 flex items-center text-xs sm:text-sm text-gray-500">
                      <Phone className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      {formatPhoneNumber(winner.phoneNumber)}
                    </div>

                    {winner.timestamp && (
                      <div className="mt-1 flex items-center text-[10px] sm:text-xs text-gray-500">
                        <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                        {formatTimestamp(winner.timestamp)}
                      </div>
                    )}
                  </div>

                  <div className="mt-2 sm:mt-0 sm:ml-4 flex justify-between sm:flex-col sm:items-end">
                    <div className="flex items-center">
                      <Award className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 ${getPrizeTypeColor(winner.prizeType)}`} />
                      <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium
                        ${getStatusColor(winner.prizeType)}`}>
                        {winner.prizeType}
                      </span>
                    </div>
                    <span className="text-[10px] sm:text-xs text-gray-500">
                      #{winner.ticketId}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'all' && (
        <div className="p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Prize Distribution</h4>
          <div className="space-y-3">
            {Object.entries(prizes || {}).map(([prizeKey, isEnabled]) => {
              if (!isEnabled) return null;
              
              const prizeType = prizeKey.replace(/([A-Z])/g, ' $1').trim();
              const count = prizeStatistics[prizeKey] || 0;
              
              return (
                <div key={prizeKey} className="flex justify-between items-center p-2 border-b">
                  <div className="flex items-center">
                    <Award className={`h-4 w-4 mr-2 ${getPrizeTypeColor(prizeType)}`} />
                    <span className="text-sm text-gray-700">{prizeType}</span>
                  </div>
                  <div className="flex items-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium 
                      ${count > 0 ? getStatusColor(prizeType) : 'bg-gray-100 text-gray-600'}`}
                    >
                      {count} claimed
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {displayedWinners.length > 0 && (
        <div className="p-4 border-t flex justify-between">
          <button 
            onClick={printWinnersList}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
          >
            <Printer className="w-4 h-4 mr-1" />
            Print List
          </button>
          
          <button 
            onClick={exportWinnersAsCsv}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
          >
            <Download className="w-4 h-4 mr-1" />
            Export CSV
          </button>
        </div>
      )}
    </div>
  );
};

export default WinnerDisplay;
