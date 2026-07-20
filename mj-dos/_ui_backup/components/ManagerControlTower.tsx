import { useState, useEffect } from 'react';
import { useOrderStore } from '../stores/orderStore';
import { usePersonaStore } from '../stores/personaStore';
import { useAuditStore } from '../stores/auditStore';
import { getPersonasByDepartment } from '../data/personas';
import { canViewSupplierData } from '../utils/supplierMask';
import { canSeeNote } from '../utils/noteVisibility';
import type { Order } from '../types';

type TowerView = 'all' | 'pending' | 'in_progress' | 'priced' | 'locked' | 'completed';

const STATUS_LABELS: Record<string, string> = {
  pending: '⏳ بانتظار التعيين',
  claimed: '🔧 قيد المعالجة',
  pending_sales_info: '🔴 بانتظار معلومات المبيعات',
  pending_factory_info: '🏭 بانتظار معلومات المصنع',
  priced: '💰 تم التسعير',
  revision: '🔄 مراجعة',
  locked: '🔒 مقفل',
  deposit_received: '💳 تم استلام الدفعة',
  completed: '✅ مكتمل',
  price_given: '📄 تم إعطاء السعر للزبون', waiting_customer: '📄 بانتظار رد الزبون',
};

export default function ManagerControlTower() {
  const persona = usePersonaStore((s) => s.activePersona);
  const activeTab = usePersonaStore((s) => s.activeTab);
  const addLog = useAuditStore((s) => s.addLog);
  const orders = useOrderStore((s) => s.orders);
  const assignOrder = useOrderStore((s) => s.assignOrder);
  const requestInfo = useOrderStore((s) => s.requestInfo);

  const [filter, setFilter] = useState<TowerView>('all');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<Record<string, string>>({});
  const [noteContent, setNoteContent] = useState('');

  const isSalesManager = persona.name === 'لميس - مديرة المبيعات';
  const isProcManager = persona.name === 'كنانة' && activeTab === 'dashboard';

  const subordinates = getPersonasByDepartment(isSalesManager ? 'sales' : 'procurement')
    .filter((p) => p.name !== persona.name)
    .map((p) => p.name);

  const relevantOrders = isProcManager
    ? orders.filter((o) =>
        !['completed', 'deposit_received'].includes(o.status) ||
        subordinates.includes(o.assignment?.assignedTo || '') ||
        subordinates.includes(o.claim?.claimedBy || '')
      )
    : orders.filter((o) =>
        o.salesPersona === persona.name ||
        subordinates.includes(o.salesPersona)
      );

  const filtered = filter === 'all' ? relevantOrders : relevantOrders.filter((o) => o.status === filter);

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
    pending: relevantOrders.filter((o) => o.status === 'pending' || o.status === 'pending_factory_info').length,
    inProgress: relevantOrders.filter((o) => ['claimed', 'pending_sales_info', 'pending_factory_info', 'revision'].includes(o.status)).length,
    priced: relevantOrders.filter((o) => o.status === 'priced').length,
    locked: relevantOrders.filter((o) => ['locked', 'deposit_received'].includes(o.status)).length,
    completed: relevantOrders.filter((o) => o.status === 'completed').length,
    totalRevenue: relevantOrders.reduce((sum, o) => sum + (o.revenue?.actualRevenueUSD || 0), 0),
    totalPipeline: relevantOrders.reduce((sum, o) => {
      const lp = o.pricingHistory?.length ? o.pricingHistory[o.pricingHistory.length - 1] : null;
      return sum + (lp?.totalUSD || 0);
    }, 0),
  };

  return (
    <div className="mct-screen">
      <div className="mct-header">
        <div className="mct-header-icon">{isSalesManager ? '📊' : '🏭'}</div>
        <div style={{ flex: 1 }}>
          <h2 className="mct-title">{isSalesManager ? 'tower التحكم — المبيعات' : 'tower التحكم — المشتريات'}</h2>
          <p className="mct-sub">{persona.name} · {persona.role}</p>
        </div>
      </div>

      <div className="mct-stats">
        <div className="mct-stat-card">
          <div className="mct-stat-value">{stats.total}</div>
          <div className="mct-stat-label">إجمالي الطلبات</div>
        </div>
        <div className="mct-stat-card warn">
          <div className="mct-stat-value">{stats.pending + stats.inProgress}</div>
          <div className="mct-stat-label">قيد المعالجة</div>
        </div>
        <div className="mct-stat-card success">
          <div className="mct-stat-value">{stats.priced + stats.locked}</div>
          <div className="mct-stat-label">تم التسعير / مقفل</div>
        </div>
        <div className="mct-stat-card revenue">
          <div className="mct-stat-value">${stats.totalPipeline.toFixed(3)}</div>
          <div className="mct-stat-label">إجمالي خط الأنابيب (ليس إيراداً)</div>
        </div>
        <div className="mct-stat-card actual">
          <div className="mct-stat-value">${stats.totalRevenue.toFixed(3)}</div>
          <div className="mct-stat-label">الإيراد الفعلي</div>
        </div>
      </div>

      <div className="mct-filters">
        {(['all', 'pending', 'in_progress', 'priced', 'locked', 'completed'] as TowerView[]).map((f) => (
          <button key={f} className={`mct-filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'الكل' : f === 'pending' ? 'بانتظار التعيين' : f === 'in_progress' ? 'قيد المعالجة' : f === 'priced' ? 'تم التسعير' : f === 'locked' ? 'مقفل' : 'مكتمل'}
            <span className="mct-filter-count">
              {f === 'all' ? stats.total : f === 'pending' ? stats.pending : f === 'in_progress' ? stats.inProgress : f === 'priced' ? stats.priced : f === 'locked' ? stats.locked : stats.completed}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state-banner">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-text">لا توجد طلبات تطابق الفلتر المحدد</div>
        </div>
      ) : (
        <div className="mct-table-wrap">
          <table className="mct-table">
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
                    <td className="mct-td-num">#{order.orderNumber}</td>
                    <td className="mct-td-mark">{order.shippingMark}-{order.shippingMarkSerial}</td>
                    <td>{persona.department === 'procurement' ? `#${order.orderNumber}` : order.clientName}</td>
                    <td>{order.productName}</td>
                    <td><span className={`mct-status-badge status-${order.status}`}>{STATUS_LABELS[order.status]}</span></td>
                    <td>{assignedTo || '—'}</td>
                    <td><MctAgeCell createdAt={order.createdAt} /></td>
                    <td>{order.pricingHistory?.length ? `$${order.pricingHistory[order.pricingHistory.length - 1].totalUSD.toFixed(3)}` : '—'}</td>
                    <td>{order.revenue ? `$${order.revenue.actualRevenueUSD.toFixed(3)}` : '$0'}</td>
                    <td>
                      <button className="mct-expand-btn" onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}>
                        {expandedOrder === order.id ? 'إخفاء' : 'تفاصيل'}
                      </button>
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
        const showSupplier = canViewSupplierData(persona.name);
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
                <div className="mct-detail-row"><span className="mct-detail-label">المنتج:</span><span>{order.productName}</span></div>
                <div className="mct-detail-row"><span className="mct-detail-label">القسم:</span><span>{order.categoryLabel}</span></div>
                <div className="mct-detail-row"><span className="mct-detail-label">البائع:</span><span>{order.salesPersona}</span></div>
              </div>
              <div className="mct-detail-col">
                {lp && (
                  <>
                    <div className="mct-detail-row"><span className="mct-detail-label">سعر المصنع:</span><span>{lp.factoryPriceRMB} RMB</span></div>
                    <div className="mct-detail-row"><span className="mct-detail-label">الشحن:</span><span>{lp.shippingCostRMB} RMB</span></div>
                    <div className="mct-detail-row"><span className="mct-detail-label">الإجمالي:</span><span>{lp.totalRMB} RMB / ${lp.totalUSD.toFixed(3)}</span></div>
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

            {isProcManager && order.status === 'pending' && (
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

            {order.notes.length > 0 && (
              <div className="mct-notes-section">
                <div className="mct-notes-title">الملاحظات ({order.notes.length}):</div>
                {order.notes.filter((note) => canSeeNote(note, persona.name, persona.department)).map((note) => (
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
            )}

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
  const pad = (n: number) => String(n).padStart(2, '0');
  return <span className="mct-age-cell">⏱ {pad(h)}:{pad(m)}:{pad(s)}</span>;
}
