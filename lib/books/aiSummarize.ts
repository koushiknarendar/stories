import Anthropic from "@anthropic-ai/sdk";
import { BOOK_CHAPTER_SUMMARY_SYSTEM, buildBookChapterSummaryUser } from "@/lib/cardPrompt";
import type { RawChapter } from "./chunker";
import type { BookCard } from "@/lib/types";

const CARDS_PER_BATCH = 2;

function batchChapters(chapters: RawChapter[], targetCards: number): RawChapter[][] {
  const targetBatches = Math.max(1, Math.round(targetCards / CARDS_PER_BATCH));
  const groupSize = Math.max(1, Math.ceil(chapters.length / targetBatches));
  const batches: RawChapter[][] = [];
  for (let i = 0; i < chapters.length; i += groupSize) batches.push(chapters.slice(i, i + groupSize));
  return batches;
}

function labelForBatch(batch: RawChapter[]): string | null {
  const labels = batch.map((c) => c.chapterLabel).filter((l): l is string => Boolean(l));
  if (labels.length === 0) return null;
  if (labels.length === 1) return labels[0];
  return `${labels[0]} – ${labels[labels.length - 1]}`;
}

interface BatchResult {
  cards: Omit<BookCard, "cardIndex">[];
  error?: string;
}

async function summarizeBatch(
  client: Anthropic,
  batch: RawChapter[],
  bookTitle: string,
  author: string | null
): Promise<BatchResult> {
  const label = labelForBatch(batch);
  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: [{ type: "text", text: BOOK_CHAPTER_SUMMARY_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildBookChapterSummaryUser(batch, bookTitle, author) }],
    });
    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return { cards: [], error: "Model response contained no JSON array" };

    const parsed = JSON.parse(match[0]) as { headline: string; bullets: string[]; readTime?: string }[];
    const cards = parsed
      .filter((c) => c.headline && Array.isArray(c.bullets))
      .map((c) => ({ chapterLabel: label, kind: "summary" as const, headline: c.headline, bullets: c.bullets, readTime: c.readTime ?? "15s" }));
    return { cards };
  } catch (err) {
    // Skip a failed batch rather than failing the whole ingest — a gap in
    // coverage is better than losing the entire book. The caller surfaces the
    // last error when EVERY batch fails, so this doesn't fail silently.
    return { cards: [], error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// Summarizes a book into addictive story cards, grounded in its real chapter
// text (not just what the model already "knows" about the book). Batches run
// with limited concurrency to keep ingestion inside serverless time limits.
export async function summarizeBookFromChapters(
  chapters: RawChapter[],
  bookTitle: string,
  author: string | null,
  targetCards = 26
): Promise<{ cards: Omit<BookCard, "cardIndex">[]; lastError: string | null }> {
  const client = new Anthropic();
  const batches = batchChapters(chapters, targetCards);
  const CONCURRENCY = 5;
  const results: BatchResult[] = new Array(batches.length);

  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const slice = batches.slice(i, i + CONCURRENCY);
    const settled = await Promise.all(slice.map((batch) => summarizeBatch(client, batch, bookTitle, author)));
    settled.forEach((result, j) => { results[i + j] = result; });
  }

  const lastError = [...results].reverse().find((r) => r.error)?.error ?? null;
  return { cards: results.flatMap((r) => r.cards), lastError };
}
