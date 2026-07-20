import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { useOrderStore } from '../stores/orderStore';
import { usePersonaStore } from '../stores/personaStore';
import { useAuditStore } from '../stores/auditStore';
import { useExchangeRateStore } from '../stores/exchangeRateStore';
import { canViewSupplierData } from '../utils/supplierMask';
import OrderDetailsTabs from './OrderDetails';
import PricingTab from './PricingTab';
import { ORDER_NOTE_TARGETS, canSeeNote, getCurrentUserIds, isConfidentialRecipient } from '../utils/noteVisibility';
import { statusLabel } from '../utils/orderStatus';
import { exportQuotationPDF, exportQuotationExcel } from '../utils/quotationExport';
import { getNextAction, type WorkflowActionKey } from '../utils/workflowEngine';
import { STATUS_LABELS } from '../utils/orderStatus';
import { buildOrderTimeline } from '../utils/orderTimeline';
import { parseArabicNumber } from '../utils/arabicNumerals';
import { pad2 } from '../utils/dateHelpers';
import { formatNumber } from '../utils/formatNumber';
import { useModal } from '../hooks/useModal';
import type { QuotationCurrency, QuotationTemplate, Department, ProformaLine } from '../types';
import {
  latestPricingForProduct, pricingForProduct, unpricedProducts, allProductsPriced, orderBaseTotals,
} from '../utils/orderProducts';
import OrderTopBar from './order/OrderTopBar';
import OrderInfoPanel from './order/OrderInfoPanel';
import OrderTimelinePanel from './order/OrderTimelinePanel';
import ShippingMarkEditor from './order/ShippingMarkEditor';
import RejectPricingDialog from './order/RejectPricingDialog';
import ArchiveConfirmDialog from './order/ArchiveConfirmDialog';
import ArchivedOrderBanner from './order/ArchivedOrderBanner';
import ConfirmedOrderWarning from './order/ConfirmedOrderWarning';
import WorkflowBar from './order/WorkflowBar';
import NegotiationPanel from './order/NegotiationPanel';
import NotesPanel from './order/NotesPanel';
import ProformaModal from './order/ProformaModal';
import InvoicePreviewModal from './order/InvoicePreviewModal';
import DepositRecordForm from './order/DepositRecordForm';
import DepositConfirmDialog from './order/DepositConfirmDialog';
import FactoryPaymentForm from './order/FactoryPaymentForm';
import FactoryPaymentConfirmDialog from './order/FactoryPaymentConfirmDialog';

const ALL_PEOPLE = '__all__';

