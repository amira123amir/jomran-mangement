import type { Order, Persona, QuotationCurrency } from '../../types';
import PricingTab from '../PricingTab';
import { useExchangeRateStore } from '../../stores/exchangeRateStore';
import { formatNumber } from '../../utils/formatNumber';
import { parseArabicNumber } from '../../utils/arabicNumerals';

interface PricingPanelProps {
  order: Order;
  persona: Persona;
  canAccessPricing: boolean;
  latestPricing: Order['pricingHistory'][number] | null;
  showPriceForm: boolean;
  factoryPrice: string;
  shippingCost: string;
  internalChinaShipping: string;
  miscCosts: string;
  otherCosts: string;
  supplierName: string;
  supplierPhone: string;
  procurementNotes: string;
  exchangeRateInput: string;
  itemCurrencies: Record<string, 'RMB' | 'USD'>;
  totalRmb: number;
  totalUsd: number;
  onShowPriceForm: (show: boolean) => void;
  onFactoryPriceChange: (val: string) => void;
  onShippingCostChange: (val: string) => void;
  onInternalChinaShippingChange: (val: string) => void;
  onMiscCostChange: (val: string) => void;
  onOtherCostChange: (val: string) => void;
  onSupplierNameChange: (val: string) => void;
  onSupplierPhoneChange: (val: string) => void;
  onProcurementNotesChange: (val: string) => void;
  onExchangeRateChange: (val: string) => void;
  onItemCurrencyChange: (key: string, val: 'RMB' | 'USD') => void;
  onSubmitPricing: () => void;
  onRejectPricing: () => void;
  onShowProforma: () => void;
}

