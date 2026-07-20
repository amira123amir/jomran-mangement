import { useState } from 'react';
import { useExchangeRateStore } from '../stores/exchangeRateStore';
import { useAuditStore } from '../stores/auditStore';
import { usePersonaStore } from '../stores/personaStore';

export default function ExchangeRateScreen() {
  const { rates, isLocked, lockedBy, lockedAt, lockRates } = useExchangeRateStore();
  const addLog = useAuditStore((s) => s.addLog);
  const persona = usePersonaStore((s) => s.activePersona);

  const [localRates, setLocalRates] = useState(rates);
  const [saved, setSaved] = useState(false);

  const handleChange = (field: 'rmb' | 'try_' | 'syp', value: string) => {
    if (/^\d*\.?\d*$/.test(value) || value === '') {
      setLocalRates((prev) => ({ ...prev, [field]: value }));
      setSaved(false);
    }
  };

  const handleLock = () => {
    if (!localRates.rmb || !localRates.try_ || !localRates.syp) return;
    lockRates(localRates, persona.name);
    addLog(
      persona.name,
      persona.department,
      'قامت المحاسبة بقفل أسعار الصرف المعتمدة لليوم',
      `USD/RMB: ${localRates.rmb} | USD/TRY: ${localRates.try_} | USD/SYP: ${localRates.syp}`
    );
    setSaved(true);
  };

  const handleReset = () => {
    setLocalRates({ rmb: '', try_: '', syp: '' });
    setSaved(false);
    addLog(persona.name, persona.department, 'تم مسح بيانات أسعار الصرف لإعادة الإدخال');
  };

  return (
    <div className="exchange-rate-screen">
      <div className="ers-header">
        <div className="ers-header-icon">💱</div>
        <div>
          <h2 className="ers-title">تثبيت أسعار الصرف اليومية للشركة</h2>
          <p className="ers-sub">أسعار الصرف المعتمدة تُطبق تلقائياً على جميع طلبات المبيعات اليوم</p>
        </div>
      </div>

      {isLocked && (
        <div className="ers-locked-banner">
          <div className="ers-locked-dot" />
          <div>
            <span className="ers-locked-text">الأسعار معتمدة ومغلقة بواسطة <strong>{lockedBy}</strong></span>
            <span className="ers-locked-time">{lockedAt}</span>
          </div>
        </div>
      )}

      <div className="ers-cards">
        <div className={`ers-card ${localRates.rmb ? 'filled' : ''}`}>
          <div className="ers-card-flag">🇨🇳</div>
          <div className="ers-card-info">
            <span className="ers-card-currency">الرمبي الصيني</span>
            <span className="ers-card-code">RMB / CNY</span>
          </div>
          <div className="ers-card-input-wrap">
            <span className="ers-card-prefix">1 USD =</span>
            <input
              type="text"
              className="ers-card-input"
              placeholder="0.00"
              value={localRates.rmb}
              onChange={(e) => handleChange('rmb', e.target.value)}
              disabled={isLocked && saved}
            />
            <span className="ers-card-suffix">RMB</span>
          </div>
        </div>

        <div className={`ers-card ${localRates.try_ ? 'filled' : ''}`}>
          <div className="ers-card-flag">🇹🇷</div>
          <div className="ers-card-info">
            <span className="ers-card-currency">الليرة التركية</span>
            <span className="ers-card-code">TRY</span>
          </div>
          <div className="ers-card-input-wrap">
            <span className="ers-card-prefix">1 USD =</span>
            <input
              type="text"
              className="ers-card-input"
              placeholder="0.00"
              value={localRates.try_}
              onChange={(e) => handleChange('try_', e.target.value)}
              disabled={isLocked && saved}
            />
            <span className="ers-card-suffix">TRY</span>
          </div>
        </div>

        <div className={`ers-card ${localRates.syp ? 'filled' : ''}`}>
          <div className="ers-card-flag">🇸🇾</div>
          <div className="ers-card-info">
            <span className="ers-card-currency">الليرة السورية</span>
            <span className="ers-card-code">SYP</span>
          </div>
          <div className="ers-card-input-wrap">
            <span className="ers-card-prefix">1 USD =</span>
            <input
              type="text"
              className="ers-card-input"
              placeholder="0.00"
              value={localRates.syp}
              onChange={(e) => handleChange('syp', e.target.value)}
              disabled={isLocked && saved}
            />
            <span className="ers-card-suffix">SYP</span>
          </div>
        </div>
      </div>

      <div className="ers-actions">
        <button
          className="ers-btn-primary"
          onClick={handleLock}
          disabled={!localRates.rmb || !localRates.try_ || !localRates.syp || (isLocked && saved)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          اعتماد وحفظ أسعار اليوم
        </button>
        <button className="ers-btn-secondary" onClick={handleReset}>
          مسح وإعادة الإدخال
        </button>
      </div>

      {saved && (
        <div className="ers-success-bar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          تم تثبيت واعتماد أسعار الصرف بنجاح — سيتم تطبيقها على جميع الطلبات اليوم
        </div>
      )}

      <div className="ers-info-box">
        <div className="ers-info-title">كيف يعمل هذا النظام؟</div>
        <ul className="ers-info-list">
          <li>تُدخل أسعار الصرف اليومية مرة واحدة فقط صباحاً</li>
          <li>يتم تثبيتها من قبل المحاسبة (نور) ولا يمكن تعديلها إلا في اليوم التالي</li>
          <li>تُطبق تلقائياً على جميع طلبات المبيعات وتحويل العملات في النظام</li>
          <li>يُمنع أي طلب بدون سعر صرف معتمد من المحاسبة</li>
        </ul>
      </div>
    </div>
  );
}
