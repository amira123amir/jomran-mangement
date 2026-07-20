import type { Order, SupplierData } from '../../types';
import type { TransitionResult } from './transitionTypes';

export interface OrderSlice {
  orders: Order[];
  addOrder: (data: Omit<Order, 'id' | 'orderNumber' | 'status' | 'claim' | 'pricingHistory' | 'revenue' | 'notes' | 'customNotes' | 'proforma' | 'negotiationHistory' | 'documents' | 'supplierData' | 'assignment' | 'lockTicket' | 'workflowHistory' | 'createdAt' | 'updatedAt'> & { targetPrice?: number }) => Order;
  getOrderById: (id: string) => Order | undefined;
  getOrdersBySales: (personaName: string) => Order[];
  getOrdersByCategory: (category: string) => Order[];
  getPendingOrders: () => Order[];
  getClaimedBy: (personaName: string) => Order[];
  getPricedForSales: (salesPersona: string) => Order[];
  getOrdersAssignedTo: (personaName: string) => Order[];
  getSubordinateOrders: (subordinateNames: string[]) => Order[];
  getDeadlineStatus: (orderId: string) => { remaining: string; expired: boolean; progress: number } | null;
  updateSupplierData: (orderId: string, supplierData: SupplierData, personaName: string) => void;
  archiveOrder: (orderId: string, requestedBy: string, reason: string) => TransitionResult;
  unarchiveOrder: (orderId: string, requestedBy: string) => TransitionResult;
}
