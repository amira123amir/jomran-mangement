import { useState, useEffect } from 'react';
import { useOrderStore } from '../stores/orderStore';
import { usePersonaStore } from '../stores/personaStore';
import { useAuditStore } from '../stores/auditStore';
import { getPersonasByDepartment } from '../data/personas';
import { canViewSupplierData } from '../utils/supplierMask';
import { canSeeNote } from '../utils/noteVisibility';
import OrderWorkspace from './OrderWorkspace';
import { statusLabel, QUEUE_FILTERS } from '../utils/orderStatus';
import { formatNumber } from '../utils/formatNumber';
import { pad2 } from '../utils/dateHelpers';
import { productSummary, categorySummary, orderBaseTotals } from '../utils/orderProducts';
import OrderStatusFilterBar from './OrderStatusFilterBar';
import type { Order } from '../types';

export default function ManagerControlTower() {
  const persona = usePersonaStore((s) => s.activePersona);
  const activeTab = usePersonaStore((s) => s.activeTab);
  const addLog = useAuditStore((s) => s.addLog);
  const orders = useOrderStore((s) => s.orders).filter((o) => !o.archivedAt);
  const assignOrder = useOrderStore((s) => s.assignOrder);
  const requestInfo = useOrderStore((s) => s.requestInfo);

  const [queueFilterId, setQueueFilterId] = useState<string>('all');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<Record<string, string>>({});
  const [noteContent, setNoteContent] = useState('');
  const [workspaceOrderId, setWorkspaceOrderId] = useState<string | null>(null);

  const isSalesManager = persona.name === 'لميس - مديرة المبيعات';
  const isProcManager = persona.name === 'كنانة' && activeTab === 'dashboard';

  const subordinates = getPersonasByDepartment(isSalesManager ? 'sales' : 'procurement')
    .filter((p) => p.name !== persona.name)
    .map((p) => p.name);

  const relevantOrders = isProcManager
    ? orders.filter((o) =>
        !['delivered', 'deposit_confirmed'].includes(o.status) ||
        subordinates.includes(o.assignment?.assignedTo || '') ||
        subordinates.includes(o.claim?.claimedBy || '')
      )
    : orders.filter((o) =>
        o.salesPersona === persona.name ||
        subordinates.includes(o.salesPersona)
      );

  // Apply the full 15-status filter.
  const activeQueueFilter = QUEUE_FILTERS.find((f) => f.id === queueFilterId) ?? QUEUE_FILTERS[0];
  const filtered = relevantOrders.filter((o) => activeQueueFilter.match(o.status));

  const handleAssign = (order: Order, targetName: string) => {
    if (!targetName) return;
    assignOrder(order.id, targetName, persona.name);
    addLog(persona.name, persona.department, `تم تعيين الطلب #${order.orderNumber} لـ ${targetName}`, `الشحنة: ${order.shippingMark}`);
    setAssignTarget((prev) => ({ ...prev, [order.id]: '' }));
  };

  const handleRequestInfo = (order: Order) => {
    if (!noteContent.trim()) return;
    requestInfo(order.id, persona.name, persona.department, noteContent.trim());
    addLog(persona.name, persona.department, `تم إرسال استعلام من ${persona.name} حول الطلب #${order.orderNumber}`, noteContent.trim().slice(0, 60));
    setNoteContent('');
    setExpandedOrder(null);
  };

  const procurementStaff = getPersonasByDepartment('procurement').filter((p) => p.role !== 'مديرة المشتريات');

  const stats = {
    total: relevantOrders.length,
    pending: relevantOrders.filter((o) => o.status === 'waiting_for_assignment').length,
    inProgress: relevantOrders.filter((o) => ['pricing_in_progress', 'procurement_inquiry'].includes(o.status)).length,
    priced: relevantOrders.filter((o) => o.status === 'pricing_completed').length,
    locked: relevantOrders.filter((o) => ['official_quotation_generated', 'deposit_paid', 'deposit_confirmed'].includes(o.status)).length,
    completed: relevantOrders.filter((o) => o.status === 'delivered').length,
    totalRevenue: relevantOrders.reduce((sum, o) => sum + (o.revenue?.actualRevenueUSD || 0), 0),
    totalPipeline: relevantOrders.reduce((sum, o) => sum + orderBaseTotals(o).usd, 0),
  };

  if (workspaceOrderId) {
    return (
      <div className="mct-screen">
        <button className="ow-back-btn" onClick={() => setWorkspaceOrderId(null)}>← العودة إلى برج التحكم</button>
        <OrderWorkspace orderId={workspaceOrderId} />
      </div>
    );
  }

  return (
    <div className="dept-dashboard">
      <div className="dept-welcome">
        <div className="dept-welcome-content">
          <h2 className="dept-welcome-title">أهلاً بك، <span className="highlight">{persona.name}</span></h2>
          <p className="dept-welcome-sub">{isSalesManager ? 'برج التحكم — المبيعات' : 'برج التحكم — المشتريات'}</p>
        </div>
        <div className="dept-welcome-decoration">
          <div className="deco-circle c1" /><div className="deco-circle c2" /><div className="deco-circle c3" />
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: '#f0f9ff' }}><span className="kpi-icon-text">🗂️</span></div>
          <div className="kpi-info"><span className="kpi-value">{stats.total}</span><span className="kpi-label">إجمالي الطلبات</span></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: '#fffbeb' }}><span className="kpi-icon-text">⏳</span></div>
          <div className="kpi-info"><span className="kpi-value">{stats.pending + stats.inProgress}</span><span className="kpi-label">قيد المعالجة</span></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: '#ecfeff' }}><span className="kpi-icon-text">✅</span></div>
          <div className="kpi-info"><span className="kpi-value">{stats.priced + stats.locked}</span><span className="kpi-label">تم التسعير / مقفل</span></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: '#fef3c7' }}><span className="kpi-icon-text">📈</span></div>
          <div className="kpi-info">
            <span className="kpi-value">${formatNumber(stats.totalPipeline)}</span>
            <span className="kpi-label">خط الأنابيب (ليس إيراداً)</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: '#d1fae5' }}><span className="kpi-icon-text">💵</span></div>
          <div className="kpi-info">
            <span className="kpi-value">${formatNumber(stats.totalRevenue)}</span>
            <span className="kpi-label">الإيراد الفعلي</span>
          </div>
        </div>
      </div>


      <div style={{ marginTop: 24, marginBottom: 12 }}>
        <OrderStatusFilterBar authorizedOrders={relevantOrders} activeFilterId={queueFilterId} onFilterChange={setQueueFilterId} />
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state-banner">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-text">لا توجد طلبات تطابق الفلتر المحدد</div>
        </div>
      ) : (
        <div className="pw-registry-table-wrap">
          <table className="pw-registry-table">
            <thead>
              <tr>
                <th>#</th>
                <th>رمز الشحن</th>
                <th>{persona.department === 'procurement' ? 'رقم الطلب' : 'العميل'}</th>
                <th>المنتج</th>
                <th>الحالة</th>
                <th>المسؤول</th>
                <th>عمر الطلب</th>
                <th>التسعير</th>
                <th>الإيراد</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => {
                const assignedTo = order.assignment?.assignedTo || order.claim?.claimedBy || '';
                return (
                  <tr key={order.id} className={expandedOrder === order.id ? 'expanded' : ''}>
                    <td className="pw-registry-num">#{order.orderNumber}</td>
                    <td className="pw-registry-mark">{order.shippingMark}-{order.shippingMarkSerial}</td>
                    <td>{persona.department === 'procurement' ? `#${order.orderNumber}` : order.clientName}</td>
                    <td>{productSummary(order)}</td>
                    <td><span className={`pw-registry-status status-${order.status}`}>{statusLabel(order.status)}</span></td>
                    <td>{assignedTo || '—'}</td>
                    <td><MctAgeCell createdAt={order.createdAt} /></td>
                    <td>{order.pricingHistory?.length ? `$${formatNumber(orderBaseTotals(order).usd)}` : '—'}</td>
                    <td>{order.revenue ? `$${formatNumber(order.revenue.actualRevenueUSD)}` : '$0'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="pw-workspace-btn" onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}>
                          {expandedOrder === order.id ? 'إخفاء' : 'ملخص'}
                        </button>
                        <button className="pw-workspace-btn" style={{ background: 'var(--accent-blue, #2563eb)', color: 'white' }} onClick={() => setWorkspaceOrderId(order.id)}>
                          📋 مركز الطلب
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}



      {expandedOrder && (() => {
        const order = orders.find((o) => o.id === expandedOrder);
        if (!order) return null;
        const showSupplier = canViewSupplierData(persona);
        const lp = order.pricingHistory?.length ? order.pricingHistory[order.pricingHistory.length - 1] : null;
        return (
          <div className="mct-detail-panel">
            <div className="mct-detail-header">
              <h3>تفاصيل الطلب #{order.orderNumber}</h3>
              <button className="mct-close-btn" onClick={() => setExpandedOrder(null)}>✕</button>
            </div>
            <div className="mct-detail-grid">
              <div className="mct-detail-col">
                <div className="mct-detail-row"><span className="mct-detail-label">{persona.department === 'procurement' ? 'رقم الطلب:' : 'العميل:'}</span><span>{persona.department === 'procurement' ? `#${order.orderNumber}` : order.clientName}</span></div>
                <div className="mct-detail-row"><span className="mct-detail-label">المنتجات:</span><span>{productSummary(order)} ({order.products.length})</span></div>
                <div className="mct-detail-row"><span className="mct-detail-label">القسم:</span><span>{categorySummary(order)}</span></div>
                <div className="mct-detail-row"><span className="mct-detail-label">البائع:</span><span>{order.salesPersona}</span></div>
              </div>
              <div className="mct-detail-col">
                {lp && (
                  <>
                    <div className="mct-detail-row"><span className="mct-detail-label">سعر المصنع:</span><span>{lp.factoryPriceRMB} RMB</span></div>
                    <div className="mct-detail-row"><span className="mct-detail-label">الشحن:</span><span>{lp.shippingCostRMB} RMB</span></div>
                    <div className="mct-detail-row"><span className="mct-detail-label">الإجمالي:</span><span>{formatNumber(lp.totalRMB)} RMB / ${formatNumber(lp.totalUSD)}</span></div>
                  </>
                )}
                {order.supplierData && (
                  <div className="mct-detail-row">
                    <span className="mct-detail-label">المصنع:</span>
                    <span>{showSupplier ? order.supplierData.factoryName : '***'}</span>
                  </div>
                )}
                {order.revenue && (
                  <div className="mct-detail-row"><span className="mct-detail-label">الإيراد الفعلي:</span><span>${order.revenue.actualRevenueUSD} — تأكيد نور: {order.revenue.confirmedByNoor ? 'نعم' : 'لا'}</span></div>
                )}
              </div>
            </div>

            {isProcManager && order.status === 'waiting_for_assignment' && (
              <div className="mct-assign-section">
                <div className="mct-assign-title">تعيين موظف مشتريات:</div>
                <div className="mct-assign-row">
                  <select className="mct-assign-select" value={assignTarget[order.id] || ''} onChange={(e) => setAssignTarget((prev) => ({ ...prev, [order.id]: e.target.value }))}>
                    <option value="">— اختر موظف —</option>
                    {procurementStaff.map((p) => (
                      <option key={p.id} value={p.name}>{p.name} — {p.role}</option>
                    ))}
                  </select>
                  <button className="mct-assign-btn" onClick={() => handleAssign(order, assignTarget[order.id] || '')} disabled={!assignTarget[order.id]}>
                    تعيين
                  </button>
                </div>
              </div>
            )}

            {(() => {
              const visibleNotes = order.notes.filter((note) => canSeeNote(note, persona.name, persona.department));
              if (visibleNotes.length === 0) return null;
              return (
              <div className="mct-notes-section">
                <div className="mct-notes-title">الملاحظات ({visibleNotes.length}):</div>
                {visibleNotes.map((note) => (
                  <div key={note.id} className="mct-note-item">
                    <div className="mct-note-header">
                      <span className="mct-note-author">{note.authorPersona}</span>
                      <span>→ {note.targetPersona}</span>
                      <span className="mct-note-time">{note.createdAt}</span>
                    </div>
                    <div className="mct-note-content">{note.content}</div>
                    {note.readBy.length > 0 && (
                      <div className="mct-note-read">
                        {note.readBy.map((r) => `✅ قرأت ${r.persona} في ${r.readAt}`).join(' | ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              );
            })()}

            <div className="mct-query-section" onClick={(e) => e.stopPropagation()}>
              <div className="mct-query-title">إرسال استعلام / ملاحظة:</div>
              <div className="mct-query-row">
                <textarea className="mct-query-input" value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="اكتب استعلامك أو ملاحظتك هنا..." rows={2} />
                <button className="mct-query-btn" onClick={() => handleRequestInfo(order)} disabled={!noteContent.trim()}>إرسال</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function MctAgeCell({ createdAt }: { createdAt: string }) {
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

  return <span className="mct-age-cell">⏱ {pad2(h)}:{pad2(m)}:{pad2(s)}</span>;
}
