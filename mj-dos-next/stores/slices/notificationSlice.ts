import type { Notification } from '../../types';

export interface NotificationSlice {
  notifications: Notification[];
  getNotificationsFor: (persona: string) => Notification[];
  markNotificationRead: (notifId: string) => void;
  markAllNotificationsRead: (persona: string) => void;
}
