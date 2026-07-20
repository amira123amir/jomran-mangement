import type { Order, NegotiationEntry, Notification } from '../../types';
import { formatNow } from '../../utils/dateHelpers';
import { uid } from '../../utils/helpers';

export function timelineEntry(_order: Order, fromPersona: string, message: string): NegotiationEntry {
  const { timestamp } = formatNow();
  return { id: uid('neg'), fromPersona, fromDept: 'system', message, type: 'approval', createdAt: timestamp };
}

export type SetFn = (fn: (s: { notifications: Notification[]; orders: Order[] }) => Partial<{ notifications: Notification[]; orders: Order[] }>) => void;

export function notifyRecipients(
  set: SetFn,
  order: Order,
  recipientNames: (string | undefined | null)[],
  fromPersona: string,
  type: Notification['type'],
  message: string,
): void {
  const { timestamp } = formatNow();
  const seen = new Set<string>();
  const notifications: Notification[] = [];
  for (const name of recipientNames) {
    if (!name) continue;
    const target = name.trim();
    if (!target || target === fromPersona) continue;
    if (seen.has(target)) continue;
    seen.add(target);
    notifications.push({
      id: uid('notif'),
      orderId: order.id,
      orderNumber: order.orderNumber,
      shippingMark: order.shippingMark,
      type,
      message,
      fromPersona,
      forPersona: target,
      read: false,
      createdAt: timestamp,
    });
  }
  if (!notifications.length) return;
  set((s) => ({ notifications: [...s.notifications, ...notifications] }));
}

export function depositMethodLabel(method: string, custom?: string): string {
  switch (method) {
    case 'cash_office':          return 'كاش في مقر الشركة';
    case 'sham_cash':            return 'شام كاش';
    case 'trend_5000':           return 'شركة ترند — جمران / ترند 5000';
    case 'dahab_istanbul_1373':  return 'شركة ذهب — جمران / إسطنبول 1373';
    case 'free_istanbul_104':    return 'شركة فري — جمران / إسطنبول 104';
    case 'other':                return `غير ذلك: ${custom || ''}`.trim();
    default:                     return method;
  }
}

export function factoryPaymentMethodLabel(method: string): string {
  switch (method) {
    case 'rmb_jasmine':          return 'رمبي من عند جاسمين';
    case 'rmb_exchange_office':  return 'رمبي دايركتلي من الصراف';
    case 'usd_bank':             return 'دولار عن طريق البنك';
    default:                     return method;
  }
}
