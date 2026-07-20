import type { Order, OrderProduct, WorkflowTransition } from '../../types';
import type { OrderSlice } from './orderSlice';
import { formatNow, formatDeadlineDisplay, buildDeadlineAt } from '../../utils/dateHelpers';
import { uid } from '../../utils/helpers';
import { isCEO } from '../../utils/workflowEngine';

export function createOrderSlice(set: any, get: any): OrderSlice {
  return {
    orders: [],

    addOrder: (data) => {
      const { date, time, timestamp } = formatNow();
      const id = uid('order');
      const orderNumber = 1000 + get().orders.length + 1;
      const { products: productsInput, ...rest } = data;
      // Assign a stable id to each product so pricing/proforma lines can
      // reference it for the life of the order.
      const products: OrderProduct[] = (productsInput || []).map((p: Omit<OrderProduct, 'id'>) => ({
        ...p,
        id: uid('product'),
      }));
      const initialTransition: WorkflowTransition = {
        id: uid('wf'),
        from: null,
        to: 'waiting_for_assignment',
        actorName: data.salesPersona || 'system',
        actorRole: 'sales',
        actorDept: data.salesPersonaDept || 'sales',
        direction: 'initial',
        date,
        time,
        timestamp,
      };
      const order: Order = {
        ...rest,
        id,
        orderNumber,
        products,
        status: 'waiting_for_assignment',
        claim: null,
        pricingHistory: [],
        proforma: null,
        revenue: null,
        supplierData: null,
        assignment: null,
        negotiationHistory: [],
        notes: [],
        customNotes: [],
        documents: [],
        lockTicket: null,
        workflowHistory: [initialTransition],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      set((s: any) => ({ orders: [...s.orders, order] }));
      return order;
    },

    getOrderById: (id) => get().orders.find((o: any) => o.id === id),

    getOrdersBySales: (personaName) =>
      get().orders.filter((o: any) => o.salesPersona === personaName),

    getOrdersByCategory: (category) =>
      get().orders.filter((o: any) => o.products.some((p: OrderProduct) => p.category === category)),

    getPendingOrders: () =>
      get().orders.filter((o: any) => o.status === 'waiting_for_assignment'),

    getClaimedBy: (personaName) =>
      get().orders.filter((o: any) => o.claim?.claimedBy === personaName && o.status === 'pricing_in_progress'),

    getPricedForSales: (salesPersona) =>
      get().orders.filter((o: any) => o.salesPersona === salesPersona && o.status === 'pricing_completed'),

    getOrdersAssignedTo: (personaName) =>
      get().orders.filter((o: any) => o.assignment?.assignedTo === personaName),

    getSubordinateOrders: (subordinateNames) =>
      get().orders.filter((o: any) => subordinateNames.includes(o.assignment?.assignedTo || '') || subordinateNames.includes(o.claim?.claimedBy || '')),

    getDeadlineStatus: (orderId) => {
      const order = get().orders.find((o: any) => o.id === orderId);
      if (!order?.claim || order.status !== 'pricing_in_progress') return null;

      const deadline = new Date(order.claim.deadlineAt.replace(' ', 'T'));
      const now = new Date();
      const diff = deadline.getTime() - now.getTime();
      const expired = diff <= 0;

      return {
        remaining: formatDeadlineDisplay(Math.abs(diff)),
        expired,
        progress: expired ? 100 : Math.min(100, Math.max(0, ((6 * 3600 * 1000 - diff) / (6 * 3600 * 1000)) * 100)),
      };
    },

    updateSupplierData: (orderId, supplierData, _personaName) => {
      const { timestamp } = formatNow();
      set((s: any) => ({
        orders: s.orders.map((o: any) =>
          o.id === orderId
            ? { ...o, supplierData, updatedAt: timestamp }
            : o
        ),
      }));
    },

    archiveOrder: (orderId, requestedBy, reason) => {
      if (!isCEO(requestedBy)) {
        return { ok: false, error: 'الأرشفة متاحة للمدير العام فقط.' };
      }
      const trimmed = reason.trim();
      if (!trimmed) {
        return { ok: false, error: 'سبب الأرشفة إلزامي.' };
      }
      const order = get().orders.find((o: any) => o.id === orderId);
      if (!order) return { ok: false, error: 'الطلب غير موجود' };
      if (order.archivedAt) return { ok: false, error: 'الطلب مؤرشف مسبقاً.' };

      const { timestamp } = formatNow();
      let updated: Order | undefined;
      set((s: any) => ({
        orders: s.orders.map((o: any) => {
          if (o.id !== orderId) return o;
          updated = {
            ...o,
            archivedAt: timestamp,
            archivedBy: requestedBy,
            archiveReason: trimmed,
            updatedAt: timestamp,
          };
          return updated;
        }),
      }));
      return { ok: true, order: updated };
    },

    unarchiveOrder: (orderId, requestedBy) => {
      if (!isCEO(requestedBy)) {
        return { ok: false, error: 'إلغاء الأرشفة متاح للمدير العام فقط.' };
      }
      const order = get().orders.find((o: any) => o.id === orderId);
      if (!order) return { ok: false, error: 'الطلب غير موجود' };
      if (!order.archivedAt) return { ok: false, error: 'الطلب غير مؤرشف.' };

      const { timestamp } = formatNow();
      let updated: Order | undefined;
      set((s: any) => ({
        orders: s.orders.map((o: any) => {
          if (o.id !== orderId) return o;
          updated = {
            ...o,
            archivedAt: undefined,
            archivedBy: undefined,
            archiveReason: undefined,
            updatedAt: timestamp,
          };
          return updated;
        }),
      }));
      return { ok: true, order: updated };
    },
  };
}
