"use client";

import type { BookCard as BookCardType } from "@/lib/types";

const SG: React.CSSProperties = { fontFamily: "var(--font-space, 'Space Grotesk', sans-serif)" };

interface Props {
  book: { id: string; title: string; author: string | null; coverImageUrl: string | null };
  card: BookCardType;
  total: number;
}

export default function BookCard({ book, card, total }: Props) {
  if (card.kind === "text") return <TextCard book={book} card={card} total={total} />;
  return <SummaryCard book={book} card={card} total={total} />;
}

// Full-bleed cover image + gradient overlay — the addictive, TikTok-recap style
// treatment for AI-summarized cards, matching StoryReader's article-card language.
function SummaryCard({ book, card, total }: Props) {
  const img = book.coverImageUrl || `https://picsum.photos/seed/${book.id}/800/1200`;

  return (
    <div style={{ height: "100dvh", scrollSnapAlign: "start", scrollSnapStop: "always", position: "relative", flexShrink: 0, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${img})`, backgroundSize: "cover", backgroundPosition: "center" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.1) 22%, rgba(0,0,0,0.55) 48%, rgba(0,0,0,0.92) 70%, rgba(0,0,0,0.98) 100%)" }} />

      {/* Top bar — extra top padding clears the floating back button / sign-in pill in BookReader */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, padding: "calc(env(safe-area-inset-top, 0px) + 60px) 22px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {card.chapterLabel ? (
          <span style={{ ...SG, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(255,255,255,0.92)", background: "rgba(255,255,255,0.14)", padding: "5px 12px", borderRadius: 999, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}>
            {card.chapterLabel}
          </span>
        ) : <span />}
        <span style={{ ...SG, fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", color: "#fff", background: "rgba(34,197,94,0.85)", padding: "4px 10px", borderRadius: 999, backdropFilter: "blur(8px)" }}>
          AI SUMMARY
        </span>
      </div>

      {/* Bottom content */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 10, padding: "0 22px calc(env(safe-area-inset-bottom, 0px) + 108px)" }}>
        <p style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.55)", margin: "0 0 8px", textShadow: "0 1px 5px rgba(0,0,0,0.9)" }}>
          {book.title}{book.author ? ` · ${book.author}` : ""}
        </p>

        <h2 style={{ ...SG, fontSize: "clamp(22px,5.8vw,32px)", fontWeight: 800, color: "#fff", lineHeight: 1.1, letterSpacing: "-0.02em", margin: "0 0 16px", textShadow: "0 2px 16px rgba(0,0,0,0.85)" }}>
          {card.headline}
        </h2>

        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
          {(card.bullets ?? []).map((b, i) => (
            <li key={i} style={{ display: "flex", gap: 10, color: "rgba(255,255,255,0.92)", fontSize: "clamp(14px,3.6vw,16px)", lineHeight: 1.55, textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}>
              <span style={{ color: "rgba(255,255,255,0.5)", flexShrink: 0 }}>—</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.15)" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>{card.readTime} read</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{card.cardIndex + 1} / {total}</span>
        </div>
      </div>
    </div>
  );
}

// Plain reading treatment for literal book text — used by the "full text" mode.
function TextCard({ book, card, total }: Props) {
  return (
    <div style={{ height: "100dvh", scrollSnapAlign: "start", scrollSnapStop: "always", position: "relative", flexShrink: 0, display: "flex", flexDirection: "column", background: "var(--lp-bg)", boxSizing: "border-box" }}>
      <div style={{ flexShrink: 0, padding: "calc(env(safe-area-inset-top, 0px) + 60px) 20px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        {card.chapterLabel && (
          <span style={{ ...SG, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--lp-accent)", background: "color-mix(in srgb, var(--lp-accent) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--lp-accent) 25%, transparent)", padding: "5px 12px", borderRadius: 999, alignSelf: "flex-start" }}>
            {card.chapterLabel}
          </span>
        )}
        <span style={{ fontSize: 12, color: "var(--lp-text3)", fontWeight: 500 }}>{card.cardIndex + 1} / {total}</span>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "24px 26px", overflow: "hidden" }}>
        <p style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(18px, 4.6vw, 24px)", lineHeight: 1.65, color: "var(--lp-text)", margin: 0, whiteSpace: "pre-wrap" }}>
          {card.excerpt}
        </p>
      </div>

      <div style={{ flexShrink: 0, padding: "0 20px calc(env(safe-area-inset-bottom, 0px) + 100px)", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--lp-border)", paddingTop: 12 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--lp-text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>
          {book.title}{book.author ? ` · ${book.author}` : ""}
        </span>
        {card.readTime && <span style={{ fontSize: 12, color: "var(--lp-text3)" }}>{card.readTime}</span>}
      </div>
    </div>
  );
}
