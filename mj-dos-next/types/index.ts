export type Department = 'executive' | 'sales' | 'procurement' | 'accounting';

export interface Persona {
  id: string;
  name: string;
  role: string;
  department: Department;
  departmentLabel: string;
  color: string;
  initials: string;
  navItems: NavItem[];
}

export interface NavItem {
  id: string;
  label: string;
  icon: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  date: string;
  time: string;
  persona: string;
  department: string;
  action: string;
  details?: string;
}

export type WorkspaceTab = string;

// The 15 official MJ-DOS workflow statuses, in order.
// Do not add, remove, or rename statuses without owner (CEO) approval.
export type OrderStatus =
  | 'waiting_for_assignment'
  | 'pricing_in_progress'
  | 'procurement_inquiry'
  | 'pricing_completed'
  | 'quotation_presented'
  | 'official_quotation_generated'
  | 'deposit_paid'
  | 'deposit_confirmed'
  | 'payment_order_sent'
  | 'factory_payment_confirmed'
  | 'production_started'
  | 'ready_for_shipping'
  | 'shipped'
  | 'arrived'
  | 'delivered';

export interface OrderOptionalFields {
  [key: string]: string;
}

// ─── Products ──────────────────────────────────────────────────────────────
// An order carries one OR MORE products. Each product owns its own category,
// technical (optional) fields, quantity, and optional target price. Pricing
// and the customer quotation are computed PER product (see OrderPricing.productId
// and ProformaLine.productId) then summed into the order grand total.
export interface OrderProduct {
  id: string;
  productName: string;
  category: string;
  categoryLabel: string;
  quantity: number;
  optionalFields: OrderOptionalFields;
  targetPrice?: number;
  factoryUrl?: string;
}

export type SupplierCategory = 'lighting' | 'electrical' | 'steel' | 'other';

export interface Supplier {
  id: string;
  factoryName: string;
  factoryPhone: string;
  wechat?: string;
  website?: string;
  category: SupplierCategory;
  notes?: string;
}

export interface SupplierData {
  factoryName: string;
  factoryPhone: string;
  factoryAddress?: string;
  contactPerson?: string;
  procurementNotes?: string;
  supplierNumber?: string;
}

