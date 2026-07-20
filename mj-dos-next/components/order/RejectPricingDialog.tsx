interface RejectPricingDialogProps {
  isOpen: boolean;
  reason: string;
  onReasonChange: (val: string) => void;
  onReject: () => void;
  onClose: () => void;
}

export default function RejectPricingDialog({
  isOpen,
  reason,
  onReasonChange,
  onReject,
  onClose,
}: RejectPricingDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="ow-modal-overlay" onClick={onClose}>
      <div className="ow-reject-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ow-reject-header">
          <h3>❌ رفض التسعير</h3>
          <button className="ow-reject-close" onClick={onClose}>✕</button>
        </div>
        <div className="ow-reject-body">
          <p className="ow-reject-hint">يرجى توضيح سبب رفض التسعير أو التسعير المستهدف المطلوب. سيتم إعادة الطلب إلى المشتريات مع إشعار فوري.</p>
          <textarea
            className="ow-reject-textarea"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="اكتب سبب الرفض / التسعير المستهدف المطلوب... (إلزامي)"
            rows={5}
            autoFocus
          />
        </div>
        <div className="ow-reject-actions">
          <button className="ow-reject-cancel" onClick={onClose}>إلغاء</button>
          <button
            className="ow-reject-submit"
            onClick={onReject}
            disabled={!reason.trim()}
          >
            📤 إرسال الرفض إلى المشتريات
          </button>
        </div>
      </div>
    </div>
  );
}
