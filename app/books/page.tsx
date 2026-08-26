"use client";

import useSWR from "swr";
import BottomNav from "@/components/BottomNav";
import type { Book, BookProgress } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const SG: React.CSSProperties = { fontFamily: "var(--font-space, 'Space Grotesk', sans-serif)" };

function BookCoverArt({ book }: { book: Pick<Book, "id" | "coverImageUrl"> }) {
  const img = book.coverImageUrl || `https://picsum.photos/seed/${book.id}/400/560`;
  return <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${img})`, backgroundSize: "cover", backgroundPosition: "center" }} />;
}

function ContinueReadingRail({ items }: { items: (BookProgress & { book: Book })[] }) {
  if (items.length === 0) return null;
  return (
    <div style={{ padding: "0 0 24px" }}>
      <p style={{ ...SG, fontSize: 13, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--lp-text3)", margin: "0 20px 12px" }}>
        Continue reading
      </p>
      <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "0 20px", scrollbarWidth: "none" }}>
        {items.map((item) => {
          const pct = Math.min(100, Math.round(((item.currentCardIndex + 1) / Math.max(1, item.book.totalCards)) * 100));
          return (
            <a key={item.bookId} href={`/books/${item.bookId}`} style={{ flexShrink: 0, width: 140, textDecoration: "none" }}>
              <div style={{ position: "relative", width: 140, height: 196, borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 24px -8px rgba(0,0,0,0.22)" }}>
                <BookCoverArt book={item.book} />
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, background: "rgba(0,0,0,0.3)" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: "var(--lp-accent)" }} />
                </div>
              </div>
              <p style={{ ...SG, fontSize: 12.5, fontWeight: 600, color: "var(--lp-text)", margin: "8px 0 0", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                {item.book.title}
              </p>
            </a>
          );
        })}
      </div>
    </div>
  );
}

function BookRow({ book }: { book: Book }) {
  return (
    <a
      href={`/books/${book.id}`}
      style={{ textDecoration: "none", display: "flex", gap: 14, alignItems: "center", padding: "10px 20px" }}
    >
      <div style={{ position: "relative", width: 56, height: 78, borderRadius: 8, overflow: "hidden", flexShrink: 0, boxShadow: "0 4px 12px -4px rgba(0,0,0,0.25)" }}>
        <BookCoverArt book={book} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ ...SG, fontSize: 15, fontWeight: 700, color: "var(--lp-text)", margin: "0 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {book.title}
        </p>
        <p style={{ fontSize: 12.5, color: "var(--lp-text3)", margin: 0 }}>
          {book.author ?? "Unknown author"} · {book.totalCards} cards
          {book.sourceType === "ai-summary" && " · AI summary"}
        </p>
      </div>
    </a>
  );
}

export default function BooksPage() {
  const { data: books } = useSWR<Book[]>("/api/books", fetcher);
  const { data: library } = useSWR<(BookProgress & { book: Book })[]>("/api/books/library", fetcher);

  return (
    <div style={{ minHeight: "100vh", background: "var(--lp-bg)", paddingBottom: "calc(90px + env(safe-area-inset-bottom, 0px))" }}>
      <nav style={{ position: "sticky", top: 0, zIndex: 30, backdropFilter: "var(--lp-glass-blur)", WebkitBackdropFilter: "var(--lp-glass-blur)", background: "var(--lp-glass-nav)", borderBottom: "1px solid var(--lp-glass-border)" }}>
        <div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 16px) 20px 14px" }}>
          <h1 style={{ ...SG, fontSize: 22, fontWeight: 800, color: "var(--lp-text)", margin: 0, letterSpacing: "-0.02em" }}>Books</h1>
          <p style={{ fontSize: 13, color: "var(--lp-text2)", margin: "4px 0 0" }}>Real books, one bite-sized card at a time.</p>
        </div>
      </nav>

      <div style={{ padding: "20px 0 0" }}>
        {library && <ContinueReadingRail items={library} />}

        <p style={{ ...SG, fontSize: 13, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--lp-text3)", margin: "0 20px 6px" }}>
          Catalog
        </p>

        {books === undefined ? (
          <div style={{ padding: "20px" }}>
            {[0, 1, 2].map((i) => <div key={i} style={{ height: 78, borderRadius: 12, background: "var(--lp-surface)", marginBottom: 12 }} />)}
          </div>
        ) : books.length === 0 ? (
          <div style={{ padding: "40px 32px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
            <p style={{ fontSize: 14, color: "var(--lp-text2)", margin: 0 }}>No books in the catalog yet.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {books.map((book) => <BookRow key={book.id} book={book} />)}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
