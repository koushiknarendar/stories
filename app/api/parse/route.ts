export const runtime = "nodejs";

function parseDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try { const d = new Date(raw.trim()); return isNaN(d.getTime()) ? null : d.toISOString(); } catch { return null; }
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    return handlePdf(request);
  }

  const body = await request.json();
  if (body.url) {
    return handleUrl(body.url as string);
  }
  if (body.text) {
    return Response.json({ text: body.text, title: "Pasted text", source: "text" });
  }

  return Response.json({ error: "Provide url, text, or a PDF file" }, { status: 400 });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toAbsoluteUrl(base: string, href: string | undefined): string | null {
  if (!href) return null;
  try { return new URL(href, base).href; } catch { return null; }
}

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const { load } = await import("cheerio");
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = load(html);
    const raw =
      $("meta[property='og:image']").attr("content") ||
      $("meta[name='twitter:image:src']").attr("content") ||
      $("meta[name='twitter:image']").attr("content");
    return toAbsoluteUrl(url, raw);
  } catch {
    return null;
  }
}

async function fetchViaJina(url: string): Promise<{ title: string; text: string; publishedAt: string | null } | null> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { "X-Return-Format": "markdown" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const raw = await res.text();
    const titleMatch = raw.match(/^Title:\s*(.+)/m);
    const title = titleMatch?.[1]?.trim() || new URL(url).hostname;
    const pubMatch = raw.match(/^Published Time:\s*(.+)/m);
    const publishedAt = parseDate(pubMatch?.[1]);
    const text = raw
      .replace(/^(Title|URL Source|Published Time|Description|Warning|Markdown Content):.*\n?/gm, "")
      .replace(/!\[Image[^\]]*\]\([^)]*\)/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 12_000);
    return text.length >= 100 ? { title, text, publishedAt } : null;
  } catch {
    return null;
  }
}

async function fetchDirect(url: string): Promise<{ title: string; text: string; imageUrl: string | null; publishedAt: string | null } | null> {
  try {
    const { load } = await import("cheerio");
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = load(html);
    const rawDate =
      $("meta[property='article:published_time']").attr("content") ||
      $("meta[name='article:published_time']").attr("content") ||
      $("meta[name='publishedDate']").attr("content") ||
      $("meta[name='date']").attr("content") ||
      $("time[datetime]").first().attr("datetime");
    let publishedAt = parseDate(rawDate);
    if (!publishedAt) {
      $("script[type='application/ld+json']").each((_, el) => {
        if (publishedAt) return;
        try { const d = JSON.parse($(el).html() || ""); publishedAt = parseDate(d.datePublished || d.dateCreated); } catch {}
      });
    }
    $("script, style, nav, header, footer, aside, .ad, iframe, noscript").remove();
    const title =
      $("meta[property='og:title']").attr("content") ||
      $("title").text().trim() ||
      new URL(url).hostname;
    const rawImg =
      $("meta[property='og:image']").attr("content") ||
      $("meta[name='twitter:image:src']").attr("content") ||
      $("meta[name='twitter:image']").attr("content");
    const imageUrl = toAbsoluteUrl(url, rawImg);
    const container = $("article").length ? $("article") : $("main").length ? $("main") : $("body");
    const text = container.text().replace(/\s+/g, " ").trim().slice(0, 12_000);
    return text.length >= 100 ? { title, text, imageUrl, publishedAt } : null;
  } catch {
    return null;
  }
}

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const shortsMatch = u.pathname.match(/\/shorts\/([A-Za-z0-9_-]+)/);
      if (shortsMatch) return shortsMatch[1];
      return u.searchParams.get("v");
    }
    if (u.hostname === "youtu.be") {
      return u.pathname.slice(1).split(/[?#]/)[0] || null;
    }
  } catch {}
  return null;
}

