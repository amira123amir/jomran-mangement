import type { Order, OrderPricing } from '../../types';
import { formatNumber } from '../../utils/formatNumber';
import { latestPricingForProduct } from '../../utils/orderProducts';

interface OrderInfoPanelProps {
  order: Order;
  isSales: boolean;
  isProcurement: boolean;
  showSupplier: boolean;
  latestPricing: OrderPricing | null;
}

export default function OrderInfoPanel({ order, isSales, isProcurement, showSupplier, latestPricing }: OrderInfoPanelProps) {
  return (
    <div className="ow-info-panel">
      <div className="ow-details-grid">
        <div className="ow-details-row">
          <span className="ow-details-label">عدد المنتجات:</span>
          <span className="ow-details-value">{order.products.length}</span>
        </div>
        <div className="ow-details-row">
          <span className="ow-details-label">منشئ الطلب:</span>
          <span className="ow-details-value">{order.salesPersona || '—'}</span>
        </div>
      </div>

      {/* بطاقة لكل منتج في الطلب */}
      {order.products.map((p, idx) => {
        const lp = latestPricingForProduct(order, p.id);
        const extraFields = Object.entries(p.optionalFields || {}).filter(([k, v]) => k !== 'quantity' && v);
        return (
          <div key={p.id} className="ow-details-subsection">
            <div className="ow-details-subtitle">📦 المنتج {idx + 1}: {p.productName}</div>
            <div className="ow-details-grid">
              <div className="ow-details-row">
                <span className="ow-details-label">الكمية:</span>
                <span className="ow-details-value">{p.quantity || '—'}</span>
              </div>
              <div className="ow-details-row">
                <span className="ow-details-label">القسم:</span>
                <span className="ow-details-value">{p.categoryLabel || '—'}</span>
              </div>
              {p.factoryUrl && (
                <div className="ow-details-row">
                  <span className="ow-details-label">رابط المنتج:</span>
                  <span className="ow-details-value">
                    <a href={p.factoryUrl} target="_blank" rel="noopener noreferrer" dir="ltr" style={{ color: 'var(--accent-blue)', textDecoration: 'underline', fontSize: 13 }}>{p.factoryUrl}</a>
                  </span>
                </div>
              )}
              {p.targetPrice !== undefined && (
                <div className="ow-details-row">
                  <span className="ow-details-label">السعر المستهدف:</span>
                  <span className="ow-details-value">${formatNumber(p.targetPrice)}</span>
                </div>
              )}
              <div className="ow-details-row">
                <span className="ow-details-label">التسعير:</span>
                <span className="ow-details-value">{lp ? `${formatNumber(lp.totalRMB)} RMB ($${formatNumber(lp.totalUSD)})` : 'بانتظار التسعير'}</span>
              </div>
              {extraFields.map(([key, val]) => (
                <div key={key} className="ow-details-row">
                  <span className="ow-details-label">{key}:</span>
                  <span className="ow-details-value">{val || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {isSales && order.claim && (
        <div className="ow-details-subsection">
          <div className="ow-details-subtitle">🛒 المشتريات</div>
          <div className="ow-details-grid">
            <div className="ow-details-row">
              <span className="ow-details-label">المستلم:</span>
              <span className="ow-details-value">{order.claim.claimedBy}</span>
            </div>
            {latestPricing && (
              <div className="ow-details-row">
                <span className="ow-details-label">المسعّر:</span>
                <span className="ow-details-value">{latestPricing.submittedBy}</span>
              </div>
            )}
          </div>
        </div>
      )}
      {isProcurement && (
        <div className="ow-details-subsection">
          <div className="ow-details-subtitle">👤 المبيعات</div>
          <div className="ow-details-grid">
            <div className="ow-details-row">
              <span className="ow-details-label">منشئ الطلب:</span>
              <span className="ow-details-value">{order.salesPersona}</span>
            </div>
          </div>
        </div>
      )}

      {order.documents.length > 0 && (
        <div className="ow-details-subsection">
          <div className="ow-details-subtitle">المرفقات ({order.documents.length})</div>
          <div className="ow-docs-list">
            {order.documents.map((doc) => (
              <div key={doc.id} className="ow-doc-item">
                {doc.type === 'attachment' && doc.url.startsWith('blob:') ? (
                  <img src={doc.url} alt={doc.name} className="ow-doc-img" />
                ) : (
                  <>
                    <span className="ow-doc-icon">{doc.type === 'invoice' ? '🧾' : doc.type === 'proof' ? '📸' : '📄'}</span>
                    <span className="ow-doc-name">{doc.name}</span>
                    <a className="ow-doc-link" href={doc.url} target="_blank" rel="noopener noreferrer">🔗 فتح</a>
                  </>
                )}
                <span className="ow-doc-by">{doc.uploadedBy}</span>
                <span className="ow-doc-time">{doc.uploadedAt}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {order.supplierData && showSupplier && (
        <div className="ow-details-subsection">
          <div className="ow-details-subtitle">المصنع</div>
          <div className="ow-details-grid">
            <div className="ow-details-row">
              <span className="ow-details-label">الاسم:</span>
              <span className="ow-details-value">{order.supplierData.factoryName || '—'}</span>
            </div>
            <div className="ow-details-row">
              <span className="ow-details-label">الهاتف:</span>
              <span className="ow-details-value">{order.supplierData.factoryPhone || '—'}</span>
            </div>
            {order.supplierData.factoryAddress && (
              <div className="ow-details-row">
                <span className="ow-details-label">العنوان:</span>
                <span className="ow-details-value">{order.supplierData.factoryAddress}</span>
              </div>
            )}
            {order.supplierData.contactPerson && (
              <div className="ow-details-row">
                <span className="ow-details-label">جهة الاتصال:</span>
                <span className="ow-details-value">{order.supplierData.contactPerson}</span>
              </div>
            )}
            {order.supplierData.supplierNumber && (
              <div className="ow-details-row">
                <span className="ow-details-label">رقم المورد:</span>
                <span className="ow-details-value">{order.supplierData.supplierNumber}</span>
              </div>
            )}
            {order.supplierData.procurementNotes && (
              <div className="ow-details-row">
                <span className="ow-details-label">ملاحظات المشتريات:</span>
                <span className="ow-details-value">{order.supplierData.procurementNotes}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
