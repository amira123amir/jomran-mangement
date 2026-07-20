import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { Persona, WorkspaceTab } from '../types';
import { PERSONAS } from '../data/personas';

interface PersonaState {
  activePersona: Persona;
  activeTab: WorkspaceTab;
  sidebarCollapsed: boolean;
  setActivePersona: (persona: Persona) => void;
  setActiveTab: (tab: WorkspaceTab) => void;
  toggleSidebar: () => void;
}

export const usePersonaStore = create<PersonaState>()(
  devtools(
    persist(
      (set) => ({
        activePersona: PERSONAS[0],
        activeTab: PERSONAS[0].navItems[0].id,
        sidebarCollapsed: false,
        setActivePersona: (persona) =>
          set({ activePersona: persona, activeTab: persona.navItems[0].id }),
        setActiveTab: (tab) => set({ activeTab: tab }),
        toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      }),
      {
        name: 'mjdos-persona',
      }
    ),
    { name: 'PersonaStore' }
  )
);
