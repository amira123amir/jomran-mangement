import { useState, useEffect, useCallback } from 'react';
import { useOrderStore } from '../stores/orderStore';
import { useAuditStore } from '../stores/auditStore';
import { usePersonaStore } from '../stores/personaStore';
import { canViewSupplierData } from '../utils/supplierMask';
import { ORDER_NOTE_TARGETS, canSeeNote } from '../utils/noteVisibility';
import OrderWorkspace from './OrderWorkspace';
import type { Order } from '../types';

function SLATimer({ deadlineAt }: { deadlineAt: string }) {
  const [, setTick] = useState(0);

  const calcRemaining = useCallback(() => {
    if (!deadlineAt) return { text: '--:--:--', expired: false, pct: 0 };
    const deadline = new Date(deadlineAt.replace(' ', 'T'));
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    if (diff <= 0) return { text: 'منتهي!', expired: true, pct: 100 };
    const totalSec = Math.floor(diff / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return { text: `${pad(h)}:${pad(m)}:${pad(s)}`, expired: false, pct: Math.min(100, ((6 * 3600 - diff) / (6 * 3600)) * 100) };
  }, [deadlineAt]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = calcRemaining();

  return (
    <div className={`sla-timer ${remaining.expired ? 'expired' : ''}`}>
      <div className="sla-bar">
        <div className="sla-fill" style={{ width: `${remaining.pct}%` }} />
      </div>
      <span className="sla-text">⏱ {remaining.text}</span>
    </div>
  );
}

type ProcurementView = 'queue' | 'my-claims' | 'workspace';

export default function ProcurementWorkspace() {
  const persona = usePersonaStore((s) => s.activePersona);
  const addLog = useAuditStore((s) => s.addLog);
  const claimOrder = useOrderStore((s) => s.claimOrder);
  const acceptAssignment = useOrderStore((s) => s.acceptAssignment);
  const addNote = useOrderStore((s) => s.addNote);
  const markNoteRead = useOrderStore((s) => s.markNoteRead);
  const requestInfo = useOrderStore((s) => s.requestInfo);
  const completeOrder = useOrderStore((s) => s.completeOrder);
  const updateSupplierData = useOrderStore((s) => s.updateSupplierData);
  const orders = useOrderStore((s) => s.orders);

  const [view, setView] = useState<ProcurementView>('queue');
  const [noteTarget, setNoteTarget] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteConfidential, setNoteConfidential] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [queryMessage, setQueryMessage] = useState('');
  const [queryOrderId, setQueryOrderId] = useState<string | null>(null);
  const [workspaceOrderId, setWorkspaceOrderId] = useState<string | null>(null);
  const [workspaceSection, setWorkspaceSection] = useState<'info' | 'pricing' | 'negotiation' | 'notes'>('info');
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);
  const [supplierName, setSupplierName] = useState('');
  const [supplierNumber, setSupplierNumber] = useState('');

  const showSupplier = canViewSupplierData(persona.name);

  const pendingOrders = orders.filter((o) => (o.status === 'pending' || o.status === 'pending_factory_info') && !o.assignment);
  const myClaims = orders.filter((o) => (o.claim?.claimedBy === persona.name || o.assignment?.assignedTo === persona.name) && o.status !== 'completed');
  const unacceptedAssignments = myClaims.filter(o => o.assignment && !o.assignment.accepted).length;

  const handleClaim = (order: Order) => {
    claimOrder(order.id, persona.name, persona.role);
    addLog(persona.name, persona.department, `تم استلام الطلب #${order.orderNumber} (${order.shippingMark}-${order.shippingMarkSerial})`, `بدء العد التنازلي — 6 ساعات`);
    setView('my-claims');
  };

  const handleAcceptAssignment = (order: Order) => {
    acceptAssignment(order.id, persona.name);
    addLog(persona.name, persona.department, `قبول المهمة الإدارية للطلب #${order.orderNumber} (${order.shippingMark})`, `بدء العد التنازلي — 6 ساعات`);
    setView('my-claims');
  };

  const handleOpenPricing = (order: Order) => {
    setWorkspaceOrderId(order.id);
    setWorkspaceSection('pricing');
    setView('workspace');
  };

  const handleSendNote = () => {
    if (!noteTarget || !noteContent.trim() || !expandedOrder) return;
    const finalContent = noteConfidential ? `🔒 ${noteContent.trim()}` : noteContent.trim();
    addNote(expandedOrder, persona.name, persona.department, noteTarget, finalContent);
    setNoteTarget('');
    setNoteContent('');
    setNoteConfidential(false);
  };

  const handleSendQuery = () => {
    if (!queryOrderId || !queryMessage.trim()) return;
    requestInfo(queryOrderId, persona.name, persona.department, queryMessage.trim());
    addLog(persona.name, persona.department, `تم إرسال استعلام للطلب #${orders.find((o) => o.id === queryOrderId)?.orderNumber}`, queryMessage.trim().slice(0, 60));
    setQueryMessage('');
    setQueryOrderId(null);
  };

  const handleViewOrder = (orderId: string) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
    markNoteRead(orderId, persona.name);
  };

  const handleOpenWorkspace = (orderId: string) => {
    setWorkspaceOrderId(orderId);
    setView('workspace');
  };

  const handleCloseOrder = (order: Order) => {
    completeOrder(order.id);
    addLog(persona.name, persona.department, `تم إغلاق الطلب #${order.orderNumber} (${order.shippingMark}) يدوياً من المشتريات`, 'إغلاق دورة حياة الطلب');
    setExpandedOrder(null);
  };

  const handleSaveSupplier = (order: Order) => {
    if (!supplierName.trim() && !supplierNumber.trim()) return;
    updateSupplierData(order.id, {
      factoryName: supplierName.trim() || order.supplierData?.factoryName || '',
      factoryPhone: order.supplierData?.factoryPhone || '',
      procurementNotes: order.supplierData?.procurementNotes || '',
      supplierNumber: supplierNumber.trim() || order.supplierData?.supplierNumber || '',
    }, persona.name);
    addLog(persona.name, persona.department, `تحديث بيانات المورد للطلب #${order.orderNumber}`, `${supplierName.trim() ? `المعمل: ${supplierName.trim()}` : ''} ${supplierNumber.trim() ? `| رقم المورد: ${supplierNumber.trim()}` : ''}`);
    setSupplierName('');
    setSupplierNumber('');
  };

  if (view === 'workspace' && workspaceOrderId) {
    return (
      <div className="pw-screen">
        <button className="ow-back-btn" onClick={() => { setView('my-claims'); setWorkspaceOrderId(null); setWorkspaceSection('info'); }}>← العودة</button>
        <OrderWorkspace orderId={workspaceOrderId} initialSection={workspaceSection} />
      </div>
    );
  }

  return (
    <div className="pw-screen">
      <div className="pw-header">
        <div className="pw-header-icon">🏭</div>
        <div style={{ flex: 1 }}>
          <h2 className="pw-title">طابور مشتريات الصين</h2>
          <p className="pw-sub">{persona.role} · {persona.departmentLabel}</p>
        </div>
        <div className="pw-view-toggle">
          <button className={`pw-view-btn ${view === 'queue' ? 'active' : ''}`} onClick={() => setView('queue')}>
            الطابور العام
            {pendingOrders.length > 0 && <span className="pw-badge">{pendingOrders.length}</span>}
          </button>
          <button className={`pw-view-btn ${view === 'my-claims' ? 'active' : ''}`} onClick={() => setView('my-claims')}>
            محفظتي
            {myClaims.length > 0 && <span className="pw-badge">{myClaims.length}</span>}
            {unacceptedAssignments > 0 && <span className="pw-assign-badge">{unacceptedAssignments}</span>}
          </button>
        </div>
      </div>

      {queryOrderId && (
        <div className="pw-query-overlay" onClick={() => setQueryOrderId(null)}>
          <div className="pw-query-modal" onClick={(e) => e.stopPropagation()}>
            <h3>إرسال استعلام</h3>
            <textarea className="pw-query-textarea" value={queryMessage} onChange={(e) => setQueryMessage(e.target.value)} placeholder="اكتب استعلامك هنا..." rows={3} />
            <div className="pw-query-actions">
              <button className="pw-btn-cancel" onClick={() => setQueryOrderId(null)}>إلغاء</button>
              <button className="pw-btn-submit" onClick={handleSendQuery} disabled={!queryMessage.trim()}>إرسال الاستعلام</button>
            </div>
          </div>
        </div>
      )}

      {viewOrderId && (() => {
        const vo = orders.find(o => o.id === viewOrderId);
        if (!vo) return null;
        return (
          <div className="pw-query-overlay" onClick={() => setViewOrderId(null)}>
            <div className="pw-view-modal" onClick={(e) => e.stopPropagation()}>
              <div className="pw-view-modal-header">
                <h3>📋 تفاصيل الطلب #{vo.orderNumber}</h3>
                <button className="pw-btn-cancel" onClick={() => setViewOrderId(null)}>✕</button>
              </div>
              <div className="pw-view-modal-body">
                <div className="pw-view-row"><span className="pw-view-label">الشيبينغ مارك:</span><span className="pw-view-value">{vo.shippingMark}-{vo.shippingMarkSerial}</span></div>
                <div className="pw-view-row"><span className="pw-view-label">المنتج:</span><span className="pw-view-value">{vo.productName || '—'}</span></div>
                <div className="pw-view-row"><span className="pw-view-label">الكمية:</span><span className="pw-view-value">{vo.optionalFields?.quantity || '—'}</span></div>
                <div className="pw-view-row"><span className="pw-view-label">القسم:</span><span className="pw-view-value">{vo.categoryLabel || '—'}</span></div>
                <div className="pw-view-row"><span className="pw-view-label">المسؤول:</span><span className="pw-view-value">{vo.salesPersona}</span></div>
                <div className="pw-view-row"><span className="pw-view-label">تاريخ الإنشاء:</span><span className="pw-view-value">{vo.createdAt}</span></div>
                <div className="pw-view-row"><span className="pw-view-label">الحالة:</span><span className="pw-view-value">{vo.status}</span></div>

                {vo.optionalFields && Object.keys(vo.optionalFields).filter(k => k !== 'quantity').length > 0 && (
                  <>
                    <div className="pw-view-divider" />
                    <div className="pw-view-subtitle">حقول إضافية</div>
                    {Object.entries(vo.optionalFields).filter(([k]) => k !== 'quantity').map(([key, val]) => (
                      <div key={key} className="pw-view-row"><span className="pw-view-label">{key}:</span><span className="pw-view-value">{val}</span></div>
                    ))}
                  </>
                )}

                {vo.documents.length > 0 && (
                  <>
                    <div className="pw-view-divider" />
                    <div className="pw-view-subtitle">📎 المرفقات ({vo.documents.length})</div>
                    <div className="pw-view-docs">
                      {vo.documents.map((doc) => (
                        <div key={doc.id} className="pw-view-doc-item">
                          {doc.type === 'attachment' && doc.url.startsWith('blob:') ? (
                            <img src={doc.url} alt={doc.name} className="pw-view-doc-img" />
                          ) : (
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="pw-view-doc-link">{doc.name}</a>
                          )}
                          <span className="pw-view-doc-meta">— {doc.uploadedBy}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                    {vo.notes.length > 0 && (
                  <>
                    <div className="pw-view-divider" />
                    <div className="pw-view-subtitle">📝 الملاحظات ({vo.notes.length})</div>
                    {vo.notes.filter((note) => canSeeNote(note, persona.name, persona.department)).map((note) => (
                      <div key={note.id} className={`pw-view-note ${note.content.startsWith('🔒') ? 'pw-note-confidential' : ''}`}>
                        <div className="pw-note-header">
                          {note.content.startsWith('🔒') && <span className="pw-note-lock">🔒</span>}
                          <span className="pw-note-author">{note.authorPersona}</span>
                          <span className="pw-note-target">→ {note.targetPersona}</span>
                        </div>
                        <div className="pw-note-content">{note.content.replace(/^🔒\s*/, '')}</div>
                      </div>
                    ))}
                  </>
                )}

                {vo.negotiationHistory.length > 0 && (
                  <>
                    <div className="pw-view-divider" />
                    <div className="pw-view-subtitle">💬 سجل التفاوض ({vo.negotiationHistory.length})</div>
                    {vo.negotiationHistory.slice(-5).map((entry) => (
                      <div key={entry.id} className={`pw-view-negotiation type-${entry.type}`}>
                        <div className="pw-note-header">
                          <span className="pw-note-author">{entry.fromPersona}</span>
                          <span className="pw-note-time">{entry.createdAt}</span>
                        </div>
                        <div className="pw-note-content">{entry.message}</div>
                      </div>
                    ))}
                    {vo.negotiationHistory.length > 5 && (
                      <div className="pw-view-more">... وعرض {vo.negotiationHistory.length - 5} رسائل أخرى في مركز الطلب</div>
                    )}
                  </>
                )}
              </div>
              <div className="pw-view-modal-footer">
                <button className="pw-claim-btn" onClick={() => { handleClaim(vo); setViewOrderId(null); }}>🤚 استلام الطلب والمسؤولية</button>
                <button className="pw-btn-cancel" onClick={() => setViewOrderId(null)}>إغلاق</button>
              </div>
            </div>
          </div>
        );
      })()}

      {view === 'queue' ? (
        pendingOrders.length === 0 ? (
          <div className="empty-state-banner">
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-text">لا توجد طلبات في الطابور</div>
            <div className="empty-state-sub">ستظهر الطلبات الجديدة هنا فور إرسالها من المبيعات</div>
          </div>
        ) : (
          <div className="pw-queue">
            {pendingOrders.map((order) => (
              <div key={order.id} className="pw-queue-card">
                <div className="pw-queue-main">
                  <div className="pw-queue-info">
                    <span className="pw-queue-num">#{order.orderNumber}</span>
                    <span className="pw-queue-mark">{order.shippingMark}-{order.shippingMarkSerial}</span>
                    <span className="pw-queue-product">{order.productName}</span>
                    <span className="pw-queue-age">⏱ <PwAgeCell createdAt={order.createdAt} /></span>
                  </div>
                  <div className="pw-queue-actions">
                    <button className="pw-view-btn" onClick={() => setViewOrderId(order.id)}>👁️ عرض الطلب</button>
                    <button className="pw-claim-btn" onClick={() => handleClaim(order)}>🤚 استلام الطلب والمسؤولية</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        myClaims.length === 0 ? (
          <div className="empty-state-banner">
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-text">لا توجد طلبات في محفظتك</div>
            <div className="empty-state-sub">قم باستلام طلبات من الطابور العام</div>
          </div>
        ) : (
          <div className="pw-claims">
            {myClaims.map((order) => (
              <div key={order.id} className={`pw-claim-card ${expandedOrder === order.id ? 'expanded' : ''}`}>
                <div className="pw-claim-main" onClick={() => handleViewOrder(order.id)}>
                  <div className="pw-claim-info">
                    <span className="pw-claim-num">#{order.orderNumber}</span>
                    <span className="pw-claim-mark">{order.shippingMark}-{order.shippingMarkSerial}</span>
                    <span className="pw-claim-product">{order.productName}</span>
                  </div>
                  <div className="pw-claim-actions">
                    <span className="pw-age-badge">⏱ <PwAgeCell createdAt={order.createdAt} /></span>
                    {order.assignment && !order.assignment.accepted ? (
                      <button className="pw-accept-btn" onClick={(e) => { e.stopPropagation(); handleAcceptAssignment(order); }}>
                        ✅ قبول المهمة الإدارية
                      </button>
                    ) : (
                      <>
                        <SLATimer deadlineAt={order.claim?.deadlineAt || ''} />
                        <button className="pw-pricing-btn" onClick={(e) => { e.stopPropagation(); handleOpenPricing(order); }}>
                          💰 تسعير
                        </button>
                      </>
                    )}
                    <button className="pw-workspace-btn" onClick={(e) => { e.stopPropagation(); handleOpenWorkspace(order.id); }}>
                      📋 مركز الطلب
                    </button>
                  </div>
                </div>

                {expandedOrder === order.id && (
                  <div className="pw-claim-expanded">
                    {order.targetPrice !== undefined && (
                      <div className="pw-supplier-info">
                        <span className="pw-supplier-label">التسعير المستهدف:</span>
                        <span>${order.targetPrice.toFixed(3)}</span>
                      </div>
                    )}

                    {order.supplierData && (
                      <div className="pw-supplier-info">
                        <span className="pw-supplier-label">المصنع:</span>
                        <span>{showSupplier ? order.supplierData.factoryName : '***'}</span>
                        {showSupplier && order.supplierData.supplierNumber && (
                          <span>رقم المورد: {order.supplierData.supplierNumber}</span>
                        )}
                        {showSupplier && <span>{order.supplierData.factoryPhone}</span>}
                      </div>
                    )}

                    {/* حقول إضافة مورد جديدة — تظهر للمشتريات فقط */}
                    {showSupplier && (
                      <div className="pw-add-note" onClick={(e) => e.stopPropagation()} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>إضافة / تعديل بيانات المورد:</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input className="pw-note-input" type="text" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="اسم المعمل" style={{ flex: 1 }} />
                          <input className="pw-note-input" type="text" value={supplierNumber} onChange={(e) => setSupplierNumber(e.target.value)} placeholder="رقم المورد" style={{ flex: 1 }} />
                          <button className="pw-note-send" onClick={() => handleSaveSupplier(order)} disabled={!supplierName.trim() && !supplierNumber.trim()}>حفظ</button>
                        </div>
                      </div>
                    )}

                    {order.notes.length > 0 && (
                      <div className="pw-order-notes">
                        {order.notes.filter((note) => canSeeNote(note, persona.name, persona.department)).map((note) => (
                          <div key={note.id} className={`pw-note-item ${note.content.startsWith('🔒') ? 'pw-note-confidential' : ''}`}>
                            <div className="pw-note-header">
                              {note.content.startsWith('🔒') && <span className="pw-note-lock">🔒</span>}
                              <span className="pw-note-author">{note.authorPersona}</span>
                              <span className="pw-note-target">→ {note.targetPersona}</span>
                              <span className="pw-note-time">{note.createdAt}</span>
                            </div>
                            <div className="pw-note-content">{note.content.replace(/^🔒\s*/, '')}</div>
                            {note.readBy.length > 0 && (
                              <div className="pw-note-read">
                                {note.readBy.map((r) => `✅ قرأت ${r.persona} في ${r.readAt}`).join(' | ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="pw-add-note" onClick={(e) => e.stopPropagation()}>
                      <select className="pw-note-select" value={noteTarget} onChange={(e) => setNoteTarget(e.target.value)}>
                        <option value="">— إرسال ملاحظة —</option>
                        {ORDER_NOTE_TARGETS.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                      <input className="pw-note-input" type="text" value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="اكتب ملاحظتك..." />
                      <label className="pw-note-confidential-label">
                        <input type="checkbox" checked={noteConfidential} onChange={(e) => setNoteConfidential(e.target.checked)} />
                        🔒 سرّي — مرئي فقط للمرسل والمستقبل
                      </label>
                      <button className="pw-note-send" onClick={() => { setExpandedOrder(order.id); setTimeout(handleSendNote, 0); }} disabled={!noteTarget || !noteContent.trim()}>إرسال</button>
                    </div>

                    <div className="pw-query-section" onClick={(e) => e.stopPropagation()}>
                      <button className="pw-query-btn" onClick={() => setQueryOrderId(order.id)}>❓ إرسال استعلام إلى البائع</button>
                    </div>

                    {/* زر إغلاق الطلب — يظهر بعد التسعير وقبل الإكمال */}
                    {order.pricingHistory && order.status !== 'completed' && (
                      <div className="pw-query-section" onClick={(e) => e.stopPropagation()} style={{ marginTop: 8 }}>
                        <button className="pw-btn-cancel" style={{ border: '1px solid var(--accent-blue)', color: 'var(--accent-blue)', fontWeight: 700, fontSize: 12, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', background: 'white', fontFamily: 'inherit' }}
                          onClick={() => handleCloseOrder(order)}>
                          ✅ إغلاق الطلب — تمت المعالجة
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function PwAgeCell({ createdAt }: { createdAt: string }) {
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
  const pad = (n: number) => String(n).padStart(2, '0');
  return <>{pad(h)}:{pad(m)}:{pad(s)}</>;
}