export interface OrderDocument {
  id: string;
  name: string;
  type: 'attachment' | 'invoice' | 'proof' | 'other';
  url: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface NegotiationEntry {
  id: string;
  fromPersona: string;
  fromDept: string;
  message: string;
  type: 'query' | 'response' | 'revision' | 'approval';
  createdAt: string;
}

export interface DepositConfirmation {
  confirmedBy: string;
  amount: number;
  currency: string;
  reference: string;
  confirmedAt: string;
  note?: string;
  attachment?: { name: string; url: string };
}

export interface ShippingMarkLockTicket {
  id: string;
  requestedBy: string;
  currentMark: string;
  proposedMark: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy: string[];
  createdAt: string;
  resolvedAt?: string;
}

export interface ProcurementAssignment {
  assignedTo: string;
  assignedBy: string;
  assignedAt: string;
  accepted: boolean;
}

// ─── Financial workflow records ───────────────────────────────────────────
// Attachment shape used by deposit / factory-payment proofs. Client-only
// object URLs — see the "Attachment Handling" note in orderStore comments.
export interface PaymentAttachment {
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
}

export interface OfficialInvoice {
  invoiceNumber: string;
  notes: string;
  exportCurrency: QuotationCurrency;
  exportedFormat: 'pdf' | 'xlsx';
  exportedBy: string;
  exportedAt: string;
}

export type DepositPaymentMethod =
  | 'cash_office'
  | 'sham_cash'
  | 'trend_5000'
  | 'dahab_istanbul_1373'
  | 'free_istanbul_104'
  | 'other';

export interface CustomerDeposit {
  amount: number;
  currency: QuotationCurrency;
  paymentMethod: DepositPaymentMethod;
  // Required when paymentMethod === 'other'.
  customPaymentMethod?: string;
  paymentDate: string;
  attachment?: PaymentAttachment;
  recordedBy: string;
  recordedAt: string;
  // Populated when accounting confirms the deposit; original record is
  // preserved either way.
  confirmedBy?: string;
  confirmedAt?: string;
  note?: string;
}

export type FactoryPaymentMethod =
  | 'rmb_jasmine'
  | 'rmb_exchange_office'
  | 'usd_bank';

export type FactoryPaymentCurrency = 'RMB' | 'USD';

export interface FactoryPayment {
  amount: number;
  currency: FactoryPaymentCurrency;
  paymentMethod: FactoryPaymentMethod;
  reference?: string;
  note?: string;
  attachment?: PaymentAttachment;
  recordedBy: string;
  recordedAt: string;
  // Filled only after accounting verifies the payment. Procurement must
  // NEVER be able to set these itself.
  confirmedBy?: string;
  confirmedAt?: string;
}

export type WorkflowTransitionDirection = 'initial' | 'forward' | 'backward';

export interface WorkflowTransition {
  id: string;
  from: OrderStatus | null;
  to: OrderStatus;
  actorName: string;
  actorRole: string;
  actorDept: string;
  direction: WorkflowTransitionDirection;
  date: string;
  time: string;
  timestamp: string;
  reason?: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  clientId: string;
  clientName: string;
  shippingMark: string;
  shippingMarkSerial: number;
  salesPersona: string;
  salesPersonaDept: string;
  // An order holds one or more products. All product-level metadata
  // (name, category, quantity, technical fields, target price, factory URL)
  // lives on each OrderProduct.
  products: OrderProduct[];
  documents: OrderDocument[];
  status: OrderStatus;
  assignment: ProcurementAssignment | null;
  claim: ProcurementClaim | null;
  // Flat list of pricing versions across ALL products. Each entry carries a
  // productId; iteration is counted per product. Group by productId at read
  // time (see utils/pricing helpers / PricingTab).
  pricingHistory: OrderPricing[];
  proforma: ProformaInvoice | null;
  revenue: OrderRevenue | null;
  supplierData: SupplierData | null;
  negotiationHistory: NegotiationEntry[];
  notes: OrderNote[];
  customNotes: CustomNote[];
  lockTicket: ShippingMarkLockTicket | null;
  workflowHistory: WorkflowTransition[];
  officialInvoice?: OfficialInvoice;
  customerDeposit?: CustomerDeposit;
  factoryPayment?: FactoryPayment;
  // Archive state. Never delete an order — archive with a mandatory reason.
  // Archived orders are hidden from default lists but the CEO can still view.
  archivedAt?: string;
  archivedBy?: string;
  archiveReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderNote {
  id: string;
  authorPersona: string;
  authorDept: string;
  targetPersona: string;
  content: string;
  readBy: { persona: string; readAt: string }[];
  replies: OrderNoteReply[];
  createdAt: string;
}

export interface OrderNoteReply {
  id: string;
  authorPersona: string;
  authorDept: string;
  content: string;
  createdAt: string;
}

export interface ProcurementClaim {
  claimedBy: string;
  claimedByRole: string;
  claimedAt: string;
  deadlineAt: string;
}

export interface OrderPricing {
  // The product this pricing version belongs to (OrderProduct.id).
  productId: string;
  // Iteration is counted PER product, not per order.
  iteration: number;
  factoryPriceRMB: number;
  shippingCostRMB: number;
  internalChinaShippingRMB?: number;
  miscellaneousCostsRMB?: number;
  otherCostsRMB?: number;
  totalRMB: number;
  exchangeRateUsed: number;
  totalUSD: number;
  submittedBy: string;
  submittedAt: string;
  currency?: 'RMB' | 'USD';
}

export interface OrderRevenue {
  depositAmount: number;
  depositCurrency: string;
  confirmedByNoor: boolean;
  confirmedAt: string | null;
  actualRevenueUSD: number;
}

export type QuotationCurrency = 'USD' | 'RMB';
export type QuotationTemplate = 1 | 2;

// One customer-quote line, computed from a single product's latest pricing
// plus that product's profit margin.
export interface ProformaLine {
  productId: string;
  productName: string;
  baseTotalRMB: number;
  baseTotalUSD: number;
  profitPercent: number;
  profitFixed: number;
  profitFixedCurrency: QuotationCurrency;
  finalPriceRMB: number;
  finalPriceUSD: number;
}

export interface ProformaInvoice {
  // Per-product quote lines. The customer quotation is the sum of these.
  lines: ProformaLine[];
  // Grand totals across all lines.
  grandTotalRMB: number;
  grandTotalUSD: number;
  exportCurrency: QuotationCurrency;
  template: QuotationTemplate;
  submittedBy: string;
  submittedAt: string;
}

export interface CustomNoteReply {
  id: string;
  senderName: string;
  senderRole: string;
  content: string;
  createdAt: string;
}

export interface CustomNoteReadEntry {
  reader: string;
  date: string;
  time: string;
  timestamp: string;
}

export interface CustomNote {
  id: string;
  orderId: string;
  orderNumber: number;
  shippingMark: string;
  senderName: string;
  senderRole: string;
  targetUserId: string;
  targetName: string;
  targetRole: string;
  content: string;
  type: 'general' | 'secret';
  createdAt: string;
  isRead: boolean;
  readAt: string;
  readHistory: CustomNoteReadEntry[];
  replies: CustomNoteReply[];
}

export interface Notification {
  id: string;
  orderId: string;
  orderNumber: number;
  shippingMark: string;
  type: 'note' | 'pricing' | 'status' | 'assignment' | 'query' | 'deposit';
  message: string;
  fromPersona: string;
  forPersona: string;
  read: boolean;
  createdAt: string;
}
