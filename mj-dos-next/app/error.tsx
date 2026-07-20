"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontFamily: "var(--font-arabic)",
        gap: 16,
        padding: 32,
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: 48, margin: 0, color: "var(--accent-red)" }}>
        حدث خطأ
      </h1>
      <p style={{ fontSize: 16, color: "var(--text-secondary)", margin: 0, maxWidth: 500 }}>
        {error.message || "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى."}
      </p>
      <button
        onClick={reset}
        style={{
          padding: "10px 24px",
          background: "var(--accent-blue)",
          color: "white",
          border: "none",
          borderRadius: "var(--radius-md)",
          cursor: "pointer",
          fontSize: 14,
        }}
      >
        إعادة المحاولة
      </button>
    </div>
  );
}
