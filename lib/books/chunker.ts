const CHAPTER_HEADING = /^\s*(chapter|part|book)\s+([ivxlcdm]+|\d+)\b.*$/im;

interface RawChapter {
  chapterLabel: string | null;
  text: string;
}

// Normalizes "Chapter I.]", "CHAPTER I.", "chapter 1 —" etc. down to a style key
// so a "List of Illustrations"/ToC using one heading style doesn't get mixed in
// with the book's real chapter headings, which are usually styled consistently.
function headingStyle(line: string): string {
  const keyword = (line.match(/chapter|part|book/i) ?? [""])[0].toLowerCase();
  const isUpper = keyword && keyword === keyword.toUpperCase() ? "" : (line === line.toUpperCase() ? "upper" : "mixed");
  return `${keyword}:${isUpper}`;
}

function splitIntoChapters(text: string): RawChapter[] {
  const lines = text.split("\n");
  const allMatches: { line: number; label: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length > 0 && line.length < 80 && CHAPTER_HEADING.test(line)) {
      allMatches.push({ line: i, label: line });
    }
  }

  // Keep only headings matching the most common style — filters out stray
  // matches from a table of contents/list of illustrations using a different casing.
  const styleCounts = new Map<string, number>();
  for (const m of allMatches) styleCounts.set(headingStyle(m.label), (styleCounts.get(headingStyle(m.label)) ?? 0) + 1);
  let dominantStyle = "";
  let dominantCount = 0;
  for (const [style, count] of styleCounts) if (count > dominantCount) { dominantStyle = style; dominantCount = count; }
  const headingIdx = allMatches.filter((m) => headingStyle(m.label) === dominantStyle);

  // Require a handful of headings before trusting them as real chapter breaks —
  // a single stray match is more likely a false positive than real structure.
  if (headingIdx.length < 3) {
    return [{ chapterLabel: null, text: text.trim() }];
  }

  const chapters: RawChapter[] = [];

  // Never silently drop text before the first surviving heading — a book's
  // opening chapter sometimes uses a heading style that didn't win the dominant
  // vote (or has none at all), so its content must still make it into a card.
  const leading = lines.slice(0, headingIdx[0].line).join("\n").trim();
  if (leading) chapters.push({ chapterLabel: null, text: leading });

  for (let i = 0; i < headingIdx.length; i++) {
    const start = headingIdx[i].line + 1;
    const end = i + 1 < headingIdx.length ? headingIdx[i + 1].line : lines.length;
    const body = lines.slice(start, end).join("\n").trim();
    if (body) chapters.push({ chapterLabel: headingIdx[i].label, text: body });
  }
  return chapters;
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function splitLongParagraph(paragraph: string, maxWords: number): string[] {
  const sentences = paragraph.match(/[^.!?]+[.!?]+(\s+|$)/g) ?? [paragraph];
  const out: string[] = [];
  let current = "";
  let currentWords = 0;
  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/).length;
    if (currentWords > 0 && currentWords + words > maxWords) {
      out.push(current.trim());
      current = sentence;
      currentWords = words;
    } else {
      current += sentence;
      currentWords += words;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

export function estimateReadTime(excerpt: string): string {
  const seconds = Math.max(10, Math.round((wordCount(excerpt) / 200) * 60));
  return `${seconds}s`;
}

export interface ChunkedCard {
  chapterLabel: string | null;
  excerpt: string;
}

export function chunkText(text: string, opts: { minWords?: number; maxWords?: number } = {}): ChunkedCard[] {
  const minWords = opts.minWords ?? 70;
  const maxWords = opts.maxWords ?? 130;

  const chapters = splitIntoChapters(text);
  const cards: ChunkedCard[] = [];

  for (const chapter of chapters) {
    const paragraphs = splitIntoParagraphs(chapter.text);
    let current: string[] = [];
    let currentWords = 0;

    const flush = () => {
      if (current.length === 0) return;
      cards.push({ chapterLabel: chapter.chapterLabel, excerpt: current.join("\n\n") });
      current = [];
      currentWords = 0;
    };

    for (const paragraph of paragraphs) {
      const words = wordCount(paragraph);

      if (words > maxWords * 1.5) {
        flush();
        for (const piece of splitLongParagraph(paragraph, maxWords)) {
          cards.push({ chapterLabel: chapter.chapterLabel, excerpt: piece });
        }
        continue;
      }

      if (currentWords > 0 && currentWords + words > maxWords) {
        if (currentWords >= minWords) {
          flush();
        } else {
          current.push(paragraph);
          currentWords += words;
          flush();
          continue;
        }
      }

      current.push(paragraph);
      currentWords += words;
    }
    flush();
  }

  return cards;
}
