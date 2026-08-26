const START_MARKER = /\*{3}\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*{3}/i;
const END_MARKER = /\*{3}\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*{3}/i;

function candidateUrls(id: string): string[] {
  return [
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
    `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
    `https://www.gutenberg.org/files/${id}/${id}.txt`,
  ];
}

export async function fetchGutenbergText(id: string): Promise<string> {
  for (const url of candidateUrls(id)) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Storis/1.0 (+https://storis.in)" } });
      if (res.ok) return await res.text();
    } catch {
      // try next mirror URL
    }
  }
  throw new Error(`Could not fetch Gutenberg text for id ${id}`);
}

export function stripBoilerplate(raw: string): string {
  const startMatch = raw.match(START_MARKER);
  const endMatch = raw.match(END_MARKER);
  const start = startMatch ? (startMatch.index ?? 0) + startMatch[0].length : 0;
  const end = endMatch ? endMatch.index ?? raw.length : raw.length;
  return stripIllustrationTags(raw.slice(start, end).trim());
}

// Illustrated Gutenberg editions litter the text with "[Illustration: caption]"
// asides (sometimes spanning several lines) — strip them so excerpts read cleanly.
function stripIllustrationTags(text: string): string {
  // Allows one level of nested brackets (e.g. a "[_Copyright ..._]" credit inside the caption).
  return text.replace(/\[Illustration:?(?:[^[\]]|\[[^[\]]*\])*\]/gis, "").replace(/\n{3,}/g, "\n\n");
}

export function parseGutenbergTitleAuthor(raw: string): { title: string | null; author: string | null } {
  const head = raw.slice(0, 3000);
  const titleMatch = head.match(/^Title:\s*(.+)$/im);
  const authorMatch = head.match(/^Author:\s*(.+)$/im);
  return {
    title: titleMatch ? titleMatch[1].trim() : null,
    author: authorMatch ? authorMatch[1].trim() : null,
  };
}
