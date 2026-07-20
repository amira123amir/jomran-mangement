export default function Loading() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontFamily: "var(--font-arabic)",
        color: "var(--text-secondary)",
        fontSize: 18,
        gap: 12,
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          border: "3px solid var(--border-secondary)",
          borderTopColor: "var(--accent-blue)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <span>جاري التحميل...</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
