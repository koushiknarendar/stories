"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useUser, SignInButton } from "@clerk/nextjs";
import BookCard from "@/components/BookCard";
import BottomNav from "@/components/BottomNav";
import type { BookWithCards } from "@/lib/types";

const SG: React.CSSProperties = { fontFamily: "var(--font-space, 'Space Grotesk', sans-serif)" };
const SAVE_DEBOUNCE_MS = 900;

interface Props {
  book: BookWithCards;
  initialCardIndex?: number;
}

export default function BookReader({ book, initialCardIndex = 0 }: Props) {
  const { isLoaded, isSignedIn } = useUser();
  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasScrolledToStart = useRef(false);
  const [activeIndex, setActiveIndex] = useState(Math.min(initialCardIndex, book.cards.length - 1));

  const total = book.cards.length;

  const saveProgress = useCallback((index: number) => {
    if (!isSignedIn) return;
    fetch(`/api/books/${book.id}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardIndex: index, completed: index >= total - 1 }),
    }).catch(() => {});
  }, [book.id, isSignedIn, total]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || hasScrolledToStart.current || initialCardIndex <= 0) return;
    hasScrolledToStart.current = true;
    el.scrollTo({ top: initialCardIndex * el.clientHeight, behavior: "instant" as ScrollBehavior });
  }, [initialCardIndex]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const index = Math.min(Math.round(el.scrollTop / el.clientHeight), total - 1);
    setActiveIndex((prev) => (prev !== index ? index : prev));

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveProgress(index), SAVE_DEBOUNCE_MS);
  }

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  return (
    <div style={{ position: "relative", height: "100dvh", background: "var(--lp-bg)" }}>
      {/* Overall progress */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, zIndex: 20, background: "var(--lp-border)" }}>
        <div style={{ height: "100%", width: `${Math.min(100, ((activeIndex + 1) / total) * 100)}%`, background: "var(--lp-accent)", transition: "width .2s ease" }} />
      </div>

      <a
        href="/books"
        style={{ position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 14px)", left: 14, zIndex: 20, width: 34, height: 34, borderRadius: "50%", background: "var(--lp-glass-surface)", border: "1px solid var(--lp-glass-border)", backdropFilter: "var(--lp-glass-blur)", WebkitBackdropFilter: "var(--lp-glass-blur)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--lp-text)", textDecoration: "none" }}
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      </a>

      {isLoaded && !isSignedIn && (
        <div style={{ position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 14px)", right: 14, zIndex: 20 }}>
          <SignInButton mode="modal">
            <button style={{ ...SG, padding: "8px 14px", borderRadius: 999, border: "1px solid var(--lp-glass-border)", background: "var(--lp-glass-surface)", backdropFilter: "var(--lp-glass-blur)", WebkitBackdropFilter: "var(--lp-glass-blur)", color: "var(--lp-text)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Sign in to save progress
            </button>
          </SignInButton>
        </div>
      )}

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="feed-snap"
        style={{ height: "100dvh", overflowY: "scroll", scrollSnapType: "y mandatory", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
      >
        {book.cards.map((card) => (
          <BookCard key={card.cardIndex} book={book} card={card} total={total} />
        ))}

        {/* End of book */}
        <div style={{ height: "100dvh", scrollSnapAlign: "start", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "0 32px", textAlign: "center", background: "var(--lp-bg)" }}>
          <div style={{ fontSize: 40 }}>📖</div>
          <p style={{ ...SG, fontSize: 18, fontWeight: 700, color: "var(--lp-text)", margin: 0 }}>
            {book.sourceType === "ai-summary" ? "That's the whole story, in cards" : "You've reached the end"}
          </p>
          <a href="/books" style={{ ...SG, marginTop: 8, padding: "12px 26px", borderRadius: 12, background: "var(--lp-accent)", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
            Find another book
          </a>
        </div>
      </div>

      {isSignedIn && <BottomNav />}
    </div>
  );
}
