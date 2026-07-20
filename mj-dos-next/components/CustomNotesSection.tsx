import { useState, useEffect } from 'react';
import { MessageSquare, Send, Reply, CheckCircle2 } from 'lucide-react';
import { useOrderStore } from '../stores/orderStore';
import {
  NOTE_TARGETS,
  getCurrentUserIds,
  canSeeConfidentialNote,
  isConfidentialRecipient,
} from '../utils/noteVisibility';
import { CEO_NAME } from '../utils/constants';

interface CustomNotesSectionProps {
  persona: string;
  role: string;
  department: string;
}

export default function CustomNotesSection({ persona, role }: CustomNotesSectionProps) {
  const orders = useOrderStore(s => s.orders);
  const addCustomNote = useOrderStore(s => s.addCustomNote);
  const markCustomNoteRead = useOrderStore(s => s.markCustomNoteRead);
  const replyToCustomNote = useOrderStore(s => s.replyToCustomNote);

  const [showForm, setShowForm] = useState(false);
  const [targetId, setTargetId] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});

  const currentUserId = getCurrentUserIds(persona)[0];
  const isCEO = persona === CEO_NAME;

  const myNotes = orders.flatMap(o =>
    o.customNotes
      .filter(n => canSeeConfidentialNote(n, persona, currentUserId))
      .map(n => ({ note: n, order: o }))
  ).sort((a, b) => b.note.createdAt.localeCompare(a.note.createdAt));

  const unreadCount = myNotes.filter(x =>
    !x.note.isRead && isConfidentialRecipient(x.note, persona, currentUserId)
  ).length;

  useEffect(() => {
    for (const { note, order } of myNotes) {
      if (!note.isRead && isConfidentialRecipient(note, persona, currentUserId)) {
        markCustomNoteRead(order.id, note.id, persona);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona, myNotes, markCustomNoteRead]);

  const handleSendNote = () => {
    if (!targetId || !noteContent.trim() || !selectedOrderId) return;
    const target = NOTE_TARGETS.find(t => t.userId === targetId);
    if (!target) return;
    addCustomNote(selectedOrderId, persona, role, target.userId, target.name, target.role, noteContent.trim(), 'general');
    setTargetId('');
    setNoteContent('');
    setSelectedOrderId('');
    setShowForm(false);
  };

  const handleReplySubmit = (orderId: string, noteId: string) => {
    const text = replyTexts[noteId];
    if (!text?.trim()) return;
    replyToCustomNote(orderId, noteId, persona, role, text.trim());
    setReplyTexts(prev => ({ ...prev, [noteId]: '' }));
  };

  return (
    <div className="custom-notes-section">
      <div className="custom-notes-header">
        <div className="custom-notes-header-left">
          <MessageSquare size={18} />
          <span className="custom-notes-title">الملاحظات الموجهة</span>
          {unreadCount > 0 && <span className="custom-notes-badge">{unreadCount}</span>}
        </div>
        <button className="custom-notes-add-btn" onClick={() => setShowForm(true)}>
          + ملاحظة جديدة
        </button>
      </div>

      {showForm && (
        <div className="custom-note-form">
          <div className="custom-note-form-row">
            <div className="custom-note-field">
              <label>إلى</label>
              <select value={targetId} onChange={e => setTargetId(e.target.value)}>
                <option value="">— اختر المستهدف —</option>
                {NOTE_TARGETS.map(t => (
                  <option key={t.userId} value={t.userId}>{t.name} — {t.role}</option>
                ))}
              </select>
            </div>
            <div className="custom-note-field">
              <label>الطلب</label>
              <select value={selectedOrderId} onChange={e => setSelectedOrderId(e.target.value)}>
                <option value="">— اختر الطلب —</option>
                {orders.map(o => (
                  <option key={o.id} value={o.id}>#{o.orderNumber} — {o.shippingMark}</option>
                ))}
              </select>
            </div>
          </div>
          <textarea className="custom-note-textarea" value={noteContent} onChange={e => setNoteContent(e.target.value)} rows={3} placeholder="اكتب نص الملاحظة الموجهة..." />
          <div className="custom-note-actions">
            <button className="custom-note-cancel" onClick={() => setShowForm(false)}>إلغاء</button>
            <button className="custom-note-send" onClick={handleSendNote} disabled={!targetId || !noteContent.trim() || !selectedOrderId}>
              <Send size={14} /> إرسال الملاحظة
            </button>
          </div>
        </div>
      )}

      {myNotes.length === 0 ? (
        <div className="custom-notes-empty">
          <MessageSquare size={32} />
          <span>لا توجد ملاحظات موجهة لك</span>
        </div>
      ) : (
        <div className="custom-notes-list">
          {myNotes.map(({ note, order }) => {
            const showUnread = !note.isRead && isConfidentialRecipient(note, persona, currentUserId);
            const history = note.readHistory || [];
            return (
            <div key={note.id} className={`custom-note-card ${showUnread ? 'unread' : ''}`}>
              <div className="custom-note-card-header">
                <span className="custom-note-sender">{note.senderName}</span>
                <span className="custom-note-sender-role">{note.senderRole}</span>
                <span className="custom-note-order-ref">#{note.orderNumber} — {note.shippingMark}</span>
                <span className="custom-note-time">{note.createdAt}</span>
                {note.isRead ? (
                  <span className="custom-note-read-badge">
                    <CheckCircle2 size={12} /> تمت القراءة بواسطة {note.targetName} في {note.readAt}
                  </span>
                ) : showUnread ? (
                  <span className="custom-note-unread-badge">جديد</span>
                ) : null}
              </div>
              <div className="custom-note-card-body">{note.content}</div>

              {isCEO && history.length > 0 && (
                <div className="custom-note-audit">
                  <span className="custom-note-audit-title">📖 سجل القراءة (غير قابل للتعديل)</span>
                  {history.map((h, idx) => (
                    <div key={idx} className="custom-note-audit-row">
                      <span>👤 {h.reader}</span>
                      <span>📅 {h.date}</span>
                      <span>⏱ {h.time}</span>
                    </div>
                  ))}
                </div>
              )}

              {note.replies.length > 0 && (
                <div className="custom-note-replies">
                  {note.replies.map(r => (
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
                <input className="custom-note-reply-input" type="text" value={replyTexts[note.id] || ''}
                  onChange={e => setReplyTexts(prev => ({ ...prev, [note.id]: e.target.value }))}
                  placeholder="اكتب رداً..." />
                <button className="custom-note-reply-btn" onClick={() => handleReplySubmit(order.id, note.id)}
                  disabled={!replyTexts[note.id]?.trim()}>
                  <Reply size={12} /> رد
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
