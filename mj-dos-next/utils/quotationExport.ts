import type { Order, ProformaInvoice, QuotationCurrency, QuotationTemplate } from '../types';
import { downloadXlsx } from './xlsxWriter';
import { formatNumber } from './formatNumber';
import { escapeHtml } from './helpers';
import { categorySummary } from './orderProducts';

export interface QuotationLineItem {
  productName: string;
  specification?: string;
  quantity: number | string;
  unitPrice: number;
  total: number;
}

export interface QuotationPayload {
  order: Order;
  proforma: ProformaInvoice;
  currency: QuotationCurrency;
  template: QuotationTemplate;
  issuedBy: string;
  companyName: string;
  companyTagline: string;
  // Populated when this payload is an OFFICIAL invoice (Task 1/2). When
  // present, the exporter renders the invoice number in the header and the
  // notes below the totals.
  invoiceNumber?: string;
  invoiceNotes?: string;
}

const CURRENCY_LABEL: Record<QuotationCurrency, string> = {
  USD: 'USD ($)',
  RMB: 'RMB (¥)',
};

const CURRENCY_SYMBOL: Record<QuotationCurrency, string> = {
  USD: '$',
  RMB: '¥',
};

function fmt(value: number): string {
  if (!Number.isFinite(value)) return '0';
  // For invoice export: show integer with thousands separators
  return formatNumber(Math.round(value), 0);
}

function priceInCurrency(payload: QuotationPayload): number {
  return payload.currency === 'USD' ? payload.proforma.grandTotalUSD : payload.proforma.grandTotalRMB;
}

// One quotation line per product, matched to its proforma line by productId.
function buildLineItems(payload: QuotationPayload): QuotationLineItem[] {
  const { order, proforma, currency } = payload;
  return order.products.map((product) => {
    const line = proforma.lines.find((l) => l.productId === product.id);
    const lineTotal = line
      ? (currency === 'USD' ? line.finalPriceUSD : line.finalPriceRMB)
      : 0;
    const qtyNum = Number(product.quantity) || 1;
    const unitPrice = qtyNum > 0 ? lineTotal / qtyNum : lineTotal;
    const specParts = Object.entries(product.optionalFields || {})
      .filter(([k, v]) => k !== 'quantity' && v && String(v).trim())
      .map(([k, v]) => `${k}: ${v}`);
    return {
      productName: product.productName,
      specification: specParts.join(' | ') || product.categoryLabel || '',
      quantity: product.quantity,
      unitPrice,
      total: lineTotal,
    };
  });
}

