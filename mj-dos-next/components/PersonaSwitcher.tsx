import { useState, useRef, useEffect } from 'react';
import { PERSONAS, getPersonasByDepartment } from '../data/personas';
import { usePersonaStore } from '../stores/personaStore';
import { useAuditStore } from '../stores/auditStore';
import { useOrderStore } from '../stores/orderStore';
import type { Department, Persona } from '../types';

const DEPT_ORDER: { key: Department; label: string }[] = [
  { key: 'executive', label: 'الإدارة العليا' },
  { key: 'sales', label: 'قسم المبيعات' },
  { key: 'procurement', label: 'قسم المشتريات' },
  { key: 'accounting', label: 'قسم الحسابات' },
];

export default function PersonaSwitcher() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showNotifs, setShowNotifs] = useState(false);
  const { activePersona, setActivePersona } = usePersonaStore();
  const addLog = useAuditStore((s) => s.addLog);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const notifications = useOrderStore((s) => s.notifications);
  const myNotifications = notifications.filter((n) => n.forPersona === activePersona.name);
  const unreadCount = myNotifications.filter((n) => !n.read).length;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (persona: Persona) => {
    addLog(activePersona.name, activePersona.department, `تم التبديل إلى ${persona.name} (${persona.role})`);
    setActivePersona(persona);
    setOpen(false);
    setSearch('');
  };

  const handleToggle = () => {
    const next = !open;
    if (next) addLog(activePersona.name, activePersona.department, 'تم فتح قائمة تبديل المسؤول');
    setOpen(next);
  };

  const handleNotifToggle = () => {
    setShowNotifs((prev) => !prev);
  };

  const handleNotifClick = (orderId: string) => {
    useOrderStore.getState().markNotificationRead(myNotifications.find((n) => n.orderId === orderId && !n.read)?.id || '');
    setShowNotifs(false);
  };

  const filtered = search.trim()
    ? PERSONAS.filter(
        (p) =>
          p.name.includes(search) ||
          p.role.includes(search) ||
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.role.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  return (
    <div className="persona-switcher">
      <div className="persona-switcher-inner">
        <div className="persona-switcher-left">
          <div className="ps-brand">
            <span className="ps-brand-icon">◆</span>
            <span className="ps-brand-text">MJ-DOS</span>
          </div>
          <span className="ps-separator" />
          <span className="ps-subtitle">جرمان للوارد والصادر</span>
        </div>

        <div className="persona-switcher-right">
          <div className="ps-notif-bell" ref={notifRef}>
            <button className="ps-notif-btn" onClick={handleNotifToggle} title="الإشعارات">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {unreadCount > 0 && <span className="ps-notif-badge">{unreadCount}</span>}
            </button>
            {showNotifs && (
              <div className="ps-notif-dropdown">
                <div className="ps-notif-header">الإشعارات ({unreadCount} جديدة)</div>
                <div className="ps-notif-list">
                  {myNotifications.length === 0 ? (
                    <div className="ps-notif-empty">لا توجد إشعارات</div>
                  ) : (
                    myNotifications.slice().reverse().slice(0, 20).map((n) => (
                      <div key={n.id} className={`ps-notif-item ${!n.read ? 'unread' : ''}`} onClick={() => handleNotifClick(n.orderId)}>
                        <div className={`ps-notif-dot ${n.type}`} />
                        <div className="ps-notif-info">
                          <span className="ps-notif-msg">{n.message}</span>
                          <span className="ps-notif-from">من: {n.fromPersona} — {n.createdAt}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div ref={dropdownRef}>
            <button className="ps-current-btn" onClick={handleToggle}>
              <div className="ps-avatar" style={{ backgroundColor: activePersona.color }}>
                {activePersona.initials}
              </div>
              <div className="ps-current-info">
                <span className="ps-current-name">{activePersona.name}</span>
                <span className="ps-current-role">{activePersona.role} · {activePersona.departmentLabel}</span>
              </div>
              <svg className={`ps-chevron ${open ? 'open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {open && (
              <div className="ps-dropdown">
                <div className="ps-dropdown-header">
                  <span className="ps-dropdown-title">تبديل المسؤول</span>
                  <span className="ps-dropdown-subtitle">اختر عضو الفريق لتجربة واجهته</span>
                </div>
                <div className="ps-search-wrap">
                  <svg className="ps-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input className="ps-search" type="text" placeholder="بحث بالاسم أو المنصب..." value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
                </div>
                <div className="ps-dropdown-list">
                  {filtered ? (
                    filtered.length === 0 ? (
                      <div className="ps-empty">لم يتم العثور على نتائج</div>
                    ) : (
                      <div className="ps-group">
                        <div className="ps-group-label">نتائج البحث</div>
                        {filtered.map((p) => (
                          <PersonaItem key={p.id} persona={p} active={p.id === activePersona.id} onSelect={handleSelect} />
                        ))}
                      </div>
                    )
                  ) : (
                    DEPT_ORDER.map(({ key, label }) => {
                      const personas = getPersonasByDepartment(key);
                      if (personas.length === 0) return null;
                      return (
                        <div className="ps-group" key={key}>
                          <div className="ps-group-label">{label}</div>
                          {personas.map((p) => (
                            <PersonaItem key={p.id} persona={p} active={p.id === activePersona.id} onSelect={handleSelect} />
                          ))}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PersonaItem({ persona, active, onSelect }: { persona: Persona; active: boolean; onSelect: (p: Persona) => void }) {
  return (
    <button className={`ps-item ${active ? 'active' : ''}`} onClick={() => onSelect(persona)}>
      <div className="ps-item-avatar" style={{ backgroundColor: persona.color }}>{persona.initials}</div>
      <div className="ps-item-info">
        <span className="ps-item-name">{persona.name}</span>
        <span className="ps-item-role">{persona.role}</span>
      </div>
      {active && (
        <svg className="ps-item-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  );
}
