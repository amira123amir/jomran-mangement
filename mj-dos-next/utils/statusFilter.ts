import type { OrderStatus } from '../types';

// Presentation-layer status filter value used by the shared <StatusFilter />
// component. Never causes any store mutation.
export type StatusFilterValue = 'all' | OrderStatus;

export function applyStatusFilter<T extends { status: OrderStatus }>(
  orders: T[],
  value: StatusFilterValue,
): T[] {
  if (value === 'all') return orders;
  return orders.filter((o) => o.status === value);
}
