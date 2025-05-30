// src/services/index.ts - Simplified version removing deleted services

export { BookingManager } from './BookingManager';
export { GameService } from './GameService';
export { PrizeValidationService } from './PrizeValidationService';

// Simple CSV export function to replace the complex ExportManager
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

// Simple toast notification function to replace NotificationManager
export const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info'): void => {
  // This will be handled by the Toast component that already exists
  console.log(`${type.toUpperCase()}: ${message}`);
};
