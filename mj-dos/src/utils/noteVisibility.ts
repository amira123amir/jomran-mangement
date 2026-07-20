import type { OrderNote, CustomNote } from '../types';
import { PERSONAS } from '../data/personas';

export const CEO_NAME = 'محمد جمران';

const NOTE_ALL_PEOPLE = '__all__';

// Any note targeted to a specific persona is confidential.
// Visible ONLY to: the sender, the intended recipient (exact persona), and CEO.
// No department-wide fallback — that previously leaked confidential notes to
// coworkers of the intended recipient (e.g. Mai seeing a note for Kenana).
export function canSeeNote(
  note: OrderNote,
  currentPersonaName: string,
  _currentDepartment: string,
): boolean {
  if (note.targetPersona === NOTE_ALL_PEOPLE) return true;
  if (currentPersonaName === CEO_NAME) return true;
  if (note.authorPersona === currentPersonaName) return true;
  if (note.targetPersona === currentPersonaName) return true;
  return false;
}

// Confidential notes: visible only to sender, intended recipient, and CEO.
// No other persona may see the note, its content, its existence, previews,
// notifications, or unread indicators.
export function canSeeConfidentialNote(
  note: CustomNote,
  currentPersonaName: string,
  currentUserId: string | undefined,
): boolean {
  if (currentPersonaName === CEO_NAME) return true;
  if (note.senderName === currentPersonaName) return true;
  if (currentUserId && note.targetUserId === currentUserId) return true;
  return false;
}

export function isConfidentialRecipient(
  note: CustomNote,
  currentPersonaName: string,
  currentUserId: string | undefined,
): boolean {
  if (currentUserId && note.targetUserId === currentUserId) return true;
  if (currentPersonaName === CEO_NAME) return true;
  return false;
}

const NOTE_TARGETS = PERSONAS.map(p => ({
  userId: p.id,
  name: p.name,
  role: p.role,
}));

export function getCurrentUserIds(personaName: string): string[] {
  const persona = PERSONAS.find(p => p.name === personaName);
  return persona ? [persona.id] : [];
}

export { NOTE_TARGETS };

// Values MUST match the exact persona name (see personas.ts). Targeting a role
// label instead of a persona breaks strict confidentiality.
export const ORDER_NOTE_TARGETS = NOTE_TARGETS.map(t => ({
  value: t.name,
  label: `${t.name} (${t.role})`
}));
