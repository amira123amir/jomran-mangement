import type { OrderStatus, ShippingMarkLockTicket } from '../../types';
import type { TransitionActor, TransitionOptions, TransitionResult } from './transitionTypes';

export interface WorkflowSlice {
  transitionOrder: (orderId: string, targetStatus: OrderStatus, opts: TransitionOptions) => TransitionResult;

  claimOrder: (orderId: string, personaName: string, personaRole: string) => void;
  assignOrder: (orderId: string, assignTo: string, assignBy: string) => void;
  acceptAssignment: (orderId: string, personaName: string) => void;

  requestInfo: (orderId: string, fromPersona: string, fromDept: string, message: string, infoType?: 'sales' | 'factory') => void;
  submitRevision: (orderId: string, fromPersona: string, fromDept: string, message: string) => void;

  requestShippingMarkChange: (orderId: string, requestedBy: string, currentMark: string, proposedMark: string) => void;
  approveShippingMarkTicket: (orderId: string, approverName: string) => void;
}
