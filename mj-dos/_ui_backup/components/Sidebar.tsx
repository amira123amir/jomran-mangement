import { usePersonaStore } from '../stores/personaStore';
import { useAuditStore } from '../stores/auditStore';
import { useOrderStore } from '../stores/orderStore';

export default function Sidebar() {
  const { activePersona, activeTab, setActiveTab, sidebarCollapsed, toggleSidebar } = usePersonaStore();
  const addLog = useAuditStore((s) => s.addLog);
  const orders = useOrderStore((s) => s.orders);
  const notifications = useOrderStore((s) => s.notifications);
  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const notifCount = notifications.filter((n) => n.forPersona === activePersona.name && !n.read).length;

  const handleNavClick = (itemId: string, itemLabel: string) => {
    addLog(activePersona.name, activePersona.department, `التنقل إلى: ${itemLabel}`, `Tab ID: ${itemId}`);
    setActiveTab(itemId);
  };

  const handleCollapse = () => {
    addLog(activePersona.name, activePersona.department, sidebarCollapsed ? 'تم توسيع الشريط الجانبي' : 'تم طي الشريط الجانبي');
    toggleSidebar();
  };

  const getBadge = (itemId: string) => {
    if (activePersona.department === 'procurement' && itemId === 'dashboard' && pendingCount > 0) return pendingCount;
    if (activePersona.department === 'sales' && itemId === 'new-order' && notifCount > 0) return notifCount;
    if (activePersona.department === 'sales' && itemId === 'orders' && activePersona.name === 'لميس - مديرة المبيعات') {
      const actionNeeded = orders.filter((o) => ['priced', 'pending_sales_info', 'revision'].includes(o.status)).length;
      if (actionNeeded > 0) return actionNeeded;
    }
    return 0;
  };

  return (
    <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {!sidebarCollapsed && (
          <div className="sidebar-dept-badge" style={{ borderRightColor: activePersona.color }}>
            <span className="sidebar-dept-name">{activePersona.departmentLabel}</span>
            <span className="sidebar-dept-role">{activePersona.role}</span>
          </div>
        )}
        <button className="sidebar-toggle" onClick={handleCollapse} title="طي/فتح الشريط">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {sidebarCollapsed ? (
              <>
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            ) : (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>

      <nav className="sidebar-nav">
        {activePersona.navItems.map((item) => {
          const isActive = activeTab === item.id;
          const badge = getBadge(item.id);
          return (
            <button
              key={item.id}
              className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id, item.label)}
              title={sidebarCollapsed ? item.label : undefined}
              style={isActive ? { borderRightColor: activePersona.color } : undefined}
            >
              <NavIcon id={item.icon} />
              {!sidebarCollapsed && <span className="sidebar-nav-label">{item.label}</span>}
              {badge > 0 && !sidebarCollapsed && <span className="sidebar-nav-badge">{badge}</span>}
              {isActive && !sidebarCollapsed && (
                <span className="sidebar-nav-indicator" style={{ backgroundColor: activePersona.color }} />
              )}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        {!sidebarCollapsed && (
          <div className="sidebar-footer-text">
            <span className="sidebar-footer-label">مساحة العمل</span>
            <span className="sidebar-footer-value">{activePersona.name}</span>
          </div>
        )}
      </div>
    </aside>
  );
}

import type { ReactNode } from 'react';

function NavIcon({ id }: { id: string }) {
  const props = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const icons: Record<string, ReactNode> = {
    grid: <svg {...props}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    'bar-chart': <svg {...props}><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>,
    'check-circle': <svg {...props}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
    activity: <svg {...props}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
    mail: <svg {...props}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg>,
    users: <svg {...props}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    target: <svg {...props}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
    'shopping-cart': <svg {...props}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
    'file-text': <svg {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
    'message-square': <svg {...props}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    'check-square': <svg {...props}><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
    truck: <svg {...props}><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
    clipboard: <svg {...props}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>,
    send: <svg {...props}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
    package: <svg {...props}><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
    map: <svg {...props}><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>,
    'credit-card': <svg {...props}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
    book: <svg {...props}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
    'refresh-cw': <svg {...props}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
  };
  return icons[id] || icons.grid;
}
