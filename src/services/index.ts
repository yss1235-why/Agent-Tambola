// src/services/index.ts - Updated version
export { BookingManager } from './BookingManager';
export { GameService } from './GameService';
export { GameDatabaseService } from './GameDatabaseService';

// Simple CSV export function to replace complex ExportManager
export const exportToCSV = (data: any[], filename: string): void => {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : value;
      }).join(',')
    )
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Simple toast notification function
export const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info'): void => {
  console.log(`${type.toUpperCase()}: ${message}`);
};
