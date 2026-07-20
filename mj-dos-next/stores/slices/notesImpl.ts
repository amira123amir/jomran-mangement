import type { Order, OrderNote, OrderNoteReply, CustomNote, CustomNoteReply, NegotiationEntry, Notification } from '../../types';
import type { NotesSlice } from './notesSlice';
import { formatNow } from '../../utils/dateHelpers';
import { uid } from '../../utils/helpers';

export function createNotesSlice(set: any, get: any): NotesSlice {
  return {
    addNote: (orderId, author, authorDept, target, content) => {
      const { timestamp } = formatNow();
      const id = uid('note');
      const note: OrderNote = { id, authorPersona: author, authorDept, targetPersona: target, content, readBy: [], replies: [], createdAt: timestamp };

      const order = get().orders.find((o: any) => o.id === orderId);
      if (!order) return;

      set((s: any) => ({
        orders: s.orders.map((o: any) =>
          o.id === orderId
            ? { ...o, notes: [...o.notes, note], updatedAt: timestamp }
            : o
        ),
      }));

      const notif: Notification = {
        id: uid('notif'),
        orderId,
        orderNumber: order.orderNumber,
        shippingMark: order.shippingMark,
        type: 'note',
        message: `ملاحظة جديدة من ${author} على الطلب #${order.orderNumber}: "${content.slice(0, 60)}${content.length > 60 ? '...' : ''}"`,
        fromPersona: author,
        forPersona: target,
        read: false,
        createdAt: timestamp,
      };
      set((s: any) => ({ notifications: [...s.notifications, notif] }));
    },

    markNoteRead: (orderId, persona) => {
      const { timestamp } = formatNow();
      set((s: any) => ({
        orders: s.orders.map((o: any) => {
          if (o.id !== orderId) return o;
          return {
            ...o,
            notes: o.notes.map((n: any) => {
              if (n.targetPersona !== persona) return n;
              const alreadyRead = n.readBy.some((r: any) => r.persona === persona);
              if (alreadyRead) return n;
              return { ...n, readBy: [...n.readBy, { persona, readAt: timestamp }] };
            }),
          };
        }),
      }));
    },

    replyToNote: (orderId, noteId, author, authorDept, content) => {
      const { timestamp } = formatNow();
      const reply: OrderNoteReply = {
        id: uid('reply'),
        authorPersona: author,
        authorDept,
        content,
        createdAt: timestamp,
      };
      set((s: any) => ({
        orders: s.orders.map((o: any) => {
          if (o.id !== orderId) return o;
          return {
            ...o,
            notes: o.notes.map((n: any) =>
              n.id === noteId ? { ...n, replies: [...n.replies, reply] } : n
            ),
            updatedAt: timestamp,
          };
        }),
      }));
    },

    addCustomNote: (orderId, senderName, senderRole, targetUserId, targetName, targetRole, content, type) => {
      const { timestamp } = formatNow();
      const id = uid('cnote');
      const order = get().orders.find((o: any) => o.id === orderId);
      if (!order) return;
      const note: CustomNote = { id, orderId, orderNumber: order.orderNumber, shippingMark: order.shippingMark, senderName, senderRole, targetUserId, targetName, targetRole, content, type: type || 'general', createdAt: timestamp, isRead: false, readAt: '', readHistory: [], replies: [] };
      set((s: any) => ({
        orders: s.orders.map((o: any) => o.id === orderId ? { ...o, customNotes: [...o.customNotes, note], updatedAt: timestamp } : o),
      }));
    },

    markCustomNoteRead: (orderId, noteId, readerName) => {
      const { date, time, timestamp } = formatNow();
      set((s: any) => ({
        orders: s.orders.map((o: any) => {
          if (o.id !== orderId) return o;
          return {
            ...o,
            customNotes: o.customNotes.map((n: any) => {
              if (n.id !== noteId) return n;
              const history = n.readHistory || [];
              const alreadyLogged = history.some((h: any) => h.reader === readerName);
              if (alreadyLogged && n.isRead) return n;
              const newHistory = alreadyLogged
                ? history
                : [...history, { reader: readerName, date, time, timestamp }];
              return {
                ...n,
                isRead: true,
                readAt: n.readAt || timestamp,
                readHistory: newHistory,
              };
            }),
          };
        }),
      }));
    },

    replyToCustomNote: (orderId, noteId, senderName, senderRole, content) => {
      const { timestamp } = formatNow();
      const reply: CustomNoteReply = { id: uid('creply'), senderName, senderRole, content, createdAt: timestamp };
      set((s: any) => ({
        orders: s.orders.map((o: any) => {
          if (o.id !== orderId) return o;
          return {
            ...o,
            customNotes: o.customNotes.map((n: any) =>
              n.id === noteId ? { ...n, replies: [...n.replies, reply] } : n
            ),
            updatedAt: timestamp,
          };
        }),
      }));
    },

    getCustomNotesForTarget: (targetUserId) => {
      const results: { note: CustomNote; order: Order }[] = [];
      for (const order of get().orders) {
        for (const note of order.customNotes) {
          if (note.targetUserId === targetUserId) {
            results.push({ note, order });
          }
        }
      }
      return results.sort((a, b) => b.note.createdAt.localeCompare(a.note.createdAt));
    },

    addNegotiationEntry: (orderId, fromPersona, fromDept, message, type) => {
      const { timestamp } = formatNow();
      const entry: NegotiationEntry = {
        id: uid('neg'),
        fromPersona,
        fromDept,
        message,
        type,
        createdAt: timestamp,
      };
      set((s: any) => ({
        orders: s.orders.map((o: any) =>
          o.id === orderId
            ? { ...o, negotiationHistory: [...o.negotiationHistory, entry], updatedAt: timestamp }
            : o
        ),
      }));
    },

    addDocument: (orderId, name, type, url, uploadedBy) => {
      const { timestamp } = formatNow();
      const doc = {
        id: uid('doc'),
        name,
        type,
        url,
        uploadedBy,
        uploadedAt: timestamp,
      };
      set((s: any) => ({
        orders: s.orders.map((o: any) =>
          o.id === orderId
            ? { ...o, documents: [...o.documents, doc], updatedAt: timestamp }
            : o
        ),
      }));
    },
  };
}
