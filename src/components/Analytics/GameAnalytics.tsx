// src/components/Analytics/GameAnalytics.tsx

import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { LineChart, BarChart, XAxis, YAxis, Tooltip, Legend, Line, Bar } from 'recharts';
import { LoadingSpinner } from '@components';
import { ExportManager } from '../../services/ExportManager';
import { ReportGenerator } from '../../services/ReportGenerator';
import { handleApiError } from '../../utils/errorHandler';

interface AnalyticsData {
  gameMetrics: {
    totalGames: number;
    averageGameDuration: number;
    totalRevenue: number;
    averageTicketsPerGame: number;
  };
  playerMetrics: {
    totalPlayers: number;
    averageTicketsPerPlayer: number;
    returnRate: number;
    topPlayers: Array<{
      name: string;
      gamesPlayed: number;
      totalTickets: number;
    }>;
  };
  gamePerformance: Array<{
    date: string;
    games: number;
    revenue: number;
    players: number;
  }>;
  prizeDistribution: Array<{
    prizeType: string;
    count: number;
    totalAmount: number;
  }>;
}

export const GameAnalytics: React.FC = () => {
  const { currentUser } = useAuth();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('week');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser?.uid) return;

    const loadAnalytics = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const analyticsRef = ref(
          database,
          `hosts/${currentUser.uid}/analytics/${timeRange}`
        );

        onValue(analyticsRef, (snapshot) => {
          if (snapshot.exists()) {
            setAnalyticsData(snapshot.val());
          }
          setIsLoading(false);
        });
      } catch (error) {
        console.error('Error loading analytics:', error);
        setError(handleApiError(error, 'Failed to load analytics data'));
        setIsLoading(false);
      }
    };

    loadAnalytics();
  }, [currentUser?.uid, timeRange]);

  const handleExport = async () => {
    if (!analyticsData || !currentUser?.uid) return;

    try {
      const exportManager = ExportManager.getInstance();
      const reportGenerator = ReportGenerator.getInstance();

      const report = await reportGenerator.generateGameReport({
        id: 'analytics_export',
        hostId: currentUser.uid,
        timestamp: Date.now(),
        gameData: analyticsData,
        statistics: analyticsData.gameMetrics,
        players: analyticsData.playerMetrics,
        performance: analyticsData.gamePerformance
      });

      const blob = await exportManager.exportGameData(
        'analytics_export',
        'excel',
        {
          includeGameStats: true,
          includePlayerDetails: true,
          includePrizeHistory: true
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `game_analytics_${timeRange}_${new Date().toISOString()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting analytics:', error);
      setError(handleApiError(error, 'Failed to export analytics data'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error}
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="text-center text-gray-600 py-8">
        No analytics data available
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with Controls */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-800">
          Game Analytics Dashboard
        </h2>
        <div className="flex space-x-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 
              focus:ring-blue-500"
          >
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="year">Last Year</option>
          </select>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Export Data
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Games"
          value={analyticsData.gameMetrics.totalGames}
          subtitle="Games hosted"
        />
        <MetricCard
          title="Average Duration"
          value={`${Math.round(analyticsData.gameMetrics.averageGameDuration / 60)} min`}
          subtitle="Per game"
        />
        <MetricCard
          title="Total Revenue"
          value={`₹${analyticsData.gameMetrics.totalRevenue.toLocaleString()}`}
          subtitle="Revenue generated"
        />
        <MetricCard
          title="Players"
          value={analyticsData.playerMetrics.totalPlayers}
          subtitle="Unique players"
        />
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Game Performance Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Game Performance
          </h3>
          <LineChart
            width={600}
            height={300}
            data={analyticsData.gamePerformance}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#3B82F6"
              name="Revenue"
            />
            <Line
              type="monotone"
              dataKey="players"
              stroke="#10B981"
              name="Players"
            />
          </LineChart>
        </div>

        {/* Prize Distribution Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Prize Distribution
          </h3>
          <BarChart
            width={600}
            height={300}
            data={analyticsData.prizeDistribution}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <XAxis dataKey="prizeType" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="#3B82F6" name="Times Won" />
            <Bar dataKey="totalAmount" fill="#10B981" name="Total Amount" />
          </BarChart>
        </div>
      </div>

      {/* Top Players Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Top Players</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Player Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Games Played
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Tickets
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Average Tickets/Game
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analyticsData.playerMetrics.topPlayers.map((player, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {player.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {player.gamesPlayed}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {player.totalTickets}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {(player.totalTickets / player.gamesPlayed).toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle }) => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
      <p className="mt-1 text-sm text-gray-600">{subtitle}</p>
    </div>
  );
};

export default GameAnalytics;