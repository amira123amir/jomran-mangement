import { usePersonaStore } from '../stores/personaStore';
import type { Order } from '../types';

export default function OrderDetailsTabs({
  order,
  onTabChange,
  onDelete,
  activeSection,
}: {
  order: Order;
  onTabChange: (tab: 'info' | 'pricing' | 'negotiation' | 'notes') => void;
  onDelete: (orderId: string) => void;
  activeSection: string;
}) {
  const currentUser = usePersonaStore((s) => s.activePersona);
  const isManager = currentUser.name === 'محمد جمران';

  return (
    <div className="ow-sections">
      <button className={`ow-section-btn ${activeSection === 'info' ? 'active' : ''}`} onClick={() => onTabChange('info')}>المعلومات</button>
      <button className={`ow-section-btn ${activeSection === 'pricing' ? 'active' : ''}`} onClick={() => onTabChange('pricing')}>التسعير</button>
      <button className={`ow-section-btn ${activeSection === 'negotiation' ? 'active' : ''}`} onClick={() => onTabChange('negotiation')}>التفاوض ({order.negotiationHistory.length})</button>
      <button className={`ow-section-btn ${activeSection === 'notes' ? 'active' : ''}`} onClick={() => onTabChange('notes')}>الملاحظات السرية ({order.notes.length})</button>
      {isManager && (
        <button className="ow-delete-btn" onClick={() => onDelete(order.id)}>🗑️ حذف الطلب</button>
      )}
    </div>
  );
}
