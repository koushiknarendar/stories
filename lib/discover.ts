import { load } from "cheerio";
import Anthropic from "@anthropic-ai/sdk";
import { fetchRssArticles } from "./rss";
import { getGeneratedStories, saveGeneratedStorySet } from "./db";
import { DISCOVER_SYSTEM, buildDiscoverUser } from "./cardPrompt";
import type { StorySet, StoryCard } from "./types";

const client = new Anthropic();

function parseDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try { const d = new Date(raw.trim()); return isNaN(d.getTime()) ? null : d.toISOString(); } catch { return null; }
}

function parseDateFromText(text: string): string | null {
  const mo = "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec";
  const m1 = text.match(new RegExp(`(${mo})\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})`, "i"));
  if (m1) return parseDate(m1[0]);
  const m2 = text.match(new RegExp(`\\b(\\d{1,2})\\s+(${mo})\\.?\\s+(\\d{4})`, "i"));
  if (m2) return parseDate(m2[0]);
  return null;
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
    let publishedAt = parseDate(pubMatch?.[1]);
    const text = raw
      .replace(/^(Title|URL Source|Published Time|Description|Warning|Markdown Content):.*\n?/gm, "")
      .replace(/!\[Image[^\]]*\]\([^)]*\)/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 12_000);
    if (!publishedAt) publishedAt = parseDateFromText(raw);
    return text.length >= 100 ? { title, text, publishedAt } : null;
  } catch {
    return null;
  }
}

async function fetchVia12ft(url: string): Promise<{ title: string; text: string; publishedAt: string | null } | null> {
  try {
    const res = await fetch(`https://12ft.io/proxy?q=${encodeURIComponent(url)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const { load } = await import("cheerio");
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
    const container = $("article").length ? $("article") : $("main").length ? $("main") : $("body");
    const text = container.text().replace(/\s+/g, " ").trim().slice(0, 12_000);
    if (!publishedAt) publishedAt = parseDateFromText(text);
    return text.length >= 100 ? { title, text, publishedAt } : null;
  } catch {
    return null;
  }
}

async function fetchOgImage(url: string): Promise<string | null> {
  try {
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
    if (!raw) return null;
    try { return new URL(raw, url).href; } catch { return null; }
  } catch {
    return null;
  }
}

async function generateCards(text: string, title: string, category: string): Promise<StoryCard[] | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3072,
      system: [{ type: "text", text: DISCOVER_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildDiscoverUser(text, title, category) }],
    });
    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) continue;
    try { return JSON.parse(match[0]) as StoryCard[]; } catch { continue; }
  }
  return null;
}

async function generateForCategory(category: string): Promise<StorySet[]> {
  const articles = await fetchRssArticles(category, 2);
  const results: StorySet[] = [];

  for (const article of articles) {
    try {
      const [jinaResult, ogImage] = await Promise.all([
        fetchViaJina(article.url),
        fetchOgImage(article.url),
      ]);
      const parsed = jinaResult ?? (await fetchVia12ft(article.url));
      if (!parsed) continue;

      const cards = await generateCards(parsed.text, parsed.title || article.title, category);
      if (!cards || !cards.length) continue;

      let sourceDomain = "news";
      try { sourceDomain = new URL(article.url).hostname.replace("www.", ""); } catch { /* ok */ }

      const storySet: StorySet = {
        id: crypto.randomUUID(),
        title: parsed.title || article.title,
        source: sourceDomain,
        sourceUrl: article.url,
        coverImageUrl: ogImage ?? undefined,
        category,
        publishedAt: parsed.publishedAt ?? undefined,
        cards,
        savedAt: new Date().toISOString(),
      };

      await saveGeneratedStorySet(storySet, category);
      results.push(storySet);
    } catch {
      continue;
    }
  }
  return results;
}

export async function getOrGenerateDiscoverStories(categories: string[]): Promise<{
  id: string; title: string; source: string; source_url: string | null;
  cover_image_url: string | null; category: string | null; saved_at: string;
  is_generated: boolean;
}[]> {
  type DiscoverItem = Awaited<ReturnType<typeof getGeneratedStories>>[number];
  const results: DiscoverItem[] = [];
  const toGenerate: string[] = [];

  for (const category of categories) {
    const fresh = await getGeneratedStories([category]);
    if (fresh.length > 0) {
      results.push(...fresh);
    } else {
      toGenerate.push(category);
    }
  }

  // Generate up to 3 categories that have no cache
  const limited = toGenerate.slice(0, 3);
  for (const category of limited) {
    const generated = await generateForCategory(category);
    // Map StorySet → the flat DB shape the caller expects
    for (const s of generated) {
      results.push({
        id: s.id,
        title: s.title,
        source: s.source,
        source_url: s.sourceUrl ?? null,
        cover_image_url: s.coverImageUrl ?? null,
        category: s.category ?? null,
        saved_at: s.savedAt,
        published_at: s.publishedAt ?? null,
        is_generated: true,
      });
    }
  }

  return results;
}
