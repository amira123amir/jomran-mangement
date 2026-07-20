import type { OrderStatus } from '../types';

// The 15 canonical statuses in workflow order. Index + 1 = step number (1..15).
export const WORKFLOW_STATUSES: OrderStatus[] = [
  'waiting_for_assignment',
  'pricing_in_progress',
  'procurement_inquiry',
  'pricing_completed',
  'quotation_presented',
  'official_quotation_generated',
  'deposit_paid',
  'deposit_confirmed',
  'payment_order_sent',
  'factory_payment_confirmed',
  'production_started',
  'ready_for_shipping',
  'shipped',
  'arrived',
  'delivered',
];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  waiting_for_assignment: 'بانتظار التعيين',
  pricing_in_progress: 'التسعير قيد التنفيذ',
  procurement_inquiry: 'المشتريات تستفسر',
  pricing_completed: 'تم التسعير - جاهز للعرض',
  quotation_presented: 'معروض على العميل بانتظار الموافقة',
  official_quotation_generated: 'تم تصدير فاتورة رسمية',
  deposit_paid: 'تم دفع العربون',
  deposit_confirmed: 'تم تأكيد العربون',
  payment_order_sent: 'تم توجيه الأمر إلى المشتريات بالدفع',
  factory_payment_confirmed: 'تم تأكيد دفع المشتريات للمعمل',
  production_started: 'بدأ الإنتاج',
  ready_for_shipping: 'جاهز للشحن',
  shipped: 'تم الشحن',
  arrived: 'تم الوصول',
  delivered: 'تم التسليم',
};

export const STATUS_LABELS_EN: Record<OrderStatus, string> = {
  waiting_for_assignment: 'Waiting for Assignment',
  pricing_in_progress: 'Pricing in Progress',
  procurement_inquiry: 'Procurement Inquiry',
  pricing_completed: 'Pricing Completed – Ready for Customer',
  quotation_presented: 'Quotation Presented to Customer',
  official_quotation_generated: 'Official Quotation Generated',
  deposit_paid: 'Deposit Paid',
  deposit_confirmed: 'Deposit Confirmed',
  payment_order_sent: 'Payment Order Sent to Procurement',
  factory_payment_confirmed: 'Factory Payment Confirmed',
  production_started: 'Production Started',
  ready_for_shipping: 'Ready for Shipping',
  shipped: 'Shipped',
  arrived: 'Arrived',
  delivered: 'Delivered',
};

export const STATUS_ICONS: Record<OrderStatus, string> = {
  waiting_for_assignment: '⏳',
  pricing_in_progress: '🔧',
  procurement_inquiry: '❓',
  pricing_completed: '💰',
  quotation_presented: '📄',
  official_quotation_generated: '🧾',
  deposit_paid: '💵',
  deposit_confirmed: '💳',
  payment_order_sent: '➡️',
  factory_payment_confirmed: '✅',
  production_started: '🏗️',
  ready_for_shipping: '📦',
  shipped: '🚢',
  arrived: '🛬',
  delivered: '🎉',
};

// Workflow stage → used for grouping/coloring the visual indicator.
export type WorkflowStage = 'assignment' | 'pricing' | 'quotation' | 'payment' | 'production' | 'fulfillment';

export const STATUS_STAGE: Record<OrderStatus, WorkflowStage> = {
  waiting_for_assignment: 'assignment',
  pricing_in_progress: 'pricing',
  procurement_inquiry: 'pricing',
  pricing_completed: 'pricing',
  quotation_presented: 'quotation',
  official_quotation_generated: 'quotation',
  deposit_paid: 'payment',
  deposit_confirmed: 'payment',
  payment_order_sent: 'payment',
  factory_payment_confirmed: 'payment',
  production_started: 'production',
  ready_for_shipping: 'production',
  shipped: 'fulfillment',
  arrived: 'fulfillment',
  delivered: 'fulfillment',
};

