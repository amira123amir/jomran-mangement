import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { OrderSlice } from './slices/orderSlice';
import type { NotificationSlice } from './slices/notificationSlice';
import type { FinancialSlice } from './slices/financialSlice';
import type { NotesSlice } from './slices/notesSlice';
import type { WorkflowSlice } from './slices/workflowSlice';
import { createOrderSlice } from './slices/orderImpl';
import { createNotificationSlice } from './slices/notificationImpl';
import { createFinancialSlice } from './slices/financialImpl';
import { createNotesSlice } from './slices/notesImpl';
import { createWorkflowSlice } from './slices/workflowImpl';

export type { TransitionActor, TransitionOptions, TransitionResult } from './slices/transitionTypes';

export type OrderStore = OrderSlice & NotificationSlice & FinancialSlice & NotesSlice & WorkflowSlice;

export const useOrderStore = create<OrderStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...createOrderSlice(set, get),
        ...createNotificationSlice(set, get),
        ...createFinancialSlice(set, get),
        ...createNotesSlice(set, get),
        ...createWorkflowSlice(set, get),
      }),
      {
        name: 'mjdos-orders',
        partialize: (state) => ({
          orders: state.orders,
          notifications: state.notifications,
        }),
      }
    ),
    { name: 'OrderStore' }
  )
);
