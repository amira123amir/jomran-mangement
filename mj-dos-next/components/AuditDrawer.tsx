import { useEffect, useRef } from 'react';
import { useAuditStore } from '../stores/auditStore';

export default function AuditDrawer() {
  const { logs, isOpen, toggleDrawer, clearLogs } = useAuditStore();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [logs.length]);

  const deptColors: Record<string, string> = {
    executive: '#7c3aed',
    sales: '#2563eb',
    procurement: '#059669',
    accounting: '#d97706',
  };

  const deptAr: Record<string, string> = {
    executive: 'إدارة',
    sales: 'مبيعات',
    procurement: 'مشتريات',
    accounting: 'حسابات',
  };

  return (
    <div className={`audit-drawer ${isOpen ? 'open' : ''}`}>
      <button className="audit-drawer-toggle" onClick={toggleDrawer}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points={isOpen ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
        </svg>
        <span>سجل تتبع أثر النظام</span>
        <span className="audit-count">{logs.length}</span>
        <span className="audit-live-dot" />
      </button>

      {isOpen && (
        <div className="audit-drawer-content">
          <div className="audit-drawer-header">
            <div className="audit-drawer-header-left">
              <span className="audit-drawer-title">المخرجات الحية (Live Output)</span>
              <span className="audit-drawer-subtitle">كل نقرة، تنقل، وإجراء يتم تتبعه</span>
            </div>
            <div className="audit-drawer-header-right">
              <button className="audit-clear-btn" onClick={clearLogs}>مسح</button>
              <button className="audit-export-btn" onClick={() => {
                const blob = new Blob([logs.map(l =>
                  `[${l.date} ${l.time}] [${l.persona}] [${l.department}] ${l.action}${l.details ? ' — ' + l.details : ''}`
                ).join('\n')], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}>تصدير</button>
            </div>
          </div>

          <div className="audit-log-list" ref={listRef}>
            {logs.length === 0 ? (
              <div className="audit-empty">
                <span className="audit-empty-icon">🔍</span>
                <span>لا توجد سجلات مراجعة بعد</span>
                <span className="audit-empty-sub">انقر على الأزرار، انتقل بين التبويبات، أو بدّل المسؤول لرؤية السجلات</span>
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="audit-log-entry">
                  <div className="audit-log-time">
                    <span className="audit-log-date">{log.date}</span>
                    <span className="audit-log-timestamp">{log.time}</span>
                  </div>
                  <div className="audit-log-dept-badge" style={{ backgroundColor: deptColors[log.department] || '#6b7280' }}>
                    {deptAr[log.department] || log.department}
                  </div>
                  <div className="audit-log-details">
                    <span className="audit-log-persona">{log.persona}</span>
                    <span className="audit-log-action">{log.action}</span>
                    {log.details && <span className="audit-log-extra">{log.details}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
