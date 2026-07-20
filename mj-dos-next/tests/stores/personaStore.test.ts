import { describe, it, expect, beforeEach } from 'vitest';
import { usePersonaStore } from '../../stores/personaStore';
import { PERSONAS } from '../../data/personas';

describe('personaStore', () => {
  beforeEach(() => {
    usePersonaStore.setState({
      activePersona: PERSONAS[0],
      activeTab: PERSONAS[0].navItems[0].id,
      sidebarCollapsed: false,
    });
  });

  it('starts with the first persona', () => {
    const { activePersona } = usePersonaStore.getState();
    expect(activePersona.name).toBe(PERSONAS[0].name);
  });

  it('switches persona and resets tab', () => {
    const { setActivePersona } = usePersonaStore.getState();
    setActivePersona(PERSONAS[1]);
    const { activePersona, activeTab } = usePersonaStore.getState();
    expect(activePersona.name).toBe(PERSONAS[1].name);
    expect(activeTab).toBe(PERSONAS[1].navItems[0].id);
  });

  it('toggles sidebar', () => {
    const { toggleSidebar } = usePersonaStore.getState();
    expect(usePersonaStore.getState().sidebarCollapsed).toBe(false);
    toggleSidebar();
    expect(usePersonaStore.getState().sidebarCollapsed).toBe(true);
    toggleSidebar();
    expect(usePersonaStore.getState().sidebarCollapsed).toBe(false);
  });
});
