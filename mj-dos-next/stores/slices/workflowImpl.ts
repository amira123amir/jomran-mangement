import type { Order, Department, NegotiationEntry, Notification, WorkflowTransition } from '../../types';
import type { WorkflowSlice } from './workflowSlice';
import { formatNow, buildDeadlineAt } from '../../utils/dateHelpers';
import { uid } from '../../utils/helpers';
import { findTransition, isCEO } from '../../utils/workflowEngine';
import { timelineEntry } from './helpers';
import { CEO_NAME } from '../../utils/constants';

export function createWorkflowSlice(set: any, get: any): WorkflowSlice {
  return {
    transitionOrder: (orderId, targetStatus, opts) => {
      const order = get().orders.find((o: any) => o.id === orderId);
      if (!order) return { ok: false, error: 'الطلب غير موجود' };
      if (order.status === targetStatus) return { ok: true, order };

      const spec = findTransition(order.status, targetStatus);
      if (!spec) {
        return {
          ok: false,
          error: `انتقال غير مسموح: ${order.status} → ${targetStatus}. لا يمكن تخطي مراحل سير العمل.`,
        };
      }

      const dept = opts.actor.dept;
      const authorized = isCEO(opts.actor.name) || spec.allowedDepartments.includes(dept as 'sales' | 'procurement' | 'accounting' | 'executive');
      if (!authorized) {
        return {
          ok: false,
          error: `القسم "${dept}" غير مخوّل لتنفيذ هذا الانتقال.`,
        };
      }

      if (spec.requiresReason && !opts.reason?.trim()) {
        return { ok: false, error: 'هذا الانتقال يتطلب سبباً/ملاحظة.' };
      }

      if (spec.isEnabled && !spec.isEnabled(order)) {
        return { ok: false, error: spec.disabledReason || 'الشروط اللازمة لهذا الانتقال غير مستوفاة.' };
      }

      const { date, time, timestamp } = formatNow();
      const transition: WorkflowTransition = {
        id: uid('wf'),
        from: order.status,
        to: targetStatus,
        actorName: opts.actor.name,
        actorRole: opts.actor.role,
        actorDept: opts.actor.dept,
        direction: spec.direction,
        date,
        time,
        timestamp,
        reason: opts.reason?.trim() || undefined,
      };

      let updated: Order | undefined;
      set((s: any) => ({
        orders: s.orders.map((o: any) => {
          if (o.id !== orderId) return o;
          const extras = opts.mutate ? opts.mutate(o) : {};
          if ('status' in extras) delete (extras as Partial<Order>).status;
          updated = {
            ...o,
            ...extras,
            status: targetStatus,
            workflowHistory: [...(o.workflowHistory || []), transition],
            updatedAt: timestamp,
          };
          return updated;
        }),
      }));

      return { ok: true, order: updated };
    },

    claimOrder: (orderId, personaName, personaRole) => {
      const { timestamp } = formatNow();
      const deadlineAt = buildDeadlineAt();

      const order = get().orders.find((o: any) => o.id === orderId);
      if (!order) return;

      const tlEntry = timelineEntry(order, 'system', `🟢 [${timestamp}] استلام الطلب #${order.orderNumber} من قبل ${personaName} — بداية عداد التسعير (6 ساعات)`);

      const result = get().transitionOrder(orderId, 'pricing_in_progress', {
        actor: { name: personaName, role: personaRole, dept: 'procurement' },
        mutate: (o: any) => ({
          claim: { claimedBy: personaName, claimedByRole: personaRole, claimedAt: timestamp, deadlineAt },
          negotiationHistory: [...o.negotiationHistory, tlEntry],
        }),
      });
      if (!result.ok) return;

      if (order.salesPersona) {
        const notif: Notification = {
          id: uid('notif'),
          orderId,
          orderNumber: order.orderNumber,
          shippingMark: order.shippingMark,
          type: 'status',
          message: `تم استلام الطلب #${order.orderNumber} (${order.shippingMark}) من قبل ${personaName}`,
          fromPersona: personaName,
          forPersona: order.salesPersona,
          read: false,
          createdAt: timestamp,
        };
        set((s: any) => ({ notifications: [...s.notifications, notif] }));
      }
    },

    assignOrder: (orderId, assignTo, assignBy) => {
      const { timestamp } = formatNow();
      const order = get().orders.find((o: any) => o.id === orderId);
      if (!order) return;

      const claim = { claimedBy: assignTo, claimedByRole: 'موظفة مشتريات', claimedAt: timestamp, deadlineAt: '' };
      const tlEntry = timelineEntry(order, 'system', `📋 [${timestamp}] تعيين الطلب #${order.orderNumber} إلى ${assignTo} بواسطة ${assignBy} — بانتظار قبول المهمة`);

      const result = get().transitionOrder(orderId, 'pricing_in_progress', {
        actor: { name: assignBy, role: 'مديرة المشتريات', dept: 'procurement' },
        mutate: (o: any) => ({
          claim,
          assignment: { assignedTo: assignTo, assignedBy: assignBy, assignedAt: timestamp, accepted: false },
          negotiationHistory: [...o.negotiationHistory, tlEntry],
        }),
      });
      if (!result.ok) return;

      const notif: Notification = {
        id: uid('notif'),
        orderId,
        orderNumber: order.orderNumber,
        shippingMark: order.shippingMark,
        type: 'assignment',
        message: `تم تكليفك بالطلب #${order.orderNumber} (${order.shippingMark}) من قبل ${assignBy} — يرجى قبول المهمة`,
        fromPersona: assignBy,
        forPersona: assignTo,
        read: false,
        createdAt: timestamp,
      };
      set((s: any) => ({ notifications: [...s.notifications, notif] }));
    },

    acceptAssignment: (orderId, personaName) => {
      const { timestamp } = formatNow();
      const deadlineAt = buildDeadlineAt();

      const order = get().orders.find((o: any) => o.id === orderId);
      if (!order) return;
      const tlEntry = timelineEntry(order, 'system', `✅ [${timestamp}] قبول المهمة من ${personaName} — بداية عداد التسعير (6 ساعات)`);

      set((s: any) => ({
        orders: s.orders.map((o: any) => {
          if (o.id !== orderId || o.assignment?.assignedTo !== personaName) return o;
          return {
            ...o,
            assignment: { ...o.assignment, accepted: true },
            claim: o.claim ? { ...o.claim, deadlineAt } : o.claim,
            negotiationHistory: [...o.negotiationHistory, tlEntry],
            updatedAt: timestamp,
          };
        }),
      }));
    },

    requestInfo: (orderId, fromPersona, fromDept, message, _infoType) => {
      const { timestamp } = formatNow();
      const order = get().orders.find((o: any) => o.id === orderId);
      if (!order) return;

      const entry: NegotiationEntry = {
        id: uid('neg'),
        fromPersona,
        fromDept,
        message,
        type: 'query',
        createdAt: timestamp,
      };

      set((s: any) => ({
        orders: s.orders.map((o: any) =>
          o.id === orderId
            ? { ...o, negotiationHistory: [...o.negotiationHistory, entry], updatedAt: timestamp }
            : o
        ),
      }));

      if (order.salesPersona) {
        const notif: Notification = {
          id: uid('notif'),
          orderId,
          orderNumber: order.orderNumber,
          shippingMark: order.shippingMark,
          type: 'query',
          message: `استعلام من ${fromPersona} حول الطلب #${order.orderNumber}: "${message.slice(0, 60)}${message.length > 60 ? '...' : ''}"`,
          fromPersona,
          forPersona: order.salesPersona,
          read: false,
          createdAt: timestamp,
        };
        set((s: any) => ({ notifications: [...s.notifications, notif] }));
      }
    },

    submitRevision: (orderId, fromPersona, fromDept, message) => {
      const order = get().orders.find((o: any) => o.id === orderId);
      if (!order) return;

      const entry: NegotiationEntry = {
        id: uid('neg'),
        fromPersona,
        fromDept,
        message,
        type: 'revision',
        createdAt: formatNow().timestamp,
      };

      get().transitionOrder(orderId, 'pricing_in_progress', {
        actor: { name: fromPersona, role: fromDept, dept: fromDept as Department },
        reason: message,
        mutate: (o: any) => ({ negotiationHistory: [...o.negotiationHistory, entry] }),
      });
    },

    requestShippingMarkChange: (orderId, requestedBy, currentMark, proposedMark) => {
      const { timestamp } = formatNow();
      const ticket: any = {
        id: uid('ticket'),
        requestedBy,
        currentMark,
        proposedMark,
        status: 'pending',
        approvedBy: [],
        createdAt: timestamp,
      };
      set((s: any) => ({
        orders: s.orders.map((o: any) =>
          o.id === orderId
            ? { ...o, lockTicket: ticket, updatedAt: timestamp }
            : o
        ),
      }));
    },

    approveShippingMarkTicket: (orderId, approverName) => {
      const { timestamp } = formatNow();
      set((s: any) => ({
        orders: s.orders.map((o: any) => {
          if (o.id !== orderId || !o.lockTicket) return o;
          const ticket = o.lockTicket;
          const alreadyApproved = ticket.approvedBy.includes(approverName);
          if (alreadyApproved) return o;

          const newApprovedBy = [...ticket.approvedBy, approverName];
          const bothApproved = newApprovedBy.includes('نور') && newApprovedBy.includes(CEO_NAME);

          if (bothApproved) {
            return {
              ...o,
              shippingMark: ticket.proposedMark,
              lockTicket: { ...ticket, approvedBy: newApprovedBy, status: 'approved' as const, resolvedAt: timestamp },
              updatedAt: timestamp,
            };
          }

          return {
            ...o,
            lockTicket: { ...ticket, approvedBy: newApprovedBy },
            updatedAt: timestamp,
          };
        }),
      }));
    },
  };
}
