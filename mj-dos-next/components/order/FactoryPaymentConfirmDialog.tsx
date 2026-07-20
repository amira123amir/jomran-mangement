import { formatNumber } from '../../utils/formatNumber';
import type { Order, Persona } from '../../types';

interface FactoryPaymentConfirmDialogProps {
  isOpen: boolean;
  order: Order;
  persona: Persona;
  onConfirm: () => void;
  onClose: () => void;
}

export default function FactoryPaymentConfirmDialog({
  isOpen,
  order,
  persona,
  onConfirm,
  onClose,
}: FactoryPaymentConfirmDialogProps) {
  if (!isOpen || !order.factoryPayment) return null;

  const p = order.factoryPayment;
  const methodLabel = ({ rmb_jasmine: 'رمبي من عند جاسمين', rmb_exchange_office: 'رمبي دايركتلي من الصراف', usd_bank: 'دولار عن طريق البنك' } as Record<string, string>)[p.paymentMethod];
  const canConfirm = p.recordedBy !== persona.name;

  return (
    <div className="ow-modal-overlay" onClick={onClose}>
      <div className="ow-proforma-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ow-proforma-header">
          <h3>✅ تأكيد دفع المشتريات للمعمل</h3>
          <button className="ow-proforma-close" onClick={onClose}>✕</button>
        </div>
        <div className="ow-proforma-body">
          <div className="ow-proforma-info">
            <div className="ow-proforma-row"><span className="ow-proforma-label">المبلغ:</span><span className="ow-proforma-value">{formatNumber(p.amount)} {p.currency}</span></div>
            <div className="ow-proforma-row"><span className="ow-proforma-label">طريقة الدفع:</span><span className="ow-proforma-value">{methodLabel}</span></div>
            {p.reference && <div className="ow-proforma-row"><span className="ow-proforma-label">المرجع:</span><span className="ow-proforma-value">{p.reference}</span></div>}
            <div className="ow-proforma-row"><span className="ow-proforma-label">سجّله:</span><span className="ow-proforma-value">{p.recordedBy} — {p.recordedAt}</span></div>
            {p.note && <div className="ow-proforma-row"><span className="ow-proforma-label">ملاحظة المشتريات:</span><span className="ow-proforma-value">{p.note}</span></div>}
            {p.attachment && (
              <div className="ow-proforma-row"><span className="ow-proforma-label">إثبات الدفع:</span><a className="ow-doc-link" href={p.attachment.url} target="_blank" rel="noopener noreferrer">📎 {p.attachment.name}</a></div>
            )}
          </div>
          {!canConfirm && (
            <div className="ow-proforma-summary" style={{ background: '#fee2e2', color: '#7f1d1d' }}>
              لا يمكنك تأكيد دفع سجّلته بنفسك. التأكيد من صلاحية الحسابات فقط.
            </div>
          )}
        </div>
        <div className="ow-proforma-footer">
          <button
            className="ow-proforma-submit"
            disabled={!canConfirm}
            onClick={onConfirm}
          >
            ✅ تأكيد الدفع
          </button>
          <button className="ow-proforma-cancel" onClick={onClose}>إغلاق</button>
        </div>
      </div>
    </div>
  );
}
