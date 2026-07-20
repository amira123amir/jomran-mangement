import { useState, useEffect } from 'react';
import { MessageSquare, Send, Reply, CheckCircle2 } from 'lucide-react';
import { useOrderStore } from '../stores/orderStore';
import { useLiveTimer } from '../hooks/useLiveTimer';
import { NOTE_TARGETS, getCurrentUserIds, canSeeConfidentialNote, isConfidentialRecipient } from '../utils/noteVisibility';
import { formatNumber } from '../utils/formatNumber';
import { pad2 } from '../utils/dateHelpers';
import { statusLabel } from '../utils/orderStatus';
import OrderWorkspace from './OrderWorkspace';
import StatusFilter from './StatusFilter';
import { applyStatusFilter, type StatusFilterValue } from '../utils/statusFilter';

const EMPTY_MSG = 'لا توجد بيانات حالية، يرجى البدء بإدخال المعاملات الحقيقية';

interface DashProps {
  persona: string;
  departmentLabel: string;
  role: string;
  department: string;
}

export default function ExecutiveDashboard({ persona, departmentLabel, role }: DashProps) {
  const allOrdersRaw = useOrderStore((s) => s.orders);
  const addCustomNote = useOrderStore(s => s.addCustomNote);
  const markCustomNoteRead = useOrderStore(s => s.markCustomNoteRead);
  const replyToCustomNote = useOrderStore(s => s.replyToCustomNote);
  const unarchiveOrder = useOrderStore(s => s.unarchiveOrder);

  const [showArchived, setShowArchived] = useState(false);
  const orders = showArchived ? allOrdersRaw : allOrdersRaw.filter(o => !o.archivedAt);
  const archivedCount = allOrdersRaw.filter(o => !!o.archivedAt).length;

  const pending = orders.filter((o) => o.status === 'waiting_for_assignment');
  const inProgress = orders.filter((o) => ['pricing_in_progress', 'procurement_inquiry'].includes(o.status));
  const priced = orders.filter((o) => o.status === 'pricing_completed');
  const locked = orders.filter((o) => o.status === 'official_quotation_generated');
  const completed = orders.filter((o) => o.status === 'delivered');
  const totalRevenue = orders.reduce((s, o) => s + (o.revenue?.confirmedByNoor ? o.revenue.actualRevenueUSD : 0), 0);
  const totalPipeline = orders.reduce((s, o) => { const lp = o.pricingHistory?.length ? o.pricingHistory[o.pricingHistory.length - 1] : null; return s + (lp?.totalUSD || 0); }, 0);

  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [noteType, setNoteType] = useState<'general' | 'secret'>('general');
  const [noteTarget, setNoteTarget] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all');
  const visibleOrders = applyStatusFilter(orders, statusFilter);

  const expandedOrder = expandedOrderId ? orders.find(o => o.id === expandedOrderId) : null;
  const currentUserId = getCurrentUserIds(persona)[0];

  const visibleNotes = expandedOrder
    ? expandedOrder.customNotes.filter(n => canSeeConfidentialNote(n, persona, currentUserId))
    : [];

  useEffect(() => {
    if (!expandedOrder) return;
    for (const n of expandedOrder.customNotes) {
      if (!n.isRead && isConfidentialRecipient(n, persona, currentUserId)) {
        markCustomNoteRead(expandedOrder.id, n.id, persona);
      }
    }
  }, [expandedOrderId, expandedOrder, currentUserId, persona, markCustomNoteRead]);

  const handleSendNote = () => {
    if (!noteTarget || !noteContent.trim() || !expandedOrder) return;
    const target = NOTE_TARGETS.find(t => t.userId === noteTarget);
    if (!target) return;
    addCustomNote(expandedOrder.id, persona, role, target.userId, target.name, target.role, noteContent.trim(), noteType);
    setNoteTarget('');
    setNoteContent('');
    setNoteType('general');
  };

  const handleReplySubmit = (noteId: string) => {
    if (!expandedOrder) return;
    const text = replyTexts[noteId];
    if (!text?.trim()) return;
    replyToCustomNote(expandedOrder.id, noteId, persona, role, text.trim());
    setReplyTexts(prev => ({ ...prev, [noteId]: '' }));
  };

  return (
    <div className="dept-dashboard">
      <div className="dept-welcome">
        <div className="dept-welcome-content">
          <h2 className="dept-welcome-title">أهلاً بك، <span className="highlight">{persona}</span></h2>
          <p className="dept-welcome-sub">{role} · {departmentLabel}</p>
          <p className="dept-welcome-desc">لوحة المتابعة الشاملة لجميع الطلبات والشحنات — اضغط على أي طلب لفتح التفاصيل وإرسال التوجيهات</p>
        </div>
        <div className="dept-welcome-decoration">
          <div className="deco-circle c1" /><div className="deco-circle c2" /><div className="deco-circle c3" />
        </div>
      </div>
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: '#ecfdf5' }}><span className="kpi-icon-text">📊</span></div>
          <div className="kpi-info"><span className="kpi-value">{orders.length}</span><span className="kpi-label">إجمالي الطلبات</span></div>
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
          <div className="kpi-info"><span className="kpi-value">{priced.length}</span><span className="kpi-label">تم التسعير</span></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: '#f3e8ff' }}><span className="kpi-icon-text">🔒</span></div>
          <div className="kpi-info"><span className="kpi-value">{locked.length}</span><span className="kpi-label">مقفلة</span></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: '#d1fae5' }}><span className="kpi-icon-text">✅</span></div>
          <div className="kpi-info"><span className="kpi-value">{completed.length}</span><span className="kpi-label">مكتملة</span></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: '#fef3c7' }}><span className="kpi-icon-text">📈</span></div>
          <div className="kpi-info"><span className="kpi-value">${formatNumber(totalPipeline)}</span><span className="kpi-label">خط الأنابيب (ليس إيراداً)</span></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: '#d1fae5' }}><span className="kpi-icon-text">💵</span></div>
          <div className="kpi-info"><span className="kpi-value">${formatNumber(totalRevenue)}</span><span className="kpi-label">الإيراد الفعلي ($0 حتى تأكيد نور)</span></div>
        </div>
      </div>

      {orders.length > 0 && (
        <div className="exec-tracking-section">
          <div className="exec-tracking-header">
            <span className="exec-tracking-icon">🗺️</span>
            <span className="exec-tracking-title">تتبع شامل لجميع الطلبات ({visibleOrders.length} / {orders.length}) — اضغط على أي سطر لفتح التفاصيل</span>
            <StatusFilter value={statusFilter} onChange={setStatusFilter} authorizedOrders={orders} className="exec-status-filter" />
            <label className="exec-archive-toggle" style={{ marginInlineStart: 12, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              عرض المؤرشفة ({archivedCount})
            </label>
          </div>
          <div className="exec-table-wrap">
            <table className="exec-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>رمز الشحن</th>
                  <th>العميل</th>
                  <th>المنتج</th>
                  <th>الحالة</th>
                  <th>المسؤول</th>
                  <th>عمر الطلب</th>
                  <th>التسعير (pipeline)</th>
                  <th>الإيراد ($0 حتى تأكيد نور)</th>
                  <th>SLA</th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((order) => {
                  const responsible = order.assignment?.assignedTo || order.claim?.claimedBy || order.salesPersona || '—';
                  const isOverdue = order.claim && new Date(order.claim.deadlineAt.replace(' ', 'T')).getTime() < Date.now();
                  return (
                    <tr key={order.id} className={`${isOverdue ? 'exec-row-overdue' : ''} ${expandedOrderId === order.id ? 'exec-row-expanded' : ''} ${order.archivedAt ? 'exec-row-archived' : ''} exec-row-clickable`} onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}>
                      <td className="exec-td-num">#{order.orderNumber}{order.archivedAt ? ' 🗄️' : ''}</td>
                      <td className="exec-td-mark">{order.shippingMark}-{order.shippingMarkSerial}</td>
                      <td>{order.clientName}</td>
                      <td>{order.productName}</td>
                      <td>
                        <span className={`mct-status-badge status-${order.status}`}>{statusLabel(order.status)}</span>
                        {order.archivedAt && (
                          <button
                            className="ow-workflow-next-btn"
                            style={{ marginInlineStart: 8, padding: '4px 8px', fontSize: 11 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              const r = unarchiveOrder(order.id, persona);
                              if (!r.ok) alert(r.error);
                            }}
                          >
                            ↩ إلغاء الأرشفة
                          </button>
                        )}
                      </td>
                      <td>{responsible}</td>
                      <td><ExecAgeCell createdAt={order.createdAt} /></td>
                      <td>{order.pricingHistory?.length ? `$${formatNumber(order.pricingHistory[order.pricingHistory.length - 1].totalUSD)}` : '—'}</td>
                      <td>${formatNumber(order.revenue?.confirmedByNoor ? order.revenue.actualRevenueUSD : 0)}</td>
                      <td>
                        {order.claim?.deadlineAt ? (
                          <SLATimerInline deadlineAt={order.claim.deadlineAt} />
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {expandedOrder && (
        <div className="exec-detail-panel">
          <div className="exec-detail-header">
            <h3>تفاصيل الطلب #{expandedOrder.orderNumber}</h3>
            <button className="exec-detail-close" onClick={() => setExpandedOrderId(null)}>✕</button>
          </div>

          <OrderWorkspace orderId={expandedOrder.id} />

          <div className="exec-timeline-section">
            <div className="exec-timeline-title">🗓️ تايم لاين الطلب</div>
            <div className="exec-timeline-items">
              <div className="exec-timeline-item">
                <span className="exec-tl-dot" style={{background:'#3b82f6'}} />
                <div className="exec-tl-content">
                  <span className="exec-tl-event">تم إنشاء الطلب</span>
                  <span className="exec-tl-time">{expandedOrder.createdAt}</span>
                </div>
              </div>
              {expandedOrder.claim?.claimedAt && (
                <div className="exec-timeline-item">
                  <span className="exec-tl-dot" style={{background: expandedOrder.claim.deadlineAt ? '#059669' : '#f59e0b'}} />
                  <div className="exec-tl-content">
                    <span className="exec-tl-event">{expandedOrder.assignment?.accepted ? 'تم قبول المهمة بواسطة' : 'تم التعيين لـ'} {expandedOrder.claim.claimedBy}</span>
                    <span className="exec-tl-time">{expandedOrder.claim.claimedAt}</span>
                  </div>
                </div>
              )}
              {(() => {
                const lp = expandedOrder.pricingHistory?.length ? expandedOrder.pricingHistory[expandedOrder.pricingHistory.length - 1] : null;
                return lp?.submittedAt ? (
                  <div className="exec-timeline-item">
                    <span className="exec-tl-dot" style={{background:'#8b5cf6'}} />
                    <div className="exec-tl-content">
                      <span className="exec-tl-event">تم التسعير بواسطة {lp.submittedBy}</span>
                      <span className="exec-tl-time">{lp.submittedAt}</span>
                    </div>
                  </div>
                ) : null;
              })()}
              {expandedOrder.revenue?.confirmedAt && (
                <div className="exec-timeline-item">
                  <span className="exec-tl-dot" style={{background:'#059669'}} />
                  <div className="exec-tl-content">
                    <span className="exec-tl-event">تم تأكيد الدفعة من نور</span>
                    <span className="exec-tl-time">{expandedOrder.revenue.confirmedAt}</span>
                  </div>
                </div>
              )}
              {(expandedOrder.status === 'delivered') && (
                <div className="exec-timeline-item">
                  <span className="exec-tl-dot" style={{background:'#10b981'}} />
                  <div className="exec-tl-content">
                    <span className="exec-tl-event">تم التسليم</span>
                    <span className="exec-tl-time">{expandedOrder.updatedAt}</span>
                  </div>
                </div>
              )}
              {expandedOrder.negotiationHistory.filter(e => e.fromDept === 'system').map(entry => (
                <div key={entry.id} className="exec-timeline-item">
                  <span className="exec-tl-dot" style={{background:'#6366f1'}} />
                  <div className="exec-tl-content">
                    <span className="exec-tl-event">{entry.message}</span>
                    <span className="exec-tl-time">{entry.createdAt}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="exec-detail-notes">
            <div className="exec-notes-title">
              <MessageSquare size={16} /> الملاحظات والتوجيهات
            </div>

            <div className="exec-note-form">
              <div className="exec-note-form-row">
                <div className="exec-note-field">
                  <label>إلى</label>
                  <select value={noteTarget} onChange={e => setNoteTarget(e.target.value)}>
                    <option value="">— اختر المستهدف —</option>
                    {NOTE_TARGETS.map(t => (
                      <option key={t.userId} value={t.userId}>{t.name} — {t.role}</option>
                    ))}
                  </select>
                </div>
                <div className="exec-note-field">
                  <label>نوع الملاحظة</label>
                  <div className="exec-note-type-toggle">
                    <button className={`exec-type-btn ${noteType === 'general' ? 'active' : ''}`} onClick={() => setNoteType('general')}>📢 عامة</button>
                    <button className={`exec-type-btn secret ${noteType === 'secret' ? 'active' : ''}`} onClick={() => setNoteType('secret')}>🔒 سرية</button>
                  </div>
                </div>
              </div>
              <textarea className="exec-note-textarea" value={noteContent} onChange={e => setNoteContent(e.target.value)} rows={2} placeholder={noteType === 'general' ? 'اكتب ملاحظة عامة لتظهر للجميع...' : 'اكتب رسالة سرية — تظهر فقط للمستهدف...'} />
              <div className="exec-note-actions">
                <button className="exec-note-send" onClick={handleSendNote} disabled={!noteTarget || !noteContent.trim()}>
                  <Send size={14} /> إرسال
                </button>
              </div>
            </div>

            {visibleNotes.length === 0 ? (
              <div className="exec-notes-empty">لا توجد ملاحظات بعد</div>
            ) : (
              <div className="exec-notes-list">
                {[...visibleNotes].reverse().map(n => (
                  <div key={n.id} className={`exec-note-card ${n.type === 'secret' ? 'secret' : ''}`}>
                    <div className="exec-note-card-header">
                      {n.type === 'secret' && <span className="exec-note-secret-badge">🔒 سري</span>}
                      <span className="exec-note-sender">{n.senderName}</span>
                      <span className="exec-note-sender-role">{n.senderRole}</span>
                      <span className="exec-note-target">→ {n.targetName}</span>
                      <span className="exec-note-time">{n.createdAt}</span>
                      {n.isRead ? (
                        <span className="custom-note-read-badge"><CheckCircle2 size={12} /> تمت القراءة بواسطة {n.targetName} في {n.readAt}</span>
                      ) : (
                        <span className="custom-note-unread-badge">جديد</span>
                      )}
                    </div>
                    <div className={`exec-note-card-body ${n.type === 'secret' ? 'secret-body' : ''}`}>{n.content}</div>

                    {(n.readHistory?.length || 0) > 0 && (
                      <div className="custom-note-audit">
                        <span className="custom-note-audit-title">📖 سجل القراءة (غير قابل للتعديل)</span>
                        {n.readHistory.map((h, idx) => (
                          <div key={idx} className="custom-note-audit-row">
                            <span>👤 {h.reader}</span>
                            <span>📅 {h.date}</span>
                            <span>⏱ {h.time}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {n.replies.length > 0 && (
                      <div className="custom-note-replies">
                        {n.replies.map(r => (
                          <div key={r.id} className="custom-note-reply-item">
                            <div className="custom-note-reply-header">
                              <span className="custom-note-reply-author">{r.senderName}</span>
                              <span className="custom-note-reply-role">{r.senderRole}</span>
                              <span className="custom-note-reply-time">{r.createdAt}</span>
                            </div>
                            <div className="custom-note-reply-content">{r.content}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="custom-note-reply-form">
                      <input className="custom-note-reply-input" type="text" value={replyTexts[n.id] || ''}
                        onChange={e => setReplyTexts(prev => ({ ...prev, [n.id]: e.target.value }))}
                        placeholder="اكتب رداً..." />
                      <button className="custom-note-reply-btn" onClick={() => handleReplySubmit(n.id)}
                        disabled={!replyTexts[n.id]?.trim()}>
                        <Reply size={12} /> رد
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {orders.length === 0 && (
        <div className="empty-state-banner">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-text">{EMPTY_MSG}</div>
        </div>
      )}
    </div>
  );
}

function ExecAgeCell({ createdAt }: { createdAt: string }) {
  useLiveTimer();
  const elapsed = formatElapsed(createdAt);
  return <span className="exec-age-cell">⏱ {elapsed.h}:{elapsed.m}:{elapsed.s}</span>;
}

function SLATimerInline({ deadlineAt }: { deadlineAt: string }) {
  useLiveTimer();
  const deadline = new Date(deadlineAt.replace(' ', 'T'));
  const diff = deadline.getTime() - Date.now();
  const expired = diff <= 0;
  const absDiff = Math.abs(diff);
  const totalSec = Math.floor(absDiff / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  return (
    <span className={`exec-sla ${expired ? 'expired' : ''}`}>
      {expired ? `منتهي بـ ${pad2(h)}:${pad2(m)}:${pad2(s)}` : `${pad2(h)}:${pad2(m)}:${pad2(s)}`}
    </span>
  );
}

import { formatElapsed } from '../hooks/useLiveTimer';
