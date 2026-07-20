import type { Order, Persona } from '../../types';
import { ORDER_NOTE_TARGETS, canSeeNote } from '../../utils/noteVisibility';

const ALL_PEOPLE = '__all__';

interface NotesPanelProps {
  order: Order;
  persona: Persona;
  noteTarget: string;
  noteContent: string;
  replyInputs: Record<string, string>;
  onTargetChange: (val: string) => void;
  onContentChange: (val: string) => void;
  onReplyInputChange: (noteId: string, val: string) => void;
  onSendNote: () => void;
  onReply: (noteId: string) => void;
}

export default function NotesPanel({
  order,
  persona,
  noteTarget,
  noteContent,
  replyInputs,
  onTargetChange,
  onContentChange,
  onReplyInputChange,
  onSendNote,
  onReply,
}: NotesPanelProps) {
  return (
    <div className="ow-notes-panel">
      <div className="ow-note-input">
        <select className="ow-note-select" value={noteTarget} onChange={(e) => onTargetChange(e.target.value)}>
          <option value="">— إرسال ملاحظة إلى —</option>
          <option value={ALL_PEOPLE}>👥 جميع الأشخاص</option>
          {ORDER_NOTE_TARGETS.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <textarea className="ow-note-textarea" value={noteContent} onChange={(e) => onContentChange(e.target.value)} placeholder="اكتب ملاحظتك هنا..." rows={4} />
        <button className="ow-note-send" onClick={onSendNote} disabled={!noteTarget || !noteContent.trim()}>إرسال وحفظ</button>
      </div>

      {order.notes.length === 0 ? (
        <div className="ow-notes-empty">لا توجد ملاحظات بعد</div>
      ) : (
        <div className="ow-notes-list">
          {order.notes.filter((note) => canSeeNote(note, persona.name, persona.department)).map((note) => (
            <div key={note.id} className="ow-note-item">
              <div className="ow-note-header">
                <span className="ow-note-author">{note.authorPersona}</span>
                <span className="ow-note-target">→ {note.targetPersona === ALL_PEOPLE ? '👥 الجميع' : note.targetPersona}</span>
                <span className="ow-note-time">{note.createdAt}</span>
              </div>
              <div className="ow-note-content">{note.content}</div>
              {note.readBy.length > 0 && (
                <div className="ow-note-read">
                  {note.readBy.map((r) => `✅ قرأها ${r.persona}`).join(' | ')}
                </div>
              )}

              {note.replies.length > 0 && (
                <div className="ow-note-replies">
                  {note.replies.map((reply) => (
                    <div key={reply.id} className="ow-note-reply">
                      <span className="ow-reply-author">{reply.authorPersona}</span>
                      <span className="ow-reply-time">{reply.createdAt}</span>
                      <div className="ow-reply-text">{reply.content}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="ow-reply-form">
                <input className="ow-reply-input" value={replyInputs[note.id] || ''} onChange={(e) => onReplyInputChange(note.id, e.target.value)} placeholder="اكتب رداً..." />
                <button className="ow-reply-btn" onClick={() => onReply(note.id)} disabled={!replyInputs[note.id]?.trim()}>رد</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
