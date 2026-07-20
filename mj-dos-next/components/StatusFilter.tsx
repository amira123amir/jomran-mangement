import type { Order, OrderStatus } from '../types';
import { STATUS_LABELS, WORKFLOW_STATUSES } from '../utils/orderStatus';
import type { StatusFilterValue } from '../utils/statusFilter';

// Presentation-layer filter for order lists. Values ("all" | OrderStatus) drive
// list rendering only — never mutate order.status, never touch the master store.
// Labels come from the canonical STATUS_LABELS map in src/utils/orderStatus.ts
// so there is exactly one source of truth for status names. The stateless
// filtering helper lives in src/utils/statusFilter.ts.

interface StatusFilterProps {
  value: StatusFilterValue;
  onChange: (value: StatusFilterValue) => void;
  // Authorized orders the current user is allowed to see, BEFORE the status
  // filter is applied. Used to compute the per-status counts.
  authorizedOrders: Order[];
  className?: string;
  label?: string;
}

export default function StatusFilter({
  value,
  onChange,
  authorizedOrders,
  className,
  label = 'حالة الطلب',
}: StatusFilterProps) {
  const total = authorizedOrders.length;
  const countFor = (s: OrderStatus) => authorizedOrders.filter((o) => o.status === s).length;

  return (
    <label className={`status-filter ${className || ''}`}>
      <span className="status-filter-label">{label}:</span>
      <select
        className="status-filter-select"
        value={value}
        onChange={(e) => onChange(e.target.value as StatusFilterValue)}
      >
        <option value="all">كل الطلبات ({total})</option>
        {WORKFLOW_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]} ({countFor(s)})
          </option>
        ))}
      </select>
    </label>
  );
}
