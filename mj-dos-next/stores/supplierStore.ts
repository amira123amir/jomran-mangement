import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { Supplier } from '../types';
import { uid } from '../utils/helpers';

interface SupplierStore {
  suppliers: Supplier[];
  addSupplier: (supplier: Omit<Supplier, 'id'>) => void;
  updateSupplier: (id: string, supplier: Partial<Supplier>) => void;
  removeSupplier: (id: string) => void;
}

export const useSupplierStore = create<SupplierStore>()(
  devtools(
    persist(
      (set) => ({
        suppliers: [
          { id: '1', factoryName: 'مصنع النور للإنارة', factoryPhone: '123456789', category: 'lighting', wechat: 'lighting_wechat' },
          { id: '2', factoryName: 'شركة الكهرباء الوطنية', factoryPhone: '987654321', category: 'electrical', website: 'https://elec.com' },
        ],
        addSupplier: (supplier) => set((state) => ({
          suppliers: [...state.suppliers, { ...supplier, id: uid('sup') }]
        })),
        updateSupplier: (id, supplier) => set((state) => ({
          suppliers: state.suppliers.map((s) => (s.id === id ? { ...s, ...supplier } : s))
        })),
        removeSupplier: (id) => set((state) => ({
          suppliers: state.suppliers.filter((s) => s.id !== id)
        })),
      }),
      {
        name: 'mjdos-suppliers',
      }
    ),
    { name: 'SupplierStore' }
  )
);
