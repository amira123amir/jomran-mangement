import type { Order, CustomNote, NegotiationEntry } from '../../types';

export interface NotesSlice {
  addNote: (orderId: string, author: string, authorDept: string, target: string, content: string) => void;
  markNoteRead: (orderId: string, persona: string) => void;
  replyToNote: (orderId: string, noteId: string, author: string, authorDept: string, content: string) => void;

  addCustomNote: (orderId: string, senderName: string, senderRole: string, targetUserId: string, targetName: string, targetRole: string, content: string, type?: 'general' | 'secret') => void;
  markCustomNoteRead: (orderId: string, noteId: string, readerName: string) => void;
  replyToCustomNote: (orderId: string, noteId: string, senderName: string, senderRole: string, content: string) => void;
  getCustomNotesForTarget: (targetUserId: string) => { note: CustomNote; order: Order }[];

  addNegotiationEntry: (orderId: string, fromPersona: string, fromDept: string, message: string, type: NegotiationEntry['type']) => void;

  addDocument: (orderId: string, name: string, type: string, url: string, uploadedBy: string) => void;
}
