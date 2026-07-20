import { useState, useMemo } from 'react';
import type { ClientClassification } from '../stores/clientRegistryStore';
import { generateShippingMark } from '../stores/clientRegistryStore';

interface KYCModalProps {
  onSubmit: (data: {
    legalName: string;
    phone: string;
    countryCode: string;
    country: string;
    city: string;
    classification: ClientClassification;
    customShippingMark: string;
  }) => void;
  onClose: () => void;
}

const CLASSIFICATIONS: ClientClassification[] = ['مصنع', 'تاجر جملة', 'تاجر تجزئة', 'مقاولات'];
const COUNTRY_CODES = [
  { code: '+963', label: 'سوريا', flag: '🇸🇾' },
  { code: '+90', label: 'تركيا', flag: '🇹🇷' },
  { code: '+86', label: 'الصين', flag: '🇨🇳' },
  { code: '+971', label: 'الإمارات', flag: '🇦🇪' },
  { code: '+966', label: 'السعودية', flag: '🇸🇦' },
  { code: '+20', label: 'مصر', flag: '🇪🇬' },
  { code: '+964', label: 'العراق', flag: '🇮🇶' },
  { code: '+961', label: 'لبنان', flag: '🇱🇧' },
  { code: '+970', label: 'فلسطين', flag: '🇵🇸' },
  { code: '+962', label: 'الأردن', flag: '🇯🇴' },
  { code: '+218', label: 'ليبيا', flag: '🇱🇾' },
  { code: '+213', label: 'الجزائر', flag: '🇩🇿' },
];

