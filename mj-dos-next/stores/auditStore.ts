import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { AuditLogEntry } from '../types';
import { formatNowISO } from '../utils/dateHelpers';
import { uid } from '../utils/helpers';

interface AuditState {
  logs: AuditLogEntry[];
  isOpen: boolean;
  addLog: (persona: string, department: string, action: string, details?: string) => void;
  toggleDrawer: () => void;
}

export const useAuditStore = create<AuditState>()(
  devtools(
    persist(
      (set) => ({
        logs: [],
        isOpen: false,
        addLog: (persona, department, action, details) => {
          const { date, time, timestamp } = formatNowISO();
          const entry: AuditLogEntry = {
            id: uid('log'),
            timestamp,
            date,
            time,
            persona,
            department,
            action,
            details,
          };
          set((s) => ({ logs: [...s.logs, entry] }));
        },
        toggleDrawer: () => set((s) => ({ isOpen: !s.isOpen })),
      }),
      {
        name: 'mjdos-audit',
        partialize: (state) => ({ logs: state.logs }),
      }
    ),
    { name: 'AuditStore' }
  )
);
