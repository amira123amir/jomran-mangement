import CustomNotesSection from './CustomNotesSection';

const EMPTY_MSG = 'لا توجد بيانات حالية، يرجى البدء بإدخال المعاملات الحقيقية';

interface DashProps {
  persona: string;
  departmentLabel: string;
  role: string;
  department: string;
}

export default function DefaultDashboard({ persona, departmentLabel, role, department }: DashProps) {
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
