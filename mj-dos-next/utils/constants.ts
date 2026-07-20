import { PERSONAS } from '../data/personas';

// Single source of truth for the CEO name. Used by workflowEngine, supplierMask,
// noteVisibility, and orderStore. Never hardcode the name elsewhere.
export const CEO_NAME = 'محمد جمران';

// Lookup a persona ID by the person's display name. When the same name appears
// in multiple departments (e.g. آية in sales AND procurement), the first match
// is returned. For targeted notifications, always prefer the `id` field.
export function findPersonaIdByName(name: string): string | undefined {
  return PERSONAS.find((p) => p.name === name)?.id;
}

// Resolve an array of candidate names to unique persona IDs. Duplicates and
// unresolved names are silently dropped.
export function resolvePersonaIds(names: (string | undefined | null)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    if (!name) continue;
    const id = findPersonaIdByName(name);
    if (id && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}
