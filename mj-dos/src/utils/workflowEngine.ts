import type { OrderStatus, Department, Order } from '../types';

// Every workflow transition is declared once, here. The store must never mutate
// order.status outside of transitionOrder() in orderStore.
//
// forward transitions:  from → next  (moves the order along the pipeline)
// backward transitions: from → prev  (only explicitly-defined rewinds, e.g.
//   sales rejects procurement pricing)
//
// Any other status change is a violation of the state machine and must be
// rejected by the store guard.

export type WorkflowActionKey =
  | 'claim'
  | 'submitPricing'
  | 'presentQuotation'
  | 'generateOfficialQuotation'
  | 'recordDepositPaid'
  | 'confirmDeposit'
  | 'returnDeposit'
  | 'sendPaymentOrder'
  | 'confirmFactoryPayment'
  | 'markProductionStarted'
  | 'markReadyForShipping'
  | 'markShipped'
  | 'markArrived'
  | 'markDelivered'
  | 'rejectPricing';

export interface WorkflowTransitionSpec {
  from: OrderStatus;
  to: OrderStatus;
  action: WorkflowActionKey;
  labelAr: string;
  labelEn: string;
  direction: 'forward' | 'backward';
  // Which departments may trigger this transition. CEO ('executive') can always trigger.
  allowedDepartments: Department[];
  requiresReason?: boolean;
  // Optional runtime precondition — e.g. Pricing must exist before presenting a quotation.
  isEnabled?: (order: Order) => boolean;
  disabledReason?: string;
}

// ─── Forward pipeline (one next step per status) ───────────────────────────────
export const FORWARD_TRANSITIONS: WorkflowTransitionSpec[] = [
  {
    from: 'waiting_for_assignment',
    to: 'pricing_in_progress',
    action: 'claim',
    labelAr: '🤚 استلام الطلب',
    labelEn: 'Claim Order',
    direction: 'forward',
    allowedDepartments: ['procurement'],
  },
  {
    from: 'pricing_in_progress',
    to: 'pricing_completed',
    action: 'submitPricing',
    labelAr: '💰 تسجيل التسعير',
    labelEn: 'Submit Pricing',
    direction: 'forward',
    allowedDepartments: ['procurement'],
  },
  {
    from: 'procurement_inquiry',
    to: 'pricing_in_progress',
    action: 'submitPricing',
    labelAr: '↩ العودة إلى التسعير',
    labelEn: 'Resume Pricing',
    direction: 'forward',
    allowedDepartments: ['procurement'],
  },
  {
    from: 'pricing_completed',
    to: 'quotation_presented',
    action: 'presentQuotation',
    labelAr: '📄 عرض الفاتورة على العميل',
    labelEn: 'Present Quotation',
    direction: 'forward',
    allowedDepartments: ['sales'],
    isEnabled: (o) => (o.pricingHistory?.length || 0) > 0,
    disabledReason: 'لا يوجد تسعير معتمد بعد',
  },
  {
    from: 'quotation_presented',
    to: 'official_quotation_generated',
    action: 'generateOfficialQuotation',
    labelAr: '🧾 إصدار الفاتورة الرسمية',
    labelEn: 'Generate Official Quotation',
    direction: 'forward',
    allowedDepartments: ['sales', 'accounting'],
    isEnabled: (o) => !!o.proforma,
    disabledReason: 'يجب إعداد عرض السعر أولاً',
  },
  {
    from: 'official_quotation_generated',
    to: 'deposit_paid',
    action: 'recordDepositPaid',
    labelAr: '💵 تسجيل استلام العربون من الزبون',
    labelEn: 'Customer Deposit Received',
    direction: 'forward',
    // Sales records the incoming deposit; accounting confirms it in the next step.
    allowedDepartments: ['sales'],
  },
  {
    from: 'deposit_paid',
    to: 'deposit_confirmed',
    action: 'confirmDeposit',
    labelAr: '💳 تأكيد استلام العربون',
    labelEn: 'Confirm Customer Deposit',
    direction: 'forward',
    allowedDepartments: ['accounting'],
    // Cannot confirm what wasn't recorded.
    isEnabled: (o) => !!o.customerDeposit,
    disabledReason: 'لم يتم تسجيل بيانات العربون بعد',
  },
  {
    from: 'deposit_confirmed',
    to: 'payment_order_sent',
    action: 'sendPaymentOrder',
    labelAr: '➡️ توجيه أمر الدفع إلى المشتريات',
    labelEn: 'Send Payment Order to Procurement',
    direction: 'forward',
    // Procurement Manager can advance this stage herself once she confirms
    // the factory deposit was paid (see button in OrderWorkspace).
    allowedDepartments: ['accounting', 'procurement'],
  },
  {
    from: 'payment_order_sent',
    to: 'factory_payment_confirmed',
    action: 'confirmFactoryPayment',
    labelAr: '✅ تأكيد دفع المشتريات للمعمل',
    labelEn: 'Confirm Factory Payment',
    direction: 'forward',
    // Accounting verifies the payment recorded by procurement. Procurement must
    // NEVER be allowed to confirm its own factory payment.
    allowedDepartments: ['accounting'],
    isEnabled: (o) => !!o.factoryPayment,
    disabledReason: 'المشتريات لم تسجّل دفع المعمل بعد',
  },
  {
    from: 'factory_payment_confirmed',
    to: 'production_started',
    action: 'markProductionStarted',
    labelAr: '🏗️ بدء الإنتاج',
    labelEn: 'Start Production',
    direction: 'forward',
    allowedDepartments: ['procurement'],
  },
  {
    from: 'production_started',
    to: 'ready_for_shipping',
    action: 'markReadyForShipping',
    labelAr: '📦 جاهز للشحن',
    labelEn: 'Ready for Shipping',
    direction: 'forward',
    allowedDepartments: ['procurement'],
  },
  {
    from: 'ready_for_shipping',
    to: 'shipped',
    action: 'markShipped',
    labelAr: '🚢 تم الشحن',
    labelEn: 'Mark Shipped',
    direction: 'forward',
    allowedDepartments: ['procurement'],
  },
  {
    from: 'shipped',
    to: 'arrived',
    action: 'markArrived',
    labelAr: '🛬 وصلت الشحنة',
    labelEn: 'Mark Arrived',
    direction: 'forward',
    allowedDepartments: ['procurement', 'sales'],
  },
  {
    from: 'arrived',
    to: 'delivered',
    action: 'markDelivered',
    labelAr: '🎉 تم التسليم للعميل',
    labelEn: 'Mark Delivered',
    direction: 'forward',
    allowedDepartments: ['sales', 'accounting'],
  },
];

