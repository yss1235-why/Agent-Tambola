// src/services/PerformanceMonitor.ts

interface PerformanceMetric {
  id: string;
  timestamp: number;
  type: string;
  duration?: number;
  data?: any;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private inProgressMetrics: Map<string, { start: number; data?: any }> = new Map();
  private maxMetrics: number = 100;
  private enabled: boolean = true;
  
  private constructor() {}
  
  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }
  
  public startMetric(type: string, data?: any): string {
    if (!this.enabled) return '';
    
    const id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.inProgressMetrics.set(id, { start: performance.now(), data });
    
    return id;
  }
  
  public endMetric(id: string, additionalData?: any): void {
    if (!this.enabled || !id) return;
    
    const metric = this.inProgressMetrics.get(id);
    if (!metric) return;
    
    const end = performance.now();
    const duration = end - metric.start;
    
    this.recordMetric({
      id,
      timestamp: Date.now(),
      type: id.split('_')[0],
      duration,
      data: {
        ...metric.data,
        ...additionalData
      }
    });
    
    this.inProgressMetrics.delete(id);
  }
  
  public recordMetric(metric: PerformanceMetric): void {
    if (!this.enabled) return;
    
    this.metrics.push(metric);
    
    // Trim if exceeding max count
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
    
    // Log slow operations for debugging
    if (metric.duration && metric.duration > 1000) {
      console.warn(`Slow operation detected (${metric.duration.toFixed(2)}ms): ${metric.type}`, metric.data);
    }
  }
  
  public getMetrics(type?: string): PerformanceMetric[] {
    if (type) {
      return this.metrics.filter(m => m.type === type);
    }
    return [...this.metrics];
  }
  
  public clearMetrics(): void {
    this.metrics = [];
    this.inProgressMetrics.clear();
  }
  
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
  
  public getAverageMetric(type: string): number | null {
    const relevantMetrics = this.metrics.filter(m => m.type === type && m.duration !== undefined);
    
    if (relevantMetrics.length === 0) {
      return null;
    }
    
    const sum = relevantMetrics.reduce((acc, metric) => acc + (metric.duration || 0), 0);
    return sum / relevantMetrics.length;
  }
  
  public reportPerformance(): Record<string, any> {
    // Group metrics by type
    const groupedMetrics: Record<string, PerformanceMetric[]> = {};
    
    this.metrics.forEach(metric => {
      if (!groupedMetrics[metric.type]) {
        groupedMetrics[metric.type] = [];
      }
      groupedMetrics[metric.type].push(metric);
    });
    
    // Calculate stats for each type
    const report: Record<string, any> = {};
    
    Object.entries(groupedMetrics).forEach(([type, metrics]) => {
      const durationsMs = metrics
        .map(m => m.duration || 0)
        .filter(d => d > 0);
      
      if (durationsMs.length > 0) {
        const sum = durationsMs.reduce((acc, d) => acc + d, 0);
        const avg = sum / durationsMs.length;
        const sorted = [...durationsMs].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        
        report[type] = {
          count: metrics.length,
          avgMs: avg,
          medianMs: median,
          minMs: min,
          maxMs: max,
          totalMs: sum
        };
      } else {
        report[type] = {
          count: metrics.length,
          noDurationData: true
        };
      }
    });
    
    return report;
  }
}

export default PerformanceMonitor;