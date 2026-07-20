import { create } from 'zustand';

export type ClientClassification = 'مصنع' | 'تاجر جملة' | 'تاجر تجزئة' | 'مقاولات';

const COUNTRY_CODE_MAP: Record<string, string> = {
  'سوريا': 'SY', 'تركيا': 'TR', 'الصين': 'CN', 'الإمارات': 'AE',
  'السعودية': 'SA', 'مصر': 'EG', 'العراق': 'IQ', 'لبنان': 'LB',
  'فلسطين': 'PS', 'الأردن': 'JO', 'ليبيا': 'LY', 'الجزائر': 'DZ',
};

export function generateShippingMark(country: string, legalName: string): string {
  const countryKey = Object.keys(COUNTRY_CODE_MAP).find((k) => country.includes(k));
  const cCode = countryKey ? COUNTRY_CODE_MAP[countryKey] : 'XX';
  const nameParts = legalName.trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const arabicToLatin: Record<string, string> = {
    'ا': 'A', 'ب': 'B', 'ت': 'T', 'ث': 'TH', 'ج': 'J', 'ح': 'H', 'خ': 'KH',
    'د': 'D', 'ذ': 'DH', 'ر': 'R', 'ز': 'Z', 'س': 'S', 'ش': 'SH', 'ص': 'S',
    'ض': 'D', 'ط': 'T', 'ظ': 'Z', 'ع': 'A', 'غ': 'GH', 'ف': 'F', 'ق': 'Q',
    'ك': 'K', 'ل': 'L', 'م': 'M', 'ن': 'N', 'ه': 'H', 'و': 'W', 'ي': 'Y',
  };
  let latinName = '';
  for (const ch of firstName) {
    latinName += arabicToLatin[ch] || ch;
  }
  latinName = latinName.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 2);
  if (latinName.length < 2) latinName = latinName.padEnd(2, 'X');
  return `${cCode}&${latinName}`;
}

export interface Client {
  id: string;
  legalName: string;
  phone: string;
  countryCode: string;
  country: string;
  city: string;
  classification: ClientClassification;
  defaultCurrency: string;
  shippingMark: string;
  shippingMarkLocked: boolean;
  orderCount: number;
  createdAt: string;
}

interface ClientRegistryState {
  clients: Client[];
  addClient: (client: Omit<Client, 'id' | 'createdAt' | 'defaultCurrency' | 'shippingMark' | 'orderCount' | 'shippingMarkLocked'> & { customShippingMark?: string }) => Client;
  getClientById: (id: string) => Client | undefined;
  incrementOrderCount: (clientId: string) => void;
  getNextSerial: (clientId: string) => number;
  lockShippingMark: (clientId: string) => void;
}

let clientCounter = 0;

function getCurrencyForClassification(c: ClientClassification): string {
  const map: Record<ClientClassification, string> = {
    'مصنع': 'USD',
    'تاجر جملة': 'USD',
    'تاجر تجزئة': 'RMB',
    'مقاولات': 'SYP',
  };
  return map[c];
}

export const useClientRegistryStore = create<ClientRegistryState>((set, get) => ({
  clients: [],
  addClient: (data) => {
    const id = `client-${++clientCounter}-${Date.now()}`;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const createdAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const defaultCurrency = getCurrencyForClassification(data.classification);
    const autoMark = generateShippingMark(data.country, data.legalName);
    const shippingMark = data.customShippingMark || autoMark;
    const client: Client = { ...data, id, createdAt, defaultCurrency, shippingMark, shippingMarkLocked: false, orderCount: 0 };
    set((s) => ({ clients: [...s.clients, client] }));
    return client;
  },
  getClientById: (id) => get().clients.find((c) => c.id === id),
  incrementOrderCount: (clientId) =>
    set((s) => ({
      clients: s.clients.map((c) =>
        c.id === clientId ? { ...c, orderCount: c.orderCount + 1 } : c
      ),
    })),
  getNextSerial: (clientId) => {
    const client = get().clients.find((c) => c.id === clientId);
    return (client?.orderCount || 0) + 1;
  },
  lockShippingMark: (clientId) =>
    set((s) => ({
      clients: s.clients.map((c) =>
        c.id === clientId ? { ...c, shippingMarkLocked: true } : c
      ),
    })),
}));
