export const runtime = "nodejs";

import { createBook, insertBookCards, markBookError } from "@/lib/db";
import { fetchGutenbergText, stripBoilerplate, parseGutenbergTitleAuthor } from "@/lib/books/gutenberg";
import { chunkText, estimateReadTime } from "@/lib/books/chunker";
import type { BookCard } from "@/lib/types";

// Ingests a public-domain book from Project Gutenberg into the shared catalog.
// AI-summary and upload sources have their own dedicated endpoints.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { gutenbergId, category, coverImageUrl, title: titleOverride, author: authorOverride } = body ?? {};

  if (!gutenbergId || typeof gutenbergId !== "string") {
    return Response.json({ error: "gutenbergId is required" }, { status: 400 });
  }

  let bookId: string | null = null;
  try {
    const raw = await fetchGutenbergText(gutenbergId);
    const { title: parsedTitle, author: parsedAuthor } = parseGutenbergTitleAuthor(raw);
    const text = stripBoilerplate(raw);
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      return Response.json({ error: "No readable content found in this Gutenberg text" }, { status: 422 });
    }

    bookId = await createBook({
      title: titleOverride ?? parsedTitle ?? `Gutenberg #${gutenbergId}`,
      author: authorOverride ?? parsedAuthor,
      sourceType: "gutenberg",
      sourceRef: gutenbergId,
      coverImageUrl: coverImageUrl ?? null,
      category: category ?? null,
    });

    const cards: Omit<BookCard, "cardIndex">[] = chunks.map((c) => ({
      chapterLabel: c.chapterLabel,
      kind: "text",
      headline: null,
      excerpt: c.excerpt,
      readTime: estimateReadTime(c.excerpt),
    }));

    await insertBookCards(bookId, cards);

    return Response.json({ id: bookId, totalCards: cards.length });
  } catch (err) {
    if (bookId) await markBookError(bookId).catch(() => {});
    return Response.json({ error: err instanceof Error ? err.message : "Ingestion failed" }, { status: 500 });
  }
}
