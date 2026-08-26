"use client";

import type { BookCard as BookCardType } from "@/lib/types";

const SG: React.CSSProperties = { fontFamily: "var(--font-space, 'Space Grotesk', sans-serif)" };

interface Props {
  book: { title: string; author: string | null };
  card: BookCardType;
  total: number;
}

export default function BookCard({ book, card, total }: Props) {
  return (
    <div
      style={{
        height: "100dvh",
        scrollSnapAlign: "start",
        scrollSnapStop: "always",
        position: "relative",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--lp-bg)",
        boxSizing: "border-box",
      }}
    >
      {/* Top bar — extra top padding clears the floating back button / sign-in pill in BookReader */}
      <div style={{ flexShrink: 0, padding: "calc(env(safe-area-inset-top, 0px) + 60px) 20px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {card.chapterLabel ? (
            <span style={{ ...SG, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--lp-accent)", background: "color-mix(in srgb, var(--lp-accent) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--lp-accent) 25%, transparent)", padding: "5px 12px", borderRadius: 999 }}>
              {card.chapterLabel}
            </span>
          ) : <span />}
          {card.kind === "summary" && (
            <span style={{ ...SG, fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", color: "#fff", background: "#22c55e", padding: "4px 10px", borderRadius: 999 }}>
              AI SUMMARY
            </span>
          )}
        </div>
        <span style={{ fontSize: 12, color: "var(--lp-text3)", fontWeight: 500 }}>
          {card.cardIndex + 1} / {total}
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "24px 26px", overflow: "hidden" }}>
        {card.kind === "text" ? (
          <p style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "clamp(18px, 4.6vw, 24px)",
            lineHeight: 1.65,
            color: "var(--lp-text)",
            margin: 0,
            whiteSpace: "pre-wrap",
          }}>
            {card.excerpt}
          </p>
        ) : (
          <div>
            <h2 style={{ ...SG, fontSize: "clamp(22px,5.5vw,30px)", fontWeight: 800, color: "var(--lp-text)", lineHeight: 1.1, letterSpacing: "-0.02em", margin: "0 0 18px" }}>
              {card.headline}
            </h2>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
              {(card.bullets ?? []).map((b, i) => (
                <li key={i} style={{ display: "flex", gap: 10, color: "var(--lp-text2)", fontSize: "clamp(14px,3.4vw,16px)", lineHeight: 1.55 }}>
                  <span style={{ color: "var(--lp-accent)", flexShrink: 0 }}>—</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div style={{ flexShrink: 0, padding: "0 20px calc(env(safe-area-inset-bottom, 0px) + 100px)", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--lp-border)", paddingTop: 12 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--lp-text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>
          {book.title}{book.author ? ` · ${book.author}` : ""}
        </span>
        {card.readTime && <span style={{ fontSize: 12, color: "var(--lp-text3)" }}>{card.readTime}</span>}
      </div>
    </div>
  );
}
