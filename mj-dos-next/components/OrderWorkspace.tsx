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
import { formatNumber } from '../utils/formatNumber';
import { useModal } from '../hooks/useModal';
import type { QuotationCurrency, QuotationTemplate, Department, Order } from '../types';

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
  const [proformaProfitPercent, setProformaProfitPercent] = useState('');
  const [proformaProfitFixed, setProformaProfitFixed] = useState('');
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

  // TEMP DIAGNOSTIC — proforma modal freeze investigation. All [PROFORMA_DEBUG]
  // logs and refs below are diagnostic-only; delete this block after diagnosis.
  const proformaDebugRenderCountRef = useRef(0);
  const proformaDebugRenderTimestampsRef = useRef<number[]>([]);
  const proformaDebugLoopReportedRef = useRef(false);

  // Single close handler per modal — reused by the header X button, the
  // footer Cancel/Close button, the overlay-backdrop click, and the ESC key.
  // Close never mutates order data, status, workflow history, or export
  // records; it purely toggles the local modal state and clears form drafts.
  const closeProforma        = () => { console.log(`[PROFORMA_DEBUG] closeProforma() invoked at ${new Date().toISOString()}`); setShowProforma(false); };
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
  useModal(showProforma,               closeProforma, { debugTag: 'proforma' });
  useModal(showRejectDialog,           closeReject);
  useModal(confirmDelete,              closeArchive);
  useModal(showMarkChange,             closeMarkChange);
  useModal(showInvoicePreview,         closeInvoicePreview, { locked: invoiceExporting });
  useModal(showDepositForm,            closeDepositForm);
  useModal(showConfirmDeposit,         closeConfirmDeposit);
  useModal(showFactoryPaymentForm,     closeFactoryPayForm);
  useModal(showConfirmFactoryPayment,  closeConfirmFactoryPay);

  // TEMP DIAGNOSTIC — log every showProforma transition (open/close) and
  // reset the modal-render counter each time the modal opens so per-open
  // POSSIBLE_RENDER_LOOP counts are meaningful.
  useEffect(() => {
    if (showProforma) {
      proformaDebugRenderCountRef.current = 0;
      proformaDebugRenderTimestampsRef.current = [];
      proformaDebugLoopReportedRef.current = false;
      console.log(`[PROFORMA_DEBUG] showProforma -> TRUE  (modal OPENED) at ${new Date().toISOString()}`);
    } else {
      console.log(`[PROFORMA_DEBUG] showProforma -> FALSE (modal CLOSED) at ${new Date().toISOString()}`);
    }
  }, [showProforma]);

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
    console.log(`[PROFORMA_DEBUG] seed useEffect START showProforma=${showProforma} hasOrder=${!!order} hasProforma=${!!order?.proforma}`);
    if (!showProforma || !order) {
      console.log('[PROFORMA_DEBUG] seed useEffect END (skipped: modal closed or no order)');
      return;
    }
    // REOPEN_PROFORMA_DISABLED: seeding from an existing proforma is disabled while the
    // reopen feature is off. To re-enable, remove this guard and restore the original body below.
    if (order.proforma) {
      console.log('[PROFORMA_DEBUG] seed useEffect END (seed disabled: existing proforma present)');
      return;
    }
    // Original seed body (kept for reference; runs only when no existing proforma):
    // const existing = order.proforma;
    // if (existing) {
    //   setProformaProfitPercent(existing.profitPercent ? String(existing.profitPercent) : '');
    //   setProformaProfitFixed(existing.profitFixed ? String(existing.profitFixed) : '');
    //   setProformaProfitCurrency(existing.profitFixedCurrency || 'RMB');
    //   setProformaExportCurrency(existing.exportCurrency || 'USD');
    //   setProformaTemplate(existing.template || 1);
    // }
    console.log('[PROFORMA_DEBUG] seed useEffect END');
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
    const result = submitPricing(
      order.id,
      { factoryPriceRMB: fp, shippingCostRMB: sc, internalChinaShippingRMB: ics, miscellaneousCostsRMB: mc, otherCostsRMB: oc, totalRMB: 0, exchangeRateUsed: er, totalUSD: 0, submittedBy: persona.name, currency: 'RMB' },
      { name: persona.name, role: persona.role, dept: persona.department },
    );
    if (!result.ok) {
      alert(`تعذّر تسجيل التسعير: ${result.error}`);
      return;
    }
    if (supplierName.trim() || supplierPhone.trim() || procurementNotes.trim()) {
      updateSupplierData(order.id, { factoryName: supplierName.trim(), factoryPhone: supplierPhone.trim(), procurementNotes: procurementNotes.trim() }, persona.name);
    }
    setShowPriceForm(false);
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
  const computeProformaFinals = () => {
    if (!latestPricing) return null;
    const baseTotalRMB = latestPricing.totalRMB;
    const baseTotalUSD = latestPricing.totalUSD;
    const er = latestPricing.exchangeRateUsed || 1;
    const pct = parseArabicNumber(proformaProfitPercent);
    const fixed = parseArabicNumber(proformaProfitFixed);
    const fixedRMB = proformaProfitCurrency === 'USD' ? fixed * er : fixed;
    const finalRMB = baseTotalRMB + (baseTotalRMB * pct / 100) + fixedRMB;
    const finalUSD = er > 0 ? +(finalRMB / er).toFixed(3) : 0;
    return { baseTotalRMB, baseTotalUSD, pct, fixed, finalRMB: +finalRMB.toFixed(3), finalUSD };
  };

  const persistProforma = () => {
    const totals = computeProformaFinals();
    if (!totals) return null;
    const proforma = {
      baseTotalRMB: totals.baseTotalRMB,
      baseTotalUSD: totals.baseTotalUSD,
      profitPercent: totals.pct,
      profitFixed: totals.fixed,
      profitFixedCurrency: proformaProfitCurrency,
      finalPriceRMB: totals.finalRMB,
      finalPriceUSD: totals.finalUSD,
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
      `الإجمالي: ${formatNumber(totals.finalRMB)} RMB ($${formatNumber(totals.finalUSD)})`,
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
  const pad = (n: number) => String(n).padStart(2, '0');

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
      <div className="ow-top-bar">
        <div className="ow-top-item">
          <span className="ow-top-label">{isProcurement ? 'رقم الطلب' : 'العميل'}</span>
          <span className="ow-top-value">{isProcurement ? `#${order.orderNumber}` : order.clientName}</span>
        </div>
        <div className="ow-top-divider" />
        <div className="ow-top-item">
          <span className="ow-top-label">الشيبينغ مارك</span>
          <span className="ow-top-value ow-top-mark">
            {order.shippingMark}-{order.shippingMarkSerial}
            {isEditable ? (
              <button className="ow-mark-edit-btn-sm" onClick={() => setShowMarkChange(true)} title="تعديل">✏️</button>
            ) : (
              <span className="ow-mark-locked-icon" title="مؤمنة">🔒</span>
            )}
          </span>
        </div>
        {!isProcurement && <><div className="ow-top-divider" />
        <div className="ow-top-item">
          <span className="ow-top-label">رقم الطلب</span>
          <span className="ow-top-value ow-top-num">#{order.orderNumber}</span>
        </div></>}
        <div className="ow-top-divider" />
        <div className="ow-top-item">
          <span className="ow-top-label">الحالة</span>
          <span className={`ow-status-badge status-${order.status}`}>{statusLabel(order.status)}</span>
        </div>
        <div className="ow-top-divider" />
        <div className="ow-top-item">
          <span className="ow-top-label">عمر الطلب</span>
          <span className="ow-top-value ow-top-age">⏱ {pad(ageH)}:{pad(ageM)}:{pad(ageS)}</span>
        </div>
        <div className="ow-top-divider" />
        <div className="ow-top-item">
          <span className="ow-top-label">تاريخ الإنشاء</span>
          <span className="ow-top-value ow-top-date">{order.createdAt}</span>
        </div>
      </div>

      {showMarkChange && isEditable && (
        <div className="ow-mark-change-form">
          <input className="ow-mark-input" type="text" value={newMark} onChange={(e) => setNewMark(e.target.value)} placeholder="أدخل العلامة الجديدة" />
          <button className="ow-mark-submit" onClick={handleMarkChange} disabled={!newMark.trim()}>💾 حفظ</button>
          <button className="ow-mark-cancel" onClick={() => { setShowMarkChange(false); setNewMark(''); }}>إلغاء</button>
        </div>
      )}

      {/* Workflow next-action bar — enforced state machine. Only the single valid next step is exposed. */}
      {(() => {
        const forward = nextAction.forward;
        const lastTransition = order.workflowHistory && order.workflowHistory.length > 0
          ? order.workflowHistory[order.workflowHistory.length - 1]
          : null;
        return (
          <div className="ow-workflow-bar">
            <div className="ow-workflow-status">
              <span className="ow-workflow-status-label">الحالة الحالية:</span>
              <span className="ow-workflow-status-value">{statusLabel(order.status)}</span>
              {lastTransition && (
                <span className="ow-workflow-last-change">
                  آخر تغيير: {lastTransition.actorName} — {lastTransition.date} {lastTransition.time}
                </span>
              )}
            </div>
            <div className="ow-workflow-actions">
              {!forward && (
                <span className="ow-workflow-terminal">🏁 وصل الطلب إلى نهاية سير العمل — لا توجد خطوة تالية.</span>
              )}
              {forward && !nextAction.forwardAuthorized && (
                <span className="ow-workflow-locked">
                  ⏳ الخطوة التالية <strong>{STATUS_LABELS[forward.to]}</strong> — تنفَّذ من قبل: {forward.allowedDepartments.map(d => ({sales:'المبيعات',procurement:'المشتريات',accounting:'الحسابات',executive:'الإدارة العليا'}[d])).join(' / ')}
                </span>
              )}
              {forward && nextAction.forwardAuthorized && (
                (() => {
                  // Some actions have their own dedicated UI elsewhere in the workspace.
                  // Only render a workflow-bar button for stages 6→15 that don't already have one.
                  const inlineOwnedActions: WorkflowActionKey[] = ['claim', 'submitPricing', 'presentQuotation'];
                  if (inlineOwnedActions.includes(forward.action)) {
                    return (
                      <span className="ow-workflow-hint">
                        الخطوة التالية <strong>{STATUS_LABELS[forward.to]}</strong> — استخدم زر «{forward.labelAr}» في القسم المخصص.
                      </span>
                    );
                  }
                  const disabled = !nextAction.forwardEnabled;
                  // Procurement Manager receives the "أمر دفع عربون للمعمل"
                  // directive at deposit_confirmed. Her button re-labels the
                  // sendPaymentOrder transition to reflect the factory-side
                  // confirmation semantics.
                  const isProcurementManager =
                    isProcurement && persona.role === 'مديرة المشتريات';
                  const useFactoryConfirmLabel =
                    isProcurementManager
                    && order.status === 'deposit_confirmed'
                    && forward.action === 'sendPaymentOrder';
                  return (
                    <button
                      className="ow-workflow-next-btn"
                      onClick={() => runWorkflowAction(forward.action)}
                      disabled={disabled}
                      title={disabled ? nextAction.forwardDisabledReason : `${forward.labelEn}`}
                    >
                      {useFactoryConfirmLabel
                        ? `✅ تأكيد دفع العربون للمعمل ⟶ ${STATUS_LABELS[forward.to]}`
                        : `${forward.labelAr} ⟶ ${STATUS_LABELS[forward.to]}`}
                    </button>
                  );
                })()
              )}
              {/* Procurement-only intra-status action: record factory payment
                  while status remains payment_order_sent. Accounting will
                  verify next; this button never changes status itself. */}
              {order.status === 'payment_order_sent' && isProcurement && (order.claim?.claimedBy === persona.name || order.assignment?.assignedTo === persona.name || persona.name === 'كنانة') && (
                <button
                  className="ow-workflow-next-btn"
                  style={{ background: '#0f766e' }}
                  onClick={() => {
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
                >
                  🏭 {order.factoryPayment ? 'تعديل دفع المعمل' : 'تسجيل دفع المعمل'}
                </button>
              )}
              {nextAction.backward.map((b) => (
                <span key={b.action + b.to} className="ow-workflow-backward-hint">
                  ↩ يمكنك أيضاً «{b.labelAr}» عبر الأدوات المخصصة في تبويب التسعير.
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      {isConfirmed && (
        <div className="ow-mark-warning">
          🔒 لا يمكن تعديل الشيبينغ مارك للطلبيات المؤكدة. يرجى الحصول على موافقة مديرة المبيعات، مديرة المحاسبة، أو المدير العام
        </div>
      )}

      {showRejectDialog && (
        <div className="ow-modal-overlay" onClick={() => { setShowRejectDialog(false); setRejectReason(''); }}>
          <div className="ow-reject-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ow-reject-header">
              <h3>❌ رفض التسعير</h3>
              <button className="ow-reject-close" onClick={() => { setShowRejectDialog(false); setRejectReason(''); }}>✕</button>
            </div>
            <div className="ow-reject-body">
              <p className="ow-reject-hint">يرجى توضيح سبب رفض التسعير أو التسعير المستهدف المطلوب. سيتم إعادة الطلب إلى المشتريات مع إشعار فوري.</p>
              <textarea
                className="ow-reject-textarea"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="اكتب سبب الرفض / التسعير المستهدف المطلوب... (إلزامي)"
                rows={5}
                autoFocus
              />
            </div>
            <div className="ow-reject-actions">
              <button className="ow-reject-cancel" onClick={() => { setShowRejectDialog(false); setRejectReason(''); }}>إلغاء</button>
              <button
                className="ow-reject-submit"
                onClick={() => {
                  const reason = rejectReason.trim();
                  if (!reason) return;
                  rejectPricing(order.id, persona.name, persona.department, reason);
                  addLog(persona.name, persona.department, `❌ رفض التسعير للطلب #${order.orderNumber}`, reason.slice(0, 120));
                  setShowRejectDialog(false);
                  setRejectReason('');
                }}
                disabled={!rejectReason.trim()}
              >
                📤 إرسال الرفض إلى المشتريات
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="ow-modal-overlay" onClick={() => { setConfirmDelete(false); setArchiveReason(''); }}>
          <div className="ow-delete-confirm" onClick={(e) => e.stopPropagation()}>
            <span className="ow-delete-confirm-title">🗄️ أرشفة الطلب #{order.orderNumber}</span>
            <span className="ow-delete-confirm-text">لا يمكن حذف الطلبات في MJ-DOS — سيتم أرشفة الطلب مع إبقاء سجله الكامل. يرجى ذكر سبب الأرشفة (إلزامي).</span>
            <textarea
              className="ow-reject-textarea"
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              placeholder="سبب الأرشفة (إلغاء العميل، خطأ في الإدخال، ...)"
              rows={4}
              autoFocus
              style={{ marginTop: 8 }}
            />
            <div className="ow-delete-confirm-actions">
              <button className="ow-delete-confirm-cancel" onClick={() => { setConfirmDelete(false); setArchiveReason(''); }}>إلغاء</button>
              <button className="ow-delete-confirm-proceed" onClick={handleArchiveOrder} disabled={!archiveReason.trim()}>
                🗄️ تأكيد الأرشفة
              </button>
            </div>
          </div>
        </div>
      )}

      {order.archivedAt && (
        <div className="ow-mark-warning" style={{ background: '#fef3c7', borderColor: '#f59e0b', color: '#78350f' }}>
          🗄️ هذا الطلب مؤرشف — بتاريخ {order.archivedAt} بواسطة {order.archivedBy}
          {order.archiveReason ? ` — السبب: ${order.archiveReason}` : ''}
        </div>
      )}

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

      {/* المعلومات — البيانات الأساسية فقط */}
      {activeSection === 'info' && (
        <div className="ow-info-panel">
          <div className="ow-details-grid">
            <div className="ow-details-row">
              <span className="ow-details-label">المنتج:</span>
              <span className="ow-details-value">{order.productName || '—'}</span>
            </div>
            <div className="ow-details-row">
              <span className="ow-details-label">الكمية:</span>
              <span className="ow-details-value">{order.optionalFields?.quantity || '—'}</span>
            </div>
            <div className="ow-details-row">
              <span className="ow-details-label">القسم:</span>
              <span className="ow-details-value">{order.categoryLabel || '—'}</span>
            </div>
            <div className="ow-details-row">
              <span className="ow-details-label">منشئ الطلب:</span>
              <span className="ow-details-value">{order.salesPersona || '—'}</span>
            </div>
          </div>

          {/* الشفافية: عرض المسؤولين */}
          {isSales && order.claim && (
            <div className="ow-details-subsection">
              <div className="ow-details-subtitle">🛒 المشتريات</div>
              <div className="ow-details-grid">
                <div className="ow-details-row">
                  <span className="ow-details-label">المستلم:</span>
                  <span className="ow-details-value">{order.claim.claimedBy}</span>
                </div>
                {latestPricing && (
                  <div className="ow-details-row">
                    <span className="ow-details-label">المسعّر:</span>
                    <span className="ow-details-value">{latestPricing.submittedBy}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          {isProcurement && (
            <div className="ow-details-subsection">
              <div className="ow-details-subtitle">👤 المبيعات</div>
              <div className="ow-details-grid">
                <div className="ow-details-row">
                  <span className="ow-details-label">منشئ الطلب:</span>
                  <span className="ow-details-value">{order.salesPersona}</span>
                </div>
              </div>
            </div>
          )}

          {order.optionalFields && Object.keys(order.optionalFields).filter(k => k !== 'quantity').length > 0 && (
            <div className="ow-details-subsection">
              <div className="ow-details-subtitle">حقول إضافية</div>
              <div className="ow-details-grid">
                {Object.entries(order.optionalFields).filter(([k]) => k !== 'quantity').map(([key, val]) => (
                  <div key={key} className="ow-details-row">
                    <span className="ow-details-label">{key}:</span>
                    <span className="ow-details-value">{val || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {order.documents.length > 0 && (
            <div className="ow-details-subsection">
              <div className="ow-details-subtitle">المرفقات ({order.documents.length})</div>
              <div className="ow-docs-list">
                {order.documents.map((doc) => (
                  <div key={doc.id} className="ow-doc-item">
                    {doc.type === 'attachment' && doc.url.startsWith('blob:') ? (
                      <img src={doc.url} alt={doc.name} className="ow-doc-img" />
                    ) : (
                      <>
                        <span className="ow-doc-icon">{doc.type === 'invoice' ? '🧾' : doc.type === 'proof' ? '📸' : '📄'}</span>
                        <span className="ow-doc-name">{doc.name}</span>
                        <a className="ow-doc-link" href={doc.url} target="_blank" rel="noopener noreferrer">🔗 فتح</a>
                      </>
                    )}
                    <span className="ow-doc-by">{doc.uploadedBy}</span>
                    <span className="ow-doc-time">{doc.uploadedAt}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {order.supplierData && showSupplier && (
            <div className="ow-details-subsection">
              <div className="ow-details-subtitle">المصنع</div>
              <div className="ow-details-grid">
                <div className="ow-details-row">
                  <span className="ow-details-label">الاسم:</span>
                  <span className="ow-details-value">{order.supplierData.factoryName || '—'}</span>
                </div>
                <div className="ow-details-row">
                  <span className="ow-details-label">الهاتف:</span>
                  <span className="ow-details-value">{order.supplierData.factoryPhone || '—'}</span>
                </div>
                {order.supplierData.factoryAddress && (
                  <div className="ow-details-row">
                    <span className="ow-details-label">العنوان:</span>
                    <span className="ow-details-value">{order.supplierData.factoryAddress}</span>
                  </div>
                )}
                {order.supplierData.contactPerson && (
                  <div className="ow-details-row">
                    <span className="ow-details-label">جهة الاتصال:</span>
                    <span className="ow-details-value">{order.supplierData.contactPerson}</span>
                  </div>
                )}
                {order.supplierData.supplierNumber && (
                  <div className="ow-details-row">
                    <span className="ow-details-label">رقم المورد:</span>
                    <span className="ow-details-value">{order.supplierData.supplierNumber}</span>
                  </div>
                )}
                {order.supplierData.procurementNotes && (
                  <div className="ow-details-row">
                    <span className="ow-details-label">ملاحظات المشتريات:</span>
                    <span className="ow-details-value">{order.supplierData.procurementNotes}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* القصة الكاملة — timeline موحّد لكل شيء حدث للطلب */}
      {activeSection === 'timeline' && (() => {
        const events = buildOrderTimeline(order);
        return (
          <div className="ow-timeline-panel">
            <div className="ow-timeline-header">
              <span className="ow-timeline-header-title">📖 القصة الكاملة للطلب #{order.orderNumber}</span>
              <span className="ow-timeline-header-hint">
                كل حدث مسجَّل بشكل دائم — لا يمكن تعديل أو حذف السجل.
              </span>
            </div>
            {events.length === 0 ? (
              <div className="ow-notes-empty">لا توجد أحداث بعد</div>
            ) : (
              <ol className="ow-timeline-list">
                {events.map((e) => (
                  <li key={e.id} className={`ow-timeline-item tone-${e.tone} kind-${e.kind}`}>
                    <div className="ow-timeline-dot" aria-hidden="true">{e.icon}</div>
                    <div className="ow-timeline-content">
                      <div className="ow-timeline-title-row">
                        <span className="ow-timeline-title">{e.title}</span>
                        <span className="ow-timeline-time">📅 {e.date} · ⏱ {e.time}</span>
                      </div>
                      <div className="ow-timeline-actor">
                        👤 {e.actorName}
                        {e.actorRole ? <span className="ow-timeline-role"> — {e.actorRole}</span> : null}
                        {e.actorDept && !e.actorRole ? <span className="ow-timeline-role"> — {e.actorDept}</span> : null}
                      </div>
                      {e.detail && <div className="ow-timeline-detail">{e.detail}</div>}
                      {e.reason && <div className="ow-timeline-reason">📝 السبب: {e.reason}</div>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        );
      })()}

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
          {isSales && (order.status === 'pricing_completed' || order.status === 'quotation_presented') && latestPricing && (
            <div className="ow-pricing-approval-bar">
              <div className="ow-pricing-approval-summary">
                <span className="ow-pricing-approval-label">📋 التسعير الحالي:</span>
                <span className="ow-pricing-approval-value">${formatNumber(latestPricing.totalUSD)} ({formatNumber(latestPricing.totalRMB)} RMB)</span>
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
        <div className="ow-negotiation-panel">
          <div className="ow-negotiation-input">
            <textarea className="ow-negotiation-textarea" value={negotiationMsg} onChange={(e) => setNegotiationMsg(e.target.value)} placeholder="اكتب رسالتك هنا..." rows={3} />
            <div className="ow-negotiation-actions">
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleNegImageSelect} />
              <button className="ow-neg-image-btn" onClick={() => fileInputRef.current?.click()} title="إرفاق صورة">📷</button>
              <button className="ow-negotiation-send" onClick={handleNegMessageWithImage} disabled={!negotiationMsg.trim() && !negImageFile}>إرسال</button>
            </div>
            {negImagePreview && (
              <div className="ow-neg-image-preview">
                <img src={negImagePreview} alt="معاينة" />
                <button className="ow-neg-image-remove" onClick={() => { setNegImageFile(null); setNegImagePreview(null); }}>✕</button>
              </div>
            )}
          </div>

          {/* Workflow transition audit — permanent, immutable log of every stage change. */}
          {order.workflowHistory && order.workflowHistory.length > 0 && (
            <div className="ow-workflow-history">
              <div className="ow-workflow-history-title">📖 سجل انتقالات سير العمل (غير قابل للتعديل)</div>
              <div className="ow-workflow-history-list">
                {order.workflowHistory.map((t) => (
                  <div key={t.id} className={`ow-workflow-history-item direction-${t.direction}`}>
                    <div className="ow-workflow-history-row">
                      <span className="ow-workflow-history-direction">
                        {t.direction === 'initial' ? '🆕' : t.direction === 'forward' ? '➡️' : '↩️'}
                      </span>
                      <span className="ow-workflow-history-from">
                        {t.from ? STATUS_LABELS[t.from] : 'إنشاء الطلب'}
                      </span>
                      <span className="ow-workflow-history-arrow">→</span>
                      <span className="ow-workflow-history-to">{STATUS_LABELS[t.to]}</span>
                    </div>
                    <div className="ow-workflow-history-meta">
                      <span>👤 {t.actorName}</span>
                      <span>💼 {t.actorRole || t.actorDept}</span>
                      <span>📅 {t.date}</span>
                      <span>⏱ {t.time}</span>
                    </div>
                    {t.reason && <div className="ow-workflow-history-reason">📝 {t.reason}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {order.negotiationHistory.length === 0 ? (
            <div className="ow-notes-empty">لا توجد رسائل بعد</div>
          ) : (
            <div className="ow-negotiation-list">
              {order.negotiationHistory.map((entry) => (
                <div key={entry.id} className={`ow-negotiation-entry type-${entry.type}`}>
                  <div className="ow-negotiation-header">
                    <span className="ow-negotiation-author">{entry.fromPersona}</span>
                    <span className="ow-negotiation-sep">—</span>
                    <span className="ow-negotiation-time">{entry.createdAt}</span>
                  </div>
                  <div className="ow-negotiation-message">{entry.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* الملاحظات السرية — رسائل موجهة مع خيار الجميع وسلاسل الرد */}
      {activeSection === 'notes' && (
        <div className="ow-notes-panel">
          <div className="ow-note-input">
            <select className="ow-note-select" value={noteTarget} onChange={(e) => setNoteTarget(e.target.value)}>
              <option value="">— إرسال ملاحظة إلى —</option>
              <option value={ALL_PEOPLE}>👥 جميع الأشخاص</option>
              {ORDER_NOTE_TARGETS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <textarea className="ow-note-textarea" value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="اكتب ملاحظتك هنا..." rows={4} />
            <button className="ow-note-send" onClick={handleAddNote} disabled={!noteTarget || !noteContent.trim()}>إرسال وحفظ</button>
          </div>

          {order.notes.length === 0 ? (
            <div className="ow-notes-empty">لا توجد ملاحظات بعد</div>
          ) : (
            <div className="ow-notes-list">
              {order.notes.filter((note) => canSeeNote(note, persona.name, persona.department)).map((note) => (
                <div key={note.id} className="ow-note-item">
                  <div className="ow-note-header">
                    <span className="ow-note-author">{note.authorPersona}</span>
                    <span className="ow-note-target">→ {note.targetPersona === ALL_PEOPLE ? '👥 الجميع' : note.targetPersona}</span>
                    <span className="ow-note-time">{note.createdAt}</span>
                  </div>
                  <div className="ow-note-content">{note.content}</div>
                  {note.readBy.length > 0 && (
                    <div className="ow-note-read">
                      {note.readBy.map((r) => `✅ قرأها ${r.persona}`).join(' | ')}
                    </div>
                  )}

                  {/* الردود */}
                  {note.replies.length > 0 && (
                    <div className="ow-note-replies">
                      {note.replies.map((reply) => (
                        <div key={reply.id} className="ow-note-reply">
                          <span className="ow-reply-author">{reply.authorPersona}</span>
                          <span className="ow-reply-time">{reply.createdAt}</span>
                          <div className="ow-reply-text">{reply.content}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* إضافة رد */}
                  <div className="ow-reply-form">
                    <input className="ow-reply-input" value={replyInputs[note.id] || ''} onChange={(e) => setReplyInputs(prev => ({ ...prev, [note.id]: e.target.value }))} placeholder="اكتب رداً..." />
                    <button className="ow-reply-btn" onClick={() => handleReply(note.id)} disabled={!replyInputs[note.id]?.trim()}>رد</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ProformaModalV2 temporarily disabled — reverted to the OLD JSX modal
          below for its original layout. isOpen is hard-wired to `false` so the
          component renders (preserving type-narrowing for `order`) but its
          internal `if (!isOpen) return null` short-circuits before any UI.
          To re-enable, restore `isOpen={showProforma}`. */}
      <ProformaModalV2
        isOpen={false}
        onClose={() => setShowProforma(false)}
        order={order}
        onExportPDF={({ profitPercent, currency, template }) => {
          if (!latestPricing) throw new Error('لا توجد بيانات تسعير لهذا الطلب');
          const pct = parseArabicNumber(profitPercent);
          const baseRMB = latestPricing.totalRMB;
          const baseUSD = latestPricing.totalUSD;
          const er = latestPricing.exchangeRateUsed || 1;
          const finalRMB = +(baseRMB + (baseRMB * pct) / 100).toFixed(3);
          const finalUSD = er > 0 ? +(finalRMB / er).toFixed(3) : 0;
          exportQuotationPDF({
            order,
            proforma: {
              baseTotalRMB: baseRMB,
              baseTotalUSD: baseUSD,
              profitPercent: pct,
              profitFixed: 0,
              profitFixedCurrency: currency,
              finalPriceRMB: finalRMB,
              finalPriceUSD: finalUSD,
              exportCurrency: currency,
              template,
              submittedBy: persona.name,
              submittedAt: new Date().toISOString(),
            },
            currency,
            template,
            issuedBy: persona.name,
            companyName: 'MJ Group',
            companyTagline: 'MJ-DOS Enterprise Operating System',
          });
          addLog(
            persona.name,
            persona.department,
            `📤 تصدير عرض السعر PDF للطلب #${order.orderNumber}`,
            `العملة: ${currency} — القالب: ${template}`,
          );
        }}
        onExportExcel={({ profitPercent, currency, template }) => {
          if (!latestPricing) throw new Error('لا توجد بيانات تسعير لهذا الطلب');
          const pct = parseArabicNumber(profitPercent);
          const baseRMB = latestPricing.totalRMB;
          const baseUSD = latestPricing.totalUSD;
          const er = latestPricing.exchangeRateUsed || 1;
          const finalRMB = +(baseRMB + (baseRMB * pct) / 100).toFixed(3);
          const finalUSD = er > 0 ? +(finalRMB / er).toFixed(3) : 0;
          exportQuotationExcel({
            order,
            proforma: {
              baseTotalRMB: baseRMB,
              baseTotalUSD: baseUSD,
              profitPercent: pct,
              profitFixed: 0,
              profitFixedCurrency: currency,
              finalPriceRMB: finalRMB,
              finalPriceUSD: finalUSD,
              exportCurrency: currency,
              template,
              submittedBy: persona.name,
              submittedAt: new Date().toISOString(),
            },
            currency,
            template,
            issuedBy: persona.name,
            companyName: 'MJ Group',
            companyTagline: 'MJ-DOS Enterprise Operating System',
          });
          addLog(
            persona.name,
            persona.department,
            `📤 تصدير عرض السعر Excel للطلب #${order.orderNumber}`,
            `العملة: ${currency} — القالب: ${template}`,
          );
        }}
      />

      {/* OLD PROFORMA MODAL — RE-ENABLED. Restores the original design and
          layout. Behaviour changes vs. the pre-disable version:
            - Modal is NOT auto-closed after PDF/Excel success (see
              handleConfirmAndSend).
            - Reopen button is always visible.
            - Non-null assertions inside the IIFE remain as a safety-belt in
              case narrowing is lost across the callback boundary. */}
      {showProforma && latestPricing && (() => {
        // TypeScript loses narrowing across the IIFE + outer `false &&` guard.
        // Non-null assertions on the captured consts keep the dead block
        // typechecking without altering runtime behaviour (block never runs).
        // TEMP DIAGNOSTIC — modal render counter + naive render-loop detector.
        // Runs synchronously during OrderWorkspace render while showProforma
        // is true. Detector fires if >20 renders happened within a 1s window.
        proformaDebugRenderCountRef.current += 1;
        const __proformaDebugNow = Date.now();
        proformaDebugRenderTimestampsRef.current.push(__proformaDebugNow);
        if (proformaDebugRenderTimestampsRef.current.length > 40) {
          proformaDebugRenderTimestampsRef.current = proformaDebugRenderTimestampsRef.current.slice(-40);
        }
        const __proformaDebugRecent = proformaDebugRenderTimestampsRef.current.filter(t => __proformaDebugNow - t <= 1000);
        console.log(`[PROFORMA_DEBUG] modal render #${proformaDebugRenderCountRef.current} (rendersInLast1s=${__proformaDebugRecent.length})`);
        if (__proformaDebugRecent.length > 20 && !proformaDebugLoopReportedRef.current) {
          proformaDebugLoopReportedRef.current = true;
          console.log('[PROFORMA_DEBUG] POSSIBLE_RENDER_LOOP', { rendersInLast1s: __proformaDebugRecent.length, totalRenders: proformaDebugRenderCountRef.current });
        }

        const baseRMB = latestPricing!.totalRMB;
        const baseUSD = latestPricing!.totalUSD;
        const er = latestPricing!.exchangeRateUsed || 1;
        const pct = parseArabicNumber(proformaProfitPercent);
        const fixed = parseArabicNumber(proformaProfitFixed);
        const fixedRMB = proformaProfitCurrency === 'USD' ? fixed * er : fixed;
        const finalRMB = baseRMB + (baseRMB * pct / 100) + fixedRMB;
        const finalUSD = er > 0 ? +(finalRMB / er).toFixed(3) : 0;
        const existingProforma = order!.proforma;
        const firstImage = order!.documents.find(d => d.type === 'attachment' && d.url.startsWith('blob:'));
        const canConfirm = pct > 0 || fixed > 0 || !!existingProforma;

        return (
          <div className="ow-proforma-modal" role="dialog" aria-modal="false" aria-label="إعداد عرض السعر للزبون">
            <div className="ow-proforma-header">
              <h3>📄 إعداد عرض السعر للزبون</h3>
              <button type="button" className="ow-proforma-close" onClick={() => { console.log('[PROFORMA_DEBUG] click: header X button'); closeProforma(); }} aria-label="إغلاق">✕</button>
            </div>
              <div className="ow-proforma-body">
                {firstImage && (
                  <div className="ow-proforma-image-wrap">
                    <img src={firstImage!.url} alt="صورة المنتج" className="ow-proforma-image" />
                  </div>
                )}

                <div className="ow-proforma-info">
                  <div className="ow-proforma-row"><span className="ow-proforma-label">{isProcurement ? 'رقم الطلب:' : 'الزبون:'}</span><span className="ow-proforma-value">{isProcurement ? `#${order!.orderNumber}` : order!.clientName}</span></div>
                  <div className="ow-proforma-row"><span className="ow-proforma-label">رقم الطلب:</span><span className="ow-proforma-value">#{order!.orderNumber}</span></div>
                  <div className="ow-proforma-row"><span className="ow-proforma-label">الشيبينغ مارك:</span><span className="ow-proforma-value">{order!.shippingMark}-{order!.shippingMarkSerial}</span></div>
                  <div className="ow-proforma-row"><span className="ow-proforma-label">المنتج:</span><span className="ow-proforma-value">{order!.productName}</span></div>
                  <div className="ow-proforma-row"><span className="ow-proforma-label">الكمية:</span><span className="ow-proforma-value">{order!.optionalFields?.quantity || '—'}</span></div>
                </div>

                <div className="ow-proforma-cost">
                  <span className="ow-proforma-cost-title">💰 التكلفة الأساسية</span>
                  <div className="ow-proforma-cost-values">
                    <span className="ow-proforma-cost-rmb">¥ {formatNumber(baseRMB)} RMB</span>
                    <span className="ow-proforma-cost-usd">$ {formatNumber(baseUSD)} USD</span>
                  </div>
                </div>

                <div className="ow-proforma-profit">
                  <div className="ow-proforma-profit-title">📈 إضافة الربح</div>
                  <div className="ow-proforma-profit-controls">
                    <div className="ow-proforma-profit-group">
                      <label className="ow-proforma-profit-label">نسبة ربح %</label>
                      <input className="ow-proforma-profit-input" type="text" inputMode="decimal" value={proformaProfitPercent} onChange={(e) => { console.log('[PROFORMA_DEBUG] input change: profitPercent =', e.target.value); setProformaProfitPercent(e.target.value); }} placeholder="0" min="0" />
                    </div>
                    <div className="ow-proforma-profit-sep">أو</div>
                    <div className="ow-proforma-profit-group">
                      <label className="ow-proforma-profit-label">مبلغ ثابت</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input className="ow-proforma-profit-input" type="text" inputMode="decimal" value={proformaProfitFixed} onChange={(e) => { console.log('[PROFORMA_DEBUG] input change: profitFixed =', e.target.value); setProformaProfitFixed(e.target.value); }} placeholder="0" min="0" style={{ flex: 1 }} />
                        <select className="ow-pricing-currency-select-sm" value={proformaProfitCurrency} onChange={(e) => { console.log('[PROFORMA_DEBUG] select change: profitCurrency =', e.target.value); setProformaProfitCurrency(e.target.value as QuotationCurrency); }}>
                          <option value="RMB">RMB (¥)</option>
                          <option value="USD">USD ($)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="ow-proforma-profit">
                  <div className="ow-proforma-profit-title">🌐 عملة عرض السعر (اختيار واحد فقط)</div>
                  <div className="ow-proforma-profit-controls">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="radio" name="export-currency" value="USD"
                        checked={proformaExportCurrency === 'USD'}
                        onChange={() => { console.log('[PROFORMA_DEBUG] radio change: exportCurrency = USD'); setProformaExportCurrency('USD'); }} />
                      تصدير بالدولار فقط (USD)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="radio" name="export-currency" value="RMB"
                        checked={proformaExportCurrency === 'RMB'}
                        onChange={() => { console.log('[PROFORMA_DEBUG] radio change: exportCurrency = RMB'); setProformaExportCurrency('RMB'); }} />
                      تصدير باليوان فقط (RMB)
                    </label>
                  </div>
                </div>

                <div className="ow-proforma-profit">
                  <div className="ow-proforma-profit-title">🗂️ قالب عرض السعر</div>
                  <div className="ow-proforma-profit-controls">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="radio" name="quote-template" value="1"
                        checked={proformaTemplate === 1}
                        onChange={() => { console.log('[PROFORMA_DEBUG] radio change: template = 1'); setProformaTemplate(1); }} />
                      Template 1 — جدول قياسي
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="radio" name="quote-template" value="2"
                        checked={proformaTemplate === 2}
                        onChange={() => { console.log('[PROFORMA_DEBUG] radio change: template = 2'); setProformaTemplate(2); }} />
                      Template 2 — منتج لكل صفحة (عرض مميز)
                    </label>
                  </div>
                </div>

                <div className="ow-proforma-final">
                  <span className="ow-proforma-final-label">السعر النهائي للزبون:</span>
                  <div className="ow-proforma-final-values">
                    {proformaExportCurrency === 'RMB' ? (
                      <span className="ow-proforma-final-rmb">¥ {formatNumber(finalRMB)} RMB</span>
                    ) : (
                      <span className="ow-proforma-final-usd">$ {formatNumber(finalUSD)} USD</span>
                    )}
                  </div>
                </div>

                {pct > 0 || fixed > 0 ? (
                  <div className="ow-proforma-summary">
                    <span>الربح: {pct > 0 ? `${formatNumber(pct)}%` : ''}{pct > 0 && fixed > 0 ? ' + ' : ''}{fixed > 0 ? `${formatNumber(fixed)} ${proformaProfitCurrency}` : ''} = {formatNumber(finalRMB - baseRMB)} RMB (${formatNumber((finalRMB - baseRMB) / er)} USD)</span>
                  </div>
                ) : null}

                {existingProforma && (
                  <div className="ow-proforma-summary" style={{ background: '#f1f5f9', color: '#334155' }}>
                    ✅ آخر إعداد للعرض بتاريخ {existingProforma!.submittedAt} — يمكنك تعديل الحقول أعلاه وإعادة التصدير في أي وقت.
                  </div>
                )}
              </div>
              <div className="ow-proforma-footer">
                <button type="button" className="ow-proforma-submit" onClick={() => handleConfirmAndSend('pdf')} disabled={!canConfirm} title="تأكيد وحفظ العرض ثم تصدير PDF">
                  ✅ تأكيد وإرسال — PDF
                </button>
                <button type="button" className="ow-proforma-submit" onClick={() => handleConfirmAndSend('xlsx')} disabled={!canConfirm} title="تأكيد وحفظ العرض ثم تصدير Excel">
                  ✅ تأكيد وإرسال — Excel
                </button>
                {order!.status === 'quotation_presented' && (
                  <button
                    type="button"
                    className="ow-proforma-submit"
                    onClick={() => runWorkflowAction('generateOfficialQuotation')}
                    title="تصدير فاتورة رسمية"
                  >
                    🧾 تصدير فاتورة رسمية
                  </button>
                )}
                <button type="button" className="ow-proforma-cancel" onClick={() => { console.log('[PROFORMA_DEBUG] click: footer Close button'); closeProforma(); }}>إغلاق</button>
              </div>
          </div>
        );
      })()}

      {showInvoicePreview && order.proforma && (() => {
        const proforma = order.proforma;
        const existing = order.officialInvoice;
        const currency = proforma.exportCurrency || 'USD';
        const finalPrice = currency === 'USD' ? proforma.finalPriceUSD : proforma.finalPriceRMB;
        const sym = currency === 'USD' ? '$' : '¥';
        const runExport = (format: 'pdf' | 'xlsx') => {
          if (invoiceExporting) return; // Debounce double-clicks.
          const actor = { name: persona.name, role: persona.role, dept: persona.department };
          // Generate the invoice number up front so the exported file and the
          // persisted store record carry the SAME number.
          const invoiceNumber = `INV-${order.orderNumber}-${Date.now().toString().slice(-6)}`;
          const payload = {
            order,
            proforma,
            currency,
            template: proforma.template || 1,
            issuedBy: persona.name,
            companyName: 'MJ Group',
            companyTagline: `فاتورة رسمية — ${invoiceNumber}`,
            invoiceNotes: invoiceNotes.trim(),
            invoiceNumber,
          };
          // try/finally guarantees `invoiceExporting` is reset — so the modal
          // never becomes permanently locked, no matter what the exporter
          // throws. Status only advances after a successful file generation.
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
              { invoiceNumber, notes: invoiceNotes.trim(), exportCurrency: currency, exportedFormat: format },
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
        };
        return (
          <div className="ow-proforma-modal" role="dialog" aria-modal="false" aria-label="معاينة الفاتورة الرسمية">
            <div className="ow-proforma-header">
              <h3>🧾 معاينة الفاتورة الرسمية قبل التصدير</h3>
              <button type="button" className="ow-proforma-close" onClick={closeInvoicePreview} aria-label="إغلاق">✕</button>
            </div>
              <div className="ow-proforma-body">
                <div className="ow-proforma-info">
                  <div className="ow-proforma-row"><span className="ow-proforma-label">الشركة:</span><span className="ow-proforma-value">MJ Group</span></div>
                  <div className="ow-proforma-row"><span className="ow-proforma-label">الزبون:</span><span className="ow-proforma-value">{order.clientName}</span></div>
                  <div className="ow-proforma-row"><span className="ow-proforma-label">رقم الطلب:</span><span className="ow-proforma-value">#{order.orderNumber}</span></div>
                  <div className="ow-proforma-row"><span className="ow-proforma-label">الشيبينغ مارك:</span><span className="ow-proforma-value">{order.shippingMark}-{order.shippingMarkSerial}</span></div>
                  <div className="ow-proforma-row"><span className="ow-proforma-label">المنتج:</span><span className="ow-proforma-value">{order.productName}</span></div>
                  <div className="ow-proforma-row"><span className="ow-proforma-label">الكمية:</span><span className="ow-proforma-value">{order.optionalFields?.quantity || '—'}</span></div>
                  <div className="ow-proforma-row"><span className="ow-proforma-label">العملة:</span><span className="ow-proforma-value">{currency}</span></div>
                  <div className="ow-proforma-row"><span className="ow-proforma-label">القالب:</span><span className="ow-proforma-value">Template {proforma.template || 1}</span></div>
                  {existing && (
                    <div className="ow-proforma-row"><span className="ow-proforma-label">رقم الفاتورة السابقة:</span><span className="ow-proforma-value">{existing.invoiceNumber} — {existing.exportedAt} — {existing.exportedFormat.toUpperCase()}</span></div>
                  )}
                </div>
                <div className="ow-proforma-final">
                  <span className="ow-proforma-final-label">الإجمالي النهائي:</span>
                  <div className="ow-proforma-final-values">
                    <span className={currency === 'USD' ? 'ow-proforma-final-usd' : 'ow-proforma-final-rmb'}>{sym} {formatNumber(Math.round(finalPrice), 0)} {currency}</span>
                  </div>
                </div>
                <div className="ow-proforma-profit">
                  <div className="ow-proforma-profit-title">📝 ملاحظات الفاتورة (تظهر في PDF/Excel)</div>
                  <textarea
                    className="ow-reject-textarea"
                    style={{ width: '100%', minHeight: 120 }}
                    value={invoiceNotes}
                    onChange={(e) => setInvoiceNotes(e.target.value)}
                    placeholder="يمكنك تعديل ملاحظات الفاتورة الافتراضية حسب الحاجة..."
                  />
                </div>
              </div>
              <div className="ow-proforma-footer">
                <button
                  type="button"
                  className="ow-proforma-submit"
                  onClick={() => runExport('pdf')}
                  disabled={invoiceExporting}
                  title="حفظ الفاتورة وتوليد PDF"
                >
                  {invoiceExporting ? '⏳ جاري التوليد…' : '📄 تصدير كـ PDF'}
                </button>
                <button
                  type="button"
                  className="ow-proforma-submit"
                  onClick={() => runExport('xlsx')}
                  disabled={invoiceExporting}
                  title="حفظ الفاتورة وتوليد Excel"
                >
                  {invoiceExporting ? '⏳ جاري التوليد…' : '📊 تصدير كـ Excel'}
                </button>
                {/* Close is NEVER disabled — this is the user's guaranteed escape hatch. */}
                <button type="button" className="ow-proforma-cancel" onClick={closeInvoicePreview}>
                  إغلاق (لا يتم تغيير الحالة)
                </button>
              </div>
          </div>
        );
      })()}

      {showDepositForm && (
        <div className="ow-modal-overlay" onClick={() => setShowDepositForm(false)}>
          <div className="ow-proforma-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ow-proforma-header">
              <h3>💵 تسجيل استلام العربون من الزبون</h3>
              <button className="ow-proforma-close" onClick={() => setShowDepositForm(false)}>✕</button>
            </div>
            <div className="ow-proforma-body">
              <div className="ow-pricing-form-row">
                <div className="ow-pricing-form-group">
                  <label className="ow-pricing-form-label">مبلغ العربون *</label>
                  <input className="ow-pricing-form-input" type="text" inputMode="decimal" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="0" />
                </div>
                <div className="ow-pricing-form-group" style={{ maxWidth: 160 }}>
                  <label className="ow-pricing-form-label">العملة *</label>
                  <select className="ow-pricing-form-input" value={depositCurrency} onChange={(e) => setDepositCurrency(e.target.value as QuotationCurrency)}>
                    <option value="USD">USD ($)</option>
                    <option value="RMB">RMB (¥)</option>
                  </select>
                </div>
              </div>
              <div className="ow-pricing-form-row">
                <div className="ow-pricing-form-group">
                  <label className="ow-pricing-form-label">طريقة الدفع *</label>
                  <select className="ow-pricing-form-input" value={depositMethod} onChange={(e) => setDepositMethod(e.target.value as import('../types').DepositPaymentMethod)}>
                    <option value="cash_office">كاش في مقر الشركة</option>
                    <option value="sham_cash">شام كاش</option>
                    <option value="trend_5000">شركة ترند — جمران / ترند 5000</option>
                    <option value="dahab_istanbul_1373">شركة ذهب — جمران / إسطنبول 1373</option>
                    <option value="free_istanbul_104">شركة فري — جمران / إسطنبول 104</option>
                    <option value="other">غير ذلك</option>
                  </select>
                </div>
                <div className="ow-pricing-form-group">
                  <label className="ow-pricing-form-label">تاريخ الدفع *</label>
                  <input className="ow-pricing-form-input" type="date" value={depositDate} onChange={(e) => setDepositDate(e.target.value)} />
                </div>
              </div>
              {depositMethod === 'other' && (
                <div className="ow-pricing-form-row">
                  <div className="ow-pricing-form-group">
                    <label className="ow-pricing-form-label">اكتب مكان أو طريقة الدفع *</label>
                    <input className="ow-pricing-form-input" type="text" value={depositCustomMethod} onChange={(e) => setDepositCustomMethod(e.target.value)} placeholder="مثال: تحويل عبر شركة X" />
                  </div>
                </div>
              )}
              <div className="ow-pricing-form-row">
                <div className="ow-pricing-form-group">
                  <label className="ow-pricing-form-label">إثبات الدفع (اختياري — صورة، PDF، ...)</label>
                  <input className="ow-pricing-form-input" type="file" accept="image/*,application/pdf" onChange={(e) => setDepositAttachment(e.target.files?.[0] || null)} />
                  {depositAttachment && (
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>📎 {depositAttachment.name}</div>
                  )}
                </div>
              </div>
            </div>
            <div className="ow-proforma-footer">
              <button
                className="ow-proforma-submit"
                onClick={() => {
                  const amount = parseArabicNumber(depositAmount);
                  const actor = { name: persona.name, role: persona.role, dept: persona.department };
                  const attachment = depositAttachment ? { name: depositAttachment.name, url: URL.createObjectURL(depositAttachment), mimeType: depositAttachment.type, size: depositAttachment.size } : undefined;
                  const result = useOrderStore.getState().recordDepositPaid(
                    order.id,
                    {
                      amount,
                      currency: depositCurrency,
                      paymentMethod: depositMethod,
                      customPaymentMethod: depositMethod === 'other' ? depositCustomMethod.trim() : undefined,
                      paymentDate: depositDate,
                      attachment,
                    },
                    actor,
                  );
                  if (!result.ok) {
                    alert(`تعذّر حفظ العربون: ${result.error}`);
                    return;
                  }
                  addLog(persona.name, persona.department, `💵 تسجيل عربون للطلب #${order.orderNumber}`, `${amount} ${depositCurrency}`);
                  setShowDepositForm(false);
                }}
                disabled={!depositAmount.trim() || (depositMethod === 'other' && !depositCustomMethod.trim())}
              >
                ✅ حفظ العربون
              </button>
              <button className="ow-proforma-cancel" onClick={() => setShowDepositForm(false)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {showConfirmDeposit && order.customerDeposit && (() => {
        const d = order.customerDeposit;
        const methodLabel = d.paymentMethod === 'other'
          ? `غير ذلك: ${d.customPaymentMethod || ''}`
          : ({ cash_office: 'كاش في مقر الشركة', sham_cash: 'شام كاش', trend_5000: 'شركة ترند — جمران / ترند 5000', dahab_istanbul_1373: 'شركة ذهب — جمران / إسطنبول 1373', free_istanbul_104: 'شركة فري — جمران / إسطنبول 104' } as Record<string, string>)[d.paymentMethod];
        return (
          <div className="ow-modal-overlay" onClick={() => setShowConfirmDeposit(false)}>
            <div className="ow-proforma-modal" onClick={(e) => e.stopPropagation()}>
              <div className="ow-proforma-header">
                <h3>💳 تأكيد دفع العربون</h3>
                <button className="ow-proforma-close" onClick={() => setShowConfirmDeposit(false)}>✕</button>
              </div>
              <div className="ow-proforma-body">
                <div className="ow-proforma-info">
                  <div className="ow-proforma-row"><span className="ow-proforma-label">المبلغ:</span><span className="ow-proforma-value">{formatNumber(d.amount)} {d.currency}</span></div>
                  <div className="ow-proforma-row"><span className="ow-proforma-label">طريقة الدفع:</span><span className="ow-proforma-value">{methodLabel}</span></div>
                  <div className="ow-proforma-row"><span className="ow-proforma-label">تاريخ الدفع:</span><span className="ow-proforma-value">{d.paymentDate}</span></div>
                  <div className="ow-proforma-row"><span className="ow-proforma-label">سجّله:</span><span className="ow-proforma-value">{d.recordedBy} — {d.recordedAt}</span></div>
                  {d.note && (
                    <div className="ow-proforma-row"><span className="ow-proforma-label">ملاحظات:</span><span className="ow-proforma-value">{d.note}</span></div>
                  )}
                  {d.attachment && (
                    <div className="ow-proforma-row"><span className="ow-proforma-label">إثبات الدفع:</span><a className="ow-doc-link" href={d.attachment.url} target="_blank" rel="noopener noreferrer">📎 {d.attachment.name}</a></div>
                  )}
                </div>
                {showReturnDeposit && (
                  <div className="ow-proforma-profit">
                    <div className="ow-proforma-profit-title">↩ سبب الإعادة للتصحيح (إلزامي)</div>
                    <textarea className="ow-reject-textarea" style={{ width: '100%' }} value={returnDepositReason} onChange={(e) => setReturnDepositReason(e.target.value)} rows={3} placeholder="اكتب سبب إعادة العربون للتصحيح..." />
                  </div>
                )}
                {!showReturnDeposit && (
                  <div className="ow-proforma-profit">
                    <div className="ow-proforma-profit-title">ملاحظات (اختياري)</div>
                    <textarea className="ow-reject-textarea" style={{ width: '100%' }} value={confirmNote} onChange={(e) => setConfirmNote(e.target.value)} rows={2} placeholder="اكتب ملاحظة هنا..." />
                    <div className="ow-proforma-profit-title" style={{ marginTop: 10 }}>إرفاق ملف (اختياري)</div>
                    <input type="file" onChange={(e) => setConfirmAttachment(e.target.files?.[0] || null)} />
                    {confirmAttachment && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>📎 {confirmAttachment.name}</div>}
                  </div>
                )}
              </div>
              <div className="ow-proforma-footer">
                <button
                  className="ow-proforma-submit"
                  onClick={() => {
                    const actor = { name: persona.name, role: persona.role, dept: persona.department };
                    const result = useOrderStore.getState().confirmDeposit(
                      order.id,
                      {
                        confirmedBy: persona.name,
                        amount: d.amount,
                        currency: d.currency,
                        reference: d.paymentMethod,
                        confirmedAt: '',
                        note: confirmNote.trim() || undefined,
                        attachment: confirmAttachment ? { name: confirmAttachment.name, url: URL.createObjectURL(confirmAttachment) } : undefined
                      },
                      actor,
                    );
                    if (!result.ok) { alert(`تعذّر تأكيد العربون: ${result.error}`); return; }
                    addLog(persona.name, persona.department, `💳 تأكيد العربون للطلب #${order.orderNumber}`, `${d.amount} ${d.currency}`);
                    setShowConfirmDeposit(false);
                  }}
                >
                  ✅ تأكيد العربون
                </button>
                {!showReturnDeposit ? (
                  <button className="ow-proforma-cancel" onClick={() => setShowReturnDeposit(true)}>↩ إعادة للتصحيح</button>
                ) : (
                  <button
                    className="ow-pricing-reject-btn"
                    disabled={!returnDepositReason.trim()}
                    onClick={() => {
                      const actor = { name: persona.name, role: persona.role, dept: persona.department };
                      const result = useOrderStore.getState().returnDeposit(order.id, actor, returnDepositReason.trim());
                      if (!result.ok) { alert(`تعذّر الإعادة: ${result.error}`); return; }
                      addLog(persona.name, persona.department, `↩ إعادة العربون للتصحيح للطلب #${order.orderNumber}`, returnDepositReason.slice(0, 120));
                      setShowConfirmDeposit(false);
                      setShowReturnDeposit(false);
                      setReturnDepositReason('');
                    }}
                  >
                    📤 إرسال الإعادة
                  </button>
                )}
                <button className="ow-proforma-cancel" onClick={() => { setShowConfirmDeposit(false); setShowReturnDeposit(false); setReturnDepositReason(''); }}>إغلاق</button>
              </div>
            </div>
          </div>
        );
      })()}

      {showFactoryPaymentForm && (
        <div className="ow-modal-overlay" onClick={() => setShowFactoryPaymentForm(false)}>
          <div className="ow-proforma-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ow-proforma-header">
              <h3>🏭 تسجيل دفع المعمل</h3>
              <button className="ow-proforma-close" onClick={() => setShowFactoryPaymentForm(false)}>✕</button>
            </div>
            <div className="ow-proforma-body">
              <div className="ow-pricing-form-row">
                <div className="ow-pricing-form-group">
                  <label className="ow-pricing-form-label">المبلغ *</label>
                  <input className="ow-pricing-form-input" type="text" inputMode="decimal" value={factoryPayAmount} onChange={(e) => setFactoryPayAmount(e.target.value)} placeholder="0" />
                </div>
                <div className="ow-pricing-form-group" style={{ maxWidth: 160 }}>
                  <label className="ow-pricing-form-label">العملة *</label>
                  <select className="ow-pricing-form-input" value={factoryPayCurrency} onChange={(e) => setFactoryPayCurrency(e.target.value as 'RMB' | 'USD')}>
                    <option value="RMB">RMB (¥)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>
              <div className="ow-pricing-form-row">
                <div className="ow-pricing-form-group">
                  <label className="ow-pricing-form-label">طريقة الدفع *</label>
                  <select className="ow-pricing-form-input" value={factoryPayMethod} onChange={(e) => setFactoryPayMethod(e.target.value as import('../types').FactoryPaymentMethod)}>
                    <option value="rmb_jasmine">رمبي من عند جاسمين</option>
                    <option value="rmb_exchange_office">رمبي دايركتلي من الصراف</option>
                    <option value="usd_bank">دولار عن طريق البنك</option>
                  </select>
                </div>
                <div className="ow-pricing-form-group">
                  <label className="ow-pricing-form-label">مرجع الدفع (اختياري)</label>
                  <input className="ow-pricing-form-input" type="text" value={factoryPayReference} onChange={(e) => setFactoryPayReference(e.target.value)} placeholder="رقم تحويل، إشعار مصرفي، ..." />
                </div>
              </div>
              <div className="ow-pricing-form-row">
                <div className="ow-pricing-form-group">
                  <label className="ow-pricing-form-label">ملاحظة المشتريات (اختياري)</label>
                  <textarea className="ow-pricing-form-input" value={factoryPayNote} onChange={(e) => setFactoryPayNote(e.target.value)} rows={2} placeholder="أي معلومة مفيدة للحسابات" />
                </div>
              </div>
              <div className="ow-pricing-form-row">
                <div className="ow-pricing-form-group">
                  <label className="ow-pricing-form-label">إثبات الدفع (اختياري)</label>
                  <input className="ow-pricing-form-input" type="file" accept="image/*,application/pdf" onChange={(e) => setFactoryPayAttachment(e.target.files?.[0] || null)} />
                  {factoryPayAttachment && (
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>📎 {factoryPayAttachment.name}</div>
                  )}
                </div>
              </div>
              <div className="ow-proforma-summary" style={{ background: '#fef3c7', color: '#78350f' }}>
                ملاحظة: لا يتغيّر وضع الطلب حتى تؤكّد الحسابات دفع المعمل. لا يمكن للمشتريات تأكيد دفعها بنفسها.
              </div>
            </div>
            <div className="ow-proforma-footer">
              <button
                className="ow-proforma-submit"
                disabled={!factoryPayAmount.trim()}
                onClick={() => {
                  const amount = parseArabicNumber(factoryPayAmount);
                  const actor = { name: persona.name, role: persona.role, dept: persona.department };
                  const attachment = factoryPayAttachment ? { name: factoryPayAttachment.name, url: URL.createObjectURL(factoryPayAttachment), mimeType: factoryPayAttachment.type, size: factoryPayAttachment.size } : undefined;
                  const result = useOrderStore.getState().recordFactoryPayment(
                    order.id,
                    { amount, currency: factoryPayCurrency, paymentMethod: factoryPayMethod, reference: factoryPayReference.trim() || undefined, note: factoryPayNote.trim() || undefined, attachment },
                    actor,
                  );
                  if (!result.ok) { alert(`تعذّر حفظ دفع المعمل: ${result.error}`); return; }
                  addLog(persona.name, persona.department, `🏭 تسجيل دفع المعمل للطلب #${order.orderNumber}`, `${amount} ${factoryPayCurrency}`);
                  setShowFactoryPaymentForm(false);
                }}
              >
                ✅ حفظ وإعلام الحسابات
              </button>
              <button className="ow-proforma-cancel" onClick={() => setShowFactoryPaymentForm(false)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {showConfirmFactoryPayment && order.factoryPayment && (() => {
        const p = order.factoryPayment;
        const methodLabel = ({ rmb_jasmine: 'رمبي من عند جاسمين', rmb_exchange_office: 'رمبي دايركتلي من الصراف', usd_bank: 'دولار عن طريق البنك' } as Record<string, string>)[p.paymentMethod];
        const canConfirm = p.recordedBy !== persona.name;
        return (
          <div className="ow-modal-overlay" onClick={() => setShowConfirmFactoryPayment(false)}>
            <div className="ow-proforma-modal" onClick={(e) => e.stopPropagation()}>
              <div className="ow-proforma-header">
                <h3>✅ تأكيد دفع المشتريات للمعمل</h3>
                <button className="ow-proforma-close" onClick={() => setShowConfirmFactoryPayment(false)}>✕</button>
              </div>
              <div className="ow-proforma-body">
                <div className="ow-proforma-info">
                  <div className="ow-proforma-row"><span className="ow-proforma-label">المبلغ:</span><span className="ow-proforma-value">{formatNumber(p.amount)} {p.currency}</span></div>
                  <div className="ow-proforma-row"><span className="ow-proforma-label">طريقة الدفع:</span><span className="ow-proforma-value">{methodLabel}</span></div>
                  {p.reference && <div className="ow-proforma-row"><span className="ow-proforma-label">المرجع:</span><span className="ow-proforma-value">{p.reference}</span></div>}
                  <div className="ow-proforma-row"><span className="ow-proforma-label">سجّله:</span><span className="ow-proforma-value">{p.recordedBy} — {p.recordedAt}</span></div>
                  {p.note && <div className="ow-proforma-row"><span className="ow-proforma-label">ملاحظة المشتريات:</span><span className="ow-proforma-value">{p.note}</span></div>}
                  {p.attachment && (
                    <div className="ow-proforma-row"><span className="ow-proforma-label">إثبات الدفع:</span><a className="ow-doc-link" href={p.attachment.url} target="_blank" rel="noopener noreferrer">📎 {p.attachment.name}</a></div>
                  )}
                </div>
                {!canConfirm && (
                  <div className="ow-proforma-summary" style={{ background: '#fee2e2', color: '#7f1d1d' }}>
                    لا يمكنك تأكيد دفع سجّلته بنفسك. التأكيد من صلاحية الحسابات فقط.
                  </div>
                )}
              </div>
              <div className="ow-proforma-footer">
                <button
                  className="ow-proforma-submit"
                  disabled={!canConfirm}
                  onClick={() => {
                    const actor = { name: persona.name, role: persona.role, dept: persona.department };
                    const result = useOrderStore.getState().confirmFactoryPayment(order.id, actor);
                    if (!result.ok) { alert(`تعذّر التأكيد: ${result.error}`); return; }
                    addLog(persona.name, persona.department, `✅ تأكيد دفع المعمل للطلب #${order.orderNumber}`, `${p.amount} ${p.currency}`);
                    setShowConfirmFactoryPayment(false);
                  }}
                >
                  ✅ تأكيد الدفع
                </button>
                <button className="ow-proforma-cancel" onClick={() => setShowConfirmFactoryPayment(false)}>إغلاق</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ============================================================
// ProformaModalV2 — new isolated modal (does NOT use useModal).
// Local state only. Never seeds from order.proforma.
// Always opens with clean defaults. Layout arranged by template.
// ============================================================

interface ProformaExportValues {
  profitPercent: string;
  currency: QuotationCurrency;
  template: QuotationTemplate;
}

interface ProformaModalV2Props {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  onExportPDF: (values: ProformaExportValues) => void | Promise<void>;
  onExportExcel: (values: ProformaExportValues) => void | Promise<void>;
}

function ProformaModalV2({ isOpen, onClose, order, onExportPDF, onExportExcel }: ProformaModalV2Props) {
  const [profitPercent, setProfitPercent] = useState<string>('');
  const [currency, setCurrency] = useState<QuotationCurrency>('USD');
  const [template, setTemplate] = useState<QuotationTemplate>(1);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isExportingPDF, setIsExportingPDF] = useState<boolean>(false);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);

  // Clean-slate on every open. Never seed from order.proforma and never
  // rehydrate a previously saved quotation — the modal always starts fresh.
  useEffect(() => {
    if (!isOpen) return;
    setProfitPercent('');
    setCurrency('USD');
    setTemplate(1);
    setStatusMessage('');
    setIsExportingPDF(false);
    setIsExportingExcel(false);
  }, [isOpen]);

  if (!isOpen) return null;

  // Preview computations — derived, not stored. Base totals come from the
  // most recent pricing entry; profit percent flows through parseArabicNumber
  // so users can type either Latin or Arabic digits.
  const latestPricing = order.pricingHistory?.length
    ? order.pricingHistory[order.pricingHistory.length - 1]
    : null;
  const baseUSD = latestPricing?.totalUSD ?? 0;
  const baseRMB = latestPricing?.totalRMB ?? 0;
  const pct = parseArabicNumber(profitPercent);
  const base = currency === 'USD' ? baseUSD : baseRMB;
  const profitValue = base * pct / 100;
  const finalTotal = base + profitValue;
  const symbol = currency === 'USD' ? '$' : '¥';
  const productCount = order.optionalFields?.quantity ?? '—';
  const templateLabel =
    template === 1 ? 'Template 1 — جدول قياسي' : 'Template 2 — منتج لكل صفحة';
  const isBusy = isExportingPDF || isExportingExcel;

  const handleExportPDFClick = async () => {
    if (isBusy) return;
    setStatusMessage('');
    setIsExportingPDF(true);
    try {
      await onExportPDF({ profitPercent, currency, template });
      setStatusMessage('تم فتح ملف PDF بنجاح');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطأ غير متوقع';
      setStatusMessage(`تعذّر تصدير PDF: ${msg}`);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportExcelClick = async () => {
    if (isBusy) return;
    setStatusMessage('');
    setIsExportingExcel(true);
    try {
      await onExportExcel({ profitPercent, currency, template });
      setStatusMessage('تم تصدير ملف Excel بنجاح');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطأ غير متوقع';
      setStatusMessage(`تعذّر تصدير Excel: ${msg}`);
    } finally {
      setIsExportingExcel(false);
    }
  };

  return (
    <div
      className="ow-proforma-modal"
      role="dialog"
      aria-modal="false"
      aria-label="إعداد عرض السعر للزبون"
    >
      {/* HEADER: title + client + order # + close */}
      <div className="ow-proforma-header">
        <div>
          <h3>📄 إعداد عرض السعر للزبون</h3>
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
            {order.clientName}
            {order.orderNumber ? ` — طلب #${order.orderNumber}` : ''}
          </div>
        </div>
        <button
          type="button"
          className="ow-proforma-close"
          onClick={onClose}
          aria-label="إغلاق"
        >
          ✕
        </button>
      </div>

      <div className="ow-proforma-body">
        {/* SETTINGS: profit %, currency, template */}
        <div className="ow-proforma-profit">
          <div className="ow-proforma-profit-title">⚙️ الإعدادات</div>
          <div className="ow-proforma-profit-controls">
            <div className="ow-proforma-profit-group">
              <label className="ow-proforma-profit-label">نسبة الربح %</label>
              <input
                className="ow-proforma-profit-input"
                type="text"
                inputMode="decimal"
                value={profitPercent}
                onChange={(e) => setProfitPercent(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="ow-proforma-profit-group">
              <label className="ow-proforma-profit-label">العملة</label>
              <select
                className="ow-pricing-currency-select-sm"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as QuotationCurrency)}
              >
                <option value="USD">USD ($)</option>
                <option value="RMB">RMB (¥)</option>
              </select>
            </div>
            <div className="ow-proforma-profit-group">
              <label className="ow-proforma-profit-label">القالب</label>
              <select
                className="ow-pricing-currency-select-sm"
                value={String(template)}
                onChange={(e) =>
                  setTemplate(Number(e.target.value) as QuotationTemplate)
                }
              >
                <option value="1">Template 1 — جدول قياسي</option>
                <option value="2">Template 2 — منتج لكل صفحة</option>
              </select>
            </div>
          </div>
        </div>

        {/* PREVIEW */}
        <div className="ow-proforma-info">
          <div className="ow-proforma-row">
            <span className="ow-proforma-label">الزبون:</span>
            <span className="ow-proforma-value">{order.clientName}</span>
          </div>
          <div className="ow-proforma-row">
            <span className="ow-proforma-label">عدد المنتجات:</span>
            <span className="ow-proforma-value">{productCount}</span>
          </div>
          <div className="ow-proforma-row">
            <span className="ow-proforma-label">الإجمالي الأساسي:</span>
            <span className="ow-proforma-value">
              {symbol} {formatNumber(base)} {currency}
            </span>
          </div>
          <div className="ow-proforma-row">
            <span className="ow-proforma-label">قيمة الربح:</span>
            <span className="ow-proforma-value">
              {symbol} {formatNumber(profitValue)} {currency}
            </span>
          </div>
          <div className="ow-proforma-row">
            <span className="ow-proforma-label">الإجمالي النهائي:</span>
            <span className="ow-proforma-value">
              {symbol} {formatNumber(Math.round(finalTotal), 0)} {currency}
            </span>
          </div>
          <div className="ow-proforma-row">
            <span className="ow-proforma-label">العملة:</span>
            <span className="ow-proforma-value">{currency}</span>
          </div>
          <div className="ow-proforma-row">
            <span className="ow-proforma-label">القالب:</span>
            <span className="ow-proforma-value">{templateLabel}</span>
          </div>
        </div>

        {statusMessage && (
          <div className="ow-proforma-summary">{statusMessage}</div>
        )}
      </div>

      {/* FOOTER */}
      <div className="ow-proforma-footer">
        <button
          type="button"
          className="ow-proforma-submit"
          onClick={handleExportPDFClick}
          disabled={isBusy}
        >
          {isExportingPDF ? '... جارٍ تصدير PDF' : '📄 تصدير PDF'}
        </button>
        <button
          type="button"
          className="ow-proforma-submit"
          onClick={handleExportExcelClick}
          disabled={isBusy}
        >
          {isExportingExcel ? '... جارٍ تصدير Excel' : '📊 تصدير Excel'}
        </button>
        <button type="button" className="ow-proforma-cancel" onClick={onClose}>
          إغلاق
        </button>
      </div>
    </div>
  );
}
