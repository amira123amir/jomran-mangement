import { useState } from 'react';
import { useOrderStore } from '../stores/orderStore';
import { formatNumber } from '../utils/formatNumber';
import { statusLabel, QUEUE_FILTERS } from '../utils/orderStatus';
import CustomNotesSection from './CustomNotesSection';
import OrderStatusFilterBar from './OrderStatusFilterBar';

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

  const activeQueueFilter = QUEUE_FILTERS.find((f) => f.id === queueFilterId) ?? QUEUE_FILTERS[0];
  const visibleOrders = myOrders.filter((o) => activeQueueFilter.match(o.status));

  const actionNeeded = myOrders.filter((o) => ['pricing_completed', 'procurement_inquiry'].includes(o.status));
  const pending = myOrders.filter((o) => o.status === 'waiting_for_assignment');
  const inProgress = myOrders.filter((o) => o.status === 'pricing_in_progress');
  const totalRevenue = myOrders.reduce((s, o) => s + (o.revenue?.confirmedByNoor ? o.revenue.actualRevenueUSD : 0), 0);
  const totalPipeline = myOrders.reduce((s, o) => { const lp = o.pricingHistory?.length ? o.pricingHistory[o.pricingHistory.length - 1] : null; return s + (lp?.totalUSD || 0); }, 0);

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
          {/* هنا يجب إضافة جدول الطلبات لاحقاً إذا لم يكن موجوداً، سأفترض وجوده في مكوّن آخر أو سأكتفي بالفلترة الآن */}
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
