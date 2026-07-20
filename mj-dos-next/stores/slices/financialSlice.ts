import type { OrderPricing, ProformaInvoice, OfficialInvoice, CustomerDeposit, FactoryPayment, DepositConfirmation } from '../../types';
import type { TransitionActor, TransitionResult } from './transitionTypes';

export interface FinancialSlice {
  submitPricing: (orderId: string, pricing: Omit<OrderPricing, 'iteration' | 'submittedAt'>, actor: TransitionActor) => TransitionResult;
  submitProforma: (orderId: string, proforma: Omit<ProformaInvoice, 'submittedAt'>, actor: TransitionActor) => TransitionResult;
  rejectPricing: (orderId: string, fromPersona: string, fromDept: string, reason: string) => TransitionResult;
  acceptPricing: (orderId: string, fromPersona: string) => void;
  generateOfficialQuotation: (
    orderId: string,
    invoice: Omit<OfficialInvoice, 'exportedBy' | 'exportedAt'>,
    actor: TransitionActor,
  ) => TransitionResult;
  recordDepositPaid: (
    orderId: string,
    deposit: Omit<CustomerDeposit, 'recordedBy' | 'recordedAt' | 'confirmedBy' | 'confirmedAt'>,
    actor: TransitionActor,
  ) => TransitionResult;
  confirmDeposit: (orderId: string, confirmation: DepositConfirmation, actor: TransitionActor) => TransitionResult;
  returnDeposit: (orderId: string, actor: TransitionActor, reason: string) => TransitionResult;
  sendPaymentOrder: (orderId: string, actor: TransitionActor, note?: string) => TransitionResult;
  recordFactoryPayment: (
    orderId: string,
    payment: Omit<FactoryPayment, 'recordedBy' | 'recordedAt' | 'confirmedBy' | 'confirmedAt'>,
    actor: TransitionActor,
  ) => { ok: boolean; error?: string };
  confirmFactoryPayment: (orderId: string, actor: TransitionActor, note?: string) => TransitionResult;
  markProductionStarted: (orderId: string, actor: TransitionActor, note?: string) => TransitionResult;
  markReadyForShipping: (orderId: string, actor: TransitionActor, note?: string) => TransitionResult;
  markShipped: (orderId: string, actor: TransitionActor, note?: string) => TransitionResult;
  markArrived: (orderId: string, actor: TransitionActor, note?: string) => TransitionResult;
  markDelivered: (orderId: string, actor: TransitionActor, note?: string) => TransitionResult;
}
