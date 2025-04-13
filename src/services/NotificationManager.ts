// src/services/NotificationManager.ts

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'system' | 'user' | 'prize';
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  read: boolean;
  playSound?: boolean;
  requireInteraction?: boolean;
}

export class NotificationManager {
  private static instance: NotificationManager;
  private notifications: Notification[] = [];
  private listeners: Set<(notifications: Notification[]) => void> = new Set();
  private showDesktopNotifications: boolean = true;
  
  private constructor() {}
  
  public static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }
  
  public showNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): void {
    const newNotification: Notification = {
      ...notification,
      id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      read: false
    };
    
    this.notifications.unshift(newNotification);
    
    // Keep only the last 50 notifications
    if (this.notifications.length > 50) {
      this.notifications = this.notifications.slice(0, 50);
    }
    
    // Notify listeners
    this.notifyListeners();
    
    // Show desktop notification if enabled
    if (this.showDesktopNotifications && notification.playSound !== false) {
      this.showDesktopNotification(newNotification);
    }
  }
  
  private showDesktopNotification(notification: Notification): void {
    if (!('Notification' in window)) {
      return;
    }
    
    if (Notification.permission === 'granted') {
      this.createDesktopNotification(notification);
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          this.createDesktopNotification(notification);
        }
      });
    }
  }
  
  private createDesktopNotification(notification: Notification): void {
    const desktopNotification = new window.Notification(notification.title, {
      body: notification.message,
      requireInteraction: notification.requireInteraction || false,
      icon: '/logo.png'
    });
    
    desktopNotification.onclick = () => {
      window.focus();
      this.markAsRead(notification.id);
    };
  }
  
  public getNotifications(): Notification[] {
    return [...this.notifications];
  }
  
  public markAsRead(id: string): void {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
      this.notifyListeners();
    }
  }
  
  public markAllAsRead(): void {
    this.notifications.forEach(notification => {
      notification.read = true;
    });
    this.notifyListeners();
  }
  
  public clearNotifications(): void {
    this.notifications = [];
    this.notifyListeners();
  }
  
  public getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }
  
  public setDesktopNotificationsEnabled(enabled: boolean): void {
    this.showDesktopNotifications = enabled;
  }
  
  public addListener(listener: (notifications: Notification[]) => void): void {
    this.listeners.add(listener);
  }
  
  public removeListener(listener: (notifications: Notification[]) => void): void {
    this.listeners.delete(listener);
  }
  
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      listener([...this.notifications]);
    });
  }
}

export default NotificationManager;