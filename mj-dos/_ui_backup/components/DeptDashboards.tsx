import { useOrderStore } from '../stores/orderStore';
import CustomNotesSection from './CustomNotesSection';

const EMPTY_MSG = 'لا توجد بيانات حالية، يرجى البدء بإدخال المعاملات الحقيقية';

interface DashProps {
  persona: string;
  departmentLabel: string;
  role: string;
  department: string;
}

export function SalesDashboard({ persona, departmentLabel, role, department }: DashProps) {
  const allOrders = useOrderStore((s) => s.orders);
  const myOrders = allOrders.filter((o) => o.salesPersona === persona);
  const actionNeeded = myOrders.filter((o) => ['priced', 'pending_sales_info', 'revision'].includes(o.status));
  const pending = myOrders.filter((o) => o.status === 'pending');
  const inProgress = myOrders.filter((o) => o.status === 'claimed');
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
            <span className="kpi-value">${totalPipeline.toFixed(3)}</span>
            <span className="kpi-label">خط الأنابيب (ليس إيراداً)</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: '#d1fae5' }}><span className="kpi-icon-text">💵</span></div>
          <div className="kpi-info">
            <span className="kpi-value">${totalRevenue.toFixed(3)}</span>
            <span className="kpi-label">الإيراد الفعلي</span>
          </div>
        </div>
      </div>
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

export function ProcurementDashboard({ persona, departmentLabel, role, department }: DashProps) {
  const orders = useOrderStore((s) => s.orders);
  const pending = orders.filter((o) => o.status === 'pending');
  const myClaims = orders.filter((o) => (o.claim?.claimedBy === persona || o.assignment?.assignedTo === persona) && ['claimed'].includes(o.status));

  return (
    <div className="dept-dashboard">
      <div className="dept-welcome">
        <div className="dept-welcome-content">
          <h2 className="dept-welcome-title">أهلاً بك، <span className="highlight">{persona}</span></h2>
          <p className="dept-welcome-sub">{role} · {departmentLabel}</p>
          <p className="dept-welcome-desc">للوصول إلى طابور المشتريات، اختر "لوحة تحكمي" من الشريط الجانبي</p>
        </div>
        <div className="dept-welcome-decoration">
          <div className="deco-circle c1" /><div className="deco-circle c2" /><div className="deco-circle c3" />
        </div>
      </div>
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: '#fffbeb' }}><span className="kpi-icon-text">📋</span></div>
          <div className="kpi-info"><span className="kpi-value">{pending.length}</span><span className="kpi-label">في الطابور العام</span></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: '#eff6ff' }}><span className="kpi-icon-text">🔧</span></div>
          <div className="kpi-info"><span className="kpi-value">{myClaims.length}</span><span className="kpi-label">في محفظتي</span></div>
        </div>
      </div>
      <CustomNotesSection persona={persona} role={role} department={department} />
    </div>
  );
}

export function AccountingDashboard({ persona, departmentLabel, role, department }: DashProps) {
  const orders = useOrderStore((s) => s.orders);
  const locked = orders.filter((o) => o.status === 'locked');
  const totalRevenue = orders.reduce((s, o) => s + (o.revenue?.confirmedByNoor ? o.revenue.actualRevenueUSD : 0), 0);

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
          <div className="kpi-info"><span className="kpi-value">${totalRevenue.toFixed(3)}</span><span className="kpi-label">إجمالي الإيرادات المؤكدة</span></div>
        </div>
      </div>
      <CustomNotesSection persona={persona} role={role} department={department} />
    </div>
  );
}

export function DefaultDashboard({ persona, departmentLabel, role, department }: DashProps) {
  return (
    <div className="dept-dashboard">
      <div className="dept-welcome">
        <div className="dept-welcome-content">
          <h2 className="dept-welcome-title">أهلاً بك، <span className="highlight">{persona}</span></h2>
          <p className="dept-welcome-sub">{role} · {departmentLabel}</p>
          <p className="dept-welcome-desc">اختر وحدة من الشريط الجانبي لبدء مسار عملك.</p>
        </div>
        <div className="dept-welcome-decoration">
          <div className="deco-circle c1" /><div className="deco-circle c2" /><div className="deco-circle c3" />
        </div>
      </div>
      <div className="empty-state-banner">
        <div className="empty-state-icon">📭</div>
        <div className="empty-state-text">{EMPTY_MSG}</div>
      </div>
      <CustomNotesSection persona={persona} role={role} department={department} />
    </div>
  );
}
