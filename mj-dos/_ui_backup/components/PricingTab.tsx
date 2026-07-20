import type { Order } from '../types';

const PricingTab = ({ order }: { order: Order; currentUser: { role: string; name: string; department: string } }) => {
  const offers = order.pricingHistory || [];

  return (
    <div className="pricing-tab" style={{padding: '20px'}}>
      <h3>قائمة الأسعار المسجلة</h3>
      {offers.length > 0 ? (
        offers.map((offer, index) => (
          <div key={index} className="pricing-card" style={{border: '1px solid #ddd', marginTop: '10px', padding: '15px', borderRadius: '8px'}}>
            <h4>سعر {index + 1}</h4>
            <div className="price-details" style={{display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '14px'}}>
              <p><strong>المعمل:</strong> {order.supplierData?.factoryName || 'غير محدد'}</p>
              <p><strong>السعر الأساسي:</strong> {offer.factoryPriceRMB.toLocaleString()} RMB</p>
              <p><strong>الشحن:</strong> {offer.shippingCostRMB.toLocaleString()} RMB</p>
              <p><strong>الإجمالي:</strong> {offer.totalRMB.toLocaleString()} RMB</p>
              <p><strong>بواسطة:</strong> {offer.submittedBy}</p>
            </div>
          </div>
        ))
      ) : (
        <p>لا توجد بيانات تسعير مسجلة</p>
      )}
    </div>
  );
};

export default PricingTab;