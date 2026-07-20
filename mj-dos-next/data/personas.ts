import type { Persona } from '../types';

const executiveNav = [
  { id: 'overview', label: 'نظرة عامة إستراتيجية', icon: 'grid' },
  { id: 'kpi', label: 'لوحة مؤشرات الأداء', icon: 'bar-chart' },
  { id: 'approvals', label: 'الموافقات المعلقة', icon: 'check-circle' },
  { id: 'activity', label: 'سجل نشاط الشركة', icon: 'activity' },
  { id: 'messages', label: 'التوجيهات والرسائل', icon: 'mail' },
];

const salesNav = [
  { id: 'dashboard', label: 'لوحة تحكمي', icon: 'grid' },
  { id: 'new-order', label: 'إنشاء طلب عميل جديد', icon: 'shopping-cart' },
  { id: 'orders', label: 'طلبات البيع', icon: 'clipboard' },
  { id: 'clients', label: 'محفظة العملاء', icon: 'users' },
  { id: 'leads', label: 'قائمة العملاء المحتملين', icon: 'target' },
  { id: 'quotes', label: 'عرض الأسعار', icon: 'file-text' },
  { id: 'communications', label: 'المراسلات', icon: 'message-square' },
  { id: 'tasks', label: 'مهامي', icon: 'check-square' },
];

const procurementNav = [
  { id: 'dashboard', label: 'لوحة تحكمي', icon: 'grid' },
  { id: 'suppliers', label: 'دليل الموردين', icon: 'truck' },
  { id: 'rfq', label: 'إدارة طلبات العرض', icon: 'send' },
  { id: 'inventory', label: 'حالة المخزون', icon: 'package' },
  { id: 'shipments', label: 'تتبع الشحنات', icon: 'map' },
  { id: 'tasks', label: 'مهامي', icon: 'check-square' },
];

const accountingNav = [
  { id: 'exchange-rates', label: 'تثبيت أسعار الصرف اليومية', icon: 'grid' },
  { id: 'invoices', label: 'الفواتير', icon: 'file-text' },
  { id: 'payments', label: 'المدفوعات', icon: 'credit-card' },
  { id: 'ledger', label: 'دفتر الأستاذ العام', icon: 'book' },
  { id: 'reports', label: 'التقارير المالية', icon: 'bar-chart' },
  { id: 'reconciliation', label: 'التسوية البنكية', icon: 'refresh-cw' },
  { id: 'tasks', label: 'مهامي', icon: 'check-square' },
];

function makeId(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function hue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return Math.abs(h % 360);
}

function makeColor(name: string, dept: string): string {
  const h = hue(name);
  const sMap: Record<string, number> = { executive: 70, sales: 65, procurement: 55, accounting: 50 };
  const lMap: Record<string, number> = { executive: 38, sales: 42, procurement: 40, accounting: 36 };
  return `hsl(${h}, ${sMap[dept]}%, ${lMap[dept]}%)`;
}

export const PERSONAS: Persona[] = [
  {
    id: makeId('mohammad-jamran'),
    name: 'محمد جمران',
    role: 'المالك',
    department: 'executive',
    departmentLabel: 'الإدارة العليا',
    color: makeColor('Mohammad Jamran', 'executive'),
    initials: 'مج',
    navItems: executiveNav,
  },

  ...([
    { name: 'لميس - مديرة المبيعات', role: 'مديرة المبيعات', enId: 'lamis' },
    { name: 'آية', role: 'مبيعات الإضاءة', enId: 'aya-light' },
    { name: 'هالة', role: 'مبيعات الطاقة', enId: 'hala' },
    { name: 'أحلام', role: 'مبيعات الحاسبات', enId: 'ahlam' },
    { name: 'سدرة', role: 'مبيعات مواد البناء', enId: 'sidra' },
    { name: 'عزة', role: 'مبيعات الألعاب', enId: 'azza' },
    { name: 'شيماء', role: 'مبيعات ماكينات الإنتاج', enId: 'shaimaa' },
    { name: 'غسون', role: 'مبيعات المنتجات المنزلية', enId: 'ghousoun' },
    { name: 'مي', role: 'مبيعات المستلزمات المكتبية', enId: 'mai-sales' },
  ] as const).map(p => ({
    id: makeId(p.enId + '-sales'),
    name: p.name,
    role: p.role,
    department: 'sales' as const,
    departmentLabel: 'قسم المبيعات',
    color: makeColor(p.enId, 'sales'),
    initials: initials(p.name),
    navItems: salesNav,
  })),

  ...([
    { name: 'كنانة', role: 'مديرة المشتريات', enId: 'kenana' },
    { name: 'آية', role: 'الكابلات والحواسب', enId: 'aya-cables' },
    { name: 'مي', role: 'مشتريات الإضاءة', enId: 'mai-proc' },
    { name: 'ريم', role: 'مواد البناء', enId: 'reem' },
    { name: 'أمل', role: 'قطع غيار السيارات', enId: 'amal' },
    { name: 'آية كصوحه', role: 'مصنعات العملاء', enId: 'aya-kassouha' },
    { name: 'مراح', role: 'مشتريات الزجاج', enId: 'marah-glass' },
    { name: 'روان', role: 'المنتجات المنزلية', enId: 'rawan-home' },
    { name: 'مراح', role: 'مشتريات الألعاب', enId: 'marah-toys' },
    { name: 'روان ١', role: 'المنتجات الطبية', enId: 'rawan-medical' },
  ] as const).map(p => ({
    id: makeId(p.enId + '-proc'),
    name: p.name,
    role: p.role,
    department: 'procurement' as const,
    departmentLabel: 'قسم المشتريات',
    color: makeColor(p.enId, 'procurement'),
    initials: initials(p.name),
    navItems: procurementNav,
  })),

  ...([
    { name: 'نور', role: 'مديرة الحسابات', enId: 'noor' },
    { name: 'دنيا', role: 'محاسبة', enId: 'dunia' },
    { name: 'عائشة', role: 'محاسبة', enId: 'aisha' },
    { name: 'رما', role: 'محاسبة', enId: 'rama' },
    { name: 'زينب', role: 'محاسبة', enId: 'zainab' },
    { name: 'بيان', role: 'محاسبة', enId: 'bayan' },
  ] as const).map(p => ({
    id: makeId(p.enId + '-acct'),
    name: p.name,
    role: p.role,
    department: 'accounting' as const,
    departmentLabel: 'قسم الحسابات',
    color: makeColor(p.enId, 'accounting'),
    initials: initials(p.name),
    navItems: accountingNav,
  })),
];

export function getPersonasByDepartment(dept: string): Persona[] {
  return PERSONAS.filter(p => p.department === dept);
}
