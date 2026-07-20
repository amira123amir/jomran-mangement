import type { Order } from '../../types';
import { STATUS_LABELS } from '../../utils/orderStatus';

interface NegotiationPanelProps {
  order: Order;
  negotiationMsg: string;
  onNegotiationMsgChange: (val: string) => void;
  negImageFile: File | null;
  negImagePreview: string | null;
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  onSendMessage: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export default function NegotiationPanel({
  order,
  negotiationMsg,
  onNegotiationMsgChange,
  negImageFile,
  negImagePreview,
  onImageSelect,
  onRemoveImage,
  onSendMessage,
  fileInputRef,
}: NegotiationPanelProps) {
  return (
    <div className="ow-negotiation-panel">
      <div className="ow-negotiation-input">
        <textarea className="ow-negotiation-textarea" value={negotiationMsg} onChange={(e) => onNegotiationMsgChange(e.target.value)} placeholder="اكتب رسالتك هنا..." rows={3} />
        <div className="ow-negotiation-actions">
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onImageSelect} />
          <button className="ow-neg-image-btn" onClick={() => fileInputRef.current?.click()} title="إرفاق صورة">📷</button>
          <button className="ow-negotiation-send" onClick={onSendMessage} disabled={!negotiationMsg.trim() && !negImageFile}>إرسال</button>
        </div>
        {negImagePreview && (
          <div className="ow-neg-image-preview">
            <img src={negImagePreview} alt="معاينة" />
            <button className="ow-neg-image-remove" onClick={onRemoveImage}>✕</button>
          </div>
        )}
      </div>

      {order.workflowHistory && order.workflowHistory.length > 0 && (
        <div className="ow-workflow-history">
          <div className="ow-workflow-history-title">📖 سجل انتقالات سير العمل (غير قابل للتعديل)</div>
          <div className="ow-workflow-history-list">
            {order.workflowHistory.map((t) => (
              <div key={t.id} className={`ow-workflow-history-item direction-${t.direction}`}>
                <div className="ow-workflow-history-row">
                  <span className="ow-workflow-history-direction">
                    {t.direction === 'initial' ? '🆕' : t.direction === 'forward' ? '➡️' : '↩️'}
                  </span>
                  <span className="ow-workflow-history-from">
                    {t.from ? STATUS_LABELS[t.from] : 'إنشاء الطلب'}
                  </span>
                  <span className="ow-workflow-history-arrow">→</span>
                  <span className="ow-workflow-history-to">{STATUS_LABELS[t.to]}</span>
                </div>
                <div className="ow-workflow-history-meta">
                  <span>👤 {t.actorName}</span>
                  <span>💼 {t.actorRole || t.actorDept}</span>
                  <span>📅 {t.date}</span>
                  <span>⏱ {t.time}</span>
                </div>
                {t.reason && <div className="ow-workflow-history-reason">📝 {t.reason}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {order.negotiationHistory.length === 0 ? (
        <div className="ow-notes-empty">لا توجد رسائل بعد</div>
      ) : (
        <div className="ow-negotiation-list">
          {order.negotiationHistory.map((entry) => (
            <div key={entry.id} className={`ow-negotiation-entry type-${entry.type}`}>
              <div className="ow-negotiation-header">
                <span className="ow-negotiation-author">{entry.fromPersona}</span>
                <span className="ow-negotiation-sep">—</span>
                <span className="ow-negotiation-time">{entry.createdAt}</span>
              </div>
              <div className="ow-negotiation-message">{entry.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