export default function KYCModal({ onSubmit, onClose }: KYCModalProps) {
  const [legalName, setLegalName] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+963');
  const [country, setCountry] = useState('سوريا');
  const [city, setCity] = useState('');
  const [classification, setClassification] = useState<ClientClassification | ''>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [shippingMarkEdited, setShippingMarkEdited] = useState(false);
  const [shippingMarkValue, setShippingMarkValue] = useState('');

  const previewShippingMark = useMemo(() => {
    if (!legalName.trim() || !country.trim()) return null;
    return generateShippingMark(country, legalName.trim());
  }, [legalName, country]);

  const effectiveShippingMark = previewShippingMark || '';

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!legalName.trim()) errs.legalName = 'الاسم التجاري القانوني مطلوب';
    if (!phone.trim()) errs.phone = 'رقم الهاتف الموثق مطلوب';
    else if (!/^\d{7,15}$/.test(phone.replace(/\s/g, ''))) errs.phone = 'رقم الهاتف غير صحيح';
    if (!country.trim()) errs.country = 'دولة العميل مطلوبة';
    if (!city.trim()) errs.city = 'مدينة العميل مطلوبة';
    if (!classification) errs.classification = 'تصنيف العميل مطلوب';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const finalMark = shippingMarkEdited ? shippingMarkValue.trim() : effectiveShippingMark;
    if (!finalMark) { setErrors((prev) => ({ ...prev, shippingMark: 'رمز الشحن مطلوب' })); return; }
    onSubmit({
      legalName: legalName.trim(),
      phone: phone.trim(),
      countryCode,
      country: country.trim(),
      city: city.trim(),
      classification: classification as ClientClassification,
      customShippingMark: finalMark,
    });
    setSubmitted(true);
    setTimeout(() => onClose(), 1500);
  };

  return (
    <div className="kyc-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="kyc-modal">
        <div className="kyc-modal-header">
          <div>
            <h3 className="kyc-modal-title">تسجيل عميل جديد — KYC</h3>
            <p className="kyc-modal-sub">جميع الحقول إجبارية لضمان جودة البيانات</p>
          </div>
          <button className="kyc-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {submitted ? (
          <div className="kyc-success">
            <div className="kyc-success-icon">✅</div>
            <div className="kyc-success-text">تم تسجيل العميل بنجاح</div>
            {shippingMarkEdited ? shippingMarkValue : effectiveShippingMark ? (
              <div className="kyc-shipping-mark-preview">
                <span className="kyc-sm-label">رمز الشحن:</span>
                <span className="kyc-sm-value">{shippingMarkEdited ? shippingMarkValue : effectiveShippingMark}</span>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="kyc-modal-body">
            <div className="kyc-field">
              <label className="kyc-label">الاسم التجاري القانوني للعميل <span className="req">*</span></label>
              <input className={`kyc-input ${errors.legalName ? 'error' : ''}`} type="text" value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="مثال: شركة الأهرام للتجارة" />
              {errors.legalName && <span className="kyc-error">{errors.legalName}</span>}
            </div>

            <div className="kyc-row">
              <div className="kyc-field">
                <label className="kyc-label">الدولة <span className="req">*</span></label>
                <select className={`kyc-input ${errors.country ? 'error' : ''}`} value={country} onChange={(e) => setCountry(e.target.value)}>
                  {COUNTRY_CODES.map((c) => <option key={c.code} value={c.label}>{c.flag} {c.label}</option>)}
                </select>
              </div>
              <div className="kyc-field">
                <label className="kyc-label">مدينة العميل <span className="req">*</span></label>
                <input className={`kyc-input ${errors.city ? 'error' : ''}`} type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="مثال: دمشق" />
                {errors.city && <span className="kyc-error">{errors.city}</span>}
              </div>
            </div>

            <div className="kyc-row">
              <div className="kyc-field">
                <label className="kyc-label">رمز الدولة <span className="req">*</span></label>
                <select className={`kyc-input ${errors.phone ? 'error' : ''}`} value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
                  {COUNTRY_CODES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.label} ({c.code})</option>)}
                </select>
              </div>
              <div className="kyc-field flex-2">
                <label className="kyc-label">رقم الهاتف الموثق <span className="req">*</span></label>
                <input className={`kyc-input ${errors.phone ? 'error' : ''}`} type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9XXXXXXXX" dir="ltr" />
                {errors.phone && <span className="kyc-error">{errors.phone}</span>}
              </div>
            </div>

            <div className="kyc-field">
              <label className="kyc-label">تصنيف العميل <span className="req">*</span></label>
              <div className="kyc-classification-grid">
                {CLASSIFICATIONS.map((c) => (
                  <button key={c} className={`kyc-class-btn ${classification === c ? 'selected' : ''}`} onClick={() => setClassification(c)}>
                    <span className="kyc-class-icon">
                      {c === 'مصنع' ? '🏭' : c === 'تاجر جملة' ? '📦' : c === 'تاجر تجزئة' ? '🏪' : '🔨'}
                    </span>
                    <span>{c}</span>
                  </button>
                ))}
              </div>
              {errors.classification && <span className="kyc-error">{errors.classification}</span>}
            </div>

            {effectiveShippingMark && (
              <div className="kyc-field">
                <label className="kyc-label">رمز الشحن المشفر (Shipping Mark) <span className="req">*</span></label>
                <div className="kyc-shipping-mark-bar">
                  <span className="kyc-sm-icon">🏷️</span>
                  <input
                    className="kyc-shipping-mark-input"
                    type="text"
                    value={shippingMarkEdited ? shippingMarkValue : effectiveShippingMark}
                    onChange={(e) => {
                      setShippingMarkEdited(true);
                      setShippingMarkValue(e.target.value);
                    }}
                    onFocus={() => {
                      if (!shippingMarkEdited) {
                        setShippingMarkValue(effectiveShippingMark);
                        setShippingMarkEdited(true);
                      }
                    }}
                    dir="ltr"
                    placeholder="SY&TA"
                  />
                </div>
                {errors.shippingMark && <span className="kyc-error">{errors.shippingMark}</span>}
                <span className="kyc-sm-hint">القيمة الافتراضية مولّدة تلقائياً — يمكنك تعديلها يدوياً</span>
              </div>
            )}
          </div>
        )}

        {!submitted && (
          <div className="kyc-modal-footer">
            <button className="kyc-btn-cancel" onClick={onClose}>إلغاء</button>
            <button className="kyc-btn-submit" onClick={handleSubmit}>تسجيل العميل</button>
          </div>
        )}
      </div>
    </div>
  );
}