function styleBlock(): string {
  return `
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', 'Helvetica Neue', Tahoma, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 32px;
      direction: rtl;
    }
    .q-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 18px;
      border-bottom: 3px solid #1e3a8a;
      margin-bottom: 22px;
    }
    .q-brand-name { font-size: 26px; font-weight: 800; color: #1e3a8a; letter-spacing: 0.5px; }
    .q-brand-tag { font-size: 12px; color: #64748b; margin-top: 4px; }
    .q-doc-meta { text-align: left; font-size: 12px; color: #334155; line-height: 1.7; }
    .q-doc-meta strong { color: #0f172a; }
    .q-doc-title { font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 4px; }
    .q-section { margin-bottom: 20px; }
    .q-section-title {
      font-size: 13px;
      font-weight: 700;
      color: #1e3a8a;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding-bottom: 6px;
      border-bottom: 1px solid #cbd5e1;
      margin-bottom: 10px;
    }
    .q-customer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 13px; }
    .q-customer-grid div { display: flex; gap: 6px; }
    .q-customer-grid strong { color: #475569; min-width: 100px; }
    table.q-items {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    table.q-items thead th {
      background: #1e3a8a;
      color: #ffffff;
      padding: 10px 8px;
      text-align: right;
      font-weight: 600;
    }
    table.q-items tbody td {
      padding: 10px 8px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    table.q-items tbody tr:nth-child(even) td { background: #f8fafc; }
    .q-numeric { text-align: left; direction: ltr; font-variant-numeric: tabular-nums; }
    .q-totals { margin-top: 14px; display: flex; justify-content: flex-end; }
    .q-totals-box {
      min-width: 320px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 14px 18px;
      background: #f8fafc;
    }
    .q-totals-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 13px;
      color: #334155;
    }
    .q-totals-row.grand {
      border-top: 2px solid #1e3a8a;
      margin-top: 8px;
      padding-top: 10px;
      font-size: 16px;
      font-weight: 700;
      color: #1e3a8a;
    }
    .q-footer {
      margin-top: 36px;
      padding-top: 14px;
      border-top: 1px solid #cbd5e1;
      font-size: 11px;
      color: #64748b;
      text-align: center;
      line-height: 1.7;
    }
    .q-page {
      page-break-after: always;
    }
    .q-page:last-child { page-break-after: auto; }
    .q-product-hero {
      padding: 30px;
      border: 2px solid #1e3a8a;
      border-radius: 10px;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      margin-bottom: 20px;
    }
    .q-product-hero-name {
      font-size: 26px;
      font-weight: 800;
      color: #1e3a8a;
      margin-bottom: 8px;
    }
    .q-product-hero-spec {
      font-size: 14px;
      color: #475569;
      line-height: 1.7;
    }
    .q-product-hero-price {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 2px dashed #cbd5e1;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .q-product-hero-price-label { font-size: 14px; color: #475569; }
    .q-product-hero-price-value {
      font-size: 26px;
      font-weight: 800;
      color: #1e3a8a;
      direction: ltr;
    }
    @media print {
      body { padding: 20px; }
      .no-print { display: none !important; }
    }
    .print-toolbar {
      position: fixed;
      top: 12px;
      left: 12px;
      display: flex;
      gap: 8px;
      z-index: 999;
    }
    .print-toolbar button {
      padding: 8px 14px;
      font-size: 13px;
      background: #1e3a8a;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
    }
  `;
}

function renderHeaderHtml(payload: QuotationPayload): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isOfficial = !!payload.invoiceNumber;
  return `
    <div class="q-header">
      <div>
        <div class="q-brand-name">${payload.companyName}</div>
        <div class="q-brand-tag">${payload.companyTagline}</div>
      </div>
      <div class="q-doc-meta">
        <div class="q-doc-title">${isOfficial ? 'فاتورة رسمية / Official Invoice' : 'عرض سعر / Quotation'}</div>
        ${isOfficial ? `<div><strong>رقم الفاتورة:</strong> ${escapeHtml(payload.invoiceNumber!)}</div>` : ''}
        <div><strong>رقم الطلب:</strong> #${payload.order.orderNumber}</div>
        <div><strong>الشيبينغ مارك:</strong> ${payload.order.shippingMark}-${payload.order.shippingMarkSerial}</div>
        <div><strong>التاريخ:</strong> ${dateStr}</div>
        <div><strong>العملة:</strong> ${CURRENCY_LABEL[payload.currency]}</div>
        <div><strong>أعدّ بواسطة:</strong> ${payload.issuedBy}</div>
      </div>
    </div>
    <div class="q-section">
      <div class="q-section-title">بيانات العميل</div>
      <div class="q-customer-grid">
        <div><strong>الاسم:</strong> ${escapeHtml(payload.order.clientName)}</div>
        <div><strong>القسم:</strong> ${escapeHtml(categorySummary(payload.order) || '—')}</div>
      </div>
    </div>
  `;
}

function renderInvoiceNotesHtml(payload: QuotationPayload): string {
  if (!payload.invoiceNotes || !payload.invoiceNotes.trim()) return '';
  return `
    <div class="q-section">
      <div class="q-section-title">ملاحظات الفاتورة / Invoice Notes</div>
      <div style="font-size:13px; line-height:1.7; color:#334155; white-space:pre-wrap;">${escapeHtml(payload.invoiceNotes.trim())}</div>
    </div>
  `;
}

