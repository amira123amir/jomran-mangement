import type { Persona } from '../types';

const CEO_NAME = 'محمد جمران';

export function canViewSupplierData(persona: Persona | { name: string; department: string }): boolean {
  if (persona.name === CEO_NAME) return true;
  return persona.department === 'procurement' || persona.department === 'accounting';
}

export function canViewCustomerData(persona: Persona | { name: string; department: string }): boolean {
  if (persona.name === CEO_NAME) return true;
  return persona.department !== 'procurement';
}
