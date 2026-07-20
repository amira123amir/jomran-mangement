import type { Order, OrderStatus } from '../types';
import { STATUS_LABELS } from './orderStatus';
import { formatNumber } from './formatNumber';

// Unified chronological view of everything that has happened to an order:
// workflow transitions, negotiation messages, pricing versions, proforma
// events, and archive/unarchive. Reads only — never mutates the order.

export type TimelineKind =
  | 'workflow'
  | 'negotiation'
  | 'pricing'
  | 'proforma'
  | 'archive';

export interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  timestamp: string;      // sortable "YYYY-MM-DD HH:MM:SS"
  date: string;
  time: string;
  actorName: string;
  actorRole?: string;
  actorDept?: string;
  title: string;          // short heading (Arabic)
  detail?: string;        // free-form supporting text
  reason?: string;        // optional business reason
  icon: string;
  tone: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

function splitTimestamp(ts: string): { date: string; time: string } {
  const [date, time] = (ts || '').split(' ');
  return { date: date || '', time: time || '' };
}

function statusPair(from: OrderStatus | null, to: OrderStatus): string {
  const fromLabel = from ? STATUS_LABELS[from] : 'إنشاء الطلب';
  const toLabel = STATUS_LABELS[to];
  return `${fromLabel} → ${toLabel}`;
}

export function buildOrderTimeline(order: Order): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // 1. Workflow transitions (state machine)
  for (const t of order.workflowHistory || []) {
    let tone: TimelineEvent['tone'] = 'info';
    let icon = '➡️';
    if (t.direction === 'initial') { tone = 'success'; icon = '🆕'; }
    else if (t.direction === 'backward') { tone = 'warning'; icon = '↩️'; }
    else if (t.to === 'delivered') { tone = 'success'; icon = '🎉'; }

    events.push({
      id: `wf:${t.id}`,
      kind: 'workflow',
      timestamp: t.timestamp,
      date: t.date,
      time: t.time,
      actorName: t.actorName,
      actorRole: t.actorRole,
      actorDept: t.actorDept,
      title: t.direction === 'initial' ? 'تم إنشاء الطلب' : statusPair(t.from, t.to),
      detail: t.direction === 'initial' ? undefined : `انتقال حالة (${t.direction === 'forward' ? 'إلى الأمام' : 'إلى الخلف'})`,
      reason: t.reason,
      icon,
      tone,
    });
  }

  // 2. Negotiation messages / queries / revisions / approvals
  for (const n of order.negotiationHistory || []) {
    // Skip system-generated echoes that duplicate workflow entries — those
    // already show up above with richer metadata.
    if (n.fromDept === 'system') continue;

    const iconByType: Record<string, string> = {
      query: '❓',
      response: '💬',
      revision: '✏️',
      approval: '✅',
    };
    const toneByType: Record<string, TimelineEvent['tone']> = {
      query: 'info',
      response: 'default',
      revision: 'warning',
      approval: 'success',
    };
    const { date, time } = splitTimestamp(n.createdAt);
    events.push({
      id: `neg:${n.id}`,
      kind: 'negotiation',
      timestamp: n.createdAt,
      date,
      time,
      actorName: n.fromPersona,
      actorDept: n.fromDept,
      title:
        n.type === 'query' ? 'استعلام'
        : n.type === 'response' ? 'رد'
        : n.type === 'revision' ? 'تعديل / رفض'
        : 'موافقة',
      detail: n.message,
      icon: iconByType[n.type] || '💬',
      tone: toneByType[n.type] || 'default',
    });
  }

  // 3. Pricing versions
  for (const p of order.pricingHistory || []) {
    const { date, time } = splitTimestamp(p.submittedAt);
    events.push({
      id: `pr:${p.iteration}-${p.submittedAt}`,
      kind: 'pricing',
      timestamp: p.submittedAt,
      date,
      time,
      actorName: p.submittedBy,
      actorDept: 'procurement',
      title: `تسعير — نسخة #${p.iteration}`,
      detail: `الإجمالي: ¥ ${formatNumber(p.totalRMB)} RMB · $ ${formatNumber(p.totalUSD)} USD · سعر الصرف: ${formatNumber(p.exchangeRateUsed)}`,
      icon: '💰',
      tone: 'info',
    });
  }

  // 4. Proforma / customer quotation event
  if (order.proforma) {
    const p = order.proforma;
    const { date, time } = splitTimestamp(p.submittedAt);
    events.push({
      id: `pf:${p.submittedAt}`,
      kind: 'proforma',
      timestamp: p.submittedAt,
      date,
      time,
      actorName: p.submittedBy,
      actorDept: 'sales',
      title: 'إعداد عرض السعر للعميل',
      detail: `الإجمالي النهائي (${p.lines.length} منتج): ¥ ${formatNumber(p.grandTotalRMB)} RMB · $ ${formatNumber(p.grandTotalUSD)} USD · القالب: ${p.template} · العملة المُصدَّرة: ${p.exportCurrency}`,
      icon: '📄',
      tone: 'info',
    });
  }

  // 5. Archive event
  if (order.archivedAt) {
    const { date, time } = splitTimestamp(order.archivedAt);
    events.push({
      id: `arc:${order.archivedAt}`,
      kind: 'archive',
      timestamp: order.archivedAt,
      date,
      time,
      actorName: order.archivedBy || 'system',
      title: 'أُرشِف الطلب',
      reason: order.archiveReason,
      icon: '🗄️',
      tone: 'warning',
    });
  }

  // Chronological ascending. Ties broken by workflow > pricing > proforma > negotiation
  // so a status change that shares the same second as its side-effect appears first.
  const kindOrder: Record<TimelineKind, number> = {
    workflow: 0,
    pricing: 1,
    proforma: 2,
    negotiation: 3,
    archive: 4,
  };
  events.sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp.localeCompare(b.timestamp);
    return kindOrder[a.kind] - kindOrder[b.kind];
  });
  return events;
}
