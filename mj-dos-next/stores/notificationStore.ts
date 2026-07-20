import { useOrderStore } from './orderStore';

// Derived selector — not a standalone Zustand store. Kept as a separate file
// so existing import paths (`from '../stores/notificationStore'`) don't break.
// Returns the unread notification count for a given persona.

export function getUnreadCount(persona: string): number {
  return useOrderStore.getState().getNotificationsFor(persona).filter((n) => !n.read).length;
}
