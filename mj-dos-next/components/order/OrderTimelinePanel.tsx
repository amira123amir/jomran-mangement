import type { Order } from '../../types';
import { buildOrderTimeline } from '../../utils/orderTimeline';

interface OrderTimelinePanelProps {
  order: Order;
}

export default function OrderTimelinePanel({ order }: OrderTimelinePanelProps) {
  const events = buildOrderTimeline(order);
  return (
    <div className="ow-timeline-panel">
      <div className="ow-timeline-header">
        <span className="ow-timeline-header-title">📖 القصة الكاملة للطلب #{order.orderNumber}</span>
        <span className="ow-timeline-header-hint">
          كل حدث مسجَّل بشكل دائم — لا يمكن تعديل أو حذف السجل.
        </span>
      </div>
      {events.length === 0 ? (
        <div className="ow-notes-empty">لا توجد أحداث بعد</div>
      ) : (
        <ol className="ow-timeline-list">
          {events.map((e) => (
            <li key={e.id} className={`ow-timeline-item tone-${e.tone} kind-${e.kind}`}>
              <div className="ow-timeline-dot" aria-hidden="true">{e.icon}</div>
              <div className="ow-timeline-content">
                <div className="ow-timeline-title-row">
                  <span className="ow-timeline-title">{e.title}</span>
                  <span className="ow-timeline-time">📅 {e.date} · ⏱ {e.time}</span>
                </div>
                <div className="ow-timeline-actor">
                  👤 {e.actorName}
                  {e.actorRole ? <span className="ow-timeline-role"> — {e.actorRole}</span> : null}
                  {e.actorDept && !e.actorRole ? <span className="ow-timeline-role"> — {e.actorDept}</span> : null}
                </div>
                {e.detail && <div className="ow-timeline-detail">{e.detail}</div>}
                {e.reason && <div className="ow-timeline-reason">📝 السبب: {e.reason}</div>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
