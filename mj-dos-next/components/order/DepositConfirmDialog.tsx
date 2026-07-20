import { formatNumber } from '../../utils/formatNumber';
import type { Order, Persona } from '../../types';

interface DepositConfirmDialogProps {
  isOpen: boolean;
  order: Order;
  persona: Persona;
  confirmNote: string;
  confirmAttachment: File | null;
  showReturn: boolean;
  returnReason: string;
  onConfirmNoteChange: (val: string) => void;
  onConfirmAttachmentChange: (file: File | null) => void;
  onToggleReturn: () => void;
  onReturnReasonChange: (val: string) => void;
  onConfirm: () => void;
  onReturn: () => void;
  onClose: () => void;
}

export default function DepositConfirmDialog({
  isOpen,
  order,
  persona,
  confirmNote,
  confirmAttachment,
  showReturn,
  returnReason,
  onConfirmNoteChange,
  onConfirmAttachmentChange,
  onToggleReturn,
  onReturnReasonChange,
  onConfirm,
  onReturn,
  onClose,
}: DepositConfirmDialogProps) {
  if (!isOpen || !order.customerDeposit) return null;

  const d = order.customerDeposit;
  const methodLabel = d.paymentMethod === 'other'
    ? `غير ذلك: ${d.customPaymentMethod || ''}`
    : ({ cash_office: 'كاش في مقر الشركة', sham_cash: 'شام كاش', trend_5000: 'شركة ترند — جمران / ترند 5000', dahab_istanbul_1373: 'شركة ذهب — جمران / إسطنبول 1373', free_istanbul_104: 'شركة فري — جمران / إسطنبول 104' } as Record<string, string>)[d.paymentMethod];

  return (
    <div className="ow-modal-overlay" onClick={onClose}>
      <div className="ow-proforma-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ow-proforma-header">
          <h3>💳 تأكيد دفع العربون</h3>
          <button className="ow-proforma-close" onClick={onClose}>✕</button>
        </div>
        <div className="ow-proforma-body">
          <div className="ow-proforma-info">
            <div className="ow-proforma-row"><span className="ow-proforma-label">المبلغ:</span><span className="ow-proforma-value">{formatNumber(d.amount)} {d.currency}</span></div>
            <div className="ow-proforma-row"><span className="ow-proforma-label">طريقة الدفع:</span><span className="ow-proforma-value">{methodLabel}</span></div>
            <div className="ow-proforma-row"><span className="ow-proforma-label">تاريخ الدفع:</span><span className="ow-proforma-value">{d.paymentDate}</span></div>
            <div className="ow-proforma-row"><span className="ow-proforma-label">سجّله:</span><span className="ow-proforma-value">{d.recordedBy} — {d.recordedAt}</span></div>
            {d.note && (
              <div className="ow-proforma-row"><span className="ow-proforma-label">ملاحظات:</span><span className="ow-proforma-value">{d.note}</span></div>
            )}
            {d.attachment && (
              <div className="ow-proforma-row"><span className="ow-proforma-label">إثبات الدفع:</span><a className="ow-doc-link" href={d.attachment.url} target="_blank" rel="noopener noreferrer">📎 {d.attachment.name}</a></div>
            )}
          </div>
          {showReturn && (
            <div className="ow-proforma-profit">
              <div className="ow-proforma-profit-title">↩ سبب الإعادة للتصحيح (إلزامي)</div>
              <textarea className="ow-reject-textarea" style={{ width: '100%' }} value={returnReason} onChange={(e) => onReturnReasonChange(e.target.value)} rows={3} placeholder="اكتب سبب إعادة العربون للتصحيح..." />
            </div>
          )}
          {!showReturn && (
            <div className="ow-proforma-profit">
              <div className="ow-proforma-profit-title">ملاحظات (اختياري)</div>
              <textarea className="ow-reject-textarea" style={{ width: '100%' }} value={confirmNote} onChange={(e) => onConfirmNoteChange(e.target.value)} rows={2} placeholder="اكتب ملاحظة هنا..." />
              <div className="ow-proforma-profit-title" style={{ marginTop: 10 }}>إرفاق ملف (اختياري)</div>
              <input type="file" onChange={(e) => onConfirmAttachmentChange(e.target.files?.[0] || null)} />
              {confirmAttachment && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>📎 {confirmAttachment.name}</div>}
            </div>
          )}
        </div>
        <div className="ow-proforma-footer">
          <button
            className="ow-proforma-submit"
            onClick={onConfirm}
          >
            ✅ تأكيد العربون
          </button>
          {!showReturn ? (
            <button className="ow-proforma-cancel" onClick={onToggleReturn}>↩ إعادة للتصحيح</button>
          ) : (
            <button
              className="ow-pricing-reject-btn"
              disabled={!returnReason.trim()}
              onClick={onReturn}
            >
              📤 إرسال الإعادة
            </button>
          )}
          <button className="ow-proforma-cancel" onClick={onClose}>إغلاق</button>
        </div>
      </div>
    </div>
  );
}
