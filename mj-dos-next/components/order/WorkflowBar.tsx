import type { Order, Persona } from '../../types';
import { getNextAction, type WorkflowActionKey } from '../../utils/workflowEngine';
import { STATUS_LABELS, statusLabel } from '../../utils/orderStatus';

interface WorkflowBarProps {
  order: Order;
  persona: Persona;
  isProcurement: boolean;
  onWorkflowAction: (action: WorkflowActionKey) => void;
  onOpenFactoryPayment: () => void;
}

export default function WorkflowBar({
  order,
  persona,
  isProcurement,
  onWorkflowAction,
  onOpenFactoryPayment,
}: WorkflowBarProps) {
  const nextAction = getNextAction(order, persona.name, persona.department as import('../../types').Department);
  const forward = nextAction.forward;
  const lastTransition = order.workflowHistory && order.workflowHistory.length > 0
    ? order.workflowHistory[order.workflowHistory.length - 1]
    : null;
  const inlineOwnedActions: WorkflowActionKey[] = ['claim', 'submitPricing', 'presentQuotation'];
  const isProcurementManager = isProcurement && persona.role === 'مديرة المشتريات';
  const useFactoryConfirmLabel = isProcurementManager
    && order.status === 'deposit_confirmed'
    && forward?.action === 'sendPaymentOrder';

  return (
    <div className="ow-workflow-bar">
      <div className="ow-workflow-status">
        <span className="ow-workflow-status-label">الحالة الحالية:</span>
        <span className="ow-workflow-status-value">{statusLabel(order.status)}</span>
        {lastTransition && (
          <span className="ow-workflow-last-change">
            آخر تغيير: {lastTransition.actorName} — {lastTransition.date} {lastTransition.time}
          </span>
        )}
      </div>
      <div className="ow-workflow-actions">
        {!forward && (
          <span className="ow-workflow-terminal">🏁 وصل الطلب إلى نهاية سير العمل — لا توجد خطوة تالية.</span>
        )}
        {forward && !nextAction.forwardAuthorized && (
          <span className="ow-workflow-locked">
            ⏳ الخطوة التالية <strong>{STATUS_LABELS[forward.to]}</strong> — تنفَّذ من قبل: {forward.allowedDepartments.map(d => ({sales:'المبيعات',procurement:'المشتريات',accounting:'الحسابات',executive:'الإدارة العليا'}[d])).join(' / ')}
          </span>
        )}
        {forward && nextAction.forwardAuthorized && (
          (() => {
            if (inlineOwnedActions.includes(forward.action)) {
              return (
                <span className="ow-workflow-hint">
                  الخطوة التالية <strong>{STATUS_LABELS[forward.to]}</strong> — استخدم زر «{forward.labelAr}» في القسم المخصص.
                </span>
              );
            }
            const disabled = !nextAction.forwardEnabled;
            return (
              <button
                className="ow-workflow-next-btn"
                onClick={() => onWorkflowAction(forward.action)}
                disabled={disabled}
                title={disabled ? nextAction.forwardDisabledReason : `${forward.labelEn}`}
              >
                {useFactoryConfirmLabel
                  ? `✅ تأكيد دفع العربون للمعمل ⟶ ${STATUS_LABELS[forward.to]}`
                  : `${forward.labelAr} ⟶ ${STATUS_LABELS[forward.to]}`}
              </button>
            );
          })()
        )}
        {order.status === 'payment_order_sent' && isProcurement && (order.claim?.claimedBy === persona.name || order.assignment?.assignedTo === persona.name || persona.name === 'كنانة') && (
          <button
            className="ow-workflow-next-btn"
            style={{ background: '#0f766e' }}
            onClick={onOpenFactoryPayment}
          >
            🏭 {order.factoryPayment ? 'تعديل دفع المعمل' : 'تسجيل دفع المعمل'}
          </button>
        )}
        {nextAction.backward.map((b) => (
          <span key={b.action + b.to} className="ow-workflow-backward-hint">
            ↩ يمكنك أيضاً «{b.labelAr}» عبر الأدوات المخصصة في تبويب التسعير.
          </span>
        ))}
      </div>
    </div>
  );
}
