import { useEffect } from 'react';
import PersonaSwitcher from './components/PersonaSwitcher';
import Sidebar from './components/Sidebar';
import Workspace from './components/Workspace';
import AuditDrawer from './components/AuditDrawer';
import ErrorBoundary from './components/ErrorBoundary';
import { usePersonaStore } from './stores/personaStore';
import { useAuditStore } from './stores/auditStore';
import './App.css';

function App() {
  const activePersona = usePersonaStore((s) => s.activePersona);
  const addLog = useAuditStore((s) => s.addLog);

  useEffect(() => {
    addLog(activePersona.name, activePersona.department, 'Session started', `Persona loaded: ${activePersona.name} (${activePersona.role})`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app-root">
      <PersonaSwitcher />
      <div className="app-body">
        <Sidebar />
        <ErrorBoundary>
          <Workspace />
        </ErrorBoundary>
      </div>
      <AuditDrawer />
    </div>
  );
}

export default App;
