export const runtime = "nodejs";
export const maxDuration = 300;

import { createBook, insertBookCards, markBookError } from "@/lib/db";
import { fetchGutenbergText, stripBoilerplate, parseGutenbergTitleAuthor, gutenbergCoverUrl } from "@/lib/books/gutenberg";
import { chunkText, estimateReadTime, splitIntoChapters } from "@/lib/books/chunker";
import { summarizeBookFromChapters } from "@/lib/books/aiSummarize";
import type { BookCard } from "@/lib/types";

// Ingests a public-domain book from Project Gutenberg into the shared catalog.
// mode "summary" (default) produces an AI-condensed, addictive set of story
// cards grounded in the real chapter text — mode "full" keeps the literal,
// paragraph-chunked text (useful later for a "read the original" option, but
// far too many cards to be anyone's daily habit on its own).
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { gutenbergId, category, coverImageUrl, title: titleOverride, author: authorOverride, mode = "summary", targetCards } = body ?? {};

  if (!gutenbergId || typeof gutenbergId !== "string") {
    return Response.json({ error: "gutenbergId is required" }, { status: 400 });
  }

  let bookId: string | null = null;
  try {
    const raw = await fetchGutenbergText(gutenbergId);
    const { title: parsedTitle, author: parsedAuthor } = parseGutenbergTitleAuthor(raw);
    const text = stripBoilerplate(raw);
    const title = titleOverride ?? parsedTitle ?? `Gutenberg #${gutenbergId}`;
    const author = authorOverride ?? parsedAuthor;
    const cover = coverImageUrl ?? gutenbergCoverUrl(gutenbergId);

    let cards: Omit<BookCard, "cardIndex">[];
    let sourceType: "gutenberg" | "ai-summary";

    if (mode === "full") {
      const chunks = chunkText(text);
      if (chunks.length === 0) {
        return Response.json({ error: "No readable content found in this Gutenberg text" }, { status: 422 });
      }
      cards = chunks.map((c) => ({ chapterLabel: c.chapterLabel, kind: "text", headline: null, excerpt: c.excerpt, readTime: estimateReadTime(c.excerpt) }));
      sourceType = "gutenberg";
    } else {
      const chapters = splitIntoChapters(text);
      const result = await summarizeBookFromChapters(chapters, title, author, typeof targetCards === "number" ? targetCards : 26);
      cards = result.cards;
      if (cards.length === 0) {
        return Response.json({ error: `AI summarization produced no cards${result.lastError ? `: ${result.lastError}` : ""}` }, { status: 502 });
      }
      sourceType = "ai-summary";
    }

    bookId = await createBook({ title, author, sourceType, sourceRef: gutenbergId, coverImageUrl: cover, category: category ?? null });
    await insertBookCards(bookId, cards);

    return Response.json({ id: bookId, totalCards: cards.length });
  } catch (err) {
    if (bookId) await markBookError(bookId).catch(() => {});
    return Response.json({ error: err instanceof Error ? err.message : "Ingestion failed" }, { status: 500 });
  }
}
