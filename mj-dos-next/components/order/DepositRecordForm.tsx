import type { QuotationCurrency, DepositPaymentMethod } from '../../types';

interface DepositRecordFormProps {
  isOpen: boolean;
  amount: string;
  currency: string;
  method: string;
  customMethod: string;
  date: string;
  attachment: File | null;
  onAmountChange: (val: string) => void;
  onCurrencyChange: (val: string) => void;
  onMethodChange: (val: string) => void;
  onCustomMethodChange: (val: string) => void;
  onDateChange: (val: string) => void;
  onAttachmentChange: (file: File | null) => void;
  onSave: () => void;
  onClose: () => void;
}

export default function DepositRecordForm({
  isOpen,
  amount,
  currency,
  method,
  customMethod,
  date,
  attachment,
  onAmountChange,
  onCurrencyChange,
  onMethodChange,
  onCustomMethodChange,
  onDateChange,
  onAttachmentChange,
  onSave,
  onClose,
}: DepositRecordFormProps) {
  if (!isOpen) return null;

  return (
    <div className="ow-modal-overlay" onClick={onClose}>
      <div className="ow-proforma-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ow-proforma-header">
          <h3>💵 تسجيل استلام العربون من الزبون</h3>
          <button className="ow-proforma-close" onClick={onClose}>✕</button>
        </div>
        <div className="ow-proforma-body">
          <div className="ow-pricing-form-row">
            <div className="ow-pricing-form-group">
              <label className="ow-pricing-form-label">مبلغ العربون *</label>
              <input className="ow-pricing-form-input" type="text" inputMode="decimal" value={amount} onChange={(e) => onAmountChange(e.target.value)} placeholder="0" />
            </div>
            <div className="ow-pricing-form-group" style={{ maxWidth: 160 }}>
              <label className="ow-pricing-form-label">العملة *</label>
              <select className="ow-pricing-form-input" value={currency} onChange={(e) => onCurrencyChange(e.target.value)}>
                <option value="USD">USD ($)</option>
                <option value="RMB">RMB (¥)</option>
              </select>
            </div>
          </div>
          <div className="ow-pricing-form-row">
            <div className="ow-pricing-form-group">
              <label className="ow-pricing-form-label">طريقة الدفع *</label>
              <select className="ow-pricing-form-input" value={method} onChange={(e) => onMethodChange(e.target.value)}>
                <option value="cash_office">كاش في مقر الشركة</option>
                <option value="sham_cash">شام كاش</option>
                <option value="trend_5000">شركة ترند — جمران / ترند 5000</option>
                <option value="dahab_istanbul_1373">شركة ذهب — جمران / إسطنبول 1373</option>
                <option value="free_istanbul_104">شركة فري — جمران / إسطنبول 104</option>
                <option value="other">غير ذلك</option>
              </select>
            </div>
            <div className="ow-pricing-form-group">
              <label className="ow-pricing-form-label">تاريخ الدفع *</label>
              <input className="ow-pricing-form-input" type="date" value={date} onChange={(e) => onDateChange(e.target.value)} />
            </div>
          </div>
          {method === 'other' && (
            <div className="ow-pricing-form-row">
              <div className="ow-pricing-form-group">
                <label className="ow-pricing-form-label">اكتب مكان أو طريقة الدفع *</label>
                <input className="ow-pricing-form-input" type="text" value={customMethod} onChange={(e) => onCustomMethodChange(e.target.value)} placeholder="مثال: تحويل عبر شركة X" />
              </div>
            </div>
          )}
          <div className="ow-pricing-form-row">
            <div className="ow-pricing-form-group">
              <label className="ow-pricing-form-label">إثبات الدفع (اختياري — صورة، PDF، ...)</label>
              <input className="ow-pricing-form-input" type="file" accept="image/*,application/pdf" onChange={(e) => onAttachmentChange(e.target.files?.[0] || null)} />
              {attachment && (
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>📎 {attachment.name}</div>
              )}
            </div>
          </div>
        </div>
        <div className="ow-proforma-footer">
          <button
            className="ow-proforma-submit"
            onClick={onSave}
            disabled={!amount.trim() || (method === 'other' && !customMethod.trim())}
          >
            ✅ حفظ العربون
          </button>
          <button className="ow-proforma-cancel" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}
