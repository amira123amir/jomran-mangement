import { useState, useEffect, useRef } from 'react';
import { useClientRegistryStore } from '../stores/clientRegistryStore';
import { useExchangeRateStore } from '../stores/exchangeRateStore';
import { useAuditStore } from '../stores/auditStore';
import { usePersonaStore } from '../stores/personaStore';
import { useOrderStore } from '../stores/orderStore';
import { canSeeNote } from '../utils/noteVisibility';
import { QUEUE_FILTERS, statusLabel } from '../utils/orderStatus';
import { parseArabicNumber } from '../utils/arabicNumerals';
import { formatNumber } from '../utils/formatNumber';
import { pad2 } from '../utils/dateHelpers';
import KYCModal from './KYCModal';
import SuccessModal from './SuccessModal';
import OrderWorkspace from './OrderWorkspace';
import OrderStatusFilterBar from './OrderStatusFilterBar';
import type { OrderStatus } from '../types';

const ALL_PEOPLE = '__all__';

const CATEGORIES = [
  { id: 'lighting', label: 'إنارة', icon: '💡' },
  { id: 'computers', label: 'كمبيوترات', icon: '💻' },
  { id: 'building', label: 'مواد بناء', icon: '🧱' },
  { id: 'energy', label: 'طاقة', icon: '⚡' },
  { id: 'cables', label: 'كابلات', icon: '🔌' },
  { id: 'toys', label: 'ألعاب', icon: '🧸' },
  { id: 'home', label: 'منتجات منزلية', icon: '🏠' },
  { id: 'stationery', label: 'مستلزمات مكتبية', icon: '📎' },
  { id: 'carparts', label: 'قطع غيار', icon: '🔩' },
  { id: 'medical', label: 'منتجات طبية', icon: '🏥' },
];

interface OrderField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: string[];
  placeholder?: string;
  unit?: string;
}

function getFieldsForCategory(catId: string): OrderField[] {
  switch (catId) {
    case 'lighting':
      return [
        { key: 'voltage', label: 'الجهد الكهربائي', type: 'select', options: ['220V', '110V', '12V', '24V', '380V'] },
        { key: 'lumens', label: 'شدة الإضاءة (Lumens)', type: 'number', placeholder: 'مثال: 3600', unit: 'lm' },
        { key: 'color', label: 'لون الإضاءة', type: 'select', options: ['أبيض بارد (6500K)', 'أبيض عادي (4000K)', 'أبيض دافئ (3000K)', 'أصفر (2700K)', 'multicolor'] },
      ];
    case 'computers':
      return [
        { key: 'processor', label: 'المعالج', type: 'select', options: ['Intel Core i3', 'Intel Core i5', 'Intel Core i7', 'Intel Core i9', 'AMD Ryzen 3', 'AMD Ryzen 5', 'AMD Ryzen 7', 'Apple M1', 'Apple M2'] },
        { key: 'ram', label: 'الذاكرة العشوائية (RAM)', type: 'select', options: ['4 GB', '8 GB', '16 GB', '32 GB', '64 GB'] },
        { key: 'storage', label: 'سعة التخزين', type: 'select', options: ['256 GB SSD', '512 GB SSD', '1 TB SSD', '2 TB SSD', '1 TB HDD'] },
      ];
    case 'building':
      return [
        { key: 'material_type', label: 'نوع المادة', type: 'select', options: ['أسمنت', 'حديد تسليح', 'رمل', 'حصى', 'بلاط', 'سبك'] },
        { key: 'specifications', label: 'المواصفات', type: 'text', placeholder: 'مثال: أسمنت Portland TYPE I' },
      ];
    case 'energy':
      return [
        { key: 'power_type', label: 'نوع الطاقة', type: 'select', options: ['ألواح شمسية', 'بطاريات', 'inverters', 'مولدات كهربائية', 'محولات'] },
        { key: 'capacity', label: 'السعة / القدرة', type: 'text', placeholder: 'مثال: 5000 واط' },
        { key: 'voltage', label: 'الجهد الكهربائي', type: 'select', options: ['12V', '24V', '48V', '220V', '380V'] },
      ];
    default:
      return [
        { key: 'specifications', label: 'المواصفات التقنية', type: 'text', placeholder: 'المواصفات التفصيلية (اختياري)' },
      ];
  }
}

type ViewMode = 'create' | 'my-orders' | 'workspace';

