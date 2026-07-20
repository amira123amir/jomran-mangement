import { useState } from 'react';
import { formatNumber } from '../../utils/formatNumber';
import { parseArabicNumber } from '../../utils/arabicNumerals';
import type { Order, Persona, QuotationCurrency, QuotationTemplate, OrderPricing } from '../../types';

interface ProformaModalProps {
  isOpen: boolean;
  order: Order;
  latestPricing: OrderPricing | null;
  isProcurement: boolean;
  profitPercent: string;
  profitFixed: string;
  profitCurrency: QuotationCurrency;
  exportCurrency: QuotationCurrency;
  template: QuotationTemplate;
  onProfitPercentChange: (val: string) => void;
  onProfitFixedChange: (val: string) => void;
  onProfitCurrencyChange: (val: QuotationCurrency) => void;
  onExportCurrencyChange: (val: QuotationCurrency) => void;
  onTemplateChange: (val: QuotationTemplate) => void;
  onConfirmAndSend: (format: 'pdf' | 'xlsx') => void;
  onExportOfficialInvoice: () => void;
  onClose: () => void;
}

export default function ProformaModal({
  isOpen,
  order,
  latestPricing,
  isProcurement,
  profitPercent,
  profitFixed,
  profitCurrency,
  exportCurrency,
  template,
  onProfitPercentChange,
  onProfitFixedChange,
  onProfitCurrencyChange,
  onExportCurrencyChange,
  onTemplateChange,
  onConfirmAndSend,
  onExportOfficialInvoice,
  onClose,
}: ProformaModalProps) {
  const [profitError, setProfitError] = useState('');
  if (!isOpen || !latestPricing) return null;

  const baseRMB = latestPricing.totalRMB;
  const baseUSD = latestPricing.totalUSD;
  const er = latestPricing.exchangeRateUsed || 1;
  const pct = parseArabicNumber(profitPercent);
  const fixed = parseArabicNumber(profitFixed);
  const fixedRMB = profitCurrency === 'USD' ? fixed * er : fixed;
  const finalRMB = baseRMB + (baseRMB * pct / 100) + fixedRMB;
  const finalUSD = er > 0 ? +(finalRMB / er).toFixed(3) : 0;
  const existingProforma = order.proforma;
  const firstImage = order.documents.find(d => d.type === 'attachment' && d.url.startsWith('blob:'));
  const canConfirm = pct > 0 || fixed > 0 || !!existingProforma;

  const handleSend = (format: 'pdf' | 'xlsx') => {
    if (pct <= 0 && fixed <= 0 && !existingProforma) {
      setProfitError('يجب إدخال نسبة ربح أو مبلغ ثابت قبل الإرسال.');
      return;
    }
    setProfitError('');
    onConfirmAndSend(format);
  };

  return (
    <div className="ow-proforma-modal" role="dialog" aria-modal="false" aria-label="إعداد عرض السعر للزبون">
      <div className="ow-proforma-header">
        <h3>📄 إعداد عرض السعر للزبون</h3>
        <button type="button" className="ow-proforma-close" onClick={onClose} aria-label="إغلاق">✕</button>
      </div>
        <div className="ow-proforma-body">
          {firstImage && (
            <div className="ow-proforma-image-wrap">
              <img src={firstImage.url} alt="صورة المنتج" className="ow-proforma-image" />
            </div>
          )}

          <div className="ow-proforma-info">
            <div className="ow-proforma-row"><span className="ow-proforma-label">{isProcurement ? 'رقم الطلب:' : 'الزبون:'}</span><span className="ow-proforma-value">{isProcurement ? `#${order.orderNumber}` : order.clientName}</span></div>
            <div className="ow-proforma-row"><span className="ow-proforma-label">رقم الطلب:</span><span className="ow-proforma-value">#{order.orderNumber}</span></div>
            <div className="ow-proforma-row"><span className="ow-proforma-label">الشيبينغ مارك:</span><span className="ow-proforma-value">{order.shippingMark}-{order.shippingMarkSerial}</span></div>
            <div className="ow-proforma-row"><span className="ow-proforma-label">المنتج:</span><span className="ow-proforma-value">{order.productName}</span></div>
            <div className="ow-proforma-row"><span className="ow-proforma-label">الكمية:</span><span className="ow-proforma-value">{order.optionalFields?.quantity || '—'}</span></div>
          </div>

          <div className="ow-proforma-cost">
            <span className="ow-proforma-cost-title">💰 التكلفة الأساسية</span>
            <div className="ow-proforma-cost-values">
              <span className="ow-proforma-cost-rmb">¥ {formatNumber(baseRMB)} RMB</span>
              <span className="ow-proforma-cost-usd">$ {formatNumber(baseUSD)} USD</span>
            </div>
          </div>

          <div className="ow-proforma-profit">
            <div className="ow-proforma-profit-title">📈 إضافة الربح</div>
            <div className="ow-proforma-profit-controls">
              <div className="ow-proforma-profit-group">
                <label className="ow-proforma-profit-label">نسبة ربح %</label>
                <input className="ow-proforma-profit-input" type="text" inputMode="decimal" value={profitPercent} onChange={(e) => onProfitPercentChange(e.target.value)} placeholder="0" min="0" />
              </div>
              <div className="ow-proforma-profit-sep">أو</div>
              <div className="ow-proforma-profit-group">
                <label className="ow-proforma-profit-label">مبلغ ثابت</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="ow-proforma-profit-input" type="text" inputMode="decimal" value={profitFixed} onChange={(e) => onProfitFixedChange(e.target.value)} placeholder="0" min="0" style={{ flex: 1 }} />
                  <select className="ow-pricing-currency-select-sm" value={profitCurrency} onChange={(e) => onProfitCurrencyChange(e.target.value as QuotationCurrency)}>
                    <option value="RMB">RMB (¥)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="ow-proforma-profit">
            <div className="ow-proforma-profit-title">🌐 عملة عرض السعر (اختيار واحد فقط)</div>
            <div className="ow-proforma-profit-controls">
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="radio" name="export-currency" value="USD"
                  checked={exportCurrency === 'USD'}
                  onChange={() => onExportCurrencyChange('USD')} />
                تصدير بالدولار فقط (USD)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="radio" name="export-currency" value="RMB"
                  checked={exportCurrency === 'RMB'}
                  onChange={() => onExportCurrencyChange('RMB')} />
                تصدير باليوان فقط (RMB)
              </label>
            </div>
          </div>

          <div className="ow-proforma-profit">
            <div className="ow-proforma-profit-title">🗂️ قالب عرض السعر</div>
            <div className="ow-proforma-profit-controls">
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="radio" name="quote-template" value="1"
                  checked={template === 1}
                  onChange={() => onTemplateChange(1)} />
                Template 1 — جدول قياسي
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="radio" name="quote-template" value="2"
                  checked={template === 2}
                  onChange={() => onTemplateChange(2)} />
                Template 2 — منتج لكل صفحة (عرض مميز)
              </label>
            </div>
          </div>

          <div className="ow-proforma-final">
            <span className="ow-proforma-final-label">السعر النهائي للزبون:</span>
            <div className="ow-proforma-final-values">
              {exportCurrency === 'RMB' ? (
                <span className="ow-proforma-final-rmb">¥ {formatNumber(finalRMB)} RMB</span>
              ) : (
                <span className="ow-proforma-final-usd">$ {formatNumber(finalUSD)} USD</span>
              )}
            </div>
          </div>

          {pct > 0 || fixed > 0 ? (
            <div className="ow-proforma-summary">
              <span>الربح: {pct > 0 ? `${formatNumber(pct)}%` : ''}{pct > 0 && fixed > 0 ? ' + ' : ''}{fixed > 0 ? `${formatNumber(fixed)} ${profitCurrency}` : ''} = {formatNumber(finalRMB - baseRMB)} RMB (${formatNumber((finalRMB - baseRMB) / er)} USD)</span>
            </div>
          ) : null}

          {existingProforma && (
            <div className="ow-proforma-summary" style={{ background: '#f1f5f9', color: '#334155' }}>
              ✅ آخر إعداد للعرض بتاريخ {existingProforma.submittedAt} — يمكنك تعديل الحقول أعلاه وإعادة التصدير في أي وقت.
            </div>
          )}
          {profitError && (
            <p className="ow-proforma-profit-error">{profitError}</p>
          )}
        </div>
        <div className="ow-proforma-footer">
          <button type="button" className="ow-proforma-submit" onClick={() => handleSend('pdf')} title="تأكيد وحفظ العرض ثم تصدير PDF">
            ✅ تأكيد وإرسال — PDF
          </button>
          <button type="button" className="ow-proforma-submit" onClick={() => handleSend('xlsx')} title="تأكيد وحفظ العرض ثم تصدير Excel">
            ✅ تأكيد وإرسال — Excel
          </button>
          {order.status === 'quotation_presented' && (
            <button
              type="button"
              className="ow-proforma-submit"
              onClick={onExportOfficialInvoice}
              title="تصدير فاتورة رسمية"
            >
              🧾 تصدير فاتورة رسمية
            </button>
          )}
          <button type="button" className="ow-proforma-cancel" onClick={onClose}>إغلاق</button>
        </div>
    </div>
  );
}