function renderItemsTableHtml(items: QuotationLineItem[], currency: QuotationCurrency): string {
  const sym = CURRENCY_SYMBOL[currency];
  const rows = items.map((it) => `
    <tr>
      <td>${escapeHtml(it.productName)}${it.specification ? `<div style="font-size:11px;color:#64748b;margin-top:4px;">${escapeHtml(it.specification)}</div>` : ''}</td>
      <td class="q-numeric">${escapeHtml(String(it.quantity))}</td>
      <td class="q-numeric">${sym} ${fmt(it.unitPrice)}</td>
      <td class="q-numeric">${sym} ${fmt(it.total)}</td>
    </tr>
  `).join('');
  return `
    <div class="q-section">
      <div class="q-section-title">تفاصيل المنتجات</div>
      <table class="q-items">
        <thead>
          <tr>
            <th>المنتج / Product</th>
            <th style="text-align:left;">الكمية / Qty</th>
            <th style="text-align:left;">سعر الوحدة / Unit</th>
            <th style="text-align:left;">الإجمالي / Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderTotalsHtml(payload: QuotationPayload): string {
  const price = priceInCurrency(payload);
  const sym = CURRENCY_SYMBOL[payload.currency];
  return `
    <div class="q-totals">
      <div class="q-totals-box">
        <div class="q-totals-row">
          <span>المجموع الفرعي</span>
          <span class="q-numeric">${sym} ${fmt(price)}</span>
        </div>
        <div class="q-totals-row grand">
          <span>الإجمالي النهائي</span>
          <span class="q-numeric">${sym} ${fmt(price)}</span>
        </div>
      </div>
    </div>
  `;
}

function renderFooter(): string {
  return `
    <div class="q-footer">
      <div>Thank you for your business — نشكركم على ثقتكم</div>
      <div>هذا العرض ساري لمدة 7 أيام من تاريخ الإصدار — Quotation valid for 7 days from the date of issue</div>
    </div>
  `;
}

function renderTemplate1(payload: QuotationPayload, items: QuotationLineItem[]): string {
  return `
    ${renderHeaderHtml(payload)}
    ${renderItemsTableHtml(items, payload.currency)}
    ${renderTotalsHtml(payload)}
    ${renderInvoiceNotesHtml(payload)}
    ${renderFooter()}
  `;
}

function renderTemplate2(payload: QuotationPayload, items: QuotationLineItem[]): string {
  const sym = CURRENCY_SYMBOL[payload.currency];
  const productPages = items.map((it, idx) => `
    <div class="q-page">
      ${renderHeaderHtml(payload)}
      <div class="q-section">
        <div class="q-section-title">المنتج ${idx + 1} من ${items.length}</div>
        <div class="q-product-hero">
          <div class="q-product-hero-name">${escapeHtml(it.productName)}</div>
          ${it.specification ? `<div class="q-product-hero-spec">${escapeHtml(it.specification)}</div>` : ''}
          <div class="q-product-hero-spec"><strong>الكمية:</strong> ${escapeHtml(String(it.quantity))}</div>
          <div class="q-product-hero-price">
            <span class="q-product-hero-price-label">السعر النهائي</span>
            <span class="q-product-hero-price-value">${sym} ${fmt(it.total)}</span>
          </div>
        </div>
      </div>
      ${idx === items.length - 1 ? renderTotalsHtml(payload) + renderInvoiceNotesHtml(payload) + renderFooter() : ''}
    </div>
  `).join('');
  return productPages;
}

export function exportQuotationPDF(payload: QuotationPayload): void {
  if (typeof window === 'undefined') return;
  const items = buildLineItems(payload);
  const body = payload.template === 2
    ? renderTemplate2(payload, items)
    : renderTemplate1(payload, items);

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>Quotation #${payload.order.orderNumber} — ${payload.order.shippingMark}-${payload.order.shippingMarkSerial}</title>
  <style>${styleBlock()}</style>
</head>
<body>
  <div class="print-toolbar no-print">
    <button onclick="window.print()">🖨️ طباعة / حفظ PDF</button>
    <button onclick="window.close()">إغلاق</button>
  </div>
  ${body}
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    return;
  }

  alert('تعذّر تحضير المعاينة — يرجى السماح بالنوافذ المنبثقة لموقع MJ-DOS.');
}

export function exportQuotationExcel(payload: QuotationPayload): void {
  const items = buildLineItems(payload);
  const sym = CURRENCY_SYMBOL[payload.currency];
  const currencyLabel = CURRENCY_LABEL[payload.currency];
  const dateStr = new Date().toISOString().slice(0, 10);

  const isOfficial = !!payload.invoiceNumber;
  const rows: (string | number | null)[][] = [
    [payload.companyName],
    [payload.companyTagline],
    [],
    [isOfficial ? 'فاتورة رسمية / Official Invoice' : 'عرض سعر / Quotation'],
  ];
  if (isOfficial) rows.push(['رقم الفاتورة', payload.invoiceNumber || '']);
  rows.push(
    ['رقم الطلب', `#${payload.order.orderNumber}`],
    ['الشيبينغ مارك', `${payload.order.shippingMark}-${payload.order.shippingMarkSerial}`],
    ['التاريخ', dateStr],
    ['العملة', currencyLabel],
    ['أعدّ بواسطة', payload.issuedBy],
    [],
    ['بيانات العميل'],
    ['الاسم', payload.order.clientName],
    ['القسم', categorySummary(payload.order) || ''],
    [],
    ['المنتج', 'الكمية', `سعر الوحدة (${sym})`, `الإجمالي (${sym})`],
  );

  for (const it of items) {
    const productCell = it.specification ? `${it.productName} — ${it.specification}` : it.productName;
    rows.push([
      productCell,
      typeof it.quantity === 'number' ? it.quantity : (Number(it.quantity) || it.quantity),
      // Pre-formatted strings so Excel renders per the MJ-DOS number standard
      // (thousands separators, no trailing ".00"). Loses cell arithmetic, but
      // the quotation is a customer-facing document, not a spreadsheet.
      formatNumber(Math.round(it.unitPrice), 0),
      formatNumber(Math.round(it.total), 0),
    ]);
  }

  const total = priceInCurrency(payload);
  rows.push([]);
  rows.push(['', '', 'المجموع الفرعي', formatNumber(Math.round(total), 0)]);
  rows.push(['', '', 'الإجمالي النهائي', formatNumber(Math.round(total), 0)]);
  rows.push([]);
  rows.push([`القالب المستخدم: ${payload.template === 2 ? 'Template 2 — منتج لكل صفحة' : 'Template 1 — جدول قياسي'}`]);
  if (payload.invoiceNotes && payload.invoiceNotes.trim()) {
    rows.push([]);
    rows.push(['ملاحظات الفاتورة / Invoice Notes']);
    // Split multi-line notes over multiple rows so they render readably.
    for (const line of payload.invoiceNotes.trim().split(/\r?\n/)) {
      rows.push([line]);
    }
  }

  const fileNamePrefix = isOfficial ? `Invoice-${payload.invoiceNumber}` : `Quotation-${payload.order.orderNumber}`;
  const fileName = `${fileNamePrefix}-${payload.order.shippingMark}-${payload.order.shippingMarkSerial}-${payload.currency}.xlsx`;

  downloadXlsx(
    [{
      name: `${isOfficial ? 'Invoice' : 'Quotation'} ${payload.order.orderNumber}`,
      rows,
      columns: [{ width: 42 }, { width: 22 }, { width: 22 }, { width: 22 }],
    }],
    fileName,
  );
}
