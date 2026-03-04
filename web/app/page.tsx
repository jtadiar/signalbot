import Link from "next/link";

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35 }}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export default function Home() {
  return (
    <div
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(ellipse at 50% 0%, #1a1a1f 0%, #0a0a0c 50%, #000 100%)",
        color: "#fff",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Noise texture */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          opacity: 0.025,
          pointerEvents: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "200px",
        }}
      />

      <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
        <h1
          style={{
            fontSize: "clamp(3rem, 10vw, 7rem)",
            fontWeight: 900,
            letterSpacing: "-0.03em",
            lineHeight: 1,
            background: "linear-gradient(180deg, #e8e8ee 0%, #c0c0c8 15%, #f5f5f7 30%, #8a8a95 50%, #b8b8c2 65%, #d5d5db 80%, #9a9aa5 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter: "drop-shadow(0 2px 8px rgba(255,255,255,0.06))",
            marginBottom: "0.15em",
          }}
        >
          C13
        </h1>
        <p
          style={{
            fontSize: "clamp(1rem, 3vw, 1.6rem)",
            fontWeight: 900,
            letterSpacing: "0.35em",
            textTransform: "uppercase",
            background: "linear-gradient(180deg, #b0b0b8 0%, #7a7a85 50%, #a0a0aa 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            marginBottom: "4rem",
          }}
        >
          Studios
        </p>

        <div style={{ display: "flex", gap: "1.25rem", justifyContent: "center", flexWrap: "wrap", padding: "0 1rem" }}>
          <Link
            href="/signalbot"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.65rem",
              width: 200,
              height: 56,
              borderRadius: 14,
              fontSize: "0.9rem",
              fontWeight: 700,
              letterSpacing: "0.04em",
              textDecoration: "none",
              background: "linear-gradient(135deg, #18181c 0%, #222228 100%)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#fff",
              boxShadow: "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#10b981",
                boxShadow: "0 0 8px rgba(16,185,129,0.5)",
                animation: "pulse 2.5s ease-in-out infinite",
              }}
            />
            Signalbot
          </Link>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.65rem",
              width: 200,
              height: 56,
              borderRadius: 14,
              fontSize: "0.9rem",
              fontWeight: 700,
              letterSpacing: "0.04em",
              background: "linear-gradient(135deg, #111114 0%, #18181c 100%)",
              border: "1px solid rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.2)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
            }}
          >
            <LockIcon />
            Coming Soon
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.65rem",
              width: 200,
              height: 56,
              borderRadius: 14,
              fontSize: "0.9rem",
              fontWeight: 700,
              letterSpacing: "0.04em",
              background: "linear-gradient(135deg, #111114 0%, #18181c 100%)",
              border: "1px solid rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.2)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
            }}
          >
            <LockIcon />
            Coming Soon
          </div>
        </div>
      </div>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
}
