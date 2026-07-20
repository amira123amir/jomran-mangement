import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { useOrderStore } from '../stores/orderStore';
import { usePersonaStore } from '../stores/personaStore';
import { useAuditStore } from '../stores/auditStore';
import { useExchangeRateStore } from '../stores/exchangeRateStore';
import { canViewSupplierData } from '../utils/supplierMask';
import OrderDetailsTabs from './OrderDetails';
import PricingTab from './PricingTab';
import { ORDER_NOTE_TARGETS, canSeeNote } from '../utils/noteVisibility';

const STATUS_LABELS: Record<string, string> = {
  pending: '⏳ بانتظار التعيين', claimed: '🔧 قيد المعالجة', pending_sales_info: '🔴 بانتظار معلومات المبيعات',
  pending_factory_info: '🏭 بانتظار معلومات المصنع', priced: '💰 تم التسعير', revision: '🔄 مراجعة',
  locked: '🔒 مقفل', deposit_received: '💳 تم استلام الدفعة', completed: '✅ مكتمل',
  price_given: '📄 تم إعطاء السعر للزبون', waiting_customer: '📄 بانتظار رد الزبون',
};

const ALL_PEOPLE = '__all__';

export default function OrderWorkspace({ orderId, initialSection }: { orderId: string; initialSection?: 'info' | 'pricing' | 'negotiation' | 'notes' }) {
  const order = useOrderStore((s) => s.orders.find((o) => o.id === orderId));
  const latestPricing = order?.pricingHistory?.length ? order.pricingHistory[order.pricingHistory.length - 1] : null;
  const { addNote, markNoteRead, replyToNote, requestInfo, submitPricing, submitProforma, updateSupplierData, requestShippingMarkChange, addDocument, deleteOrder } = useOrderStore();
  const persona = usePersonaStore((s) => s.activePersona);
  const addLog = useAuditStore((s) => s.addLog);
  const { rates } = useExchangeRateStore();

  const [activeSection, setActiveSection] = useState<'info' | 'pricing' | 'negotiation' | 'notes'>(initialSection || 'info');
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

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!order) return <div className="ow-not-found">الطلب غير موجود</div>;

  const showSupplier = canViewSupplierData(persona.name);
  const isProcurement = persona.department === 'procurement';
  const isSales = persona.department === 'sales';
  const isConfirmed = order.status === 'locked' || order.status === 'deposit_received' || order.status === 'completed';
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
    const er = parseFloat(exchangeRateInput) || parseFloat(rates.rmb) || 1;
    const toRmb = (val: string, cur: 'RMB' | 'USD') => cur === 'USD' ? (parseFloat(val) || 0) * er : (parseFloat(val) || 0);
    const fp = toRmb(factoryPrice, itemCurrencies.factoryPrice);
    const ics = toRmb(internalChinaShipping, itemCurrencies.internalChinaShipping);
    const sc = toRmb(shippingCost, itemCurrencies.shippingCost);
    const mc = toRmb(miscCosts, itemCurrencies.miscCosts);
    const oc = toRmb(otherCosts, itemCurrencies.otherCosts);
    if (!fp || fp <= 0 || !er) return;
    submitPricing(order.id, { factoryPriceRMB: fp, shippingCostRMB: sc, internalChinaShippingRMB: ics, miscellaneousCostsRMB: mc, otherCostsRMB: oc, totalRMB: 0, exchangeRateUsed: er, totalUSD: 0, submittedBy: persona.name, currency: 'RMB' });
    if (supplierName.trim() || supplierPhone.trim() || procurementNotes.trim()) {
      updateSupplierData(order.id, { factoryName: supplierName.trim(), factoryPhone: supplierPhone.trim(), procurementNotes: procurementNotes.trim() }, persona.name);
    }
    setShowPriceForm(false);
  };
  const handleMarkChange = () => { requestShippingMarkChange(order.id, persona.name, order.shippingMark, newMark.trim()); setShowMarkChange(false); };
  const handleDeleteOrder = () => {
    const ok = deleteOrder(order.id, persona.name);
    if (ok) addLog(persona.name, persona.department, `🗑️ حذف الطلب #${order.orderNumber}`, '');
  };
  const handleSubmitProforma = () => {
    if (!latestPricing) return;
    const baseTotalRMB = latestPricing.totalRMB;
    const baseTotalUSD = latestPricing.totalUSD;
    const pct = parseFloat(proformaProfitPercent) || 0;
    const fixed = parseFloat(proformaProfitFixed) || 0;
    const finalRMB = baseTotalRMB + (baseTotalRMB * pct / 100) + fixed;
    const finalUSD = latestPricing.exchangeRateUsed > 0 ? +(finalRMB / latestPricing.exchangeRateUsed).toFixed(3) : 0;
    submitProforma(order.id, { baseTotalRMB, baseTotalUSD, profitPercent: pct, profitFixed: fixed, finalPriceRMB: +finalRMB.toFixed(3), finalPriceUSD: finalUSD, submittedBy: persona.name });
    addLog(persona.name, persona.department, `📄 إصدار فاتورة للطلب #${order.orderNumber} — السعر النهائي: ${finalRMB.toFixed(3)} RMB ($${finalUSD})`, '');
    setShowProforma(false);
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

  const diff = Date.now() - new Date(order.createdAt.replace(' ', 'T')).getTime();
  const totalSec = Math.max(0, Math.floor(diff / 1000));
  const ageH = Math.floor(totalSec / 3600);
  const ageM = Math.floor((totalSec % 3600) / 60);
  const ageS = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  const er = parseFloat(exchangeRateInput) || parseFloat(rates.rmb) || 1;
  const toRmb2 = (val: string, cur: 'RMB' | 'USD') => cur === 'USD' ? (parseFloat(val) || 0) * er : (parseFloat(val) || 0);
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
          <span className={`ow-status-badge status-${order.status}`}>{STATUS_LABELS[order.status]}</span>
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

      {isConfirmed && (
        <div className="ow-mark-warning">
          🔒 لا يمكن تعديل الشيبينغ مارك للطلبيات المؤكدة. يرجى الحصول على موافقة مديرة المبيعات، مديرة المحاسبة، أو المدير العام
        </div>
      )}

      {confirmDelete && (
        <div className="ow-modal-overlay" onClick={() => setConfirmDelete(false)}>
          <div className="ow-delete-confirm" onClick={(e) => e.stopPropagation()}>
            <span className="ow-delete-confirm-title">⚠️ تأكيد حذف الطلب</span>
            <span className="ow-delete-confirm-text">هل أنت متأكد من حذف الطلب <strong>#{order.orderNumber}</strong>{!isProcurement ? <> للعميل <strong>{order.clientName}</strong></> : ''}؟ هذا الإجراء لا يمكن التراجع عنه.</span>
            <div className="ow-delete-confirm-actions">
              <button className="ow-delete-confirm-cancel" onClick={() => setConfirmDelete(false)}>إلغاء</button>
              <button className="ow-delete-confirm-proceed" onClick={handleDeleteOrder}>نعم، احذف الطلب</button>
            </div>
          </div>
        </div>
      )}

      {/* التبويبات الموحدة */}
      <OrderDetailsTabs order={order} activeSection={activeSection} onTabChange={setActiveSection} onDelete={() => setConfirmDelete(true)} />

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

          {order.supplierData && (
            <div className="ow-details-subsection">
              <div className="ow-details-subtitle">المصنع</div>
              <div className="ow-details-grid">
                <div className="ow-details-row">
                  <span className="ow-details-label">الاسم:</span>
                  <span className="ow-details-value">{showSupplier ? order.supplierData.factoryName : '***'}</span>
                </div>
                <div className="ow-details-row">
                  <span className="ow-details-label">الهاتف:</span>
                  <span className="ow-details-value">{showSupplier ? order.supplierData.factoryPhone : '***'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* التسعير — فورم التسعير المباشر + سجل الأسعار */}
      {activeSection === 'pricing' && (
        <>
          {isProcurement && !showPriceForm && (
            <button className="add-price-btn" onClick={() => setShowPriceForm(true)}>💰 تسعير</button>
          )}
          {showPriceForm && (
            <div className="ow-pricing-form" style={{ marginTop: 16 }}>
              <div className="ow-pricing-form-title">💰 إدخال تسعيرة جديدة</div>
              <div className="ow-pricing-form-row">
                <div className="ow-pricing-form-group" style={{ maxWidth: 250 }}>
                  <label className="ow-pricing-form-label">سعر الصرف (USD → RMB)</label>
                  <input className={`ow-pricing-form-input ow-exrate-field ${isProcurement ? 'ow-exrate-readonly' : ''}`} type="number" value={exchangeRateInput || rates.rmb || '6.7'} onChange={(e) => { if (!isProcurement) setExchangeRateInput(e.target.value); }} placeholder={rates.rmb || '6.7'} min="0" step="0.01" readOnly={isProcurement} />
                </div>
              </div>
              <div className="ow-pricing-form-row">
                <div className="ow-pricing-form-group">
                  <label className="ow-pricing-form-label">السعر الأساسي</label>
                  <div className="ow-pricing-currency-group">
                    <input className="ow-pricing-form-input ow-pricing-amount-input" type="number" value={factoryPrice} onChange={(e) => setFactoryPrice(e.target.value)} placeholder="0" min="0" />
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
                    <input className="ow-pricing-form-input ow-pricing-amount-input" type="number" value={internalChinaShipping} onChange={(e) => setInternalChinaShipping(e.target.value)} placeholder="0" min="0" />
                    <select className="ow-pricing-currency-select-sm" value={itemCurrencies.internalChinaShipping} onChange={(e) => setItemCurrencies(prev => ({ ...prev, internalChinaShipping: e.target.value as 'RMB' | 'USD' }))}>
                      <option value="RMB">¥</option><option value="USD">$</option>
                    </select>
                  </div>
                </div>
                <div className="ow-pricing-form-group">
                  <label className="ow-pricing-form-label">شحن خارجي</label>
                  <div className="ow-pricing-currency-group">
                    <input className="ow-pricing-form-input ow-pricing-amount-input" type="number" value={shippingCost} onChange={(e) => setShippingCost(e.target.value)} placeholder="0" min="0" />
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
                    <input className="ow-pricing-form-input ow-pricing-amount-input" type="number" value={miscCosts} onChange={(e) => setMiscCosts(e.target.value)} placeholder="0" min="0" />
                    <select className="ow-pricing-currency-select-sm" value={itemCurrencies.miscCosts} onChange={(e) => setItemCurrencies(prev => ({ ...prev, miscCosts: e.target.value as 'RMB' | 'USD' }))}>
                      <option value="RMB">¥</option><option value="USD">$</option>
                    </select>
                  </div>
                </div>
                <div className="ow-pricing-form-group">
                  <label className="ow-pricing-form-label">مصاريف أخرى</label>
                  <div className="ow-pricing-currency-group">
                    <input className="ow-pricing-form-input ow-pricing-amount-input" type="number" value={otherCosts} onChange={(e) => setOtherCosts(e.target.value)} placeholder="0" min="0" />
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
                <span className="ow-pricing-form-total-value">¥ {totalRmb.toFixed(3)} RMB</span>
                <span className="ow-pricing-form-total-sep">|</span>
                <span className="ow-pricing-form-total-value">$ {totalUsd.toFixed(3)} USD</span>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                <button className="ow-pricing-form-save" onClick={handleSubmitPricing} disabled={!factoryPrice || parseFloat(factoryPrice) <= 0}>💾 حفظ التسعير</button>
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

      {showProforma && latestPricing && (() => {
        const isExisting = !!order.proforma;
        const baseRMB = latestPricing.totalRMB;
        const baseUSD = latestPricing.totalUSD;
        const pct = parseFloat(proformaProfitPercent) || (isExisting ? order.proforma!.profitPercent : 0);
        const fixed = parseFloat(proformaProfitFixed) || (isExisting ? order.proforma!.profitFixed : 0);
        const finalRMB = baseRMB + (baseRMB * pct / 100) + fixed;
        const finalUSD = latestPricing.exchangeRateUsed > 0 ? +(finalRMB / latestPricing.exchangeRateUsed).toFixed(3) : 0;
        const firstImage = order.documents.find(d => d.type === 'attachment' && d.url.startsWith('blob:'));

        return (
          <div className="ow-modal-overlay" onClick={() => setShowProforma(false)}>
            <div className="ow-proforma-modal" onClick={(e) => e.stopPropagation()}>
              <div className="ow-proforma-header">
                <h3>📄 هامش الربح والإجمالي النهائي للزبون</h3>
                <button className="ow-proforma-close" onClick={() => setShowProforma(false)}>✕</button>
              </div>
              <div className="ow-proforma-body">
                {/* صورة المنتج */}
                {firstImage && (
                  <div className="ow-proforma-image-wrap">
                    <img src={firstImage.url} alt="صورة المنتج" className="ow-proforma-image" />
                  </div>
                )}

                {/* معلومات الزبون والطلب */}
                <div className="ow-proforma-info">
                  <div className="ow-proforma-row"><span className="ow-proforma-label">{isProcurement ? 'رقم الطلب:' : 'الزبون:'}</span><span className="ow-proforma-value">{isProcurement ? `#${order.orderNumber}` : order.clientName}</span></div>
                  <div className="ow-proforma-row"><span className="ow-proforma-label">رقم الطلب:</span><span className="ow-proforma-value">#{order.orderNumber}</span></div>
                  <div className="ow-proforma-row"><span className="ow-proforma-label">الشيبينغ مارك:</span><span className="ow-proforma-value">{order.shippingMark}-{order.shippingMarkSerial}</span></div>
                  <div className="ow-proforma-row"><span className="ow-proforma-label">المنتج:</span><span className="ow-proforma-value">{order.productName}</span></div>
                  <div className="ow-proforma-row"><span className="ow-proforma-label">الكمية:</span><span className="ow-proforma-value">{order.optionalFields?.quantity || '—'}</span></div>
                </div>

                {/* السعر الأساسي (التكلفة) */}
                <div className="ow-proforma-cost">
                  <span className="ow-proforma-cost-title">💰 التكلفة الأساسية</span>
                  <div className="ow-proforma-cost-values">
                    <span className="ow-proforma-cost-rmb">¥ {baseRMB.toLocaleString()} RMB</span>
                    <span className="ow-proforma-cost-usd">$ {baseUSD.toLocaleString()} USD</span>
                  </div>
                </div>

                {/* تحكم الربح — يظهر فقط عند إنشاء بروفورما جديدة */}
                {!isExisting && (
                  <div className="ow-proforma-profit">
                    <div className="ow-proforma-profit-title">📈 إضافة الربح</div>
                    <div className="ow-proforma-profit-controls">
                      <div className="ow-proforma-profit-group">
                        <label className="ow-proforma-profit-label">نسبة ربح %</label>
                        <input className="ow-proforma-profit-input" type="number" value={proformaProfitPercent} onChange={(e) => setProformaProfitPercent(e.target.value)} placeholder="0" min="0" />
                      </div>
                      <div className="ow-proforma-profit-sep">أو</div>
                      <div className="ow-proforma-profit-group">
                        <label className="ow-proforma-profit-label">مبلغ ثابت (RMB)</label>
                        <input className="ow-proforma-profit-input" type="number" value={proformaProfitFixed} onChange={(e) => setProformaProfitFixed(e.target.value)} placeholder="0" min="0" />
                      </div>
                    </div>
                  </div>
                )}

                {/* السعر النهائي */}
                <div className="ow-proforma-final">
                  <span className="ow-proforma-final-label">السعر النهائي للزبون:</span>
                  <div className="ow-proforma-final-values">
                    <span className="ow-proforma-final-rmb">¥ {finalRMB.toLocaleString()} RMB</span>
                    <span className="ow-proforma-final-sep">|</span>
                    <span className="ow-proforma-final-usd">$ {finalUSD.toLocaleString()} USD</span>
                  </div>
                </div>

                {/* ملخص الربح */}
                {pct > 0 || fixed > 0 ? (
                  <div className="ow-proforma-summary">
                    <span>الربح: {pct > 0 ? `${pct}%` : ''}{pct > 0 && fixed > 0 ? ' + ' : ''}{fixed > 0 ? `${fixed} RMB` : ''} = {(finalRMB - baseRMB).toFixed(3)} RMB (${((finalRMB - baseRMB) / (latestPricing.exchangeRateUsed || 1)).toFixed(3)} USD)</span>
                  </div>
                ) : null}
              </div>
              <div className="ow-proforma-footer">
                {!isExisting ? (
                  <button className="ow-proforma-submit" onClick={handleSubmitProforma}>✅ تأكيد وإرسال</button>
                ) : (
                  <span className="ow-proforma-sent-label">✅ تم إرسال الفاتورة للزبون بتاريخ {order.proforma!.submittedAt}</span>
                )}
                <button className="ow-proforma-cancel" onClick={() => setShowProforma(false)}>إغلاق</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
