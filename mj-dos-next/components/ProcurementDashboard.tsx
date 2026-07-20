import { useState } from 'react';
import { useOrderStore } from '../stores/orderStore';
import { useAuditStore } from '../stores/auditStore';
import { formatNumber } from '../utils/formatNumber';
import { productSummary } from '../utils/orderProducts';
import { statusLabel, QUEUE_FILTERS } from '../utils/orderStatus';
import CustomNotesSection from './CustomNotesSection';

interface DashProps {
  persona: string;
  departmentLabel: string;
  role: string;
  department: string;
}

export default function ProcurementDashboard({ persona, departmentLabel, role, department }: DashProps) {
  const orders = useOrderStore((s) => s.orders).filter((o) => !o.archivedAt);
  const claimOrder = useOrderStore((s) => s.claimOrder);
  const addLog = useAuditStore((s) => s.addLog);
  const [queueFilterId, setQueueFilterId] = useState<string>('all');

  const waitingAssignment = orders.filter((o) => o.status === 'waiting_for_assignment');
  const myOrders = orders.filter((o) => (o.claim?.claimedBy === persona || o.assignment?.assignedTo === persona));
  const myActive = myOrders.filter((o) => o.status !== 'delivered');
  const totalRevenue = myOrders.reduce((s, o) => s + (o.revenue?.confirmedByNoor ? o.revenue.actualRevenueUSD : 0), 0);

  const handleClaim = (order: any) => {
    claimOrder(order.id, persona, role);
    addLog(persona, department, `تم استلام الطلب #${order.orderNumber} (${order.shippingMark}-${order.shippingMarkSerial})`, `بدء العد التنازلي — 6 ساعات`);
  };

  const activeQueueFilter = QUEUE_FILTERS.find((f) => f.id === queueFilterId) ?? QUEUE_FILTERS[0];
  const visibleOrders = orders.filter((o) => activeQueueFilter.match(o.status as any));

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
        <button type="button" className="kpi-card" onClick={() => setQueueFilterId('all')}>
          <div className="kpi-icon" style={{ backgroundColor: '#ecfdf5' }}><span className="kpi-icon-text">🗂️</span></div>
          <div className="kpi-info"><span className="kpi-value">{orders.length}</span><span className="kpi-label">إجمالي الطلبات</span></div>
        </button>

        <button type="button" className="kpi-card" onClick={() => setQueueFilterId('waiting_for_assignment')}>
          <div className="kpi-icon" style={{ backgroundColor: '#fffbeb' }}><span className="kpi-icon-text">⏳</span></div>
          <div className="kpi-info"><span className="kpi-value">{waitingAssignment.length}</span><span className="kpi-label">بانتظار التعيين</span></div>
        </button>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: '#eff6ff' }}><span className="kpi-icon-text">🔧</span></div>
          <div className="kpi-info"><span className="kpi-value">{myActive.length}</span><span className="kpi-label">مهامي النشطة</span></div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: '#ecfeff' }}><span className="kpi-icon-text">📁</span></div>
          <div className="kpi-info"><span className="kpi-value">{myOrders.length}</span><span className="kpi-label">طلبات مُسنَدة إليّ</span></div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: '#d1fae5' }}><span className="kpi-icon-text">💵</span></div>
          <div className="kpi-info">
            <span className="kpi-value">${formatNumber(totalRevenue)}</span>
            <span className="kpi-label">قيمة مهامي المنتهية</span>
          </div>
        </div>
      </div>

      {orders.length > 0 && (
        <div className="acct-orders-section" style={{ marginTop: 18 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>
            قائمة الطلبات ({visibleOrders.length} / {orders.length})
          </h3>
          <div className="pw-registry-table-wrap" style={{ marginTop: 10 }}>
            <table className="pw-registry-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>رمز الشحن</th>
                  <th>المنتج</th>
                  <th>الحالة</th>
                  <th>المبيعات</th>
                  <th>المشتريات</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((o) => {
                  const isPending = o.status === 'waiting_for_assignment' && !o.assignment && !o.claim;
                  return (
                  <tr key={o.id}>
                    <td className="pw-registry-num">#{o.orderNumber}</td>
                    <td className="pw-registry-mark">{o.shippingMark}-{o.shippingMarkSerial}</td>
                    <td className="pw-registry-product">{productSummary(o)}</td>
                    <td><span className={`pw-registry-status status-${o.status}`}>{statusLabel(o.status)}</span></td>
                    <td>{o.salesPersona || '—'}</td>
                    <td>{o.assignment?.assignedTo || o.claim?.claimedBy || '—'}</td>
                    <td>
                      {isPending && (
                        <button className="pw-claim-btn" onClick={() => handleClaim(o)} style={{ fontSize: 12, padding: '4px 10px' }}>🤚 استلام</button>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CustomNotesSection persona={persona} role={role} department={department} />
    </div>
  );
}
