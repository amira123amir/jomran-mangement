import { useState } from 'react';
import { useSupplierStore } from '../stores/supplierStore';
import type { SupplierCategory } from '../types';

export default function SupplierDirectory() {
  const { suppliers, addSupplier } = useSupplierStore();
  const [filter, setFilter] = useState<SupplierCategory | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  const filteredSuppliers = filter === 'all' ? suppliers : suppliers.filter(s => s.category === filter);

  return (
    <div className="procurement-workspace">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>دليل الموردين</h2>
        <button onClick={() => setShowAddModal(true)} className="ow-proforma-submit">إضافة مورد جديد</button>
      </div>
      
      <div style={{ marginBottom: 20 }}>
        <label>التصنيف: </label>
        <select value={filter} onChange={(e) => setFilter(e.target.value as SupplierCategory | 'all')}>
          <option value="all">الكل</option>
          <option value="lighting">إنارة</option>
          <option value="electrical">كهربائية</option>
          <option value="steel">حديد</option>
          <option value="other">أخرى</option>
        </select>
      </div>

      <table className="pw-registry-table">
        <thead>
          <tr>
            <th>اسم المعمل</th>
            <th>رقم الهاتف</th>
            <th>الويشات</th>
            <th>الموقع</th>
            <th>التصنيف</th>
          </tr>
        </thead>
        <tbody>
          {filteredSuppliers.map(s => (
            <tr key={s.id}>
              <td>{s.factoryName}</td>
              <td>{s.factoryPhone}</td>
              <td>{s.wechat || '-'}</td>
              <td>{s.website ? <a href={s.website} target="_blank">رابط</a> : '-'}</td>
              <td>{s.category}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
