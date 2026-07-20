import type { FactoryPaymentMethod } from '../../types';

interface FactoryPaymentFormProps {
  isOpen: boolean;
  amount: string;
  currency: string;
  method: string;
  reference: string;
  note: string;
  attachment: File | null;
  onAmountChange: (val: string) => void;
  onCurrencyChange: (val: 'RMB' | 'USD') => void;
  onMethodChange: (val: string) => void;
  onReferenceChange: (val: string) => void;
  onNoteChange: (val: string) => void;
  onAttachmentChange: (file: File | null) => void;
  onSave: () => void;
  onClose: () => void;
}

export default function FactoryPaymentForm({
  isOpen,
  amount,
  currency,
  method,
  reference,
  note,
  attachment,
  onAmountChange,
  onCurrencyChange,
  onMethodChange,
  onReferenceChange,
  onNoteChange,
  onAttachmentChange,
  onSave,
  onClose,
}: FactoryPaymentFormProps) {
  if (!isOpen) return null;

  return (
    <div className="ow-modal-overlay" onClick={onClose}>
      <div className="ow-proforma-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ow-proforma-header">
          <h3>🏭 تسجيل دفع المعمل</h3>
          <button className="ow-proforma-close" onClick={onClose}>✕</button>
        </div>
        <div className="ow-proforma-body">
          <div className="ow-pricing-form-row">
            <div className="ow-pricing-form-group">
              <label className="ow-pricing-form-label">المبلغ *</label>
              <input className="ow-pricing-form-input" type="text" inputMode="decimal" value={amount} onChange={(e) => onAmountChange(e.target.value)} placeholder="0" />
            </div>
            <div className="ow-pricing-form-group" style={{ maxWidth: 160 }}>
              <label className="ow-pricing-form-label">العملة *</label>
              <select className="ow-pricing-form-input" value={currency} onChange={(e) => onCurrencyChange(e.target.value as 'RMB' | 'USD')}>
                <option value="RMB">RMB (¥)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
          </div>
          <div className="ow-pricing-form-row">
            <div className="ow-pricing-form-group">
              <label className="ow-pricing-form-label">طريقة الدفع *</label>
              <select className="ow-pricing-form-input" value={method} onChange={(e) => onMethodChange(e.target.value)}>
                <option value="rmb_jasmine">رمبي من عند جاسمين</option>
                <option value="rmb_exchange_office">رمبي دايركتلي من الصراف</option>
                <option value="usd_bank">دولار عن طريق البنك</option>
              </select>
            </div>
            <div className="ow-pricing-form-group">
              <label className="ow-pricing-form-label">مرجع الدفع (اختياري)</label>
              <input className="ow-pricing-form-input" type="text" value={reference} onChange={(e) => onReferenceChange(e.target.value)} placeholder="رقم تحويل، إشعار مصرفي، ..." />
            </div>
          </div>
          <div className="ow-pricing-form-row">
            <div className="ow-pricing-form-group">
              <label className="ow-pricing-form-label">ملاحظة المشتريات (اختياري)</label>
              <textarea className="ow-pricing-form-input" value={note} onChange={(e) => onNoteChange(e.target.value)} rows={2} placeholder="أي معلومة مفيدة للحسابات" />
            </div>
          </div>
          <div className="ow-pricing-form-row">
            <div className="ow-pricing-form-group">
              <label className="ow-pricing-form-label">إثبات الدفع (اختياري)</label>
              <input className="ow-pricing-form-input" type="file" accept="image/*,application/pdf" onChange={(e) => onAttachmentChange(e.target.files?.[0] || null)} />
              {attachment && (
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>📎 {attachment.name}</div>
              )}
            </div>
          </div>
          <div className="ow-proforma-summary" style={{ background: '#fef3c7', color: '#78350f' }}>
            ملاحظة: لا يتغيّر وضع الطلب حتى تؤكّد الحسابات دفع المعمل. لا يمكن للمشتريات تأكيد دفعها بنفسها.
          </div>
        </div>
        <div className="ow-proforma-footer">
          <button
            className="ow-proforma-submit"
            disabled={!amount.trim()}
            onClick={onSave}
          >
            ✅ حفظ وإعلام الحسابات
          </button>
          <button className="ow-proforma-cancel" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}