function cleanYouTubeJinaText(raw: string): string {
  // Strip all images FIRST, then replace YouTube/Google nav links with their text
  const text = raw
    .replace(/!\[.*?\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\(https?:\/\/(?:www\.)?(?:youtube|accounts\.google|support\.google)\.com[^)]*\)/g, "$1");

  // Extract video title from Jina header
  const titleMatch = raw.match(/^Title:\s*(.+)/m);
  const videoTitle = titleMatch?.[1]?.trim().replace(/\s*-\s*YouTube$/i, "").trim() ?? "";

  // Extract transcript (timestamped lines like "0:05 text here")
  const transcriptMatch = text.match(/##\s*Transcript[\s\S]*?\n((?:(?:\d+:\d+|\d+\.\d+)\s+[^\n]+\n?)+)/i);
  const transcript = transcriptMatch?.[1]?.replace(/\d+:\d+\s*/g, "").replace(/\n+/g, " ").trim() ?? "";

  // Extract description — two strategies:
  // 1. Explicit ## Description section (stop at first metadata line)
  // 2. Fallback: inline text immediately after "N views • date" metadata line
  const metaStop = /^(\d[\d,.]+K?M?B?\s*(likes?|views?|subscribers?)?$|…+$|\d+[hd]\s*ago$|auto-dubbed$|audio tracks|how this was made|transcript$|follow along|show transcript|learn more$)/i;
  let description = "";

  const descSectionMatch = text.match(/##\s*Description\s*\n([\s\S]+?)(?=\n##|$)/i);
  if (descSectionMatch) {
    const lines: string[] = [];
    for (const line of descSectionMatch[1].split(/\n/).map(l => l.trim())) {
      if (metaStop.test(line)) break;
      if (line.length > 0 && line !== videoTitle) lines.push(line);
    }
    description = lines.join("\n").trim().slice(0, 800);
  }

  if (!description) {
    // Fallback: grab text after "N views • date" line (inline description pattern)
    const viewsMeta = text.match(/[\d,.][\d,.]*\s+views[^•\n]*•[^\n]*\n+([^\n]{40,})/i);
    if (viewsMeta) {
      description = viewsMeta[1]
        .replace(/…+.*$/, "").replace(/\.\.\.more\s*$/i, "")
        .trim().slice(0, 800);
    }
  }

  const parts: string[] = [];
  if (videoTitle) parts.push(`Video: ${videoTitle}`);
  if (transcript.length > 60) parts.push(`Transcript:\n${transcript.slice(0, 3000)}`);
  if (description.length > 40 && description !== videoTitle) parts.push(`Description:\n${description}`);

  return parts.join("\n\n");
}

async function fetchYouTubeContent(videoId: string): Promise<{ title: string; text: string } | null> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  try {
    const res = await fetch(`https://r.jina.ai/${watchUrl}`, {
      headers: { "X-Return-Format": "markdown" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    // Get raw markdown BEFORE any whitespace collapsing so cleanYouTubeJinaText can parse sections
    const raw = await res.text();
    const titleMatch = raw.match(/^Title:\s*(.+)/m);
    const title = titleMatch?.[1]?.trim().replace(/\s*-\s*YouTube$/i, "").trim() ?? "YouTube Video";
    const cleaned = cleanYouTubeJinaText(raw);
    // Require meaningful content beyond just the title line
    const contentBeyondTitle = cleaned.replace(`Video: ${title}`, "").trim();
    return contentBeyondTitle.length >= 80 ? { title, text: cleaned } : null;
  } catch {
    return null;
  }
}

async function handleYouTube(videoId: string, originalUrl: string) {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const thumbUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  const [ytContent, ogImage] = await Promise.all([
    fetchYouTubeContent(videoId),
    fetchOgImage(watchUrl),
  ]);

  if (ytContent) {
    return Response.json({
      text: ytContent.text,
      title: ytContent.title,
      source: "YouTube",
      sourceUrl: originalUrl,
      imageUrl: ogImage ?? thumbUrl,
    });
  }

  return Response.json(
    { error: "Couldn't extract enough content from this video. Try a video with captions, or paste the transcript directly." },
    { status: 422 }
  );
}

async function handleUrl(url: string) {
  const ytId = extractYouTubeId(url);
  if (ytId) {
    // YouTube Shorts: skip content extraction, return embed metadata directly
    try {
      if (new URL(url).pathname.includes("/shorts/")) {
        const thumbUrl = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
        try {
          const oembedRes = await fetch(
            `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${ytId}`)}&format=json`,
            { signal: AbortSignal.timeout(5000) }
          );
          const meta = await oembedRes.json();
          return Response.json({ source: "youtube-short", title: meta.title ?? "YouTube Short", sourceUrl: url, imageUrl: meta.thumbnail_url ?? thumbUrl, text: "" });
        } catch {
          return Response.json({ source: "youtube-short", title: "YouTube Short", sourceUrl: url, imageUrl: thumbUrl, text: "" });
        }
      }
    } catch {}
    // Regular YouTube video — try transcript/description extraction
    return handleYouTube(ytId, url);
  }

  // Run Jina text fetch and OG image fetch in parallel
  const [jinaResult, ogImage] = await Promise.all([
    fetchViaJina(url),
    fetchOgImage(url),
  ]);

  if (jinaResult) {
    return Response.json({ text: jinaResult.text, title: jinaResult.title, source: "url", sourceUrl: url, imageUrl: ogImage, publishedAt: jinaResult.publishedAt });
  }

  const direct = await fetchDirect(url);
  if (!direct) {
    return Response.json(
      { error: "Could not fetch this page. Try pasting the article text directly." },
      { status: 422 }
    );
  }

  return Response.json({ text: direct.text, title: direct.title, source: "url", sourceUrl: url, imageUrl: direct.imageUrl, publishedAt: direct.publishedAt });
}

async function handlePdf(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || typeof file === "string") {
    return Response.json({ error: "No file uploaded" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (buffer.byteLength > 20 * 1024 * 1024) {
    return Response.json({ error: "PDF too large (max 20 MB)" }, { status: 413 });
  }

  let text: string;
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const parsed = await pdfParse(buffer);
    text = parsed.text.replace(/\s+/g, " ").trim().slice(0, 12_000);
  } catch {
    return Response.json({ error: "Could not parse PDF" }, { status: 422 });
  }

  if (text.length < 100) {
    return Response.json({ error: "PDF has no extractable text (may be image-based)" }, { status: 422 });
  }

  const title = (file as File).name.replace(/\.pdf$/i, "") || "Uploaded PDF";

  return Response.json({ text, title, source: "pdf" });
}
