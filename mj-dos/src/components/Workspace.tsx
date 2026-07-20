import { usePersonaStore } from '../stores/personaStore';
import ExchangeRateScreen from './ExchangeRateScreen';
import SalesOrderScreen from './SalesOrderScreen';
import ProcurementWorkspace from './ProcurementWorkspace';
import SupplierDirectory from './SupplierDirectory';
import ManagerControlTower from './ManagerControlTower';
import ExecutiveDashboard from './ExecutiveDashboard';
import { SalesDashboard, ProcurementDashboard, AccountingDashboard, DefaultDashboard } from './DeptDashboards';

export default function Workspace() {
  const { activePersona, activeTab } = usePersonaStore();
  const activeNavItem = activePersona.navItems.find((n) => n.id === activeTab);

  const renderContent = () => {
    if (activePersona.department === 'accounting' && activeTab === 'exchange-rates') {
      return <ExchangeRateScreen />;
    }
    if (activePersona.department === 'sales' && activeTab === 'new-order') {
      return <SalesOrderScreen />;
    }
    if (activePersona.department === 'procurement' && activeTab === 'dashboard') {
      return <ProcurementWorkspace />;
    }
    if (activePersona.department === 'procurement' && activeTab === 'suppliers') {
      return <SupplierDirectory />;
    }
    if (activePersona.department === 'sales' && activeTab === 'orders' && activePersona.name === 'لميس - مديرة المبيعات') {
      return <ManagerControlTower />;
    }
    if (activePersona.department === 'sales') {
      return <SalesDashboard persona={activePersona.name} departmentLabel={activePersona.departmentLabel} role={activePersona.role} department={activePersona.department} />;
    }
    if (activePersona.department === 'procurement') {
      return <ProcurementDashboard persona={activePersona.name} departmentLabel={activePersona.departmentLabel} role={activePersona.role} department={activePersona.department} />;
    }
    if (activePersona.department === 'accounting') {
      return <AccountingDashboard persona={activePersona.name} departmentLabel={activePersona.departmentLabel} role={activePersona.role} department={activePersona.department} />;
    }
    if (activePersona.department === 'executive') {
      return <ExecutiveDashboard persona={activePersona.name} departmentLabel={activePersona.departmentLabel} role={activePersona.role} department={activePersona.department} />;
    }
    return <DefaultDashboard persona={activePersona.name} departmentLabel={activePersona.departmentLabel} role={activePersona.role} department={activePersona.department} />;
  };

  return (
    <main className="workspace">
      <div className="workspace-header">
        <div className="workspace-header-left">
          <h1 className="workspace-title">{activeNavItem?.label || 'لوحة التحكم'}</h1>
          <div className="workspace-breadcrumb">
            <span>{activePersona.departmentLabel}</span>
            <span className="bc-sep">/</span>
            <span className="bc-current">{activeNavItem?.label}</span>
          </div>
        </div>
        <div className="workspace-header-right">
          <span className="workspace-date">
            {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
          <div className="workspace-persona-badge" style={{ backgroundColor: activePersona.color }}>
            {activePersona.initials}
          </div>
        </div>
      </div>
      <div className="workspace-content">
        {renderContent()}
      </div>
    </main>
  );
}
