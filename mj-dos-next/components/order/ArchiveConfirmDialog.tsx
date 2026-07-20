interface ArchiveConfirmDialogProps {
  isOpen: boolean;
  orderNumber: number;
  reason: string;
  onReasonChange: (val: string) => void;
  onArchive: () => void;
  onClose: () => void;
}

export default function ArchiveConfirmDialog({
  isOpen,
  orderNumber,
  reason,
  onReasonChange,
  onArchive,
  onClose,
}: ArchiveConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="ow-modal-overlay" onClick={onClose}>
      <div className="ow-delete-confirm" onClick={(e) => e.stopPropagation()}>
        <span className="ow-delete-confirm-title">🗄️ أرشفة الطلب #{orderNumber}</span>
        <span className="ow-delete-confirm-text">لا يمكن حذف الطلبات في MJ-DOS — سيتم أرشفة الطلب مع إبقاء سجله الكامل. يرجى ذكر سبب الأرشفة (إلزامي).</span>
        <textarea
          className="ow-reject-textarea"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="سبب الأرشفة (إلغاء العميل، خطأ في الإدخال، ...)"
          rows={4}
          autoFocus
          style={{ marginTop: 8 }}
        />
        <div className="ow-delete-confirm-actions">
          <button className="ow-delete-confirm-cancel" onClick={onClose}>إلغاء</button>
          <button className="ow-delete-confirm-proceed" onClick={onArchive} disabled={!reason.trim()}>
            🗄️ تأكيد الأرشفة
          </button>
        </div>
      </div>
    </div>
  );
}
