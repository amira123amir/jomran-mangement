import { create } from 'zustand';
import type { AuditLogEntry } from '../types';

interface AuditState {
  logs: AuditLogEntry[];
  isOpen: boolean;
  addLog: (persona: string, department: string, action: string, details?: string) => void;
  toggleDrawer: () => void;
  clearLogs: () => void;
}

function formatNow() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
  return { date, time, timestamp: d.toISOString() };
}

let logCounter = 0;

export const useAuditStore = create<AuditState>((set) => ({
  logs: [],
  isOpen: false,
  addLog: (persona, department, action, details) => {
    const { date, time, timestamp } = formatNow();
    const entry: AuditLogEntry = {
      id: `log-${++logCounter}-${Date.now()}`,
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
  clearLogs: () => set({ logs: [] }),
}));