export default function OrderWorkspace({ orderId, initialSection }: { orderId: string; initialSection?: 'info' | 'timeline' | 'pricing' | 'negotiation' | 'notes' }) {
  const order = useOrderStore((s) => s.orders.find((o) => o.id === orderId));
  const latestPricing = order?.pricingHistory?.length ? order.pricingHistory[order.pricingHistory.length - 1] : null;
  // Actions are stable references defined once in the Zustand store; pull them
  // from getState() so this component does NOT subscribe to the whole store
  // snapshot. Previously `useOrderStore()` with no selector re-rendered on
  // every dispatch (any order edit, any note add, any log, anywhere), which
  // combined with the 1 Hz age-tick interval turned the workspace into a
  // sustained render source while the proforma modal was open.
  const { addNote, markNoteRead, replyToNote, requestInfo, submitPricing, submitProforma, updateSupplierData, requestShippingMarkChange, addDocument, archiveOrder, rejectPricing, markCustomNoteRead } = useOrderStore.getState();
  const persona = usePersonaStore((s) => s.activePersona);
  const addLog = useAuditStore((s) => s.addLog);
  // Selector-scoped subscription: re-render only when the rates object actually
  // changes, not on every unrelated exchange-rate-store update.
  const rates = useExchangeRateStore((s) => s.rates);

  const [activeSection, setActiveSection] = useState<'info' | 'timeline' | 'pricing' | 'negotiation' | 'notes'>(initialSection || 'info');
  useEffect(() => {
    if (activeSection === 'pricing' && order && persona.department === 'procurement'
      && !(order.claim?.claimedBy === persona.name || order.assignment?.assignedTo === persona.name)) {
      setActiveSection('info');
    }
  }, [activeSection, order, persona.name, persona.department]);
  const [noteTarget, setNoteTarget] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [negotiationMsg, setNegotiationMsg] = useState('');
  const [showMarkChange, setShowMarkChange] = useState(false);
  const [newMark, setNewMark] = useState('');
  const [negImageFile, setNegImageFile] = useState<File | null>(null);
  const [negImagePreview, setNegImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [factoryPrice, setFactoryPrice] = useState('');
  const [shippingCost, setShippingCost] = useState('');
  const [internalChinaShipping, setInternalChinaShipping] = useState('');
  const [miscCosts, setMiscCosts] = useState('');
  const [otherCosts, setOtherCosts] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [procurementNotes, setProcurementNotes] = useState('');
  const [showPriceForm, setShowPriceForm] = useState(false);
  // Which product the pricing form is currently entering a price for.
  const [pricingProductId, setPricingProductId] = useState('');
  const [exchangeRateInput, setExchangeRateInput] = useState('');
  const [itemCurrencies, setItemCurrencies] = useState<Record<string, 'RMB' | 'USD'>>({
    factoryPrice: 'RMB',
    internalChinaShipping: 'RMB',
    shippingCost: 'RMB',
    miscCosts: 'RMB',
    otherCosts: 'RMB',
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showProforma, setShowProforma] = useState(false);
  // Per-product profit inputs, keyed by product id. Missing keys = 0.
  const [proformaProfitPercent, setProformaProfitPercent] = useState<Record<string, string>>({});
  const [proformaProfitFixed, setProformaProfitFixed] = useState<Record<string, string>>({});
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [archiveReason, setArchiveReason] = useState('');
  const [proformaProfitCurrency, setProformaProfitCurrency] = useState<QuotationCurrency>('RMB');
  const [proformaExportCurrency, setProformaExportCurrency] = useState<QuotationCurrency>('USD');
  const [proformaTemplate, setProformaTemplate] = useState<QuotationTemplate>(1);
  const [, setTick] = useState(0);

  // Financial-workflow modal state (Tasks 1-9).
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [showDepositForm, setShowDepositForm] = useState(false);

  // Default invoice notes template
  const DEFAULT_INVOICE_NOTES = `شروط التسليم:
- التسليم من المصنع في الصين
- مدة التصنيع: حسب المنتج والكمية

شروط الشحن:
- الشحن البحري إلى ميناء الوصول
- التأمين على البضاعة

شروط الدفع:
- العربون: 30% من قيمة الفاتورة
- الباقي: قبل الشحن

الضمان:
- ضمان الجودة حسب مواصفات المنتج
- فترة ضمان: حسب نوع المنتج

صلاحية السعر:
- صالح لمدة 7 أيام من تاريخ الإصدار`;
  const [depositAmount, setDepositAmount] = useState('');
  const [depositCurrency, setDepositCurrency] = useState<QuotationCurrency>('USD');
  const [depositMethod, setDepositMethod] = useState<import('../types').DepositPaymentMethod>('cash_office');
  const [depositCustomMethod, setDepositCustomMethod] = useState('');
  const [depositDate, setDepositDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [depositAttachment, setDepositAttachment] = useState<File | null>(null);
  const [showConfirmDeposit, setShowConfirmDeposit] = useState(false);
  const [confirmNote, setConfirmNote] = useState('');
  const [confirmAttachment, setConfirmAttachment] = useState<File | null>(null);
  const [returnDepositReason, setReturnDepositReason] = useState('');
  const [showReturnDeposit, setShowReturnDeposit] = useState(false);
  const [showFactoryPaymentForm, setShowFactoryPaymentForm] = useState(false);
  const [factoryPayAmount, setFactoryPayAmount] = useState('');
  const [factoryPayCurrency, setFactoryPayCurrency] = useState<'RMB' | 'USD'>('RMB');
  const [factoryPayMethod, setFactoryPayMethod] = useState<import('../types').FactoryPaymentMethod>('rmb_jasmine');
  const [factoryPayReference, setFactoryPayReference] = useState('');
  const [factoryPayNote, setFactoryPayNote] = useState('');
  const [factoryPayAttachment, setFactoryPayAttachment] = useState<File | null>(null);
  const [showConfirmFactoryPayment, setShowConfirmFactoryPayment] = useState(false);
  // Loading state for the invoice-preview export path. When true, ESC is
  // locked and the action buttons show a spinner — the Close button is NEVER
  // disabled so the user is never trapped.
  const [invoiceExporting, setInvoiceExporting] = useState(false);

  // Single close handler per modal — reused by the header X button, the
  // footer Cancel/Close button, the overlay-backdrop click, and the ESC key.
  // Close never mutates order data, status, workflow history, or export
  // records; it purely toggles the local modal state and clears form drafts.
  const closeProforma        = () => setShowProforma(false);
  const closeInvoicePreview  = () => setShowInvoicePreview(false);
  const closeReject          = () => { setShowRejectDialog(false); setRejectReason(''); };
  const closeArchive         = () => { setConfirmDelete(false); setArchiveReason(''); };
  const closeMarkChange      = () => { setShowMarkChange(false); setNewMark(''); };
  const closeDepositForm     = () => setShowDepositForm(false);
  const closeConfirmDeposit  = () => { setShowConfirmDeposit(false); setShowReturnDeposit(false); setReturnDepositReason(''); };
  const closeFactoryPayForm  = () => setShowFactoryPaymentForm(false);
  const closeConfirmFactoryPay = () => setShowConfirmFactoryPayment(false);

  // ESC-to-close wiring. Capture-phase listener runs before any focused
  // input can swallow the event.
  useModal(showProforma,               closeProforma);
  useModal(showRejectDialog,           closeReject);
  useModal(confirmDelete,              closeArchive);
  useModal(showMarkChange,             closeMarkChange);
  useModal(showInvoicePreview,         closeInvoicePreview, { locked: invoiceExporting });
  useModal(showDepositForm,            closeDepositForm);
  useModal(showConfirmDeposit,         closeConfirmDeposit);
  useModal(showFactoryPaymentForm,     closeFactoryPayForm);
  useModal(showConfirmFactoryPayment,  closeConfirmFactoryPay);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const currentUserId = getCurrentUserIds(persona.name)[0];

  useEffect(() => {
    if (!order) return;
    for (const n of order.customNotes) {
      if (!n.isRead && isConfidentialRecipient(n, persona.name, currentUserId)) {
        markCustomNoteRead(order.id, n.id, persona.name);
      }
    }
  }, [order, persona.name, currentUserId, markCustomNoteRead]);

  // Seed proforma editor state from the existing proforma each time the modal opens,
  // so sales can reopen and adjust the quotation without losing prior selections.
  useEffect(() => {
    if (!showProforma || !order) return;
    // REOPEN_PROFORMA_DISABLED: seeding from an existing proforma is disabled while the
    // reopen feature is off. To re-enable, remove this guard and restore the original body below.
    if (order.proforma) return;
  }, [showProforma, order]);

  if (!order) return <div className="ow-not-found">الطلب غير موجود</div>;

  const showSupplier = canViewSupplierData(persona);
  const isProcurement = persona.department === 'procurement';
  const isSales = persona.department === 'sales';
  const isClaimant = order.claim?.claimedBy === persona.name || order.assignment?.assignedTo === persona.name;
  // Procurement must claim the order before pricing becomes accessible.
  const canAccessPricing = !isProcurement || isClaimant;
  const isConfirmed = order.status === 'official_quotation_generated'
    || order.status === 'deposit_paid'
    || order.status === 'deposit_confirmed'
    || order.status === 'payment_order_sent'
    || order.status === 'factory_payment_confirmed'
    || order.status === 'production_started'
    || order.status === 'ready_for_shipping'
    || order.status === 'shipped'
    || order.status === 'arrived'
    || order.status === 'delivered';
  const isEditable = !isConfirmed;

  const handleAddNote = () => {
    if (!noteTarget || !noteContent.trim()) return;
    const finalContent = noteTarget === ALL_PEOPLE ? noteContent.trim() : `🔒 ${noteContent.trim()}`;
    addNote(order.id, persona.name, persona.department, noteTarget, finalContent);
    setNoteTarget('');
    setNoteContent('');
    markNoteRead(order.id, persona.name);
  };
  const handleSubmitPricing = () => {
    const er = parseArabicNumber(exchangeRateInput) || parseArabicNumber(rates.rmb) || 1;
    const toRmb = (val: string, cur: 'RMB' | 'USD') => cur === 'USD' ? parseArabicNumber(val) * er : parseArabicNumber(val);
    const fp = toRmb(factoryPrice, itemCurrencies.factoryPrice);
    const ics = toRmb(internalChinaShipping, itemCurrencies.internalChinaShipping);
    const sc = toRmb(shippingCost, itemCurrencies.shippingCost);
    const mc = toRmb(miscCosts, itemCurrencies.miscCosts);
    const oc = toRmb(otherCosts, itemCurrencies.otherCosts);
    if (!fp || fp <= 0 || !er) return;
    // Resolve the target product: explicit selection, else first unpriced, else first.
    const targetProductId = pricingProductId
      || unpricedProducts(order)[0]?.id
      || order.products[0]?.id;
    if (!targetProductId) { alert('لا يوجد منتج لتسعيره.'); return; }
    const result = submitPricing(
      order.id,
      { productId: targetProductId, factoryPriceRMB: fp, shippingCostRMB: sc, internalChinaShippingRMB: ics, miscellaneousCostsRMB: mc, otherCostsRMB: oc, totalRMB: 0, exchangeRateUsed: er, totalUSD: 0, submittedBy: persona.name, currency: 'RMB' },
      { name: persona.name, role: persona.role, dept: persona.department },
    );
    if (!result.ok) {
      alert(`تعذّر تسجيل التسعير: ${result.error}`);
      return;
    }
    if (supplierName.trim() || supplierPhone.trim() || procurementNotes.trim()) {
      updateSupplierData(order.id, { factoryName: supplierName.trim(), factoryPhone: supplierPhone.trim(), procurementNotes: procurementNotes.trim() }, persona.name);
    }
    // Reset amount inputs and move to the next unpriced product (if any).
    const orderAfter = useOrderStore.getState().orders.find((o) => o.id === order.id);
    const nextUnpriced = orderAfter ? unpricedProducts(orderAfter) : [];
    setFactoryPrice('');
    setInternalChinaShipping('');
    setShippingCost('');
    setMiscCosts('');
    setOtherCosts('');
    if (nextUnpriced.length > 0) {
      setPricingProductId(nextUnpriced[0].id);
    } else {
      setShowPriceForm(false);
      setPricingProductId('');
    }
  };
  const handleMarkChange = () => { requestShippingMarkChange(order.id, persona.name, order.shippingMark, newMark.trim()); setShowMarkChange(false); };
  const handleArchiveOrder = () => {
    const reason = archiveReason.trim();
    if (!reason) return;
    const result = archiveOrder(order.id, persona.name, reason);
    if (!result.ok) {
      alert(`تعذّر أرشفة الطلب: ${result.error}`);
      return;
    }
    addLog(persona.name, persona.department, `🗄️ أرشفة الطلب #${order.orderNumber}`, reason);
    setConfirmDelete(false);
    setArchiveReason('');
  };
  // Build one proforma line per product from its latest pricing plus that
  // product's profit inputs. Products with no pricing yet are skipped.
  const computeProformaLines = (): ProformaLine[] => {
    if (!order) return [];
    const lines: ProformaLine[] = [];
    for (const p of order.products) {
      const lp = latestPricingForProduct(order, p.id);
      if (!lp) continue;
      const baseTotalRMB = lp.totalRMB;
      const baseTotalUSD = lp.totalUSD;
      const er = lp.exchangeRateUsed || 1;
      const pct = parseArabicNumber(proformaProfitPercent[p.id] || '');
      const fixed = parseArabicNumber(proformaProfitFixed[p.id] || '');
      const fixedRMB = proformaProfitCurrency === 'USD' ? fixed * er : fixed;
      const finalRMB = baseTotalRMB + (baseTotalRMB * pct / 100) + fixedRMB;
      const finalUSD = er > 0 ? +(finalRMB / er).toFixed(3) : 0;
      lines.push({
        productId: p.id,
        productName: p.productName,
        baseTotalRMB,
        baseTotalUSD,
        profitPercent: pct,
        profitFixed: fixed,
        profitFixedCurrency: proformaProfitCurrency,
        finalPriceRMB: +finalRMB.toFixed(3),
        finalPriceUSD: finalUSD,
      });
    }
    return lines;
  };

  const computeProformaFinals = () => {
    const lines = computeProformaLines();
    if (lines.length === 0) return null;
    const grandTotalRMB = +lines.reduce((s, l) => s + l.finalPriceRMB, 0).toFixed(3);
    const grandTotalUSD = +lines.reduce((s, l) => s + l.finalPriceUSD, 0).toFixed(3);
    return { lines, grandTotalRMB, grandTotalUSD };
  };

  const persistProforma = () => {
    const totals = computeProformaFinals();
    if (!totals) return null;
    const proforma = {
      lines: totals.lines,
      grandTotalRMB: totals.grandTotalRMB,
      grandTotalUSD: totals.grandTotalUSD,
      exportCurrency: proformaExportCurrency,
      template: proformaTemplate,
      submittedBy: persona.name,
    };
    const proformaResult = submitProforma(order.id, proforma, { name: persona.name, role: persona.role, dept: persona.department });
    if (!proformaResult.ok) {
      alert(`تعذّر إعداد عرض السعر: ${proformaResult.error}`);
      return null;
    }
    addLog(
      persona.name,
      persona.department,
      `📄 إصدار عرض سعر للطلب #${order.orderNumber} — العملة: ${proformaExportCurrency} — القالب: ${proformaTemplate}`,
      `عدد البنود: ${totals.lines.length} | الإجمالي: ${formatNumber(totals.grandTotalRMB)} RMB ($${formatNumber(totals.grandTotalUSD)})`,
    );
    return proforma;
  };

  const handleConfirmAndSend = (format: 'pdf' | 'xlsx') => {
    const saved = persistProforma();
    if (!saved) return;
    const payload = {
      order,
      proforma: { ...saved, submittedAt: new Date().toISOString() },
      currency: proformaExportCurrency,
      template: proformaTemplate,
      issuedBy: persona.name,
      companyName: 'MJ Group',
      companyTagline: 'MJ-DOS Enterprise Operating System',
    };
    try {
      if (format === 'pdf') {
        exportQuotationPDF(payload);
        addLog(persona.name, persona.department, `📤 تصدير عرض السعر PDF للطلب #${order.orderNumber}`, `العملة: ${payload.currency} — القالب: ${payload.template}`);
      } else {
        exportQuotationExcel(payload);
        addLog(persona.name, persona.department, `📤 تصدير عرض السعر Excel للطلب #${order.orderNumber}`, `العملة: ${payload.currency} — القالب: ${payload.template}`);
      }
      // After a successful PDF/Excel export, ensure the order status is
      // `quotation_presented` (معروض على العميل). Idempotent — no-op if the
      // proforma save already advanced it.
      useOrderStore.getState().transitionOrder(order.id, 'quotation_presented', {
        actor: { name: persona.name, role: persona.role, dept: persona.department },
      });
      // Modal intentionally stays open after a successful export. Closing is
      // exclusively driven by the header × or footer إغلاق buttons, so the
      // user can tweak inputs and re-export without reopening the dialog.
    } catch (err) {
      // The proforma is already persisted; only the file failed. Report and
      // leave the modal open so the user can retry — never trap them.
      alert(`تعذّر توليد الملف: ${(err as Error).message}`);
    }
  };
  const handleNegImageSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNegImageFile(file);
    setNegImagePreview(URL.createObjectURL(file));
  };
  const handleNegMessageWithImage = () => {
    if (!negotiationMsg.trim() && !negImageFile) return;
    const msg = negotiationMsg.trim() || '(صورة)';
    requestInfo(order.id, persona.name, persona.department, msg);
    if (negImageFile) {
      addDocument(order.id, negImageFile.name, 'attachment', URL.createObjectURL(negImageFile), persona.name);
    }
    setNegotiationMsg('');
    setNegImageFile(null);
    setNegImagePreview(null);
  };
  const handleReply = (noteId: string) => {
    const content = replyInputs[noteId]?.trim();
    if (!content) return;
    replyToNote(order.id, noteId, persona.name, persona.department, content);
    setReplyInputs(prev => ({ ...prev, [noteId]: '' }));
  };

  // Single-next-action dispatch driven by the workflow engine.
  const nextAction = getNextAction(order, persona.name, persona.department as Department);
  const {
    sendPaymentOrder, markProductionStarted, markReadyForShipping,
    markShipped, markArrived, markDelivered,
  } = useOrderStore.getState();

  const runWorkflowAction = (actionKey: WorkflowActionKey) => {
    const actor = { name: persona.name, role: persona.role, dept: persona.department };
    // Actions that require a data-entry modal are intercepted here — the
    // modal itself calls the store on success. Direct-transition actions
    // dispatch through the switch below.
    if (actionKey === 'generateOfficialQuotation') {
      setInvoiceNotes(order.officialInvoice?.notes || DEFAULT_INVOICE_NOTES);
      setShowInvoicePreview(true);
      return;
    }
    if (actionKey === 'recordDepositPaid') {
      // Fresh form each open.
      setDepositAmount('');
      setDepositCurrency(order.proforma?.exportCurrency || 'USD');
      setDepositMethod('cash_office');
      setDepositCustomMethod('');
      setDepositDate(new Date().toISOString().slice(0, 10));
      setDepositAttachment(null);
      setShowDepositForm(true);
      return;
    }
    if (actionKey === 'confirmDeposit') {
      setShowReturnDeposit(false);
      setReturnDepositReason('');
      setShowConfirmDeposit(true);
      return;
    }
    if (actionKey === 'confirmFactoryPayment') {
      setShowConfirmFactoryPayment(true);
      return;
    }
    let result;
    switch (actionKey) {
      case 'sendPaymentOrder':          result = sendPaymentOrder(order.id, actor); break;
      case 'markProductionStarted':     result = markProductionStarted(order.id, actor); break;
      case 'markReadyForShipping':      result = markReadyForShipping(order.id, actor); break;
      case 'markShipped':               result = markShipped(order.id, actor); break;
      case 'markArrived':               result = markArrived(order.id, actor); break;
      case 'markDelivered':             result = markDelivered(order.id, actor); break;
      default: return; // claim / submitPricing / presentQuotation / rejectPricing / returnDeposit have their own UI
    }
    if (!result.ok) {
      alert(`تعذّر تنفيذ الانتقال: ${result.error}`);
      return;
    }
    addLog(persona.name, persona.department, `➡️ تنفيذ ${actionKey} للطلب #${order.orderNumber}`, `${nextAction.forward?.from} → ${nextAction.forward?.to}`);
  };

  const diff = Date.now() - new Date(order.createdAt.replace(' ', 'T')).getTime();
  const totalSec = Math.max(0, Math.floor(diff / 1000));
  const ageH = Math.floor(totalSec / 3600);
  const ageM = Math.floor((totalSec % 3600) / 60);
  const ageS = totalSec % 60;

  const er = parseArabicNumber(exchangeRateInput) || parseArabicNumber(rates.rmb) || 1;
  const toRmb2 = (val: string, cur: 'RMB' | 'USD') => cur === 'USD' ? parseArabicNumber(val) * er : parseArabicNumber(val);
  const totalRmb = toRmb2(factoryPrice, itemCurrencies.factoryPrice)
    + toRmb2(internalChinaShipping, itemCurrencies.internalChinaShipping)
    + toRmb2(shippingCost, itemCurrencies.shippingCost)
    + toRmb2(miscCosts, itemCurrencies.miscCosts)
    + toRmb2(otherCosts, itemCurrencies.otherCosts);
  const totalUsd = er > 0 ? +(totalRmb / er).toFixed(3) : 0;

  return (
    <div className="ow-screen">
      {/* الشريط العلوي — بيانات الطلب في سطر واحد */}
      <OrderTopBar order={order} isProcurement={isProcurement} isEditable={isEditable} ageH={ageH} ageM={ageM} ageS={ageS} onEditMark={() => setShowMarkChange(true)} />

      {showMarkChange && isEditable && (
        <ShippingMarkEditor newMark={newMark} onMarkChange={setNewMark} onSave={handleMarkChange} onCancel={() => { setShowMarkChange(false); setNewMark(''); }} />
      )}

      <WorkflowBar
        order={order}
        persona={persona}
        isProcurement={isProcurement}
        onWorkflowAction={runWorkflowAction}
        onOpenFactoryPayment={() => {
          if (order.factoryPayment) {
            setFactoryPayAmount(String(order.factoryPayment.amount));
            setFactoryPayCurrency(order.factoryPayment.currency);
            setFactoryPayMethod(order.factoryPayment.paymentMethod);
            setFactoryPayReference(order.factoryPayment.reference || '');
            setFactoryPayNote(order.factoryPayment.note || '');
          } else {
            setFactoryPayAmount('');
            setFactoryPayCurrency('RMB');
            setFactoryPayMethod('rmb_jasmine');
            setFactoryPayReference('');
            setFactoryPayNote('');
          }
          setFactoryPayAttachment(null);
          setShowFactoryPaymentForm(true);
        }}
      />

      {isConfirmed && <ConfirmedOrderWarning />}

      <RejectPricingDialog isOpen={showRejectDialog} reason={rejectReason} onReasonChange={setRejectReason} onReject={() => { const reason = rejectReason.trim(); if (!reason) return; rejectPricing(order.id, persona.name, persona.department, reason); addLog(persona.name, persona.department, `❌ رفض التسعير للطلب #${order.orderNumber}`, reason.slice(0, 120)); setShowRejectDialog(false); setRejectReason(''); }} onClose={() => { setShowRejectDialog(false); setRejectReason(''); }} />

      <ArchiveConfirmDialog isOpen={confirmDelete} orderNumber={order.orderNumber} reason={archiveReason} onReasonChange={setArchiveReason} onArchive={handleArchiveOrder} onClose={() => { setConfirmDelete(false); setArchiveReason(''); }} />

      {order.archivedAt && <ArchivedOrderBanner archivedAt={order.archivedAt} archivedBy={order.archivedBy} archiveReason={order.archiveReason} />}

      {/* التبويبات الموحدة */}
      <OrderDetailsTabs
        order={order}
        activeSection={activeSection}
        onTabChange={(tab) => {
          if (tab === 'pricing' && !canAccessPricing) return;
          setActiveSection(tab);
        }}
        onArchive={() => setConfirmDelete(true)}
        canAccessPricing={canAccessPricing}
      />

      {activeSection === 'info' && <OrderInfoPanel order={order} isSales={isSales} isProcurement={isProcurement} showSupplier={showSupplier} latestPricing={latestPricing} />}

      {activeSection === 'timeline' && <OrderTimelinePanel order={order} />}

      {/* التسعير — فورم التسعير المباشر + سجل الأسعار */}
      {activeSection === 'pricing' && !canAccessPricing && (
        <div className="ow-notes-empty" style={{ padding: 32, textAlign: 'center' }}>
          🔒 التسعير متاح فقط بعد استلام الطلب من قبل موظف المشتريات المسؤول.
        </div>
      )}
      {activeSection === 'pricing' && canAccessPricing && (
        <>
          {isProcurement && !showPriceForm && (
            <button className="add-price-btn" onClick={() => setShowPriceForm(true)}>💰 تسعير</button>
          )}
          {isSales && (order.status === 'pricing_completed' || order.status === 'quotation_presented') && allProductsPriced(order) && (
            <div className="ow-pricing-approval-bar">
              <div className="ow-pricing-approval-summary">
                <span className="ow-pricing-approval-label">📋 إجمالي التسعير ({order.products.length} منتج):</span>
                <span className="ow-pricing-approval-value">${formatNumber(orderBaseTotals(order).usd)} ({formatNumber(orderBaseTotals(order).rmb)} RMB)</span>
              </div>
              <div className="ow-pricing-approval-actions">
                <button className="ow-pricing-reject-btn" onClick={() => setShowRejectDialog(true)}>❌ رفض التسعير — إعادة إلى المشتريات</button>
                {/* Reopen re-enabled — the OLD modal design supports repeatedly
                    closing and reopening. The button label swaps between the
                    first-time and reopen cases. */}
                <button className="ow-quotation-btn" onClick={() => setShowProforma(true)}>
                  {order.proforma ? '📄 إعادة فتح عرض السعر' : '📄 إعداد عرض السعر للعميل'}
                </button>
              </div>
            </div>
          )}
          {showPriceForm && (
            <div className="ow-pricing-form" style={{ marginTop: 16 }}>
              <div className="ow-pricing-form-title">💰 إدخال تسعيرة جديدة</div>
              <div className="ow-pricing-form-row">
                <div className="ow-pricing-form-group">
                  <label className="ow-pricing-form-label">المنتج المُسعّر <span className="req">*</span></label>
                  <select
                    className="ow-pricing-form-input"
                    value={pricingProductId || unpricedProducts(order)[0]?.id || order.products[0]?.id || ''}
                    onChange={(e) => setPricingProductId(e.target.value)}
                  >
                    {order.products.map((p, i) => {
                      const priced = pricingForProduct(order, p.id).length > 0;
                      return (
                        <option key={p.id} value={p.id}>
                          {i + 1}. {p.productName} {priced ? '✓ (مُسعّر — تحديث)' : '— بانتظار التسعير'}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
              <div className="ow-pricing-form-row">
                <div className="ow-pricing-form-group" style={{ maxWidth: 250 }}>
                  <label className="ow-pricing-form-label">سعر الصرف (USD → RMB)</label>
                  <input className={`ow-pricing-form-input ow-exrate-field ${isProcurement ? 'ow-exrate-readonly' : ''}`} type="text" inputMode="decimal" value={exchangeRateInput || rates.rmb || '6.7'} onChange={(e) => { if (!isProcurement) setExchangeRateInput(e.target.value); }} placeholder={rates.rmb || '6.7'} readOnly={isProcurement} />
                </div>
              </div>
              <div className="ow-pricing-form-row">
                <div className="ow-pricing-form-group">
                  <label className="ow-pricing-form-label">السعر الأساسي</label>
                  <div className="ow-pricing-currency-group">
                    <input className="ow-pricing-form-input ow-pricing-amount-input" type="text" inputMode="decimal" value={factoryPrice} onChange={(e) => setFactoryPrice(e.target.value)} placeholder="0" min="0" />
                    <select className="ow-pricing-currency-select-sm" value={itemCurrencies.factoryPrice} onChange={(e) => setItemCurrencies(prev => ({ ...prev, factoryPrice: e.target.value as 'RMB' | 'USD' }))}>
                      <option value="RMB">¥</option><option value="USD">$</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="ow-pricing-form-row">
                <div className="ow-pricing-form-group">
                  <label className="ow-pricing-form-label">شحن داخلي (الصين)</label>
                  <div className="ow-pricing-currency-group">
                    <input className="ow-pricing-form-input ow-pricing-amount-input" type="text" inputMode="decimal" value={internalChinaShipping} onChange={(e) => setInternalChinaShipping(e.target.value)} placeholder="0" min="0" />
                    <select className="ow-pricing-currency-select-sm" value={itemCurrencies.internalChinaShipping} onChange={(e) => setItemCurrencies(prev => ({ ...prev, internalChinaShipping: e.target.value as 'RMB' | 'USD' }))}>
                      <option value="RMB">¥</option><option value="USD">$</option>
                    </select>
                  </div>
                </div>
                <div className="ow-pricing-form-group">
                  <label className="ow-pricing-form-label">شحن خارجي</label>
                  <div className="ow-pricing-currency-group">
                    <input className="ow-pricing-form-input ow-pricing-amount-input" type="text" inputMode="decimal" value={shippingCost} onChange={(e) => setShippingCost(e.target.value)} placeholder="0" min="0" />
                    <select className="ow-pricing-currency-select-sm" value={itemCurrencies.shippingCost} onChange={(e) => setItemCurrencies(prev => ({ ...prev, shippingCost: e.target.value as 'RMB' | 'USD' }))}>
                      <option value="RMB">¥</option><option value="USD">$</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="ow-pricing-form-row">
                <div className="ow-pricing-form-group">
                  <label className="ow-pricing-form-label">مصاريف</label>
                  <div className="ow-pricing-currency-group">
                    <input className="ow-pricing-form-input ow-pricing-amount-input" type="text" inputMode="decimal" value={miscCosts} onChange={(e) => setMiscCosts(e.target.value)} placeholder="0" min="0" />
                    <select className="ow-pricing-currency-select-sm" value={itemCurrencies.miscCosts} onChange={(e) => setItemCurrencies(prev => ({ ...prev, miscCosts: e.target.value as 'RMB' | 'USD' }))}>
                      <option value="RMB">¥</option><option value="USD">$</option>
                    </select>
                  </div>
                </div>
                <div className="ow-pricing-form-group">
                  <label className="ow-pricing-form-label">مصاريف أخرى</label>
                  <div className="ow-pricing-currency-group">
                    <input className="ow-pricing-form-input ow-pricing-amount-input" type="text" inputMode="decimal" value={otherCosts} onChange={(e) => setOtherCosts(e.target.value)} placeholder="0" min="0" />
                    <select className="ow-pricing-currency-select-sm" value={itemCurrencies.otherCosts} onChange={(e) => setItemCurrencies(prev => ({ ...prev, otherCosts: e.target.value as 'RMB' | 'USD' }))}>
                      <option value="RMB">¥</option><option value="USD">$</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="ow-pricing-form-row">
                <div className="ow-pricing-form-group">
                  <label className="ow-pricing-form-label">اسم المعمل</label>
                  <input className="ow-pricing-form-input" type="text" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="اسم المعمل" />
                </div>
                <div className="ow-pricing-form-group">
                  <label className="ow-pricing-form-label">رقم هاتف المعمل</label>
                  <input className="ow-pricing-form-input" type="text" value={supplierPhone} onChange={(e) => setSupplierPhone(e.target.value)} placeholder="رقم الهاتف" />
                </div>
              </div>
              <div className="ow-pricing-form-row">
                <div className="ow-pricing-form-group">
                  <label className="ow-pricing-form-label">ملاحظات المشتريات</label>
                  <textarea className="ow-pricing-form-textarea" value={procurementNotes} onChange={(e) => setProcurementNotes(e.target.value)} placeholder="أي ملاحظات إضافية..." rows={3} />
                </div>
              </div>
              <div className="ow-pricing-form-total">
                <span className="ow-pricing-form-total-label">الإجمالي النهائي:</span>
                <span className="ow-pricing-form-total-value">¥ {formatNumber(totalRmb)} RMB</span>
                <span className="ow-pricing-form-total-sep">|</span>
                <span className="ow-pricing-form-total-value">$ {formatNumber(totalUsd)} USD</span>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                <button className="ow-pricing-form-save" onClick={handleSubmitPricing} disabled={!factoryPrice || parseArabicNumber(factoryPrice) <= 0}>💾 حفظ التسعير</button>
                <button className="ow-pricing-cancel-btn" onClick={() => { setShowPriceForm(false); setFactoryPrice(''); setShippingCost(''); setInternalChinaShipping(''); setMiscCosts(''); setOtherCosts(''); setSupplierName(''); setSupplierPhone(''); setProcurementNotes(''); }}>إلغاء</button>
              </div>
            </div>
          )}
          <PricingTab order={order} currentUser={persona} />
        </>
      )}

      {/* التفاوض — غرفة محادثة عامة (نصوص + صور فقط) */}
      {activeSection === 'negotiation' && (
        <NegotiationPanel
          order={order}
          negotiationMsg={negotiationMsg}
          onNegotiationMsgChange={setNegotiationMsg}
          negImageFile={negImageFile}
          negImagePreview={negImagePreview}
          onImageSelect={handleNegImageSelect}
          onRemoveImage={() => { setNegImageFile(null); setNegImagePreview(null); }}
          onSendMessage={handleNegMessageWithImage}
          fileInputRef={fileInputRef}
        />
      )}

      {/* الملاحظات السرية — رسائل موجهة مع خيار الجميع وسلاسل الرد */}
      {activeSection === 'notes' && (
        <NotesPanel
          order={order}
          persona={persona}
          noteTarget={noteTarget}
          noteContent={noteContent}
          replyInputs={replyInputs}
          onTargetChange={setNoteTarget}
          onContentChange={setNoteContent}
          onReplyInputChange={(noteId, val) => setReplyInputs(prev => ({ ...prev, [noteId]: val }))}
          onSendNote={handleAddNote}
          onReply={handleReply}
        />
      )}

      <ProformaModal
        isOpen={showProforma}
        order={order}
        lines={computeProformaLines()}
        isProcurement={isProcurement}
        profitPercent={proformaProfitPercent}
        profitFixed={proformaProfitFixed}
        profitCurrency={proformaProfitCurrency}
        exportCurrency={proformaExportCurrency}
        template={proformaTemplate}
        onProfitPercentChange={(productId, val) => setProformaProfitPercent((prev) => ({ ...prev, [productId]: val }))}
        onProfitFixedChange={(productId, val) => setProformaProfitFixed((prev) => ({ ...prev, [productId]: val }))}
        onProfitCurrencyChange={setProformaProfitCurrency}
        onExportCurrencyChange={setProformaExportCurrency}
        onTemplateChange={setProformaTemplate}
        onConfirmAndSend={handleConfirmAndSend}
        onExportOfficialInvoice={() => runWorkflowAction('generateOfficialQuotation')}
        onClose={closeProforma}
      />

      <InvoicePreviewModal
        isOpen={showInvoicePreview}
        order={order}
        persona={persona}
        notes={invoiceNotes}
        isExporting={invoiceExporting}
        onNotesChange={setInvoiceNotes}
        onExport={(format) => {
          if (invoiceExporting) return;
          const actor = { name: persona.name, role: persona.role, dept: persona.department };
          const proforma = order.proforma!;
          const invoiceNumber = `INV-${order.orderNumber}-${Date.now().toString().slice(-6)}`;
          const payload = {
            order,
            proforma,
            currency: proforma.exportCurrency || 'USD',
            template: proforma.template || 1,
            issuedBy: persona.name,
            companyName: 'MJ Group',
            companyTagline: `فاتورة رسمية — ${invoiceNumber}`,
            invoiceNotes: invoiceNotes.trim(),
            invoiceNumber,
          };
          setInvoiceExporting(true);
          try {
            try {
              if (format === 'pdf') exportQuotationPDF(payload);
              else exportQuotationExcel(payload);
            } catch (err) {
              alert(`فشل توليد الملف — لم يتم تغيير حالة الطلب: ${(err as Error).message}`);
              return;
            }
            const result = useOrderStore.getState().generateOfficialQuotation(
              order.id,
              { invoiceNumber, notes: invoiceNotes.trim(), exportCurrency: proforma.exportCurrency || 'USD', exportedFormat: format },
              actor,
            );
            if (!result.ok) {
              alert(`تم توليد الملف، لكن تعذّر حفظ الفاتورة رسمياً: ${result.error}`);
              return;
            }
            addLog(persona.name, persona.department, `🧾 إصدار الفاتورة الرسمية ${invoiceNumber} (${format.toUpperCase()}) للطلب #${order.orderNumber}`, invoiceNotes.trim().slice(0, 120));
            closeInvoicePreview();
          } finally {
            setInvoiceExporting(false);
          }
        }}
        onClose={closeInvoicePreview}
      />

      <DepositRecordForm
        isOpen={showDepositForm}
        amount={depositAmount}
        currency={depositCurrency}
        method={depositMethod}
        customMethod={depositCustomMethod}
        date={depositDate}
        attachment={depositAttachment}
        onAmountChange={setDepositAmount}
        onCurrencyChange={(val) => setDepositCurrency(val as QuotationCurrency)}
        onMethodChange={(val) => setDepositMethod(val as import('../types').DepositPaymentMethod)}
        onCustomMethodChange={setDepositCustomMethod}
        onDateChange={setDepositDate}
        onAttachmentChange={setDepositAttachment}
        onSave={() => {
          const amount = parseArabicNumber(depositAmount);
          const actor = { name: persona.name, role: persona.role, dept: persona.department };
          const attachment = depositAttachment ? { name: depositAttachment.name, url: URL.createObjectURL(depositAttachment), mimeType: depositAttachment.type, size: depositAttachment.size } : undefined;
          const result = useOrderStore.getState().recordDepositPaid(
            order.id,
            { amount, currency: depositCurrency, paymentMethod: depositMethod, customPaymentMethod: depositMethod === 'other' ? depositCustomMethod.trim() : undefined, paymentDate: depositDate, attachment },
            actor,
          );
          if (!result.ok) { alert(`تعذّر حفظ العربون: ${result.error}`); return; }
          addLog(persona.name, persona.department, `💵 تسجيل عربون للطلب #${order.orderNumber}`, `${amount} ${depositCurrency}`);
          setShowDepositForm(false);
        }}
        onClose={closeDepositForm}
      />

      <DepositConfirmDialog
        isOpen={showConfirmDeposit}
        order={order}
        persona={persona}
        confirmNote={confirmNote}
        confirmAttachment={confirmAttachment}
        showReturn={showReturnDeposit}
        returnReason={returnDepositReason}
        onConfirmNoteChange={setConfirmNote}
        onConfirmAttachmentChange={setConfirmAttachment}
        onToggleReturn={() => { setShowReturnDeposit(true); }}
        onReturnReasonChange={setReturnDepositReason}
        onConfirm={() => {
          const actor = { name: persona.name, role: persona.role, dept: persona.department };
          const d = order.customerDeposit!;
          const result = useOrderStore.getState().confirmDeposit(order.id, {
            confirmedBy: persona.name, amount: d.amount, currency: d.currency, reference: d.paymentMethod, confirmedAt: '', note: confirmNote.trim() || undefined, attachment: confirmAttachment ? { name: confirmAttachment.name, url: URL.createObjectURL(confirmAttachment) } : undefined,
          }, actor);
          if (!result.ok) { alert(`تعذّر تأكيد العربون: ${result.error}`); return; }
          addLog(persona.name, persona.department, `💳 تأكيد العربون للطلب #${order.orderNumber}`, `${d.amount} ${d.currency}`);
          setShowConfirmDeposit(false);
        }}
        onReturn={() => {
          const actor = { name: persona.name, role: persona.role, dept: persona.department };
          const result = useOrderStore.getState().returnDeposit(order.id, actor, returnDepositReason.trim());
          if (!result.ok) { alert(`تعذّر الإعادة: ${result.error}`); return; }
          addLog(persona.name, persona.department, `↩ إعادة العربون للتصحيح للطلب #${order.orderNumber}`, returnDepositReason.slice(0, 120));
          setShowConfirmDeposit(false);
          setShowReturnDeposit(false);
          setReturnDepositReason('');
        }}
        onClose={closeConfirmDeposit}
      />

      <FactoryPaymentForm
        isOpen={showFactoryPaymentForm}
        amount={factoryPayAmount}
        currency={factoryPayCurrency}
        method={factoryPayMethod}
        reference={factoryPayReference}
        note={factoryPayNote}
        attachment={factoryPayAttachment}
        onAmountChange={setFactoryPayAmount}
        onCurrencyChange={setFactoryPayCurrency}
        onMethodChange={(val) => setFactoryPayMethod(val as import('../types').FactoryPaymentMethod)}
        onReferenceChange={setFactoryPayReference}
        onNoteChange={setFactoryPayNote}
        onAttachmentChange={setFactoryPayAttachment}
        onSave={() => {
          const amount = parseArabicNumber(factoryPayAmount);
          const actor = { name: persona.name, role: persona.role, dept: persona.department };
          const attachment = factoryPayAttachment ? { name: factoryPayAttachment.name, url: URL.createObjectURL(factoryPayAttachment), mimeType: factoryPayAttachment.type, size: factoryPayAttachment.size } : undefined;
          const result = useOrderStore.getState().recordFactoryPayment(order.id, { amount, currency: factoryPayCurrency, paymentMethod: factoryPayMethod, reference: factoryPayReference.trim() || undefined, note: factoryPayNote.trim() || undefined, attachment }, actor);
          if (!result.ok) { alert(`تعذّر حفظ دفع المعمل: ${result.error}`); return; }
          addLog(persona.name, persona.department, `🏭 تسجيل دفع المعمل للطلب #${order.orderNumber}`, `${amount} ${factoryPayCurrency}`);
          setShowFactoryPaymentForm(false);
        }}
        onClose={closeFactoryPayForm}
      />

      <FactoryPaymentConfirmDialog
        isOpen={showConfirmFactoryPayment}
        order={order}
        persona={persona}
        onConfirm={() => {
          const actor = { name: persona.name, role: persona.role, dept: persona.department };
          const result = useOrderStore.getState().confirmFactoryPayment(order.id, actor);
          if (!result.ok) { alert(`تعذّر التأكيد: ${result.error}`); return; }
          addLog(persona.name, persona.department, `✅ تأكيد دفع المعمل للطلب #${order.orderNumber}`, `${order.factoryPayment!.amount} ${order.factoryPayment!.currency}`);
          setShowConfirmFactoryPayment(false);
        }}
        onClose={closeConfirmFactoryPay}
      />
    </div>
  );
}
