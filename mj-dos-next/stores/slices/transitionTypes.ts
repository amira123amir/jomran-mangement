import type { Order } from '../../types';

export interface TransitionActor {
  name: string;
  role: string;
  dept: string;
}

export interface TransitionOptions {
  actor: TransitionActor;
  reason?: string;
  mutate?: (order: Order) => Partial<Order>;
}

export interface TransitionResult {
  ok: boolean;
  error?: string;
  order?: Order;
}