export default function SalesOrderScreen() {
  const { clients, addClient, incrementOrderCount, getNextSerial } = useClientRegistryStore();
  const { isLocked } = useExchangeRateStore();
  const addLog = useAuditStore((s) => s.addLog);
  const persona = usePersonaStore((s) => s.activePersona);
  const addOrder = useOrderStore((s) => s.addOrder);
  const addDocument = useOrderStore((s) => s.addDocument);
  const allOrders = useOrderStore((s) => s.orders);
  const markNoteRead = useOrderStore((s) => s.markNoteRead);

  const [view, setView] = useState<ViewMode>('create');
  const [showKYC, setShowKYC] = useState(false);
  const [selectedClient, setSelectedClient] = useState('');
  const [category, setCategory] = useState('');
  const [productName, setProductName] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [attachments, setAttachments] = useState<{ name: string; url: string; type: string }[]>([]);
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [validationError, setValidationError] = useState('');
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [lastOrderNum, setLastOrderNum] = useState(0);
  const [lastShippingMark, setLastShippingMark] = useState('');
  const [workspaceOrderId, setWorkspaceOrderId] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [salesQueueFilterId, setSalesQueueFilterId] = useState<string>('all');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentFields = category ? getFieldsForCategory(category) : [];

  const myOrders = allOrders.filter((o) => o.salesPersona === persona.name && !o.archivedAt);
  const actionNeededOrders = myOrders.filter((o) => ['pricing_completed', 'procurement_inquiry'].includes(o.status));
  // Presentation-only filter: never touches the master store.
  const activeQueueFilter = QUEUE_FILTERS.find((f) => f.id === salesQueueFilterId) ?? QUEUE_FILTERS[0];
  const visibleOrders = myOrders.filter((o) => activeQueueFilter.match(o.status));

  const selectedClientData = clients.find((c) => c.id === selectedClient);
  const shippingMark = selectedClientData
    ? `${selectedClientData.shippingMark}-${getNextSerial(selectedClient)}`
    : '';

  const handleKYCSubmit = (data: { legalName: string; phone: string; countryCode: string; country: string; city: string; classification: import('../stores/clientRegistryStore').ClientClassification; customShippingMark: string }) => {
    const client = addClient({ ...data });
    setSelectedClient(client.id);
    addLog(persona.name, persona.department, `تم تسجيل عميل جديد (KYC): ${data.legalName}`, `رمز الشحن: ${client.shippingMark} | التصنيف: ${data.classification} | العملة: ${client.defaultCurrency}`);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newAttachments = Array.from(files).map((file) => ({
        name: file.name,
        url: URL.createObjectURL(file),
        type: file.type,
      }));
      setAttachments((prev) => [...prev, ...newAttachments]);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFieldChange = (key: string, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    setValidationError('');
  };

  const handleSubmit = () => {
    setValidationError('');
    if (!selectedClient) { setValidationError('يجب اختيار عميل مسجل.'); return; }
    if (!productName.trim()) { setValidationError('يجب إدخال اسم المنتج / المادة المطلوبة.'); return; }
    if (!quantity.trim() || parseArabicNumber(quantity) <= 0) { setValidationError('يجب إدخال كمية صحيحة.'); return; }
    if (!isLocked) { setValidationError('لم يتم تثبيت أسعار الصرف بعد.'); return; }

    const client = clients.find((c) => c.id === selectedClient);
    if (!client) { setValidationError('العميل غير موجود.'); return; }

    const serial = getNextSerial(selectedClient);
    const catLabel = CATEGORIES.find((c) => c.id === category)?.label || category;

    const order = addOrder({
      clientId: selectedClient,
      clientName: client.legalName,
      shippingMark: client.shippingMark,
      shippingMarkSerial: serial,
      salesPersona: persona.name,
      salesPersonaDept: persona.department,
      category,
      categoryLabel: catLabel,
      productName: productName.trim(),
      optionalFields: { ...fields, quantity },
      targetPrice: targetPrice ? parseArabicNumber(targetPrice) : undefined,
      factoryUrl: attachmentUrl.trim() || undefined,
    });

    incrementOrderCount(selectedClient);

    attachments.forEach((att) => {
      addDocument(order.id, att.name, att.type.startsWith('image/') ? 'attachment' : 'attachment', att.url, persona.name);
    });

    addLog(
      persona.name, persona.department,
      `تم إرسال الطلب رقم #${order.orderNumber} — رمز الشحن: ${client.shippingMark}-${serial}`,
      `العميل: ${client.legalName} | المنتج: ${productName.trim()} | القسم: ${catLabel} | الكمية: ${quantity}`
    );

    setLastOrderNum(order.orderNumber);
    setLastShippingMark(`${client.shippingMark}-${serial}`);
    setOrderSubmitted(true);

    setTimeout(() => {
      setOrderSubmitted(false);
      setSelectedClient('');
      setCategory('');
      setProductName('');
      setFields({});
      setQuantity('');
      setAttachments([]);
      setAttachmentUrl('');
    }, 3000);
  };

  const handleOpenWorkspace = (orderId: string) => {
    setWorkspaceOrderId(orderId);
    setView('workspace');
    markNoteRead(orderId, persona.name);
  };

  if (view === 'workspace' && workspaceOrderId) {
    return (
      <div className="sos-screen">
        <button className="ow-back-btn" onClick={() => { setView('my-orders'); setWorkspaceOrderId(null); }}>← العودة لطلباتي</button>
        <OrderWorkspace orderId={workspaceOrderId} />
      </div>
    );
  }

  return (
    <div className="sos-screen">
      {showKYC && <KYCModal onSubmit={handleKYCSubmit} onClose={() => setShowKYC(false)} />}

      {orderSubmitted && (
        <div 
          className="kyc-overlay" 
          onClick={() => setOrderSubmitted(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(11, 13, 16, 0.55)', backdropFilter: 'blur(6px)' }}
        >
          <div 
            className="kyc-modal" 
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-2xl)', width: '580px', maxWidth: '90%', padding: '20px' }}
          >
            <div className="kyc-modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid var(--border-hairline)' }}>
              <h3 className="kyc-modal-title">تم إرسال الطلب بنجاح</h3>
              <button className="kyc-close" onClick={() => setOrderSubmitted(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>
                ✕
              </button>
            </div>
            <div className="kyc-success" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0', gap: '16px' }}>
              <div className="kyc-success-icon" style={{ fontSize: '64px' }}>✅</div>
              <div className="kyc-success-text" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-green)' }}>تم إرسال الطلب بنجاح</div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>رقم الطلب: #{lastOrderNum} | رمز الشحن: {lastShippingMark}</div>
            </div>
          </div>
        </div>
      )}

      <div className="sos-header">
        <div className="sos-header-icon">📋</div>
        <div style={{ flex: 1 }}>
          <h2 className="sos-title">إدارة مبيعاتي</h2>
          <p className="sos-sub">إنشاء طلبات جديدة ومتابعة الطلبات المسعّرة</p>
        </div>
        <div className="sos-view-toggle">
          <button className={`sos-view-btn ${view === 'create' ? 'active' : ''}`} onClick={() => setView('create')}>طلب جديد</button>
          <button className={`sos-view-btn ${view === 'my-orders' ? 'active' : ''}`} onClick={() => setView('my-orders')}>
            طلباتي
            {actionNeededOrders.length > 0 && <span className="sos-view-badge">{actionNeededOrders.length}</span>}
          </button>
        </div>
      </div>

      {view === 'my-orders' ? (
        <div className="sos-my-orders">
          {myOrders.length === 0 ? (
            <div className="empty-state-banner">
              <div className="empty-state-icon">📭</div>
              <div className="empty-state-text">لا توجد طلبات بعد</div>
              <div className="empty-state-sub">ابدأ بإنشاء أول طلب عميل</div>
            </div>
          ) : (
            <>
              {actionNeededOrders.length > 0 && (
                <div className="sos-priced-section">
                  <div className="sos-priced-header">
                    <span className="sos-priced-icon">💰</span>
                    <span className="sos-priced-title">طلبات تحتاج إجراءك ({actionNeededOrders.length})</span>
                  </div>
                  {actionNeededOrders.map((order) => (
                    <div key={order.id} className="sos-pricing-card" onClick={() => handleOpenWorkspace(order.id)}>
                      <div className="sos-pricing-main">
                        <span className="sos-pricing-num">#{order.orderNumber}</span>
                        <span className="sos-pricing-mark">{order.shippingMark}-{order.shippingMarkSerial}</span>
                        <span className="sos-pricing-product">{order.productName}</span>
                        <span className={`sos-order-status status-${order.status}`}>{statusLabel(order.status)}</span>
                        {persona.department === 'sales' && (
                          <>
                            <button
                              className="sos-detail-btn"
                              title={expandedOrderId === order.id ? 'إخفاء الملخص' : 'ملخص الطلب'}
                              onClick={(e) => { e.stopPropagation(); setExpandedOrderId(expandedOrderId === order.id ? null : order.id); }}
                            >
                              {expandedOrderId === order.id ? '⬆ إخفاء الملخص' : '📋 ملخص الطلب'}
                            </button>
                            <button
                              className="sos-detail-btn"
                              title="فتح تفاصيل الطلب الكاملة"
                              onClick={(e) => { e.stopPropagation(); handleOpenWorkspace(order.id); }}
                            >
                              🗂 تفاصيل الطلب
                            </button>
                          </>
                        )}
                      </div>
                      {order.pricingHistory?.length ? (() => { const lp = order.pricingHistory[order.pricingHistory.length - 1]; return (
                        <div className="sos-pricing-details">
                          <span className="sos-pricing-usd">الإجمالي: ${formatNumber(lp.totalUSD)}</span>
                          <span className="sos-pricing-note">⚡ إحصائية خط أنابيب فقط — ليس إيراداً</span>
                        </div>
                      ); })() : null}
                      {expandedOrderId === order.id && (
                        <div className="sos-order-expanded">
                          <div className="sos-order-meta">
                            {[
                              { label: 'العميل', value: order.clientName },
                              { label: 'المنتج', value: order.productName },
                              { label: 'القسم', value: order.categoryLabel || '—' },
                              { label: 'البائع', value: order.salesPersona },
                              { label: 'المشتريات', value: order.claim?.claimedBy || order.assignment?.assignedTo || '—' },
                              { label: 'الكمية', value: order.optionalFields?.quantity || '—' },
                              { label: 'السعر المستهدف', value: order.targetPrice !== undefined ? `$${formatNumber(order.targetPrice)}` : '—' },
                              { label: 'السعر المعتمد', value: (() => { const lp = order.pricingHistory?.length ? order.pricingHistory[order.pricingHistory.length - 1] : null; return lp ? `$${formatNumber(lp.totalUSD)}` : '—'; })() },
                            ].map((f, i) => (
                              <span key={i} className="sos-order-meta-item"><strong>{f.label}:</strong> {f.value}</span>
                            ))}
                          </div>
                          <div className="sos-order-notes">
                            <strong>الملاحظات ({order.notes.filter((n) => canSeeNote(n, persona.name, persona.department)).length}):</strong>
                            {order.notes.filter((n) => canSeeNote(n, persona.name, persona.department)).length === 0 ? (
                              <div style={{ fontSize: 12, color: '#94a3b8' }}>لا توجد ملاحظات متاحة</div>
                            ) : (
                              order.notes.filter((n) => canSeeNote(n, persona.name, persona.department)).map((note) => (
                                <div key={note.id} className="sos-note-item">
                                  <div className="sos-note-header">
                                    <span className="sos-note-author">{note.authorPersona}</span>
                                    <span className="sos-note-target">→ {note.targetPersona === ALL_PEOPLE ? '👥 الجميع' : note.targetPersona}</span>
                                    <span className="sos-note-time">{note.createdAt}</span>
                                  </div>
                                  <div className="sos-note-content">{note.content}</div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="sos-all-orders">
                <h3 className="sos-all-orders-title">جميع طلباتي ({visibleOrders.length} / {myOrders.length})</h3>
                <OrderStatusFilterBar
                  authorizedOrders={myOrders}
                  activeFilterId={salesQueueFilterId}
                  onFilterChange={setSalesQueueFilterId}
                />
                {visibleOrders.length === 0 ? (
                  <div className="empty-state-banner">
                    <div className="empty-state-icon">📭</div>
                    <div className="empty-state-text">لا توجد طلبات في هذا التصنيف</div>
                  </div>
                ) : (
                  <div className="pw-registry-table-wrap">
                    <table className="pw-registry-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>الشيبينغ مارك</th>
                          <th>العميل</th>
                          <th>المنتج</th>
                          <th>الحالة</th>
                          <th>البائع</th>
                          <th>المشتريات</th>
                          <th>تاريخ الإنشاء</th>
                          <th>آخر تحديث</th>
                          <th>عمر الطلب</th>
                          <th>إجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleOrders.map((order) => (
                          <tr key={order.id}>
                            <td className="pw-registry-num">#{order.orderNumber}</td>
                            <td className="pw-registry-mark">{order.shippingMark}-{order.shippingMarkSerial}</td>
                            <td className="pw-registry-product">{order.clientName}</td>
                            <td className="pw-registry-product">{order.productName || '—'}</td>
                            <td><span className={`pw-registry-status status-${order.status}`}>{statusLabel(order.status)}</span></td>
                            <td>{order.salesPersona || '—'}</td>
                            <td>{order.claim?.claimedBy || order.assignment?.assignedTo || '—'}</td>
                            <td className="pw-registry-time">{order.createdAt}</td>
                            <td className="pw-registry-time">{order.updatedAt}</td>
                            <td>
                              <span className="pw-registry-age">⏱ <SalesAgeCell createdAt={order.createdAt} /></span>
                            </td>
                            <td>
                              <div className="pw-registry-actions">
                                <button className="pw-workspace-btn" onClick={() => handleOpenWorkspace(order.id)}>📋 مركز الطلب</button>
                                <button
                                  className="pw-workspace-btn"
                                  onClick={(e) => { e.stopPropagation(); setExpandedOrderId(expandedOrderId === order.id ? null : order.id); }}
                                >
                                  {expandedOrderId === order.id ? '⬆ إخفاء الملخص' : '📋 ملخص الطلب'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          {!isLocked && (
            <div className="sos-warning-bar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span>لم يتم تثبيت أسعار الصرف بعد — يجب على المحاسبة تثبيت الأسعار قبل إرسال أي طلب</span>
            </div>
          )}

          {validationError && (
            <div className="sos-error-bar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              <span>{validationError}</span>
            </div>
          )}

          <div className="sos-form">
            <div className="sos-section">
              <div className="sos-section-title">
                <span className="sos-section-num">١</span>
                بيانات العميل
              </div>
              <div className="sos-client-row">
                <div className="sos-field flex-1">
                  <label className="sos-label">العميل <span className="req">*</span></label>
                  <select className="sos-input" value={selectedClient} onChange={(e) => { setSelectedClient(e.target.value); setValidationError(''); }}>
                    <option value="">— اختر عميل مسجلاً —</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.legalName} ({c.shippingMark} — {c.defaultCurrency})</option>
                    ))}
                  </select>
                </div>
                <button className="sos-kyc-btn" onClick={() => setShowKYC(true)}>
                  <span>+</span> تسجيل عميل جديد (KYC)
                </button>
              </div>
              {selectedClientData && (
                <div className="sos-client-info">
                  <span>{selectedClientData.countryCode} {selectedClientData.phone}</span>
                  <span>•</span>
                  <span>{selectedClientData.city}، {selectedClientData.country}</span>
                  <span>•</span>
                  <span>{selectedClientData.classification}</span>
                  <span>•</span>
                  <span className="sos-client-currency">العملة: {selectedClientData.defaultCurrency}</span>
                  {shippingMark && (
                    <>
                      <span>•</span>
                      <span className="sos-shipping-mark-display">🏷️ {shippingMark}</span>
                      {selectedClientData.shippingMarkLocked && (
                        <span className="sos-mark-locked">🔒 مقفل</span>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="sos-section">
              <div className="sos-section-title">
                <span className="sos-section-num">٢</span>
                تفاصيل الطلب
              </div>
              <div className="sos-field" style={{ marginBottom: 14 }}>
                <label className="sos-label">اسم المنتج / المادة المطلوبة <span className="req">*</span></label>
                <input className="sos-input" type="text" value={productName} onChange={(e) => { setProductName(e.target.value); setValidationError(''); }} placeholder="مثال: بانل إضاءة LED 60x60 | لابتوب Dell Latitude 5520" />
              </div>

              <div className="sos-field" style={{ marginBottom: 14 }}>
                <label className="sos-label">الكمية المطلوبة <span className="req">*</span></label>
                <input className="sos-input" type="text" inputMode="numeric" value={quantity} onChange={(e) => { setQuantity(e.target.value); setValidationError(''); }} placeholder="0" min="1" />
              </div>

              <div className="sos-field" style={{ marginBottom: 14 }}>
                <label className="sos-label">التسعير المستهدف (USD) <span className="sos-optional-tag">(اختياري)</span></label>
                <input className="sos-input" type="text" inputMode="decimal" value={targetPrice} onChange={(e) => { if (/^\d*\.?\d*$/.test(e.target.value) || e.target.value === '') setTargetPrice(e.target.value); }} placeholder="0.000" />
              </div>

              <div className="sos-field">
                <label className="sos-label">القسم الرئيسي للطلب <span className="sos-optional-tag">(اختياري)</span></label>
                <div className="sos-category-grid">
                  {CATEGORIES.map((cat) => (
                    <button key={cat.id} className={`sos-cat-btn ${category === cat.id ? 'selected' : ''}`}
                      onClick={() => { setCategory(cat.id); setFields({}); setValidationError(''); }}>
                      <span className="sos-cat-icon">{cat.icon}</span>
                      <span className="sos-cat-label">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {category && currentFields.length > 0 && (
                <div className="sos-dynamic-fields">
                  <div className="sos-dynamic-hint">
                    الحقول التقنية التالية لقسم <strong>{CATEGORIES.find((c) => c.id === category)?.label}</strong> — <em>اختيارية</em>
                  </div>
                  <div className="sos-fields-grid">
                    {currentFields.map((f) => (
                      <div key={f.key} className="sos-field">
                        <label className="sos-label">{f.label} <span className="sos-optional-tag">(اختياري)</span></label>
                        {f.type === 'select' ? (
                          <select className="sos-input" value={fields[f.key] || ''} onChange={(e) => handleFieldChange(f.key, e.target.value)}>
                            <option value="">— اختر (اختياري) —</option>
                            {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <div className="sos-input-with-unit">
                            <input className="sos-input" type={f.type} value={fields[f.key] || ''} onChange={(e) => handleFieldChange(f.key, e.target.value)} placeholder={f.placeholder} />
                            {f.unit && <span className="sos-input-unit">{f.unit}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="sos-section">
              <div className="sos-section-title">
                <span className="sos-section-num">٣</span>
                المرفقات <span className="sos-optional-tag">(اختياري)</span>
              </div>
              <div className="sos-attachment-area">
                <input ref={fileInputRef} type="file" accept="image/*,video/*,.pdf" multiple className="sos-file-input" onChange={handleFileSelect} />
                <div className="sos-attachment-box" onClick={() => fileInputRef.current?.click()}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                  </svg>
                  <span className="sos-attachment-hint">انقر هنا لرفع الملفات</span>
                  <span className="sos-attachment-sub">صور، فيديو، PDF — بدون حد (عدد غير محدود)</span>
                </div>
                {attachments.length > 0 && (
                  <div className="sos-file-gallery">
                    {attachments.map((att, idx) => (
                      <div key={idx} className="sos-file-card">
                        {att.type.startsWith('image/') ? (
                          <img src={att.url} alt={att.name} className="sos-file-thumb" />
                        ) : att.type.startsWith('video/') ? (
                          <div className="sos-file-thumb sos-file-video">🎬</div>
                        ) : (
                          <div className="sos-file-thumb sos-file-pdf">📄</div>
                        )}
                        <div className="sos-file-info">
                          <span className="sos-file-name">{att.name}</span>
                          <span className="sos-file-ok">تم الرفع</span>
                        </div>
                        <button className="sos-file-remove" onClick={(e) => { e.stopPropagation(); handleRemoveAttachment(idx); }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="sos-url-or"><span>أو</span></div>
                <div className="sos-field">
                  <label className="sos-label">رابط المصنع / صفحة المنتج</label>
                  <input className="sos-input" type="url" value={attachmentUrl} onChange={(e) => { setAttachmentUrl(e.target.value); setValidationError(''); }} placeholder="https://..." dir="ltr" />
                </div>
              </div>
            </div>

            <div className="sos-submit-area">
              <button className="sos-submit-btn" onClick={handleSubmit}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
                إرسال إلى طابور المشتريات
              </button>
              {isLocked && (
                <div className="sos-exchange-info">
                  <span className="sos-exchange-dot" />
                  أسعار الصرف معتمدة
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SalesAgeCell({ createdAt }: { createdAt: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Date.now() - new Date(createdAt.replace(' ', 'T')).getTime();
  const totalSec = Math.max(0, Math.floor(diff / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return <span className="sos-order-age">⏱ {pad2(h)}:{pad2(m)}:{pad2(s)}</span>;
}
