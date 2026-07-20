import Link from "next/link";

export default function NotFound() {
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
      }}
    >
      <h1 style={{ fontSize: 64, margin: 0, color: "var(--text-primary)" }}>
        404
      </h1>
      <p style={{ fontSize: 18, color: "var(--text-secondary)", margin: 0 }}>
        الصفحة غير موجودة
      </p>
      <Link
        href="/"
        style={{
          padding: "10px 24px",
          background: "var(--accent-blue)",
          color: "white",
          borderRadius: "var(--radius-md)",
          textDecoration: "none",
          fontSize: 14,
        }}
      >
        العودة إلى لوحة التحكم
      </Link>
    </div>
  );
}