export default function PricingPanel({
  order,
  persona,
  canAccessPricing,
  latestPricing,
  showPriceForm,
  factoryPrice,
  shippingCost,
  internalChinaShipping,
  miscCosts,
  otherCosts,
  supplierName,
  supplierPhone,
  procurementNotes,
  exchangeRateInput,
  itemCurrencies,
  totalRmb,
  totalUsd,
  onShowPriceForm,
  onFactoryPriceChange,
  onShippingCostChange,
  onInternalChinaShippingChange,
  onMiscCostChange,
  onOtherCostChange,
  onSupplierNameChange,
  onSupplierPhoneChange,
  onProcurementNotesChange,
  onExchangeRateChange,
  onItemCurrencyChange,
  onSubmitPricing,
  onRejectPricing,
  onShowProforma,
}: PricingPanelProps) {
  const rates = useExchangeRateStore((s) => s.rates);
  const isProcurement = persona.department === 'procurement';
  const isSales = persona.department === 'sales';

  return (
    <>
      {!canAccessPricing && (
        <div className="ow-notes-empty" style={{ padding: 32, textAlign: 'center' }}>
          🔒 التسعير متاح فقط بعد استلام الطلب من قبل موظف المشتريات المسؤول.
        </div>
      )}
      {canAccessPricing && (
        <>
          {isProcurement && !showPriceForm && (
            <button className="add-price-btn" onClick={() => onShowPriceForm(true)}>💰 تسعير</button>
          )}
          {isSales && (order.status === 'pricing_completed' || order.status === 'quotation_presented') && latestPricing && (
            <div className="ow-pricing-approval-bar">
              <div className="ow-pricing-approval-summary">
                <span className="ow-pricing-approval-label">📋 التسعير الحالي:</span>
                <span className="ow-pricing-approval-value">${formatNumber(latestPricing.totalUSD)} ({formatNumber(latestPricing.totalRMB)} RMB)</span>
              </div>
              <div className="ow-pricing-approval-actions">
                <button className="ow-pricing-reject-btn" onClick={onRejectPricing}><strong>❌ رفض التسعير — إعادة إلى المشتريات</strong></button>
                <button className="ow-quotation-btn" onClick={onShowProforma}>
                  <strong>{order.proforma ? '📄 إعادة فتح عرض السعر' : '📄 إعداد عرض السعر للعميل'}</strong>
                </button>
              </div>
            </div>
          )}
          {showPriceForm && (
            <div className="ow-pricing-form" style={{ marginTop: 16 }}>
              <div className="ow-pricing-form-title">💰 إدخال تسعيرة جديدة</div>
              <div className="ow-pricing-form-row">
                <div className="ow-pricing-form-group" style={{ maxWidth: 250 }}>
                  <label className="ow-pricing-form-label">سعر الصرف (USD → RMB)</label>
                  <input className={`ow-pricing-form-input ow-exrate-field ${isProcurement ? 'ow-exrate-readonly' : ''}`} type="text" inputMode="decimal" value={exchangeRateInput || rates.rmb || '6.7'} onChange={(e) => { if (!isProcurement) onExchangeRateChange(e.target.value); }} placeholder={rates.rmb || '6.7'} readOnly={isProcurement} />
                </div>
              </div>
              <div className="ow-pricing-form-row">
                <div className="ow-pricing-form-group">
                  <label className="ow-pricing-form-label">السعر الأساسي</label>
                  <div className="ow-pricing-currency-group">
                    <input className="ow-pricing-form-input ow-pricing-amount-input" type="text" inputMode="decimal" value={factoryPrice} onChange={(e) => onFactoryPriceChange(e.target.value)} placeholder="0" min="0" />
                    <select className="ow-pricing-currency-select-sm" value={itemCurrencies.factoryPrice} onChange={(e) => onItemCurrencyChange('factoryPrice', e.target.value as 'RMB' | 'USD')}>
                      <option value="RMB">¥</option><option value="USD">$</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="ow-pricing-form-row">
                <div className="ow-pricing-form-group">
                  <label className="ow-pricing-form-label">شحن داخلي (الصين)</label>
                  <div className="ow-pricing-currency-group">
                    <input className="ow-pricing-form-input ow-pricing-amount-input" type="text" inputMode="decimal" value={internalChinaShipping} onChange={(e) => onInternalChinaShippingChange(e.target.value)} placeholder="0" min="0" />
                    <select className="ow-pricing-currency-select-sm" value={itemCurrencies.internalChinaShipping} onChange={(e) => onItemCurrencyChange('internalChinaShipping', e.target.value as 'RMB' | 'USD')}>
                      <option value="RMB">¥</option><option value="USD">$</option>
                    </select>
                  </div>
                </div>
                <div className="ow-pricing-form-group">
                  <label className="ow-pricing-form-label">شحن خارجي</label>
                  <div className="ow-pricing-currency-group">
                    <input className="ow-pricing-form-input ow-pricing-amount-input" type="text" inputMode="decimal" value={shippingCost} onChange={(e) => onShippingCostChange(e.target.value)} placeholder="0" min="0" />
                    <select className="ow-pricing-currency-select-sm" value={itemCurrencies.shippingCost} onChange={(e) => onItemCurrencyChange('shippingCost', e.target.value as 'RMB' | 'USD')}>
                      <option value="RMB">¥</option><option value="USD">$</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="ow-pricing-form-row">
                <div className="ow-pricing-form-group">
                  <label className="ow-pricing-form-label">مصاريف</label>
                  <div className="ow-pricing-currency-group">
                    <input className="ow-pricing-form-input ow-pricing-amount-input" type="text" inputMode="decimal" value={miscCosts} onChange={(e) => onMiscCostChange(e.target.value)} placeholder="0" min="0" />
                    <select className="ow-pricing-currency-select-sm" value={itemCurrencies.miscCosts} onChange={(e) => onItemCurrencyChange('miscCosts', e.target.value as 'RMB' | 'USD')}>
                      <option value="RMB">¥</option><option value="USD">$</option>
                    </select>
                  </div>
                </div>
                <div className="ow-pricing-form-group">
                  <label className="ow-pricing-form-label">مصاريف أخرى</label>
                  <div className="ow-pricing-currency-group">
                    <input className="ow-pricing-form-input ow-pricing-amount-input" type="text" inputMode="decimal" value={otherCosts} onChange={(e) => onOtherCostChange(e.target.value)} placeholder="0" min="0" />
                    <select className="ow-pricing-currency-select-sm" value={itemCurrencies.otherCosts} onChange={(e) => onItemCurrencyChange('otherCosts', e.target.value as 'RMB' | 'USD')}>
                      <option value="RMB">¥</option><option value="USD">$</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="ow-pricing-form-row">
                <div className="ow-pricing-form-group">
                  <label className="ow-pricing-form-label">اسم المعمل</label>
                  <input className="ow-pricing-form-input" type="text" value={supplierName} onChange={(e) => onSupplierNameChange(e.target.value)} placeholder="اسم المعمل" />
                </div>
                <div className="ow-pricing-form-group">
                  <label className="ow-pricing-form-label">رقم هاتف المعمل</label>
                  <input className="ow-pricing-form-input" type="text" value={supplierPhone} onChange={(e) => onSupplierPhoneChange(e.target.value)} placeholder="رقم الهاتف" />
                </div>
              </div>
              <div className="ow-pricing-form-row">
                <div className="ow-pricing-form-group">
                  <label className="ow-pricing-form-label">ملاحظات المشتريات</label>
                  <textarea className="ow-pricing-form-textarea" value={procurementNotes} onChange={(e) => onProcurementNotesChange(e.target.value)} placeholder="أي ملاحظات إضافية..." rows={3} />
                </div>
              </div>
              <div className="ow-pricing-form-total">
                <span className="ow-pricing-form-total-label">الإجمالي النهائي:</span>
                <span className="ow-pricing-form-total-value">¥ {formatNumber(totalRmb)} RMB</span>
                <span className="ow-pricing-form-total-sep">|</span>
                <span className="ow-pricing-form-total-value">$ {formatNumber(totalUsd)} USD</span>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                <button className="ow-pricing-form-save" onClick={onSubmitPricing} disabled={!factoryPrice || parseArabicNumber(factoryPrice) <= 0}>💾 حفظ التسعير</button>
                <button className="ow-pricing-cancel-btn" onClick={() => {
                  onShowPriceForm(false);
                  onFactoryPriceChange('');
                  onShippingCostChange('');
                  onInternalChinaShippingChange('');
                  onMiscCostChange('');
                  onOtherCostChange('');
                  onSupplierNameChange('');
                  onSupplierPhoneChange('');
                  onProcurementNotesChange('');
                }}>إلغاء</button>
              </div>
            </div>
          )}
          <PricingTab order={order} currentUser={persona} />
        </>
      )}
    </>
  );
}
