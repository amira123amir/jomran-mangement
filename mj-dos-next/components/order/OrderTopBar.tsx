import type { Order } from '../../types';
import { statusLabel } from '../../utils/orderStatus';
import { pad2 } from '../../utils/dateHelpers';

interface OrderTopBarProps {
  order: Order;
  isProcurement: boolean;
  isEditable: boolean;
  ageH: number;
  ageM: number;
  ageS: number;
  onEditMark: () => void;
}

export default function OrderTopBar({ order, isProcurement, isEditable, ageH, ageM, ageS, onEditMark }: OrderTopBarProps) {
  return (
    <div className="ow-top-bar">
      <div className="ow-top-item">
        <span className="ow-top-label">{isProcurement ? 'رقم الطلب' : 'العميل'}</span>
        <span className="ow-top-value">{isProcurement ? `#${order.orderNumber}` : order.clientName}</span>
      </div>
      <div className="ow-top-divider" />
      <div className="ow-top-item">
        <span className="ow-top-label">الشيبينغ مارك</span>
        <span className="ow-top-value ow-top-mark">
          {order.shippingMark}-{order.shippingMarkSerial}
          {isEditable ? (
            <button className="ow-mark-edit-btn-sm" onClick={onEditMark} title="تعديل">✏️</button>
          ) : (
            <span className="ow-mark-locked-icon" title="مؤمنة">🔒</span>
          )}
        </span>
      </div>
      {!isProcurement && <><div className="ow-top-divider" />
      <div className="ow-top-item">
        <span className="ow-top-label">رقم الطلب</span>
        <span className="ow-top-value ow-top-num">#{order.orderNumber}</span>
      </div></>}
      <div className="ow-top-divider" />
      <div className="ow-top-item">
        <span className="ow-top-label">الحالة</span>
        <span className={`ow-status-badge status-${order.status}`}>{statusLabel(order.status)}</span>
      </div>
      <div className="ow-top-divider" />
      <div className="ow-top-item">
        <span className="ow-top-label">عمر الطلب</span>
        <span className="ow-top-value ow-top-age">⏱ {pad2(ageH)}:{pad2(ageM)}:{pad2(ageS)}</span>
      </div>
      <div className="ow-top-divider" />
      <div className="ow-top-item">
        <span className="ow-top-label">تاريخ الإنشاء</span>
        <span className="ow-top-value ow-top-date">{order.createdAt}</span>
      </div>
    </div>
  );
}
