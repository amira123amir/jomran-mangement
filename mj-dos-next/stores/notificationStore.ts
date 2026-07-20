import { useOrderStore } from './orderStore';

export function getUnreadCount(persona: string): number {
  return useOrderStore.getState().getNotificationsFor(persona).filter((n) => !n.read).length;
}
