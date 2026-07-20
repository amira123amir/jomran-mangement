import { create } from 'zustand';
import type {
  Order, OrderNote, OrderNoteReply, CustomNote, CustomNoteReply,
  OrderPricing, OrderRevenue, ProformaInvoice,
  OrderStatus, Notification, NegotiationEntry,
  SupplierData, ShippingMarkLockTicket, DepositConfirmation,
  WorkflowTransition,
  OfficialInvoice, CustomerDeposit, FactoryPayment,
} from '../types';
import { findTransition, isCEO } from '../utils/workflowEngine';
import { PERSONAS } from '../data/personas';

function formatNow() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return { date, time, timestamp: `${date} ${time}` };
}

function formatDeadline(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function timelineEntry(_order: Order, fromPersona: string, message: string): NegotiationEntry {
  const { timestamp } = formatNow();
  return { id: `neg-${++negotCounter}-${Date.now()}`, fromPersona, fromDept: 'system', message, type: 'approval', createdAt: timestamp };
}

// Fan-out helper. Emits one Notification per unique recipient (skipping the
// sender and any blank names). Kept co-located with the store so every
// financial workflow method uses the same emit shape.
type SetFn = (fn: (s: { notifications: Notification[]; orders: Order[] }) => Partial<{ notifications: Notification[]; orders: Order[] }>) => void;

function notifyRecipients(
  set: SetFn,
  order: Order,
  recipients: (string | undefined | null)[],
  fromPersona: string,
  type: Notification['type'],
  message: string,
): void {
  const { timestamp } = formatNow();
  const seen = new Set<string>();
  const notifications: Notification[] = [];
  for (const r of recipients) {
    if (!r) continue;
    const target = r.trim();
    if (!target || target === fromPersona) continue;
    if (seen.has(target)) continue;
    seen.add(target);
    notifications.push({
      id: `notif-${++notifCounter}-${Date.now()}-${notifications.length}`,
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

// Human-readable payment-method labels used inside notifications and audit
// timeline entries. UI-facing labels live in DEPOSIT_PAYMENT_METHODS /
// FACTORY_PAYMENT_METHODS constants exported from workflowEngine.ts consumers.
function depositMethodLabel(method: string, custom?: string): string {
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

function factoryPaymentMethodLabel(method: string): string {
  switch (method) {
    case 'rmb_jasmine':          return 'رمبي من عند جاسمين';
    case 'rmb_exchange_office':  return 'رمبي دايركتلي من الصراف';
    case 'usd_bank':             return 'دولار عن طريق البنك';
    default:                     return method;
  }
}

let orderCounter = 0;
let noteCounter = 0;
let replyCounter = 0;
let notifCounter = 0;
let negotCounter = 0;
let docCounter = 0;
let ticketCounter = 0;
let custNoteCounter = 0;
let custReplyCounter = 0;
let wfCounter = 0;

interface TransitionActor {
  name: string;
  role: string;
  dept: string;
}

interface TransitionOptions {
  actor: TransitionActor;
  reason?: string;
  // Additional mutations applied atomically with the status change (e.g. attach
  // pricing, proforma, revenue). They must NOT change `status` — that is the
  // sole responsibility of transitionOrder.
  mutate?: (order: Order) => Partial<Order>;
}

export interface TransitionResult {
  ok: boolean;
  error?: string;
  order?: Order;
}

interface OrderStore {
  orders: Order[];
  notifications: Notification[];

  addOrder: (data: Omit<Order, 'id' | 'orderNumber' | 'status' | 'claim' | 'pricingHistory' | 'revenue' | 'notes' | 'customNotes' | 'proforma' | 'negotiationHistory' | 'documents' | 'supplierData' | 'assignment' | 'lockTicket' | 'workflowHistory' | 'createdAt' | 'updatedAt'> & { targetPrice?: number }) => Order;
  getOrderById: (id: string) => Order | undefined;
  getOrdersBySales: (personaName: string) => Order[];
  getOrdersByCategory: (category: string) => Order[];
  getPendingOrders: () => Order[];
  getClaimedBy: (personaName: string) => Order[];
  getPricedForSales: (salesPersona: string) => Order[];
  getOrdersAssignedTo: (personaName: string) => Order[];
  getSubordinateOrders: (subordinateNames: string[]) => Order[];

  claimOrder: (orderId: string, personaName: string, personaRole: string) => void;
  assignOrder: (orderId: string, assignTo: string, assignBy: string) => void;
  acceptAssignment: (orderId: string, personaName: string) => void;
  submitPricing: (orderId: string, pricing: Omit<OrderPricing, 'iteration' | 'submittedAt'>, actor: TransitionActor) => TransitionResult;
  submitProforma: (orderId: string, proforma: Omit<ProformaInvoice, 'submittedAt'>, actor: TransitionActor) => TransitionResult;
  requestInfo: (orderId: string, fromPersona: string, fromDept: string, message: string, infoType?: 'sales' | 'factory') => void;
  submitRevision: (orderId: string, fromPersona: string, fromDept: string, message: string) => void;
  rejectPricing: (orderId: string, fromPersona: string, fromDept: string, reason: string) => TransitionResult;
  acceptPricing: (orderId: string, fromPersona: string) => void;
  generateOfficialQuotation: (
    orderId: string,
    // Caller supplies the invoice number after a successful file export so
    // the number saved here matches the one embedded in the exported file.
    invoice: Omit<OfficialInvoice, 'exportedBy' | 'exportedAt'>,
    actor: TransitionActor,
  ) => TransitionResult;
  recordDepositPaid: (
    orderId: string,
    deposit: Omit<CustomerDeposit, 'recordedBy' | 'recordedAt' | 'confirmedBy' | 'confirmedAt'>,
    actor: TransitionActor,
  ) => TransitionResult;
  confirmDeposit: (orderId: string, confirmation: DepositConfirmation, actor: TransitionActor) => TransitionResult;
  returnDeposit: (orderId: string, actor: TransitionActor, reason: string) => TransitionResult;
  sendPaymentOrder: (orderId: string, actor: TransitionActor, note?: string) => TransitionResult;
  // Procurement records the factory payment. NO status change — order stays in
  // payment_order_sent until accounting verifies via confirmFactoryPayment.
  recordFactoryPayment: (
    orderId: string,
    payment: Omit<FactoryPayment, 'recordedBy' | 'recordedAt' | 'confirmedBy' | 'confirmedAt'>,
    actor: TransitionActor,
  ) => { ok: boolean; error?: string };
  confirmFactoryPayment: (orderId: string, actor: TransitionActor, note?: string) => TransitionResult;
  markProductionStarted: (orderId: string, actor: TransitionActor, note?: string) => TransitionResult;
  markReadyForShipping: (orderId: string, actor: TransitionActor, note?: string) => TransitionResult;
  markShipped: (orderId: string, actor: TransitionActor, note?: string) => TransitionResult;
  markArrived: (orderId: string, actor: TransitionActor, note?: string) => TransitionResult;
  markDelivered: (orderId: string, actor: TransitionActor, note?: string) => TransitionResult;
  updateSupplierData: (orderId: string, supplierData: SupplierData, personaName: string) => void;

  // Guarded state transition. All status changes must go through this.
  transitionOrder: (orderId: string, targetStatus: OrderStatus, opts: TransitionOptions) => TransitionResult;

  addNote: (orderId: string, author: string, authorDept: string, target: string, content: string) => void;
  markNoteRead: (orderId: string, persona: string) => void;
  replyToNote: (orderId: string, noteId: string, author: string, authorDept: string, content: string) => void;

  addCustomNote: (orderId: string, senderName: string, senderRole: string, targetUserId: string, targetName: string, targetRole: string, content: string, type?: 'general' | 'secret') => void;
  markCustomNoteRead: (orderId: string, noteId: string, readerName: string) => void;
  replyToCustomNote: (orderId: string, noteId: string, senderName: string, senderRole: string, content: string) => void;
  getCustomNotesForTarget: (targetUserId: string) => { note: CustomNote; order: Order }[];

  addNegotiationEntry: (orderId: string, fromPersona: string, fromDept: string, message: string, type: NegotiationEntry['type']) => void;

  addDocument: (orderId: string, name: string, type: string, url: string, uploadedBy: string) => void;

  requestShippingMarkChange: (orderId: string, requestedBy: string, currentMark: string, proposedMark: string) => void;
  approveShippingMarkTicket: (orderId: string, approverName: string) => void;

  getNotificationsFor: (persona: string) => Notification[];
  markNotificationRead: (notifId: string) => void;
  markAllNotificationsRead: (persona: string) => void;

  getDeadlineStatus: (orderId: string) => { remaining: string; expired: boolean; progress: number } | null;

  /** Never delete — archive with a mandatory reason. CEO only. */
  archiveOrder: (orderId: string, requestedBy: string, reason: string) => TransitionResult;
  unarchiveOrder: (orderId: string, requestedBy: string) => TransitionResult;
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  orders: [],
  notifications: [],

  addOrder: (data) => {
    const { date, time, timestamp } = formatNow();
    const id = `order-${++orderCounter}-${Date.now()}`;
    const orderNumber = 1000 + orderCounter;
    const { targetPrice, ...rest } = data;
    const initialTransition: WorkflowTransition = {
      id: `wf-${++wfCounter}-${Date.now()}`,
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
      ...(targetPrice !== undefined ? { targetPrice } : {}),
    };
    set((s) => ({ orders: [...s.orders, order] }));
    return order;
  },

  getOrderById: (id) => get().orders.find((o) => o.id === id),

  getOrdersBySales: (personaName) =>
    get().orders.filter((o) => o.salesPersona === personaName),

  getOrdersByCategory: (category) =>
    get().orders.filter((o) => o.category === category),

  getPendingOrders: () =>
    get().orders.filter((o) => o.status === 'waiting_for_assignment'),

  getClaimedBy: (personaName) =>
    get().orders.filter((o) => o.claim?.claimedBy === personaName && o.status === 'pricing_in_progress'),

  getPricedForSales: (salesPersona) =>
    get().orders.filter((o) => o.salesPersona === salesPersona && o.status === 'pricing_completed'),

  getOrdersAssignedTo: (personaName) =>
    get().orders.filter((o) => o.assignment?.assignedTo === personaName),

  getSubordinateOrders: (subordinateNames) =>
    get().orders.filter((o) => subordinateNames.includes(o.assignment?.assignedTo || '') || subordinateNames.includes(o.claim?.claimedBy || '')),

  transitionOrder: (orderId, targetStatus, opts) => {
    const order = get().orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: 'الطلب غير موجود' };
    if (order.status === targetStatus) return { ok: true, order };

    const spec = findTransition(order.status, targetStatus);
    if (!spec) {
      return {
        ok: false,
        error: `انتقال غير مسموح: ${order.status} → ${targetStatus}. لا يمكن تخطي مراحل سير العمل.`,
      };
    }

    // Department authorization (CEO always allowed).
    const dept = opts.actor.dept;
    const authorized = isCEO(opts.actor.name) || spec.allowedDepartments.includes(dept as 'sales' | 'procurement' | 'accounting' | 'executive');
    if (!authorized) {
      return {
        ok: false,
        error: `القسم "${dept}" غير مخوّل لتنفيذ هذا الانتقال.`,
      };
    }

    if (spec.requiresReason && !opts.reason?.trim()) {
      return { ok: false, error: 'هذا الانتقال يتطلب سبباً/ملاحظة.' };
    }

    if (spec.isEnabled && !spec.isEnabled(order)) {
      return { ok: false, error: spec.disabledReason || 'الشروط اللازمة لهذا الانتقال غير مستوفاة.' };
    }

    const { date, time, timestamp } = formatNow();
    const transition: WorkflowTransition = {
      id: `wf-${++wfCounter}-${Date.now()}`,
      from: order.status,
      to: targetStatus,
      actorName: opts.actor.name,
      actorRole: opts.actor.role,
      actorDept: opts.actor.dept,
      direction: spec.direction,
      date,
      time,
      timestamp,
      reason: opts.reason?.trim() || undefined,
    };

    let updated: Order | undefined;
    set((s) => ({
      orders: s.orders.map((o) => {
        if (o.id !== orderId) return o;
        const extras = opts.mutate ? opts.mutate(o) : {};
        // The mutate hook must never change status — that is transitionOrder's job.
        if ('status' in extras) delete (extras as Partial<Order>).status;
        updated = {
          ...o,
          ...extras,
          status: targetStatus,
          workflowHistory: [...(o.workflowHistory || []), transition],
          updatedAt: timestamp,
        };
        return updated;
      }),
    }));

    return { ok: true, order: updated };
  },

  claimOrder: (orderId, personaName, personaRole) => {
    const { timestamp } = formatNow();
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + 6);
    const pad = (n: number) => String(n).padStart(2, '0');
    const deadlineAt = `${deadline.getFullYear()}-${pad(deadline.getMonth() + 1)}-${pad(deadline.getDate())} ${pad(deadline.getHours())}:${pad(deadline.getMinutes())}:${pad(deadline.getSeconds())}`;

    const order = get().orders.find((o) => o.id === orderId);
    if (!order) return;

    const tlEntry = timelineEntry(order, 'system', `🟢 [${timestamp}] استلام الطلب #${order.orderNumber} من قبل ${personaName} — بداية عداد التسعير (6 ساعات)`);

    const result = get().transitionOrder(orderId, 'pricing_in_progress', {
      actor: { name: personaName, role: personaRole, dept: 'procurement' },
      mutate: (o) => ({
        claim: { claimedBy: personaName, claimedByRole: personaRole, claimedAt: timestamp, deadlineAt },
        negotiationHistory: [...o.negotiationHistory, tlEntry],
      }),
    });
    if (!result.ok) {
      console.warn('[workflow] claimOrder blocked:', result.error);
      return;
    }

    if (order.salesPersona) {
      const notif: Notification = {
        id: `notif-${++notifCounter}-${Date.now()}`,
        orderId,
        orderNumber: order.orderNumber,
        shippingMark: order.shippingMark,
        type: 'status',
        message: `تم استلام الطلب #${order.orderNumber} (${order.shippingMark}) من قبل ${personaName}`,
        fromPersona: personaName,
        forPersona: order.salesPersona,
        read: false,
        createdAt: timestamp,
      };
      set((s) => ({ notifications: [...s.notifications, notif] }));
    }
  },

  assignOrder: (orderId, assignTo, assignBy) => {
    const { timestamp } = formatNow();
    const order = get().orders.find((o) => o.id === orderId);
    if (!order) return;

    const claim = { claimedBy: assignTo, claimedByRole: 'موظفة مشتريات', claimedAt: timestamp, deadlineAt: '' };
    const tlEntry = timelineEntry(order, 'system', `📋 [${timestamp}] تعيين الطلب #${order.orderNumber} إلى ${assignTo} بواسطة ${assignBy} — بانتظار قبول المهمة`);

    const result = get().transitionOrder(orderId, 'pricing_in_progress', {
      actor: { name: assignBy, role: 'مديرة المشتريات', dept: 'procurement' },
      mutate: (o) => ({
        claim,
        assignment: { assignedTo: assignTo, assignedBy: assignBy, assignedAt: timestamp, accepted: false },
        negotiationHistory: [...o.negotiationHistory, tlEntry],
      }),
    });
    if (!result.ok) {
      console.warn('[workflow] assignOrder blocked:', result.error);
      return;
    }

    const notif: Notification = {
      id: `notif-${++notifCounter}-${Date.now()}`,
      orderId,
      orderNumber: order.orderNumber,
      shippingMark: order.shippingMark,
      type: 'assignment',
      message: `تم تكليفك بالطلب #${order.orderNumber} (${order.shippingMark}) من قبل ${assignBy} — يرجى قبول المهمة`,
      fromPersona: assignBy,
      forPersona: assignTo,
      read: false,
      createdAt: timestamp,
    };
    set((s) => ({ notifications: [...s.notifications, notif] }));
  },

  acceptAssignment: (orderId, personaName) => {
    const { timestamp } = formatNow();
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + 6);
    const pad = (n: number) => String(n).padStart(2, '0');
    const deadlineAt = `${deadline.getFullYear()}-${pad(deadline.getMonth() + 1)}-${pad(deadline.getDate())} ${pad(deadline.getHours())}:${pad(deadline.getMinutes())}:${pad(deadline.getSeconds())}`;

    const order = get().orders.find((o) => o.id === orderId);
    if (!order) return;
    const tlEntry = timelineEntry(order, 'system', `✅ [${timestamp}] قبول المهمة من ${personaName} — بداية عداد التسعير (6 ساعات)`);

    set((s) => ({
      orders: s.orders.map((o) => {
        if (o.id !== orderId || o.assignment?.assignedTo !== personaName) return o;
        return {
          ...o,
          assignment: { ...o.assignment, accepted: true },
          claim: o.claim ? { ...o.claim, deadlineAt } : o.claim,
          negotiationHistory: [...o.negotiationHistory, tlEntry],
          updatedAt: timestamp,
        };
      }),
    }));
  },

  submitPricing: (orderId, pricingData, actor) => {
    const { timestamp } = formatNow();
    const order = get().orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: 'الطلب غير موجود' };

    const extraRMB = (pricingData.internalChinaShippingRMB || 0)
      + (pricingData.miscellaneousCostsRMB || 0)
      + (pricingData.otherCostsRMB || 0);
    const totalRMB = pricingData.factoryPriceRMB + pricingData.shippingCostRMB + extraRMB;
    const exchangeRate = pricingData.exchangeRateUsed;
    const totalUSD = exchangeRate > 0 ? +(totalRMB / exchangeRate).toFixed(3) : 0;

    const iteration = (order.pricingHistory?.length || 0) + 1;

    const pricing: OrderPricing = {
      ...pricingData,
      iteration,
      totalRMB,
      exchangeRateUsed: exchangeRate,
      totalUSD,
      submittedAt: timestamp,
      currency: pricingData.currency || 'RMB',
    };

    const result = get().transitionOrder(orderId, 'pricing_completed', {
      actor,
      mutate: (o) => ({ pricingHistory: [...(o.pricingHistory || []), pricing] }),
    });
    if (!result.ok) return result;

    if (order.salesPersona) {
      const notif: Notification = {
        id: `notif-${++notifCounter}-${Date.now()}`,
        orderId,
        orderNumber: order.orderNumber,
        shippingMark: order.shippingMark,
        type: 'pricing',
        message: `💰 تسعير جديد #${iteration} للطلب #${order.orderNumber} (${order.shippingMark}) — الإجمالي: $${totalUSD} (${totalRMB} RMB) — ملاحظة: هذه إحصائية خط أنابيب فقط`,
        fromPersona: order.claim?.claimedBy || order.assignment?.assignedTo || '',
        forPersona: order.salesPersona,
        read: false,
        createdAt: timestamp,
      };
      set((s) => ({ notifications: [...s.notifications, notif] }));
    }
    return result;
  },

  submitProforma: (orderId, proformaData, actor) => {
    const { timestamp } = formatNow();
    const proforma: ProformaInvoice = { ...proformaData, submittedAt: timestamp };
    const order = get().orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: 'الطلب غير موجود' };

    // Idempotent re-save while already in quotation_presented: update the
    // proforma without triggering a status transition (nothing to advance to).
    if (order.status === 'quotation_presented') {
      set((s) => ({
        orders: s.orders.map((o) => o.id === orderId ? { ...o, proforma, updatedAt: timestamp } : o),
      }));
      return { ok: true, order: { ...order, proforma, updatedAt: timestamp } };
    }

    return get().transitionOrder(orderId, 'quotation_presented', {
      actor,
      mutate: () => ({ proforma }),
    });
  },

  requestInfo: (orderId, fromPersona, fromDept, message, _infoType) => {
    const { timestamp } = formatNow();
    const order = get().orders.find((o) => o.id === orderId);
    if (!order) return;

    const entry: NegotiationEntry = {
      id: `neg-${++negotCounter}-${Date.now()}`,
      fromPersona,
      fromDept,
      message,
      type: 'query',
      createdAt: timestamp,
    };

    set((s) => ({
      orders: s.orders.map((o) =>
        o.id === orderId
          ? { ...o, negotiationHistory: [...o.negotiationHistory, entry], updatedAt: timestamp }
          : o
      ),
    }));

    if (order.salesPersona) {
      const notif: Notification = {
        id: `notif-${++notifCounter}-${Date.now()}`,
        orderId,
        orderNumber: order.orderNumber,
        shippingMark: order.shippingMark,
        type: 'query',
        message: `استعلام من ${fromPersona} حول الطلب #${order.orderNumber}: "${message.slice(0, 60)}${message.length > 60 ? '...' : ''}"`,
        fromPersona,
        forPersona: order.salesPersona,
        read: false,
        createdAt: timestamp,
      };
      set((s) => ({ notifications: [...s.notifications, notif] }));
    }
  },

  submitRevision: (orderId, fromPersona, fromDept, message) => {
    const { timestamp } = formatNow();
    const order = get().orders.find((o) => o.id === orderId);
    if (!order) return;

    const entry: NegotiationEntry = {
      id: `neg-${++negotCounter}-${Date.now()}`,
      fromPersona,
      fromDept,
      message,
      type: 'revision',
      createdAt: timestamp,
    };

    set((s) => ({
      orders: s.orders.map((o) =>
        o.id === orderId
          ? { ...o, status: 'pricing_in_progress' as OrderStatus, negotiationHistory: [...o.negotiationHistory, entry], updatedAt: timestamp }
          : o
      ),
    }));
  },

  rejectPricing: (orderId, fromPersona, fromDept, reason) => {
    const { timestamp } = formatNow();
    const order = get().orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: 'الطلب غير موجود' };

    const entry: NegotiationEntry = {
      id: `neg-${++negotCounter}-${Date.now()}`,
      fromPersona,
      fromDept,
      message: `❌ رفض التسعير — السبب: ${reason}`,
      type: 'revision',
      createdAt: timestamp,
    };

    const result = get().transitionOrder(orderId, 'pricing_in_progress', {
      actor: { name: fromPersona, role: fromDept, dept: fromDept },
      reason,
      mutate: (o) => ({ negotiationHistory: [...o.negotiationHistory, entry] }),
    });
    if (!result.ok) return result;

    const procTarget = order.claim?.claimedBy || order.assignment?.assignedTo;
    if (procTarget) {
      const notif: Notification = {
        id: `notif-${++notifCounter}-${Date.now()}`,
        orderId,
        orderNumber: order.orderNumber,
        shippingMark: order.shippingMark,
        type: 'pricing',
        message: `❌ تم رفض التسعير للطلب #${order.orderNumber} (${order.shippingMark}) من قبل ${fromPersona} — السبب: "${reason.slice(0, 80)}${reason.length > 80 ? '...' : ''}"`,
        fromPersona,
        forPersona: procTarget,
        read: false,
        createdAt: timestamp,
      };
      set((s) => ({ notifications: [...s.notifications, notif] }));
    }
    return result;
  },

  acceptPricing: (orderId, fromPersona) => {
    const { timestamp } = formatNow();
    const order = get().orders.find((o) => o.id === orderId);
    if (!order) return;

    const entry: NegotiationEntry = {
      id: `neg-${++negotCounter}-${Date.now()}`,
      fromPersona,
      fromDept: 'sales',
      message: `✅ قبول التسعير — الانتقال إلى إعداد عرض السعر للعميل`,
      type: 'approval',
      createdAt: timestamp,
    };

    set((s) => ({
      orders: s.orders.map((o) =>
        o.id === orderId
          ? { ...o, status: 'pricing_completed' as OrderStatus, negotiationHistory: [...o.negotiationHistory, entry], updatedAt: timestamp }
          : o
      ),
    }));

    const procTarget = order.claim?.claimedBy || order.assignment?.assignedTo;
    if (procTarget) {
      const notif: Notification = {
        id: `notif-${++notifCounter}-${Date.now()}`,
        orderId,
        orderNumber: order.orderNumber,
        shippingMark: order.shippingMark,
        type: 'pricing',
        message: `✅ تم قبول التسعير للطلب #${order.orderNumber} (${order.shippingMark}) من قبل ${fromPersona} — سيتم إعداد عرض السعر للعميل`,
        fromPersona,
        forPersona: procTarget,
        read: false,
        createdAt: timestamp,
      };
      set((s) => ({ notifications: [...s.notifications, notif] }));
    }
  },

  generateOfficialQuotation: (orderId, invoice, actor) => {
    const { timestamp } = formatNow();
    const order = get().orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: 'الطلب غير موجود' };
    const invoiceNumber = invoice.invoiceNumber;
    const officialInvoice: OfficialInvoice = {
      ...invoice,
      exportedBy: actor.name,
      exportedAt: timestamp,
    };
    const tlEntry = timelineEntry(
      order,
      'system',
      `🧾 [${timestamp}] إصدار الفاتورة الرسمية ${invoiceNumber} للطلب #${order.orderNumber} — تنسيق: ${invoice.exportedFormat.toUpperCase()} — العملة: ${invoice.exportCurrency}${invoice.notes ? ` — ملاحظات: ${invoice.notes.slice(0, 80)}` : ''}`,
    );
    const result = get().transitionOrder(orderId, 'official_quotation_generated', {
      actor,
      mutate: (o) => ({
        officialInvoice,
        negotiationHistory: [...o.negotiationHistory, tlEntry],
      }),
    });
    if (!result.ok) return result;
    // Notify accounting + CEO that an official invoice has been generated.
    notifyRecipients(
      set,
      order,
      ['نور', 'دنيا', 'عائشة', 'محمد جمران'],
      actor.name,
      'status',
      `🧾 صدرت الفاتورة الرسمية ${invoiceNumber} للطلب #${order.orderNumber} (${order.shippingMark}) — العملة: ${invoice.exportCurrency} — التنسيق: ${invoice.exportedFormat.toUpperCase()}`,
    );
    return result;
  },

  recordDepositPaid: (orderId, deposit, actor) => {
    const { timestamp } = formatNow();
    const order = get().orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: 'الطلب غير موجود' };
    if (deposit.paymentMethod === 'other' && !deposit.customPaymentMethod?.trim()) {
      return { ok: false, error: 'يرجى تحديد طريقة الدفع عند اختيار «غير ذلك».' };
    }
    if (!Number.isFinite(deposit.amount) || deposit.amount <= 0) {
      return { ok: false, error: 'مبلغ العربون غير صالح.' };
    }
    const customerDeposit: CustomerDeposit = {
      ...deposit,
      recordedBy: actor.name,
      recordedAt: timestamp,
    };
    const methodLabel = depositMethodLabel(deposit.paymentMethod, deposit.customPaymentMethod);
    const tlEntry = timelineEntry(
      order,
      'system',
      `💵 [${timestamp}] سجّل ${actor.name} استلام العربون: ${deposit.amount} ${deposit.currency} — طريقة الدفع: ${methodLabel}${customerDeposit.attachment ? ' — يحتوي إثبات دفع' : ''}`,
    );
    const result = get().transitionOrder(orderId, 'deposit_paid', {
      actor,
      mutate: (o) => ({
        customerDeposit,
        negotiationHistory: [...o.negotiationHistory, tlEntry],
      }),
    });
    if (!result.ok) return result;
    // Notify: Noor (Finance Manager), Dunia (Finance Auditor), Aisha (China
    // Accounting), Lamis (Sales Manager), CEO Mohammad Jamran.
    notifyRecipients(
      set,
      order,
      ['نور', 'دنيا', 'عائشة', 'لميس - مديرة المبيعات', 'محمد جمران'],
      actor.name,
      'deposit',
      `💵 عربون جديد بانتظار التأكيد للطلب #${order.orderNumber} (${order.shippingMark}) — سجّله ${actor.name} — المبلغ: ${deposit.amount} ${deposit.currency} — الطريقة: ${methodLabel}${customerDeposit.attachment ? ' — يحتوي إثبات دفع' : ''}`,
    );
    return result;
  },

  confirmDeposit: (orderId, confirmation, actor) => {
    const { timestamp } = formatNow();
    const order = get().orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: 'الطلب غير موجود' };

    const revenue: OrderRevenue = {
      depositAmount: confirmation.amount,
      depositCurrency: confirmation.currency,
      confirmedByNoor: true,
      confirmedAt: timestamp,
      actualRevenueUSD: confirmation.currency === 'USD' ? confirmation.amount : 0,
    };
    // Preserve original deposit record; add confirmation metadata.
    const mergedDeposit: CustomerDeposit | undefined = order.customerDeposit
      ? { ...order.customerDeposit, confirmedBy: actor.name, confirmedAt: timestamp, note: confirmation.note, attachment: confirmation.attachment || order.customerDeposit.attachment }
      : undefined;

    const result = get().transitionOrder(orderId, 'deposit_confirmed', {
      actor,
      mutate: () => ({ revenue, ...(mergedDeposit ? { customerDeposit: mergedDeposit } : {}) }),
    });
    if (!result.ok) return result;

    // Notify: Procurement Manager Kinana, assigned procurement employee, CEO,
    // Sales Manager Lamis, and the sales employee responsible for the order.
    const procTarget = order.claim?.claimedBy || order.assignment?.assignedTo;
    const recipients = ['كنانة', 'محمد جمران', 'لميس - مديرة المبيعات', order.salesPersona];
    if (procTarget) recipients.push(procTarget);
    notifyRecipients(
      set,
      order,
      recipients,
      confirmation.confirmedBy,
      'deposit',
      `✅ أكّدت الحسابات (${actor.name}) العربون للطلب #${order.orderNumber} (${order.shippingMark}) — المبلغ: ${confirmation.amount} ${confirmation.currency}`,
    );
    // Dedicated procurement directive: "أمر دفع عربون للمعمل" — carries the
    // order number, client name, and confirmed amount. Recipients are
    // resolved dynamically from PERSONAS (no hardcoded names) and limited to
    // procurement: the Procurement Manager (role = 'مديرة المشتريات') and the
    // employee who first received the order (claim.claimedBy).
    const procurementManager = PERSONAS.find(
      (p) => p.department === 'procurement' && p.role === 'مديرة المشتريات',
    );
    const firstReceiver = order.claim?.claimedBy;
    const procurementRecipients: (string | undefined)[] = [
      procurementManager?.name,
      firstReceiver,
    ];
    notifyRecipients(
      set,
      order,
      procurementRecipients,
      confirmation.confirmedBy,
      'deposit',
      `📣 أمر دفع عربون للمعمل — الطلب #${order.orderNumber} — العميل: ${order.clientName} — المبلغ: ${confirmation.amount} ${confirmation.currency}`,
    );
    return result;
  },

  returnDeposit: (orderId, actor, reason) => {
    const { timestamp } = formatNow();
    const order = get().orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: 'الطلب غير موجود' };
    const tlEntry = timelineEntry(
      order,
      'system',
      `↩ [${timestamp}] أعادت الحسابات العربون للتصحيح — السبب: ${reason}`,
    );
    const result = get().transitionOrder(orderId, 'official_quotation_generated', {
      actor,
      reason,
      mutate: (o) => ({ negotiationHistory: [...o.negotiationHistory, tlEntry] }),
    });
    if (!result.ok) return result;
    if (order.salesPersona) {
      notifyRecipients(
        set,
        order,
        [order.salesPersona, 'لميس - مديرة المبيعات', 'محمد جمران'],
        actor.name,
        'deposit',
        `↩ الحسابات أعادت عربون الطلب #${order.orderNumber} للتصحيح — السبب: ${reason.slice(0, 80)}`,
      );
    }
    return result;
  },

  sendPaymentOrder: (orderId, actor, note) => {
    const { timestamp } = formatNow();
    const order = get().orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: 'الطلب غير موجود' };
    const tlEntry = timelineEntry(order, 'system', `➡️ [${timestamp}] توجيه أمر الدفع إلى المشتريات لتحويل ثمن المصنع${note ? ` — ${note}` : ''}`);
    const result = get().transitionOrder(orderId, 'payment_order_sent', {
      actor,
      reason: note,
      mutate: (o) => ({ negotiationHistory: [...o.negotiationHistory, tlEntry] }),
    });
    if (!result.ok) return result;
    // Notify Procurement Manager + assigned procurement employee.
    const procTarget = order.claim?.claimedBy || order.assignment?.assignedTo;
    const recipients = ['كنانة'];
    if (procTarget && procTarget !== 'كنانة') recipients.push(procTarget);
    notifyRecipients(
      set,
      order,
      recipients,
      actor.name,
      'status',
      `➡️ أمر دفع جديد بحاجة إلى تنفيذ للطلب #${order.orderNumber} (${order.shippingMark})${note ? ` — ${note.slice(0, 80)}` : ''}`,
    );
    return result;
  },

  recordFactoryPayment: (orderId, payment, actor) => {
    const { timestamp } = formatNow();
    const order = get().orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: 'الطلب غير موجود' };
    if (order.status !== 'payment_order_sent') {
      return { ok: false, error: 'لا يمكن تسجيل دفع المعمل قبل استلام أمر الدفع.' };
    }
    if (actor.dept !== 'procurement' && !isCEO(actor.name)) {
      return { ok: false, error: 'تسجيل دفع المعمل متاح للمشتريات فقط.' };
    }
    if (!Number.isFinite(payment.amount) || payment.amount <= 0) {
      return { ok: false, error: 'مبلغ الدفع غير صالح.' };
    }
    const factoryPayment: FactoryPayment = {
      ...payment,
      recordedBy: actor.name,
      recordedAt: timestamp,
    };
    const methodLabel = factoryPaymentMethodLabel(payment.paymentMethod);
    const tlEntry = timelineEntry(
      order,
      'system',
      `🏭 [${timestamp}] سجّلت المشتريات (${actor.name}) دفع المعمل — المبلغ: ${payment.amount} ${payment.currency} — الطريقة: ${methodLabel}${factoryPayment.attachment ? ' — يحتوي إثبات' : ''} — بانتظار تأكيد الحسابات.`,
    );
    // Data-only mutation. Status DOES NOT change — accounting must verify next.
    set((s) => ({
      orders: s.orders.map((o) =>
        o.id === orderId
          ? {
              ...o,
              factoryPayment,
              negotiationHistory: [...o.negotiationHistory, tlEntry],
              updatedAt: timestamp,
            }
          : o,
      ),
    }));
    // Notify Accounting that a factory payment needs verification.
    notifyRecipients(
      set,
      order,
      ['نور', 'دنيا', 'عائشة', 'محمد جمران'],
      actor.name,
      'deposit',
      `🏭 دفع معمل جديد بانتظار التأكيد للطلب #${order.orderNumber} (${order.shippingMark}) — سجّله ${actor.name} — ${payment.amount} ${payment.currency} — الطريقة: ${methodLabel}${factoryPayment.attachment ? ' — يحتوي إثبات' : ''}`,
    );
    return { ok: true };
  },

  confirmFactoryPayment: (orderId, actor, note) => {
    const { timestamp } = formatNow();
    const order = get().orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: 'الطلب غير موجود' };
    // Guardrail beyond workflowEngine.isEnabled: procurement must never
    // confirm its own factory payment. workflowEngine already blocks that
    // by department; this is defense-in-depth in case the check drifts.
    if (order.factoryPayment && order.factoryPayment.recordedBy === actor.name) {
      return { ok: false, error: 'لا يمكن للمشتريات تأكيد دفع المعمل الذي سجّلته بنفسها. التأكيد من صلاحية الحسابات.' };
    }
    if (!order.factoryPayment) {
      return { ok: false, error: 'لا يمكن التأكيد قبل تسجيل دفع المعمل.' };
    }
    const mergedPayment: FactoryPayment = {
      ...order.factoryPayment,
      confirmedBy: actor.name,
      confirmedAt: timestamp,
    };
    const tlEntry = timelineEntry(
      order,
      'system',
      `✅ [${timestamp}] أكّدت الحسابات (${actor.name}) دفع المعمل — يمكن للمشتريات بدء الإنتاج${note ? ` — ${note}` : ''}`,
    );
    const result = get().transitionOrder(orderId, 'factory_payment_confirmed', {
      actor,
      reason: note,
      mutate: (o) => ({
        factoryPayment: mergedPayment,
        negotiationHistory: [...o.negotiationHistory, tlEntry],
      }),
    });
    if (!result.ok) return result;
    const procTarget = order.claim?.claimedBy || order.assignment?.assignedTo;
    const recipients = ['كنانة', 'محمد جمران', 'نور', 'عائشة'];
    if (procTarget && !recipients.includes(procTarget)) recipients.push(procTarget);
    notifyRecipients(
      set,
      order,
      recipients,
      actor.name,
      'deposit',
      `✅ الحسابات أكّدت دفع المعمل للطلب #${order.orderNumber} (${order.shippingMark}) — يمكن بدء الإنتاج`,
    );
    return result;
  },

  markProductionStarted: (orderId, actor, note) => {
    const { timestamp } = formatNow();
    const order = get().orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: 'الطلب غير موجود' };
    const tlEntry = timelineEntry(order, 'system', `🏗️ [${timestamp}] بدء الإنتاج${note ? ` — ${note}` : ''}`);
    const result = get().transitionOrder(orderId, 'production_started', {
      actor,
      reason: note,
      mutate: (o) => ({ negotiationHistory: [...o.negotiationHistory, tlEntry] }),
    });
    if (!result.ok) return result;
    const recipients = [
      order.salesPersona,
      'لميس - مديرة المبيعات',
      'كنانة',
      'نور',
      'عائشة',
      'محمد جمران',
    ];
    notifyRecipients(
      set,
      order,
      recipients,
      actor.name,
      'status',
      `🏗️ بدأ الإنتاج للطلب #${order.orderNumber} (${order.shippingMark})`,
    );
    return result;
  },

  markReadyForShipping: (orderId, actor, note) => {
    const { timestamp } = formatNow();
    const order = get().orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: 'الطلب غير موجود' };
    const tlEntry = timelineEntry(order, 'system', `📦 [${timestamp}] البضاعة جاهزة للشحن${note ? ` — ${note}` : ''}`);
    return get().transitionOrder(orderId, 'ready_for_shipping', {
      actor,
      reason: note,
      mutate: (o) => ({ negotiationHistory: [...o.negotiationHistory, tlEntry] }),
    });
  },

  markShipped: (orderId, actor, note) => {
    const { timestamp } = formatNow();
    const order = get().orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: 'الطلب غير موجود' };
    const tlEntry = timelineEntry(order, 'system', `🚢 [${timestamp}] تم الشحن${note ? ` — ${note}` : ''}`);
    return get().transitionOrder(orderId, 'shipped', {
      actor,
      reason: note,
      mutate: (o) => ({ negotiationHistory: [...o.negotiationHistory, tlEntry] }),
    });
  },

  markArrived: (orderId, actor, note) => {
    const { timestamp } = formatNow();
    const order = get().orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: 'الطلب غير موجود' };
    const tlEntry = timelineEntry(order, 'system', `🛬 [${timestamp}] وصلت الشحنة${note ? ` — ${note}` : ''}`);
    return get().transitionOrder(orderId, 'arrived', {
      actor,
      reason: note,
      mutate: (o) => ({ negotiationHistory: [...o.negotiationHistory, tlEntry] }),
    });
  },

  markDelivered: (orderId, actor, note) => {
    const { timestamp } = formatNow();
    const order = get().orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: 'الطلب غير موجود' };
    const tlEntry = timelineEntry(order, 'system', `🎉 [${timestamp}] تم تسليم الطلب للعميل${note ? ` — ${note}` : ''}`);
    return get().transitionOrder(orderId, 'delivered', {
      actor,
      reason: note,
      mutate: (o) => ({ negotiationHistory: [...o.negotiationHistory, tlEntry] }),
    });
  },

  updateSupplierData: (orderId, supplierData, _personaName) => {
    const { timestamp } = formatNow();
    set((s) => ({
      orders: s.orders.map((o) =>
        o.id === orderId
          ? { ...o, supplierData, updatedAt: timestamp }
          : o
      ),
    }));
  },

  addNote: (orderId, author, authorDept, target, content) => {
    const { timestamp } = formatNow();
    const id = `note-${++noteCounter}-${Date.now()}`;
    const note: OrderNote = { id, authorPersona: author, authorDept, targetPersona: target, content, readBy: [], replies: [], createdAt: timestamp };

    const order = get().orders.find((o) => o.id === orderId);
    if (!order) return;

    set((s) => ({
      orders: s.orders.map((o) =>
        o.id === orderId
          ? { ...o, notes: [...o.notes, note], updatedAt: timestamp }
          : o
      ),
    }));

    const notif: Notification = {
      id: `notif-${++notifCounter}-${Date.now()}`,
      orderId,
      orderNumber: order.orderNumber,
      shippingMark: order.shippingMark,
      type: 'note',
      message: `ملاحظة جديدة من ${author} على الطلب #${order.orderNumber}: "${content.slice(0, 60)}${content.length > 60 ? '...' : ''}"`,
      fromPersona: author,
      forPersona: target,
      read: false,
      createdAt: timestamp,
    };
    set((s) => ({ notifications: [...s.notifications, notif] }));
  },

  markNoteRead: (orderId, persona) => {
    const { timestamp } = formatNow();
    set((s) => ({
      orders: s.orders.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          notes: o.notes.map((n) => {
            if (n.targetPersona !== persona) return n;
            const alreadyRead = n.readBy.some((r) => r.persona === persona);
            if (alreadyRead) return n;
            return { ...n, readBy: [...n.readBy, { persona, readAt: timestamp }] };
          }),
        };
      }),
    }));
  },

  replyToNote: (orderId, noteId, author, authorDept, content) => {
    const { timestamp } = formatNow();
    const reply: OrderNoteReply = {
      id: `reply-${++replyCounter}-${Date.now()}`,
      authorPersona: author,
      authorDept,
      content,
      createdAt: timestamp,
    };
    set((s) => ({
      orders: s.orders.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          notes: o.notes.map((n) =>
            n.id === noteId ? { ...n, replies: [...n.replies, reply] } : n
          ),
          updatedAt: timestamp,
        };
      }),
    }));
  },

  addCustomNote: (orderId, senderName, senderRole, targetUserId, targetName, targetRole, content, type) => {
    const { timestamp } = formatNow();
    const id = `cnote-${++custNoteCounter}-${Date.now()}`;
    const order = get().orders.find((o) => o.id === orderId);
    if (!order) return;
    const note: CustomNote = { id, orderId, orderNumber: order.orderNumber, shippingMark: order.shippingMark, senderName, senderRole, targetUserId, targetName, targetRole, content, type: type || 'general', createdAt: timestamp, isRead: false, readAt: '', readHistory: [], replies: [] };
    set((s) => ({
      orders: s.orders.map((o) => o.id === orderId ? { ...o, customNotes: [...o.customNotes, note], updatedAt: timestamp } : o),
    }));
  },

  markCustomNoteRead: (orderId, noteId, readerName) => {
    const { date, time, timestamp } = formatNow();
    set((s) => ({
      orders: s.orders.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          customNotes: o.customNotes.map((n) => {
            if (n.id !== noteId) return n;
            const history = n.readHistory || [];
            const alreadyLogged = history.some((h) => h.reader === readerName);
            if (alreadyLogged && n.isRead) return n;
            const newHistory = alreadyLogged
              ? history
              : [...history, { reader: readerName, date, time, timestamp }];
            return {
              ...n,
              isRead: true,
              readAt: n.readAt || timestamp,
              readHistory: newHistory,
            };
          }),
        };
      }),
    }));
  },

  replyToCustomNote: (orderId, noteId, senderName, senderRole, content) => {
    const { timestamp } = formatNow();
    const reply: CustomNoteReply = { id: `creply-${++custReplyCounter}-${Date.now()}`, senderName, senderRole, content, createdAt: timestamp };
    set((s) => ({
      orders: s.orders.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          customNotes: o.customNotes.map((n) =>
            n.id === noteId ? { ...n, replies: [...n.replies, reply] } : n
          ),
          updatedAt: timestamp,
        };
      }),
    }));
  },

  getCustomNotesForTarget: (targetUserId) => {
    const results: { note: CustomNote; order: Order }[] = [];
    for (const order of get().orders) {
      for (const note of order.customNotes) {
        if (note.targetUserId === targetUserId) {
          results.push({ note, order });
        }
      }
    }
    return results.sort((a, b) => b.note.createdAt.localeCompare(a.note.createdAt));
  },

  addNegotiationEntry: (orderId, fromPersona, fromDept, message, type) => {
    const { timestamp } = formatNow();
    const entry: NegotiationEntry = {
      id: `neg-${++negotCounter}-${Date.now()}`,
      fromPersona,
      fromDept,
      message,
      type,
      createdAt: timestamp,
    };
    set((s) => ({
      orders: s.orders.map((o) =>
        o.id === orderId
          ? { ...o, negotiationHistory: [...o.negotiationHistory, entry], updatedAt: timestamp }
          : o
      ),
    }));
  },

  addDocument: (orderId, name, type, url, uploadedBy) => {
    const { timestamp } = formatNow();
    const doc: Order['documents'][0] = {
      id: `doc-${++docCounter}-${Date.now()}`,
      name,
      type: type as Order['documents'][0]['type'],
      url,
      uploadedBy,
      uploadedAt: timestamp,
    };
    set((s) => ({
      orders: s.orders.map((o) =>
        o.id === orderId
          ? { ...o, documents: [...o.documents, doc], updatedAt: timestamp }
          : o
      ),
    }));
  },

  requestShippingMarkChange: (orderId, requestedBy, currentMark, proposedMark) => {
    const { timestamp } = formatNow();
    const ticket: ShippingMarkLockTicket = {
      id: `ticket-${++ticketCounter}-${Date.now()}`,
      requestedBy,
      currentMark,
      proposedMark,
      status: 'pending',
      approvedBy: [],
      createdAt: timestamp,
    };
    set((s) => ({
      orders: s.orders.map((o) =>
        o.id === orderId
          ? { ...o, lockTicket: ticket, updatedAt: timestamp }
          : o
      ),
    }));
  },

  approveShippingMarkTicket: (orderId, approverName) => {
    const { timestamp } = formatNow();
    set((s) => ({
      orders: s.orders.map((o) => {
        if (o.id !== orderId || !o.lockTicket) return o;
        const ticket = o.lockTicket;
        const alreadyApproved = ticket.approvedBy.includes(approverName);
        if (alreadyApproved) return o;

        const newApprovedBy = [...ticket.approvedBy, approverName];
        const bothApproved = newApprovedBy.includes('نور') && newApprovedBy.includes('محمد جمران');

        if (bothApproved) {
          return {
            ...o,
            shippingMark: ticket.proposedMark,
            lockTicket: { ...ticket, approvedBy: newApprovedBy, status: 'approved' as const, resolvedAt: timestamp },
            updatedAt: timestamp,
          };
        }

        return {
          ...o,
          lockTicket: { ...ticket, approvedBy: newApprovedBy },
          updatedAt: timestamp,
        };
      }),
    }));
  },

  getNotificationsFor: (persona) =>
    get().notifications.filter((n) => n.forPersona === persona),

  markNotificationRead: (notifId) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === notifId ? { ...n, read: true } : n
      ),
    })),

  markAllNotificationsRead: (persona) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.forPersona === persona ? { ...n, read: true } : n
      ),
    })),

  getDeadlineStatus: (orderId) => {
    const order = get().orders.find((o) => o.id === orderId);
    if (!order?.claim || order.status !== 'pricing_in_progress') return null;

    const deadline = new Date(order.claim.deadlineAt.replace(' ', 'T'));
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    const expired = diff <= 0;

    return {
      remaining: formatDeadline(Math.abs(diff)),
      expired,
      progress: expired ? 100 : Math.min(100, Math.max(0, ((6 * 3600 * 1000 - diff) / (6 * 3600 * 1000)) * 100)),
    };
  },

  archiveOrder: (orderId, requestedBy, reason) => {
    if (!isCEO(requestedBy)) {
      return { ok: false, error: 'الأرشفة متاحة للمدير العام فقط.' };
    }
    const trimmed = reason.trim();
    if (!trimmed) {
      return { ok: false, error: 'سبب الأرشفة إلزامي.' };
    }
    const order = get().orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: 'الطلب غير موجود' };
    if (order.archivedAt) return { ok: false, error: 'الطلب مؤرشف مسبقاً.' };

    const { timestamp } = formatNow();
    let updated: Order | undefined;
    set((s) => ({
      orders: s.orders.map((o) => {
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
    const order = get().orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: 'الطلب غير موجود' };
    if (!order.archivedAt) return { ok: false, error: 'الطلب غير مؤرشف.' };

    const { timestamp } = formatNow();
    let updated: Order | undefined;
    set((s) => ({
      orders: s.orders.map((o) => {
        if (o.id !== orderId) return o;
        // Blank the archive fields but do not touch workflowHistory — the fact
        // that the order was ever archived remains visible in the timeline.
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
}));