export function statusLabel(status: OrderStatus | string): string {
  return `${STATUS_ICONS[status as OrderStatus] ?? ''} ${STATUS_LABELS[status as OrderStatus] ?? status}`.trim();
}

export function statusStepNumber(status: OrderStatus): number {
  const idx = WORKFLOW_STATUSES.indexOf(status);
  return idx === -1 ? 0 : idx + 1;
}

// Migration map from legacy status slugs used before the 15-status alignment.
// Kept so any persisted data or in-flight code paths can be normalized.
const LEGACY_STATUS_MAP: Record<string, OrderStatus> = {
  pending: 'waiting_for_assignment',
  claimed: 'pricing_in_progress',
  pending_sales_info: 'procurement_inquiry',
  pending_factory_info: 'procurement_inquiry',
  priced: 'pricing_completed',
  pricing_rejected: 'pricing_in_progress',
  pending_quotation: 'pricing_completed',
  waiting_customer: 'quotation_presented',
  quotation_confirmed: 'official_quotation_generated',
  deposit_received: 'deposit_confirmed',
  revision: 'pricing_in_progress',
  locked: 'official_quotation_generated',
  completed: 'delivered',
};

export function normalizeStatus(status: string): OrderStatus {
  if ((WORKFLOW_STATUSES as string[]).includes(status)) return status as OrderStatus;
  return LEGACY_STATUS_MAP[status] ?? 'waiting_for_assignment';
}

// Filter groups exposed in the General Queue
export interface QueueFilter {
  id: string;
  label: string;
  department?: string;
  match: (status: OrderStatus) => boolean;
}

export const QUEUE_FILTERS: QueueFilter[] = [
  { id: 'all', label: 'كل الطلبات', match: () => true },
  { id: 'waiting_for_assignment', label: 'بانتظار التعيين', department: 'قسم المشتريات', match: (s) => s === 'waiting_for_assignment' },
  { id: 'pricing_in_progress', label: 'التسعير قيد التنفيذ', department: 'قسم المبيعات', match: (s) => s === 'pricing_in_progress' },
  { id: 'procurement_inquiry', label: 'المشتريات تستفسر', department: 'قسم المشتريات', match: (s) => s === 'procurement_inquiry' },
  { id: 'pricing_completed', label: 'جاهز للعرض', department: 'قسم المبيعات', match: (s) => s === 'pricing_completed' },
  { id: 'quotation_presented', label: 'معروض على العميل', department: 'قسم المبيعات', match: (s) => s === 'quotation_presented' },
  { id: 'official_quotation_generated', label: 'فاتورة رسمية', department: 'قسم الحسابات', match: (s) => s === 'official_quotation_generated' },
  { id: 'deposit_paid', label: 'دفع العربون', department: 'قسم الحسابات', match: (s) => s === 'deposit_paid' },
  { id: 'deposit_confirmed', label: 'تأكيد العربون', department: 'قسم الحسابات', match: (s) => s === 'deposit_confirmed' },
  { id: 'payment_order_sent', label: 'أمر الدفع للمشتريات', department: 'قسم الحسابات', match: (s) => s === 'payment_order_sent' },
  { id: 'factory_payment_confirmed', label: 'دفع المعمل مؤكد', department: 'قسم الحسابات', match: (s) => s === 'factory_payment_confirmed' },
  { id: 'production_started', label: 'الإنتاج', department: 'قسم المشتريات', match: (s) => s === 'production_started' },
  { id: 'ready_for_shipping', label: 'جاهز للشحن', department: 'قسم المشتريات', match: (s) => s === 'ready_for_shipping' },
  { id: 'shipped', label: 'مشحون', department: 'قسم المشتريات', match: (s) => s === 'shipped' },
  { id: 'arrived', label: 'وصل', department: 'قسم المشتريات', match: (s) => s === 'arrived' },
  { id: 'delivered', label: 'مُسلَّم', department: 'قسم المبيعات', match: (s) => s === 'delivered' },
];
