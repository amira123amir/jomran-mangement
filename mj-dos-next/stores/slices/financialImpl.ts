import type { Order, OrderPricing, ProformaInvoice, OfficialInvoice, CustomerDeposit, FactoryPayment, DepositConfirmation, OrderRevenue, Notification, Department, NegotiationEntry } from '../../types';
import type { FinancialSlice } from './financialSlice';
import { formatNow } from '../../utils/dateHelpers';
import { uid } from '../../utils/helpers';
import { isCEO } from '../../utils/workflowEngine';
import { PERSONAS } from '../../data/personas';
import { CEO_NAME } from '../../utils/constants';
import { timelineEntry, notifyRecipients, depositMethodLabel, factoryPaymentMethodLabel } from './helpers';

export function createFinancialSlice(set: any, get: any): FinancialSlice {
  return {
    submitPricing: (orderId, pricingData, actor) => {
      const { timestamp } = formatNow();
      const order = get().orders.find((o: any) => o.id === orderId);
      if (!order) return { ok: false, error: 'الطلب غير موجود' };

      const extraRMB = (pricingData.internalChinaShippingRMB || 0)
        + (pricingData.miscellaneousCostsRMB || 0)
        + (pricingData.otherCostsRMB || 0);
      const totalRMB = pricingData.factoryPriceRMB + pricingData.shippingCostRMB + extraRMB;
      const exchangeRate = pricingData.exchangeRateUsed;
      const totalUSD = exchangeRate > 0 ? +(totalRMB / exchangeRate).toFixed(3) : 0;

      const iteration = (order.pricingHistory?.length || 0) + 1;

      const pricing: OrderPricing = {
        ...pricingData,
        iteration,
        totalRMB,
        exchangeRateUsed: exchangeRate,
        totalUSD,
        submittedAt: timestamp,
        currency: pricingData.currency || 'RMB',
      };

      const result = get().transitionOrder(orderId, 'pricing_completed', {
        actor,
        mutate: (o: any) => ({ pricingHistory: [...(o.pricingHistory || []), pricing] }),
      });
      if (!result.ok) return result;

      if (order.salesPersona) {
        const notif: Notification = {
          id: uid('notif'),
          orderId,
          orderNumber: order.orderNumber,
          shippingMark: order.shippingMark,
          type: 'pricing',
          message: `💰 تسعير جديد #${iteration} للطلب #${order.orderNumber} (${order.shippingMark}) — الإجمالي: $${totalUSD} (${totalRMB} RMB) — ملاحظة: هذه إحصائية خط أنابيب فقط`,
          fromPersona: order.claim?.claimedBy || order.assignment?.assignedTo || '',
          forPersona: order.salesPersona,
          read: false,
          createdAt: timestamp,
        };
        set((s: any) => ({ notifications: [...s.notifications, notif] }));
      }
      return result;
    },

    submitProforma: (orderId, proformaData, actor) => {
      const { timestamp } = formatNow();
      const proforma: ProformaInvoice = { ...proformaData, submittedAt: timestamp };
      const order = get().orders.find((o: any) => o.id === orderId);
      if (!order) return { ok: false, error: 'الطلب غير موجود' };

      if (order.status === 'quotation_presented') {
        set((s: any) => ({
          orders: s.orders.map((o: any) => o.id === orderId ? { ...o, proforma, updatedAt: timestamp } : o),
        }));
        return { ok: true, order: { ...order, proforma, updatedAt: timestamp } };
      }

      return get().transitionOrder(orderId, 'quotation_presented', {
        actor,
        mutate: () => ({ proforma }),
      });
    },

    rejectPricing: (orderId, fromPersona, fromDept, reason) => {
      const { timestamp } = formatNow();
      const order = get().orders.find((o: any) => o.id === orderId);
      if (!order) return { ok: false, error: 'الطلب غير موجود' };

      const entry: NegotiationEntry = {
        id: uid('neg'),
        fromPersona,
        fromDept,
        message: `❌ رفض التسعير — السبب: ${reason}`,
        type: 'revision',
        createdAt: timestamp,
      };

      const result = get().transitionOrder(orderId, 'pricing_in_progress', {
        actor: { name: fromPersona, role: fromDept, dept: fromDept },
        reason,
        mutate: (o: any) => ({ negotiationHistory: [...o.negotiationHistory, entry] }),
      });
      if (!result.ok) return result;

      const procTarget = order.claim?.claimedBy || order.assignment?.assignedTo;
      if (procTarget) {
        const notif: Notification = {
          id: uid('notif'),
          orderId,
          orderNumber: order.orderNumber,
          shippingMark: order.shippingMark,
          type: 'pricing',
          message: `❌ تم رفض التسعير للطلب #${order.orderNumber} (${order.shippingMark}) من قبل ${fromPersona} — السبب: "${reason.slice(0, 80)}${reason.length > 80 ? '...' : ''}"`,
          fromPersona,
          forPersona: procTarget,
          read: false,
          createdAt: timestamp,
        };
        set((s: any) => ({ notifications: [...s.notifications, notif] }));
      }
      return result;
    },

    acceptPricing: (orderId, fromPersona) => {
      const { timestamp } = formatNow();
      const order = get().orders.find((o: any) => o.id === orderId);
      if (!order) return;

      const entry: NegotiationEntry = {
        id: uid('neg'),
        fromPersona,
        fromDept: 'sales',
        message: `✅ قبول التسعير — الانتقال إلى إعداد عرض السعر للعميل`,
        type: 'approval',
        createdAt: timestamp,
      };

      const result = get().transitionOrder(orderId, 'quotation_presented', {
        actor: { name: fromPersona, role: 'sales', dept: 'sales' as Department },
        mutate: (o: any) => ({ negotiationHistory: [...o.negotiationHistory, entry] }),
      });
      if (!result.ok) {
        set((s: any) => ({
          orders: s.orders.map((o: any) =>
            o.id === orderId
              ? { ...o, negotiationHistory: [...o.negotiationHistory, entry], updatedAt: timestamp }
              : o
          ),
        }));
      }

      const procTarget = order.claim?.claimedBy || order.assignment?.assignedTo;
      if (procTarget) {
        const notif: Notification = {
          id: uid('notif'),
          orderId,
          orderNumber: order.orderNumber,
          shippingMark: order.shippingMark,
          type: 'pricing',
          message: `✅ تم قبول التسعير للطلب #${order.orderNumber} (${order.shippingMark}) من قبل ${fromPersona} — سيتم إعداد عرض السعر للعميل`,
          fromPersona,
          forPersona: procTarget,
          read: false,
          createdAt: timestamp,
        };
        set((s: any) => ({ notifications: [...s.notifications, notif] }));
      }
    },

    generateOfficialQuotation: (orderId, invoice, actor) => {
      const { timestamp } = formatNow();
      const order = get().orders.find((o: any) => o.id === orderId);
      if (!order) return { ok: false, error: 'الطلب غير موجود' };
      const invoiceNumber = invoice.invoiceNumber;
      const officialInvoice: OfficialInvoice = {
        ...invoice,
        exportedBy: actor.name,
        exportedAt: timestamp,
      };
      const tlEntry = timelineEntry(
        order,
        'system',
        `🧾 [${timestamp}] إصدار الفاتورة الرسمية ${invoiceNumber} للطلب #${order.orderNumber} — تنسيق: ${invoice.exportedFormat.toUpperCase()} — العملة: ${invoice.exportCurrency}${invoice.notes ? ` — ملاحظات: ${invoice.notes.slice(0, 80)}` : ''}`,
      );
      const result = get().transitionOrder(orderId, 'official_quotation_generated', {
        actor,
        mutate: (o: any) => ({
          officialInvoice,
          negotiationHistory: [...o.negotiationHistory, tlEntry],
        }),
      });
      if (!result.ok) return result;
      notifyRecipients(
        set,
        order,
        ['نور', 'دنيا', 'عائشة', CEO_NAME],
        actor.name,
        'status',
        `🧾 صدرت الفاتورة الرسمية ${invoiceNumber} للطلب #${order.orderNumber} (${order.shippingMark}) — العملة: ${invoice.exportCurrency} — التنسيق: ${invoice.exportedFormat.toUpperCase()}`,
      );
      return result;
    },

    recordDepositPaid: (orderId, deposit, actor) => {
      const { timestamp } = formatNow();
      const order = get().orders.find((o: any) => o.id === orderId);
      if (!order) return { ok: false, error: 'الطلب غير موجود' };
      if (deposit.paymentMethod === 'other' && !deposit.customPaymentMethod?.trim()) {
        return { ok: false, error: 'يرجى تحديد طريقة الدفع عند اختيار «غير ذلك».' };
      }
      if (!Number.isFinite(deposit.amount) || deposit.amount <= 0) {
        return { ok: false, error: 'مبلغ العربون غير صالح.' };
      }
      const customerDeposit: CustomerDeposit = {
        ...deposit,
        recordedBy: actor.name,
        recordedAt: timestamp,
      };
      const methodLabel = depositMethodLabel(deposit.paymentMethod, deposit.customPaymentMethod);
      const tlEntry = timelineEntry(
        order,
        'system',
        `💵 [${timestamp}] سجّل ${actor.name} استلام العربون: ${deposit.amount} ${deposit.currency} — طريقة الدفع: ${methodLabel}${customerDeposit.attachment ? ' — يحتوي إثبات دفع' : ''}`,
      );
      const result = get().transitionOrder(orderId, 'deposit_paid', {
        actor,
        mutate: (o: any) => ({
          customerDeposit,
          negotiationHistory: [...o.negotiationHistory, tlEntry],
        }),
      });
      if (!result.ok) return result;
      notifyRecipients(
        set,
        order,
        ['نور', 'دنيا', 'عائشة', 'لميس - مديرة المبيعات', CEO_NAME],
        actor.name,
        'deposit',
        `💵 عربون جديد بانتظار التأكيد للطلب #${order.orderNumber} (${order.shippingMark}) — سجّله ${actor.name} — المبلغ: ${deposit.amount} ${deposit.currency} — الطريقة: ${methodLabel}${customerDeposit.attachment ? ' — يحتوي إثبات دفع' : ''}`,
      );
      return result;
    },

    confirmDeposit: (orderId, confirmation, actor) => {
      const { timestamp } = formatNow();
      const order = get().orders.find((o: any) => o.id === orderId);
      if (!order) return { ok: false, error: 'الطلب غير موجود' };

      const revenue: OrderRevenue = {
        depositAmount: confirmation.amount,
        depositCurrency: confirmation.currency,
        confirmedByNoor: true,
        confirmedAt: timestamp,
        actualRevenueUSD: confirmation.currency === 'USD' ? confirmation.amount : 0,
      };
      const mergedDeposit: CustomerDeposit | undefined = order.customerDeposit
        ? { ...order.customerDeposit, confirmedBy: actor.name, confirmedAt: timestamp, note: confirmation.note, attachment: confirmation.attachment || order.customerDeposit.attachment }
        : undefined;

      const result = get().transitionOrder(orderId, 'deposit_confirmed', {
        actor,
        mutate: () => ({ revenue, ...(mergedDeposit ? { customerDeposit: mergedDeposit } : {}) }),
      });
      if (!result.ok) return result;

      const procTarget = order.claim?.claimedBy || order.assignment?.assignedTo;
      const recipients = ['كنانة', CEO_NAME, 'لميس - مديرة المبيعات', order.salesPersona];
      if (procTarget) recipients.push(procTarget);
      notifyRecipients(
        set,
        order,
        recipients,
        confirmation.confirmedBy,
        'deposit',
        `✅ أكّدت الحسابات (${actor.name}) العربون للطلب #${order.orderNumber} (${order.shippingMark}) — المبلغ: ${confirmation.amount} ${confirmation.currency}`,
      );
      const procurementManager = PERSONAS.find(
        (p) => p.department === 'procurement' && p.role === 'مديرة المشتريات',
      );
      const firstReceiver = order.claim?.claimedBy;
      const procurementRecipients: (string | undefined)[] = [
        procurementManager?.name,
        firstReceiver,
      ];
      notifyRecipients(
        set,
        order,
        procurementRecipients,
        confirmation.confirmedBy,
        'deposit',
        `📣 أمر دفع عربون للمعمل — الطلب #${order.orderNumber} — العميل: ${order.clientName} — المبلغ: ${confirmation.amount} ${confirmation.currency}`,
      );
      return result;
    },

    returnDeposit: (orderId, actor, reason) => {
      const { timestamp } = formatNow();
      const order = get().orders.find((o: any) => o.id === orderId);
      if (!order) return { ok: false, error: 'الطلب غير موجود' };
      const tlEntry = timelineEntry(
        order,
        'system',
        `↩ [${timestamp}] أعادت الحسابات العربون للتصحيح — السبب: ${reason}`,
      );
      const result = get().transitionOrder(orderId, 'official_quotation_generated', {
        actor,
        reason,
        mutate: (o: any) => ({ negotiationHistory: [...o.negotiationHistory, tlEntry] }),
      });
      if (!result.ok) return result;
      if (order.salesPersona) {
        notifyRecipients(
          set,
          order,
          [order.salesPersona, 'لميس - مديرة المبيعات', CEO_NAME],
          actor.name,
          'deposit',
          `↩ الحسابات أعادت عربون الطلب #${order.orderNumber} للتصحيح — السبب: ${reason.slice(0, 80)}`,
        );
      }
      return result;
    },

    sendPaymentOrder: (orderId, actor, note) => {
      const { timestamp } = formatNow();
      const order = get().orders.find((o: any) => o.id === orderId);
      if (!order) return { ok: false, error: 'الطلب غير موجود' };
      const tlEntry = timelineEntry(order, 'system', `➡️ [${timestamp}] توجيه أمر الدفع إلى المشتريات لتحويل ثمن المصنع${note ? ` — ${note}` : ''}`);
      const result = get().transitionOrder(orderId, 'payment_order_sent', {
        actor,
        reason: note,
        mutate: (o: any) => ({ negotiationHistory: [...o.negotiationHistory, tlEntry] }),
      });
      if (!result.ok) return result;
      const procTarget = order.claim?.claimedBy || order.assignment?.assignedTo;
      const recipients = ['كنانة'];
      if (procTarget && procTarget !== 'كنانة') recipients.push(procTarget);
      notifyRecipients(
        set,
        order,
        recipients,
        actor.name,
        'status',
        `➡️ أمر دفع جديد بحاجة إلى تنفيذ للطلب #${order.orderNumber} (${order.shippingMark})${note ? ` — ${note.slice(0, 80)}` : ''}`,
      );
      return result;
    },

    recordFactoryPayment: (orderId, payment, actor) => {
      const { timestamp } = formatNow();
      const order = get().orders.find((o: any) => o.id === orderId);
      if (!order) return { ok: false, error: 'الطلب غير موجود' };
      if (order.status !== 'payment_order_sent') {
        return { ok: false, error: 'لا يمكن تسجيل دفع المعمل قبل استلام أمر الدفع.' };
      }
      if (actor.dept !== 'procurement' && !isCEO(actor.name)) {
        return { ok: false, error: 'تسجيل دفع المعمل متاح للمشتريات فقط.' };
      }
      if (!Number.isFinite(payment.amount) || payment.amount <= 0) {
        return { ok: false, error: 'مبلغ الدفع غير صالح.' };
      }
      const factoryPayment: FactoryPayment = {
        ...payment,
        recordedBy: actor.name,
        recordedAt: timestamp,
      };
      const methodLabel = factoryPaymentMethodLabel(payment.paymentMethod);
      const tlEntry = timelineEntry(
        order,
        'system',
        `🏭 [${timestamp}] سجّلت المشتريات (${actor.name}) دفع المعمل — المبلغ: ${payment.amount} ${payment.currency} — الطريقة: ${methodLabel}${factoryPayment.attachment ? ' — يحتوي إثبات' : ''} — بانتظار تأكيد الحسابات.`,
      );
      set((s: any) => ({
        orders: s.orders.map((o: any) =>
          o.id === orderId
            ? {
                ...o,
                factoryPayment,
                negotiationHistory: [...o.negotiationHistory, tlEntry],
                updatedAt: timestamp,
              }
            : o,
        ),
      }));
      notifyRecipients(
        set,
        order,
        ['نور', 'دنيا', 'عائشة', CEO_NAME],
        actor.name,
        'deposit',
        `🏭 دفع معمل جديد بانتظار التأكيد للطلب #${order.orderNumber} (${order.shippingMark}) — سجّله ${actor.name} — ${payment.amount} ${payment.currency} — الطريقة: ${methodLabel}${factoryPayment.attachment ? ' — يحتوي إثبات' : ''}`,
      );
      return { ok: true };
    },

    confirmFactoryPayment: (orderId, actor, note) => {
      const { timestamp } = formatNow();
      const order = get().orders.find((o: any) => o.id === orderId);
      if (!order) return { ok: false, error: 'الطلب غير موجود' };
      if (order.factoryPayment && order.factoryPayment.recordedBy === actor.name) {
        return { ok: false, error: 'لا يمكن للمشتريات تأكيد دفع المعمل الذي سجّلته بنفسها. التأكيد من صلاحية الحسابات.' };
      }
      if (!order.factoryPayment) {
        return { ok: false, error: 'لا يمكن التأكيد قبل تسجيل دفع المعمل.' };
      }
      const mergedPayment: FactoryPayment = {
        ...order.factoryPayment,
        confirmedBy: actor.name,
        confirmedAt: timestamp,
      };
      const tlEntry = timelineEntry(
        order,
        'system',
        `✅ [${timestamp}] أكّدت الحسابات (${actor.name}) دفع المعمل — يمكن للمشتريات بدء الإنتاج${note ? ` — ${note}` : ''}`,
      );
      const result = get().transitionOrder(orderId, 'factory_payment_confirmed', {
        actor,
        reason: note,
        mutate: (o: any) => ({
          factoryPayment: mergedPayment,
          negotiationHistory: [...o.negotiationHistory, tlEntry],
        }),
      });
      if (!result.ok) return result;
      const procTarget = order.claim?.claimedBy || order.assignment?.assignedTo;
      const recipients = ['كنانة', CEO_NAME, 'نور', 'عائشة'];
      if (procTarget && !recipients.includes(procTarget)) recipients.push(procTarget);
      notifyRecipients(
        set,
        order,
        recipients,
        actor.name,
        'deposit',
        `✅ الحسابات أكّدت دفع المعمل للطلب #${order.orderNumber} (${order.shippingMark}) — يمكن بدء الإنتاج`,
      );
      return result;
    },

    markProductionStarted: (orderId, actor, note) => {
      const { timestamp } = formatNow();
      const order = get().orders.find((o: any) => o.id === orderId);
      if (!order) return { ok: false, error: 'الطلب غير موجود' };
      const tlEntry = timelineEntry(order, 'system', `🏗️ [${timestamp}] بدء الإنتاج${note ? ` — ${note}` : ''}`);
      const result = get().transitionOrder(orderId, 'production_started', {
        actor,
        reason: note,
        mutate: (o: any) => ({ negotiationHistory: [...o.negotiationHistory, tlEntry] }),
      });
      if (!result.ok) return result;
      const recipients = [
        order.salesPersona,
        'لميس - مديرة المبيعات',
        'كنانة',
        'نور',
        'عائشة',
        CEO_NAME,
      ];
      notifyRecipients(
        set,
        order,
        recipients,
        actor.name,
        'status',
        `🏗️ بدأ الإنتاج للطلب #${order.orderNumber} (${order.shippingMark})`,
      );
      return result;
    },

    markReadyForShipping: (orderId, actor, note) => {
      const { timestamp } = formatNow();
      const order = get().orders.find((o: any) => o.id === orderId);
      if (!order) return { ok: false, error: 'الطلب غير موجود' };
      const tlEntry = timelineEntry(order, 'system', `📦 [${timestamp}] البضاعة جاهزة للشحن${note ? ` — ${note}` : ''}`);
      return get().transitionOrder(orderId, 'ready_for_shipping', {
        actor,
        reason: note,
        mutate: (o: any) => ({ negotiationHistory: [...o.negotiationHistory, tlEntry] }),
      });
    },

    markShipped: (orderId, actor, note) => {
      const { timestamp } = formatNow();
      const order = get().orders.find((o: any) => o.id === orderId);
      if (!order) return { ok: false, error: 'الطلب غير موجود' };
      const tlEntry = timelineEntry(order, 'system', `🚢 [${timestamp}] تم الشحن${note ? ` — ${note}` : ''}`);
      return get().transitionOrder(orderId, 'shipped', {
        actor,
        reason: note,
        mutate: (o: any) => ({ negotiationHistory: [...o.negotiationHistory, tlEntry] }),
      });
    },

    markArrived: (orderId, actor, note) => {
      const { timestamp } = formatNow();
      const order = get().orders.find((o: any) => o.id === orderId);
      if (!order) return { ok: false, error: 'الطلب غير موجود' };
      const tlEntry = timelineEntry(order, 'system', `🛬 [${timestamp}] وصلت الشحنة${note ? ` — ${note}` : ''}`);
      return get().transitionOrder(orderId, 'arrived', {
        actor,
        reason: note,
        mutate: (o: any) => ({ negotiationHistory: [...o.negotiationHistory, tlEntry] }),
      });
    },

    markDelivered: (orderId, actor, note) => {
      const { timestamp } = formatNow();
      const order = get().orders.find((o: any) => o.id === orderId);
      if (!order) return { ok: false, error: 'الطلب غير موجود' };
      const tlEntry = timelineEntry(order, 'system', `🎉 [${timestamp}] تم تسليم الطلب للعميل${note ? ` — ${note}` : ''}`);
      return get().transitionOrder(orderId, 'delivered', {
        actor,
        reason: note,
        mutate: (o: any) => ({ negotiationHistory: [...o.negotiationHistory, tlEntry] }),
      });
    },
  };
}
