import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { pad2 } from '../utils/dateHelpers';

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

export const useExchangeRateStore = create<ExchangeRateState>()(
  devtools(
    persist(
      (set) => ({
        rates: { rmb: '6.7', try_: '45', syp: '12500' },
        isLocked: false,
        lockedBy: '',
        lockedAt: '',
        setRates: (rates) => set({ rates }),
        lockRates: (rates, personaName) => {
          const now = new Date();
          const lockedAt = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
          set({ rates, isLocked: true, lockedBy: personaName, lockedAt });
        },
      }),
      {
        name: 'mjdos-exchange-rates',
      }
    ),
    { name: 'ExchangeRateStore' }
  )
);
