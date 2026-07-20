import { create } from 'zustand';

export interface ExchangeRates {
  rmb: string;
  try_: string;
  syp: string;
}

interface ExchangeRateState {
  rates: ExchangeRates;
  isLocked: boolean;
  lockedBy: string;
  lockedAt: string;
  setRates: (rates: ExchangeRates) => void;
  lockRates: (rates: ExchangeRates, personaName: string) => void;
}

export const useExchangeRateStore = create<ExchangeRateState>((set) => ({
  rates: { rmb: '6.7', try_: '45', syp: '12500' },
  isLocked: false,
  lockedBy: '',
  lockedAt: '',
  setRates: (rates) => set({ rates }),
  lockRates: (rates, personaName) => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const lockedAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    set({ rates, isLocked: true, lockedBy: personaName, lockedAt });
  },
}));