// ─── Explicitly-authorized backward transitions ──────────────────────────────
export const BACKWARD_TRANSITIONS: WorkflowTransitionSpec[] = [
  {
    from: 'pricing_completed',
    to: 'pricing_in_progress',
    action: 'rejectPricing',
    labelAr: '❌ رفض التسعير — إعادة إلى المشتريات',
    labelEn: 'Reject Pricing — Return to Procurement',
    direction: 'backward',
    allowedDepartments: ['sales'],
    requiresReason: true,
  },
  {
    // Accounting can return a recorded (but not yet confirmed) deposit to
    // sales for correction. Requires a mandatory reason so the audit trail
    // captures why.
    from: 'deposit_paid',
    to: 'official_quotation_generated',
    action: 'returnDeposit',
    labelAr: '↩ إعادة العربون للتصحيح',
    labelEn: 'Return Deposit for Correction',
    direction: 'backward',
    allowedDepartments: ['accounting'],
    requiresReason: true,
  },
  {
    from: 'quotation_presented',
    to: 'pricing_in_progress',
    action: 'rejectPricing',
    labelAr: '❌ رفض التسعير — إعادة إلى المشتريات',
    labelEn: 'Reject Pricing — Return to Procurement',
    direction: 'backward',
    allowedDepartments: ['sales'],
    requiresReason: true,
  },
];

const ALL_TRANSITIONS: WorkflowTransitionSpec[] = [
  ...FORWARD_TRANSITIONS,
  ...BACKWARD_TRANSITIONS,
];

export function isCEO(personaName: string): boolean {
  return personaName === 'محمد جمران';
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALL_TRANSITIONS.some((t) => t.from === from && t.to === to);
}

export function findTransition(from: OrderStatus, to: OrderStatus): WorkflowTransitionSpec | undefined {
  return ALL_TRANSITIONS.find((t) => t.from === from && t.to === to);
}

export function getForwardTransition(status: OrderStatus): WorkflowTransitionSpec | undefined {
  return FORWARD_TRANSITIONS.find((t) => t.from === status);
}

export function getBackwardTransitions(status: OrderStatus): WorkflowTransitionSpec[] {
  return BACKWARD_TRANSITIONS.filter((t) => t.from === status);
}

// The next-action for the given persona: forward step if their department is
// authorized (CEO always authorized), backward options separately.
export interface NextActionView {
  forward: WorkflowTransitionSpec | null;
  forwardAuthorized: boolean;
  forwardEnabled: boolean;
  forwardDisabledReason?: string;
  backward: WorkflowTransitionSpec[];
}

export function getNextAction(
  order: Order,
  personaName: string,
  personaDept: Department,
): NextActionView {
  const forward = getForwardTransition(order.status) || null;
  const backward = getBackwardTransitions(order.status);

  const ceo = isCEO(personaName);
  const forwardAuthorized = !!forward && (ceo || forward.allowedDepartments.includes(personaDept));
  const enabled = forward?.isEnabled ? forward.isEnabled(order) : true;

  return {
    forward,
    forwardAuthorized,
    forwardEnabled: enabled,
    forwardDisabledReason: forward?.disabledReason,
    backward: backward.filter((b) => ceo || b.allowedDepartments.includes(personaDept)),
  };
}

export function isTerminalStatus(status: OrderStatus): boolean {
  return !getForwardTransition(status);
}
