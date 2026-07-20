import { formatNumber } from '../../utils/formatNumber';
import type { Order, Persona } from '../../types';

interface InvoicePreviewModalProps {
  isOpen: boolean;
  order: Order;
  persona: Persona;
  notes: string;
  isExporting: boolean;
  onNotesChange: (val: string) => void;
  onExport: (format: 'pdf' | 'xlsx') => void;
  onClose: () => void;
}

export default function InvoicePreviewModal({
  isOpen,
  order,
  persona,
  notes,
  isExporting,
  onNotesChange,
  onExport,
  onClose,
}: InvoicePreviewModalProps) {
  if (!isOpen || !order.proforma) return null;

  const proforma = order.proforma;
  const existing = order.officialInvoice;
  const currency = proforma.exportCurrency || 'USD';
  const finalPrice = currency === 'USD' ? proforma.grandTotalUSD : proforma.grandTotalRMB;
  const sym = currency === 'USD' ? '$' : '¥';

  return (
    <div className="ow-proforma-modal" role="dialog" aria-modal="false" aria-label="معاينة الفاتورة الرسمية">
      <div className="ow-proforma-header">
        <h3>🧾 معاينة الفاتورة الرسمية قبل التصدير</h3>
        <button type="button" className="ow-proforma-close" onClick={onClose} aria-label="إغلاق">✕</button>
      </div>
        <div className="ow-proforma-body">
          <div className="ow-proforma-info">
            <div className="ow-proforma-row"><span className="ow-proforma-label">الشركة:</span><span className="ow-proforma-value">MJ Group</span></div>
            <div className="ow-proforma-row"><span className="ow-proforma-label">الزبون:</span><span className="ow-proforma-value">{order.clientName}</span></div>
            <div className="ow-proforma-row"><span className="ow-proforma-label">رقم الطلب:</span><span className="ow-proforma-value">#{order.orderNumber}</span></div>
            <div className="ow-proforma-row"><span className="ow-proforma-label">الشيبينغ مارك:</span><span className="ow-proforma-value">{order.shippingMark}-{order.shippingMarkSerial}</span></div>
            <div className="ow-proforma-row"><span className="ow-proforma-label">عدد المنتجات:</span><span className="ow-proforma-value">{order.products.length}</span></div>
            <div className="ow-proforma-row"><span className="ow-proforma-label">العملة:</span><span className="ow-proforma-value">{currency}</span></div>
            <div className="ow-proforma-row"><span className="ow-proforma-label">القالب:</span><span className="ow-proforma-value">Template {proforma.template || 1}</span></div>
            {existing && (
              <div className="ow-proforma-row"><span className="ow-proforma-label">رقم الفاتورة السابقة:</span><span className="ow-proforma-value">{existing.invoiceNumber} — {existing.exportedAt} — {existing.exportedFormat.toUpperCase()}</span></div>
            )}
          </div>
          <div className="ow-proforma-final">
            <span className="ow-proforma-final-label">الإجمالي النهائي:</span>
            <div className="ow-proforma-final-values">
              <span className={currency === 'USD' ? 'ow-proforma-final-usd' : 'ow-proforma-final-rmb'}>{sym} {formatNumber(Math.round(finalPrice), 0)} {currency}</span>
            </div>
          </div>
          <div className="ow-proforma-profit">
            <div className="ow-proforma-profit-title">📝 ملاحظات الفاتورة (تظهر في PDF/Excel)</div>
            <textarea
              className="ow-reject-textarea"
              style={{ width: '100%', minHeight: 120 }}
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="يمكنك تعديل ملاحظات الفاتورة الافتراضية حسب الحاجة..."
            />
          </div>
        </div>
        <div className="ow-proforma-footer">
          <button
            type="button"
            className="ow-proforma-submit"
            onClick={() => onExport('pdf')}
            disabled={isExporting}
            title="حفظ الفاتورة وتوليد PDF"
          >
            {isExporting ? '⏳ جاري التوليد…' : '📄 تصدير كـ PDF'}
          </button>
          <button
            type="button"
            className="ow-proforma-submit"
            onClick={() => onExport('xlsx')}
            disabled={isExporting}
            title="حفظ الفاتورة وتوليد Excel"
          >
            {isExporting ? '⏳ جاري التوليد…' : '📊 تصدير كـ Excel'}
          </button>
          <button type="button" className="ow-proforma-cancel" onClick={onClose}>
            إغلاق (لا يتم تغيير الحالة)
          </button>
        </div>
    </div>
  );
}
