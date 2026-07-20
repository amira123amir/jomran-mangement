import React, { useMemo } from 'react';

interface SuccessModalProps {
  onClose: () => void;
  title: string;
  message: string;
  details: string;
}

export default function SuccessModal({ onClose, title, message, details }: SuccessModalProps) {
  const fullText = useMemo(() => {
    // Keep the same Arabic text the user expects.
    // Expected UI: "تم إرسال الطلب بنجاح — رقم الطلب: #1001 | رمز الشحن: SY&SA-1"
    // We receive message/details from caller, so we format them deterministically.
    return `تم إرسال الطلب بنجاح — رقم الطلب: ${message.replace(/^#/, '#')} | رمز الشحن: ${details}`;
  }, [message, details]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
    } catch {
      // Silent fallback (some browsers block clipboard without permissions).
    }
  };

  return (
    <div className="kyc-overlay" onClick={onClose}>
      <div
        className="kyc-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 560 }}
      >
        <div
          className="kyc-modal-header"
          style={{
            padding: '20px 26px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-hairline)',
          }}
        >
          <h3 className="kyc-modal-title">{title}</h3>
          <button className="kyc-close" onClick={onClose} aria-label="إغلاق">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* New modal layout: 2 lines + shipping chip + Copy button */}
        <div
          className="kyc-success"
          style={{
            padding: '36px 24px',
            gap: '12px',
          }}
        >
          <div className="kyc-success-icon" style={{ fontSize: 46 }}>
            ✅
          </div>

          <div
            className="kyc-success-text"
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: 'var(--accent-green)',
              textAlign: 'center',
              letterSpacing: '-0.01em',
            }}
          >
            تم إرسال الطلب بنجاح
          </div>

          <div
            style={{
              width: '100%',
              maxWidth: 420,
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-xl)',
              padding: '14px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              alignItems: 'stretch',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', fontWeight: 700 }}>
                رقم الطلب
              </div>
              <div
                className="kyc-sm-code"
                style={{
                  fontSize: 16,
                }}
              >
                {message.startsWith('#') ? message : `#${message}`}
              </div>
            </div>

            <div
              className="kyc-shipping-mark-preview"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', fontWeight: 700 }}>
                رمز الشحن
              </div>
              <span
                className="kyc-sm-value"
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: 'var(--accent-blue)',
                  background: 'var(--accent-blue-soft)',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.06em',
                }}
              >
                {details}
              </span>
            </div>

            <div
              style={{
                fontSize: 12.5,
                color: 'var(--text-secondary)',
                fontWeight: 600,
                lineHeight: 1.6,
                direction: 'rtl',
              }}
            >
              {fullText}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                className="kyc-btn-cancel"
                style={{
                  padding: '10px 18px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 800,
                }}
                onClick={handleCopy}
                type="button"
              >
                📋 نسخ
              </button>
              <button
                className="kyc-btn-submit"
                style={{
                  padding: '10px 18px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 800,
                }}
                onClick={onClose}
                type="button"
              >
                تم
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

