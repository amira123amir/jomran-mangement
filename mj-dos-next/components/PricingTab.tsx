import type { Order } from '../types';
import { canViewSupplierData } from '../utils/supplierMask';
import { formatNumber } from '../utils/formatNumber';

// Read-only view of every saved pricing version. Every field from the
// OrderPricing type in src/types/index.ts is surfaced verbatim; optional
// fields fall back to 0 (rendered via formatNumber) so the layout stays
// stable regardless of what the procurement employee entered. Historical
// entries are never recomputed — they display exactly what was saved.
const PricingTab = ({ order, currentUser }: { order: Order; currentUser: { role: string; name: string; department: string } }) => {
  const offers = order.pricingHistory || [];
  const showSupplier = canViewSupplierData(currentUser);

  return (
    <div className="pricing-tab">
      <h3>قائمة الأسعار المسجلة ({offers.length})</h3>
      {offers.length > 0 ? (
        offers.map((offer) => {
          const internalChina = offer.internalChinaShippingRMB ?? 0;
          const misc = offer.miscellaneousCostsRMB ?? 0;
          const other = offer.otherCostsRMB ?? 0;
          const currency = offer.currency ?? 'RMB';
          const exchangeRate = offer.exchangeRateUsed;
          return (
            <div key={`${offer.iteration}-${offer.submittedAt}`} className="pricing-card">
              <h4>نسخة #{offer.iteration}</h4>
              <div className="price-details">
                {showSupplier && (
                  <p><strong>المعمل:</strong> {order.supplierData?.factoryName || 'غير محدد'}</p>
                )}
                <p><strong>السعر الأساسي (المعمل):</strong> {formatNumber(offer.factoryPriceRMB)} RMB</p>
                <p><strong>شحن داخلي (الصين):</strong> {formatNumber(internalChina)} RMB</p>
                <p><strong>شحن خارجي (دولي):</strong> {formatNumber(offer.shippingCostRMB)} RMB</p>
                <p><strong>مصاريف:</strong> {formatNumber(misc)} RMB</p>
                <p><strong>مصاريف أخرى:</strong> {formatNumber(other)} RMB</p>
                <p><strong>العملة المدخلة:</strong> {currency}</p>
                <p><strong>سعر الصرف المستخدم:</strong> {exchangeRate > 0 ? `${formatNumber(exchangeRate)} (USD → RMB)` : '—'}</p>
                <div className="pricing-total-divider" />
                <p className="pricing-total-line"><strong>الإجمالي بالعملة المحلية RMB</strong></p>
                <p className="pricing-total-value">{formatNumber(offer.totalRMB)} RMB</p>
                <p className="pricing-total-line"><strong>الإجمالي بالدولار USD</strong></p>
                <p className="pricing-total-value">$ {formatNumber(offer.totalUSD)} USD</p>
                <p><strong>بواسطة:</strong> {offer.submittedBy}</p>
                <p><strong>تاريخ التسجيل:</strong> {offer.submittedAt || '—'}</p>
              </div>
            </div>
          );
        })
      ) : (
        <p className="ow-empty">لا توجد بيانات تسعير مسجلة</p>
      )}
    </div>
  );
};

export default PricingTab;
