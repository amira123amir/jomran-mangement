import React, { useState, useEffect } from 'react';
import { useOrderStore } from '../stores/orderStore';
import { formatNumber } from '../utils/formatNumber';
import { statusLabel, QUEUE_FILTERS } from '../utils/orderStatus';
import { pad2 } from '../utils/dateHelpers';
import { canSeeNote } from '../utils/noteVisibility';
import CustomNotesSection from './CustomNotesSection';
import OrderStatusFilterBar from './OrderStatusFilterBar';
import OrderWorkspace from './OrderWorkspace';

const ALL_PEOPLE = '__all__';

const EMPTY_MSG = 'لا توجد بيانات حالية، يرجى البدء بإدخال المعاملات الحقيقية';

interface DashProps {
  persona: string;
  departmentLabel: string;
  role: string;
  department: string;
}

export default function SalesDashboard({ persona, departmentLabel, role, department }: DashProps) {
  const allOrders = useOrderStore((s) => s.orders);
  const myOrders = allOrders.filter((o) => o.salesPersona === persona && !o.archivedAt);
  const [queueFilterId, setQueueFilterId] = useState<string>('all');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [workspaceOrderId, setWorkspaceOrderId] = useState<string | null>(null);

  const activeQueueFilter = QUEUE_FILTERS.find((f) => f.id === queueFilterId) ?? QUEUE_FILTERS[0];
  const visibleOrders = myOrders.filter((o) => activeQueueFilter.match(o.status));

  const actionNeeded = myOrders.filter((o) => ['pricing_completed', 'procurement_inquiry'].includes(o.status));
  const pending = myOrders.filter((o) => o.status === 'waiting_for_assignment');
  const inProgress = myOrders.filter((o) => o.status === 'pricing_in_progress');
  const totalRevenue = myOrders.reduce((s, o) => s + (o.revenue?.confirmedByNoor ? o.revenue.actualRevenueUSD : 0), 0);
  const totalPipeline = myOrders.reduce((s, o) => { const lp = o.pricingHistory?.length ? o.pricingHistory[o.pricingHistory.length - 1] : null; return s + (lp?.totalUSD || 0); }, 0);

  if (workspaceOrderId) {
    return (
      <div className="dept-dashboard">
        <button className="ow-back-btn" onClick={() => setWorkspaceOrderId(null)}>← العودة للوحة التحكم</button>
        <OrderWorkspace orderId={workspaceOrderId} />
      </div>
    );
  }

  return (
    <div className="dept-dashboard">
      <div className="dept-welcome">
        <div className="dept-welcome-content">
          <h2 className="dept-welcome-title">أهلاً بك، <span className="highlight">{persona}</span></h2>
          <p className="dept-welcome-sub">{role} · {departmentLabel}</p>
        </div>
        <div className="dept-welcome-decoration">
          <div className="deco-circle c1" /><div className="deco-circle c2" /><div className="deco-circle c3" />
        </div>
      </div>
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: '#ecfdf5' }}><span className="kpi-icon-text">📊</span></div>
          <div className="kpi-info"><span className="kpi-value">{myOrders.length}</span><span className="kpi-label">إجمالي الطلبات</span></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: '#fffbeb' }}><span className="kpi-icon-text">⏳</span></div>
          <div className="kpi-info"><span className="kpi-value">{pending.length}</span><span className="kpi-label">بانتظار التعيين</span></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: '#eff6ff' }}><span className="kpi-icon-text">🔧</span></div>
          <div className="kpi-info"><span className="kpi-value">{inProgress.length}</span><span className="kpi-label">قيد المعالجة</span></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: '#f0fdf4' }}><span className="kpi-icon-text">💰</span></div>
          <div className="kpi-info"><span className="kpi-value">{actionNeeded.length}</span><span className="kpi-label">تحتاج إجراء</span></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: '#fef3c7' }}><span className="kpi-icon-text">📈</span></div>
          <div className="kpi-info">
            <span className="kpi-value">${formatNumber(totalPipeline)}</span>
            <span className="kpi-label">خط الأنابيب (ليس إيراداً)</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: '#d1fae5' }}><span className="kpi-icon-text">💵</span></div>
          <div className="kpi-info">
            <span className="kpi-value">${formatNumber(totalRevenue)}</span>
            <span className="kpi-label">الإيراد الفعلي</span>
          </div>
        </div>
      </div>
      
      {myOrders.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ margin: 0, marginBottom: 12 }}>طلباتي ({visibleOrders.length})</h3>
          <OrderStatusFilterBar
            authorizedOrders={myOrders}
            activeFilterId={queueFilterId}
            onFilterChange={setQueueFilterId}
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
                    <React.Fragment key={order.id}>
                      <tr>
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
                            <button className="pw-workspace-btn" onClick={() => setWorkspaceOrderId(order.id)}>📋 مركز الطلب</button>
                            <button
                              className="pw-workspace-btn"
                              onClick={(e) => { e.stopPropagation(); setExpandedOrderId(expandedOrderId === order.id ? null : order.id); }}
                            >
                              {expandedOrderId === order.id ? '⬆ إخفاء الملخص' : '📋 ملخص الطلب'}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedOrderId === order.id && (
                        <tr>
                          <td colSpan={11}>
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
                                <strong>الملاحظات ({order.notes.filter((n) => canSeeNote(n, persona, department)).length}):</strong>
                                {order.notes.filter((n) => canSeeNote(n, persona, department)).length === 0 ? (
                                  <div style={{ fontSize: 12, color: '#94a3b8' }}>لا توجد ملاحظات متاحة</div>
                                ) : (
                                  order.notes.filter((n) => canSeeNote(n, persona, department)).map((note) => (
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
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {myOrders.length === 0 && (
        <div className="empty-state-banner">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-text">{EMPTY_MSG}</div>
        </div>
      )}
      <CustomNotesSection persona={persona} role={role} department={department} />
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
  return <span>{pad2(h)}:{pad2(m)}:{pad2(s)}</span>;
}
