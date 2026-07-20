import { usePersonaStore } from '../stores/personaStore';
import { canSeeNote } from '../utils/noteVisibility';
import { CEO_NAME } from '../utils/constants';
import type { Order } from '../types';

export type OrderTab = 'info' | 'timeline' | 'pricing' | 'negotiation' | 'notes';

export default function OrderDetailsTabs({
  order,
  onTabChange,
  onArchive,
  activeSection,
  canAccessPricing = true,
}: {
  order: Order;
  onTabChange: (tab: OrderTab) => void;
  onArchive: (orderId: string) => void;
  activeSection: string;
  canAccessPricing?: boolean;
}) {
  const currentUser = usePersonaStore((s) => s.activePersona);
  const isManager = currentUser.name === CEO_NAME;
  const visibleNotesCount = order.notes.filter((n) => canSeeNote(n, currentUser.name, currentUser.department)).length;
  const timelineCount = (order.workflowHistory?.length || 0)
    + (order.pricingHistory?.length || 0)
    + (order.proforma ? 1 : 0)
    + (order.negotiationHistory?.filter(n => n.fromDept !== 'system').length || 0)
    + (order.archivedAt ? 1 : 0);

  return (
    <div className="ow-sections">
      <button className={`ow-section-btn ${activeSection === 'info' ? 'active' : ''}`} onClick={() => onTabChange('info')}>المعلومات</button>
      <button className={`ow-section-btn ${activeSection === 'timeline' ? 'active' : ''}`} onClick={() => onTabChange('timeline')}>📖 القصة الكاملة ({timelineCount})</button>
      {canAccessPricing ? (
        <button className={`ow-section-btn ${activeSection === 'pricing' ? 'active' : ''}`} onClick={() => onTabChange('pricing')}>التسعير</button>
      ) : (
        <button className="ow-section-btn ow-section-locked" disabled title="متاح بعد استلام الطلب">🔒 التسعير</button>
      )}
      <button className={`ow-section-btn ${activeSection === 'negotiation' ? 'active' : ''}`} onClick={() => onTabChange('negotiation')}>التفاوض ({order.negotiationHistory.length})</button>
      <button className={`ow-section-btn ${activeSection === 'notes' ? 'active' : ''}`} onClick={() => onTabChange('notes')}>الملاحظات السرية ({visibleNotesCount})</button>
      {isManager && !order.archivedAt && (
        <button className="ow-delete-btn" onClick={() => onArchive(order.id)} title="أرشفة الطلب — لا حذف">🗄️ أرشفة الطلب</button>
      )}
    </div>
  );
}
