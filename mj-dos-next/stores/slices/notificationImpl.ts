import type { NotificationSlice } from './notificationSlice';

export function createNotificationSlice(_set: any, _get: any): NotificationSlice {
  return {
    notifications: [],

    getNotificationsFor: (persona) =>
      _get().notifications.filter((n: any) => n.forPersona === persona),

    markNotificationRead: (notifId) =>
      _set((s: any) => ({
        notifications: s.notifications.map((n: any) =>
          n.id === notifId ? { ...n, read: true } : n
        ),
      })),

    markAllNotificationsRead: (persona) =>
      _set((s: any) => ({
        notifications: s.notifications.map((n: any) =>
          n.forPersona === persona ? { ...n, read: true } : n
        ),
      })),
  };
}
