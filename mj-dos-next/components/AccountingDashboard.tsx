import { useState } from 'react';
import { useOrderStore } from '../stores/orderStore';
import { usePersonaStore } from '../stores/personaStore';
import { useAuditStore } from '../stores/auditStore';
import { formatNumber } from '../utils/formatNumber';
import { statusLabel, QUEUE_FILTERS } from '../utils/orderStatus';
import CustomNotesSection from './CustomNotesSection';
import { applyStatusFilter, type StatusFilterValue } from '../utils/statusFilter';

interface DashProps {
  persona: string;
  departmentLabel: string;
  role: string;
  department: string;
}

export default function AccountingDashboard({ persona, departmentLabel, role, department }: DashProps) {
  const orders = useOrderStore((s) => s.orders).filter((o) => !o.archivedAt);
  const locked = orders.filter((o) => o.status === 'official_quotation_generated');
  const totalRevenue = orders.reduce((s, o) => s + (o.revenue?.confirmedByNoor ? o.revenue.actualRevenueUSD : 0), 0);
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all');
  const visibleOrders = applyStatusFilter(orders, statusFilter);
  // Invoices-tab-only feature: clicking a "deposit_paid" status opens a
  // detail modal where accounting can confirm receipt of the deposit.
  const activeTab = usePersonaStore((s) => s.activeTab);
  const activePersona = usePersonaStore((s) => s.activePersona);
  const addLog = useAuditStore((s) => s.addLog);
  const [depositReviewOrderId, setDepositReviewOrderId] = useState<string | null>(null);
  const depositReviewOrder = depositReviewOrderId
    ? orders.find((o) => o.id === depositReviewOrderId)
    : null;
  const isInvoicesTab = activeTab === 'invoices';

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
          <div className="kpi-icon" style={{ backgroundColor: '#ecfdf5' }}><span className="kpi-icon-text">🧾</span></div>
          <div className="kpi-info"><span className="kpi-value">{orders.length}</span><span className="kpi-label">إجمالي الطلبات</span></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: '#fef3c7' }}><span className="kpi-icon-text">💰</span></div>
          <div className="kpi-info"><span className="kpi-value">{locked.length}</span><span className="kpi-label">طلبات مقفلة بانتظار الدفعة</span></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: '#f0fdf4' }}><span className="kpi-icon-text">💵</span></div>
          <div className="kpi-info"><span className="kpi-value">${formatNumber(totalRevenue)}</span><span className="kpi-label">إجمالي الإيرادات المؤكدة</span></div>
        </div>
      </div>

      {/* New Section for Status Counts */}
      <div style={{ marginTop: 24 }}>
        <h3>جميع طلباتي ({visibleOrders.length} / {orders.length})</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {QUEUE_FILTERS.map((f) => (
            <div key={f.id} className="kpi-card" style={{ padding: 12 }}>
              <div className="kpi-info">
                <span className="kpi-label" style={{ fontWeight: 'bold' }}>{f.label}</span>
                <span className="kpi-value" style={{ fontSize: '1.2em' }}>{orders.filter(o => f.match(o.status as any)).length}</span>
                {f.department && <span className="kpi-label" style={{ fontSize: '0.8em', color: '#64748b' }}>{f.department}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {orders.length > 0 && (
        <div className="acct-orders-section" style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>قائمة الطلبات ({visibleOrders.length} / {orders.length})</h3>
          </div>
          <div className="pw-registry-table-wrap">
            <table className="pw-registry-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>رمز الشحن</th>
                  <th>العميل</th>
                  <th>الحالة</th>
                  <th>المبيعات</th>
                  <th>المشتريات</th>
                  <th>الإيراد المؤكد</th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((o) => (
                  <tr key={o.id}>
                    <td className="pw-registry-num">#{o.orderNumber}</td>
                    <td className="pw-registry-mark">{o.shippingMark}-{o.shippingMarkSerial}</td>
                    <td>{o.clientName}</td>
                    <td>
                      {isInvoicesTab && o.status === 'deposit_paid' ? (
                        <button
                          type="button"
                          className={`pw-registry-status status-${o.status}`}
                          style={{ cursor: 'pointer', border: 'none', font: 'inherit' }}
                          onClick={() => setDepositReviewOrderId(o.id)}
                          title="فتح تفاصيل العربون"
                        >
                          {statusLabel(o.status)}
                        </button>
                      ) : (
                        <span className={`pw-registry-status status-${o.status}`}>{statusLabel(o.status)}</span>
                      )}
                    </td>
                    <td>{o.salesPersona || '—'}</td>
                    <td>{o.assignment?.assignedTo || o.claim?.claimedBy || '—'}</td>
                    <td>{o.revenue?.confirmedByNoor ? `$${formatNumber(o.revenue.actualRevenueUSD)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {depositReviewOrder && depositReviewOrder.customerDeposit && (() => {
        const d = depositReviewOrder.customerDeposit;
        const methodLabel = d.paymentMethod === 'other'
          ? `غير ذلك: ${d.customPaymentMethod || ''}`
          : ({
              cash_office: 'كاش في مقر الشركة',
              sham_cash: 'شام كاش',
              trend_5000: 'شركة ترند — جمران / ترند 5000',
              dahab_istanbul_1373: 'شركة ذهب — جمران / إسطنبول 1373',
              free_istanbul_104: 'شركة فري — جمران / إسطنبول 104',
            } as Record<string, string>)[d.paymentMethod] || d.paymentMethod;
        const salesNote = [...depositReviewOrder.notes]
          .reverse()
          .find((n) => n.authorDept === 'sales');
        const isImage = d.attachment && (d.attachment.mimeType || '').startsWith('image/');
        return (
          <div className="ow-modal-overlay" onClick={() => setDepositReviewOrderId(null)}>
            <div className="ow-proforma-modal" onClick={(e) => e.stopPropagation()}>
              <div className="ow-proforma-header">
                <h3>💵 تفاصيل العربون — الطلب #{depositReviewOrder.orderNumber}</h3>
                <button className="ow-proforma-close" onClick={() => setDepositReviewOrderId(null)}>✕</button>
              </div>
              <div className="ow-proforma-body">
                <div className="ow-proforma-info">
                  <div className="ow-proforma-row"><span className="ow-proforma-label">رقم الطلب:</span><span className="ow-proforma-value">#{depositReviewOrder.orderNumber}</span></div>
                  <div className="ow-proforma-row"><span className="ow-proforma-label">العميل:</span><span className="ow-proforma-value">{depositReviewOrder.clientName}</span></div>
                  <div className="ow-proforma-row"><span className="ow-proforma-label">المبلغ:</span><span className="ow-proforma-value">{formatNumber(d.amount)} {d.currency}</span></div>
                  <div className="ow-proforma-row"><span className="ow-proforma-label">طريقة الدفع:</span><span className="ow-proforma-value">{methodLabel}</span></div>
                  <div className="ow-proforma-row"><span className="ow-proforma-label">تاريخ الدفع:</span><span className="ow-proforma-value">{d.paymentDate}</span></div>
                  <div className="ow-proforma-row"><span className="ow-proforma-label">سجّله:</span><span className="ow-proforma-value">{d.recordedBy} — {d.recordedAt}</span></div>
                  <div className="ow-proforma-row"><span className="ow-proforma-label">ملاحظة المبيعات:</span><span className="ow-proforma-value">{salesNote?.content || 'لا توجد ملاحظة من المبيعات'}</span></div>
                </div>
                {d.attachment ? (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, color: '#475569', marginBottom: 6 }}>إثبات الدفع:</div>
                    {isImage ? (
                      <a href={d.attachment.url} target="_blank" rel="noopener noreferrer">
                        <img src={d.attachment.url} alt={d.attachment.name} style={{ maxWidth: '100%', maxHeight: 260, borderRadius: 6, border: '1px solid #e2e8f0' }} />
                      </a>
                    ) : (
                      <a className="ow-doc-link" href={d.attachment.url} target="_blank" rel="noopener noreferrer">📎 {d.attachment.name}</a>
                    )}
                  </div>
                ) : (
                  <div style={{ marginTop: 12, fontSize: 12, color: '#94a3b8' }}>لا يوجد مرفق إثبات دفع.</div>
                )}
              </div>
              <div className="ow-proforma-footer">
                <button
                  className="ow-proforma-submit"
                  onClick={() => {
                    const actor = { name: activePersona.name, role: activePersona.role, dept: activePersona.department };
                    const result = useOrderStore.getState().confirmDeposit(
                      depositReviewOrder.id,
                      { confirmedBy: activePersona.name, amount: d.amount, currency: d.currency, reference: d.paymentMethod, confirmedAt: '' },
                      actor,
                    );
                    if (!result.ok) { alert(`تعذّر تأكيد العربون: ${result.error}`); return; }
                    addLog(activePersona.name, activePersona.department, `💳 تأكيد العربون للطلب #${depositReviewOrder.orderNumber}`, `${d.amount} ${d.currency}`);
                    setDepositReviewOrderId(null);
                  }}
                >
                  ✅ تأكيد استلام العربون
                </button>
                <button className="ow-proforma-cancel" onClick={() => setDepositReviewOrderId(null)}>إغلاق</button>
              </div>
            </div>
          </div>
        );
      })()}

      <CustomNotesSection persona={persona} role={role} department={department} />
    </div>
  );
}
