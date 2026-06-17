export const runtime = "nodejs";

import { ImageResponse } from "next/og";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "linear-gradient(145deg, #004C97 0%, #002D62 50%, #001025 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "flex-end",
          padding: "0 72px 60px",
          position: "relative",
          overflow: "hidden",
          fontFamily: "sans-serif",
        }}
      >
        {/* Gold glow circle top-right */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -80,
            width: 480,
            height: 480,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(245,197,24,0.18) 0%, rgba(245,197,24,0) 70%)",
            display: "flex",
          }}
        />

        {/* Blue shimmer left */}
        <div
          style={{
            position: "absolute",
            bottom: -80,
            left: -60,
            width: 320,
            height: 320,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0,100,220,0.25) 0%, rgba(0,100,220,0) 70%)",
            display: "flex",
          }}
        />

        {/* Big trophy emoji */}
        <div
          style={{
            position: "absolute",
            top: 48,
            right: 72,
            fontSize: 180,
            lineHeight: 1,
            opacity: 0.35,
            display: "flex",
          }}
        >
          🏆
        </div>

        {/* Ball pattern dots */}
        <div
          style={{
            position: "absolute",
            top: 220,
            right: 180,
            fontSize: 80,
            lineHeight: 1,
            opacity: 0.15,
            display: "flex",
          }}
        >
          ⚽
        </div>

        {/* STORIS wordmark */}
        <div
          style={{
            position: "absolute",
            top: 52,
            left: 72,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: "#7c5cfc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ color: "#fff", fontSize: 18, fontWeight: 900 }}>S</span>
          </div>
          <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 20, fontWeight: 700, letterSpacing: "0.06em" }}>
            STORIS
          </span>
        </div>

        {/* Main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {/* Label */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 18,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#e53e3e",
                display: "flex",
              }}
            />
            <span
              style={{
                color: "#F5C518",
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              LIVE NOW · FIFA WORLD CUP 2026
            </span>
          </div>

          {/* Big headline */}
          <div
            style={{
              color: "#ffffff",
              fontSize: 72,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              marginBottom: 20,
              display: "flex",
              maxWidth: 760,
            }}
          >
            USA · Canada · Mexico
          </div>

          {/* Sub-line */}
          <div
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 24,
              fontWeight: 500,
              letterSpacing: "0.01em",
              marginBottom: 36,
              display: "flex",
            }}
          >
            Jun 12 – Jul 19, 2026 · 48 nations · 104 matches
          </div>

          {/* Feature pills */}
          <div style={{ display: "flex", gap: 12 }}>
            {["Live Scores", "AI Recaps", "Lineup Predictions", "Standings"].map((label) => (
              <div
                key={label}
                style={{
                  padding: "8px 18px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "rgba(255,255,255,0.75)",
                  fontSize: 16,
                  fontWeight: 600,
                  display: "flex",
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
