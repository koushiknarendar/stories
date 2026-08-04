export const runtime = "nodejs";

import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  createInboxItem,
  markInboxItemDone,
  markInboxItemError,
  listInboxItems,
  deleteInboxItem,
  saveStorySet,
} from "@/lib/db";
import { CLASSIFY_SYSTEM, buildClassifyUser, PROFILE_SYSTEM, buildProfileUser, COMPANY_SYSTEM, buildCompanyUser } from "@/lib/cardPrompt";
import type { StoryCard, StorySet } from "@/lib/types";

const client = new Anthropic();

// ─── Parsing helpers (mirrored from /api/parse) ───────────────────────────────

function isLoginWall(title: string): boolean {
  const t = title.toLowerCase();
  return t.includes("log in") || t.includes("sign in") || t.includes("login") || t.includes("sign up");
}

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
    const headers: Record<string, string> = { "X-Return-Format": "markdown" };
    if (/linkedin\.com\/(in|company)\//.test(url)) {
      // Ask Jina to strip the activity/posts feed before rendering
      headers["X-Remove-Selector"] = [
        ".feed-shared-update-v2",
        ".scaffold-finite-scroll",
        ".profile-creator-shared-feed-update__container",
        "[data-finite-scroll-hotspot]",
        ".pv-recent-activity-section",
      ].join(", ");
    }
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers,
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const raw = await res.text();
    const titleMatch = raw.match(/^Title:\s*(.+)/m);
    const title = titleMatch?.[1]?.trim() || new URL(url).hostname;
    if (isLoginWall(title)) return null;
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

function extractLinkedInBio(text: string): string {
  // LinkedIn biographical section headers (in order they typically appear)
  const bioHeaders = [
    "About", "Experience", "Education", "Skills", "Certifications",
    "Licenses & certifications", "Accomplishments", "Honors & awards",
    "Languages", "Volunteer experience", "Projects", "Publications", "Causes",
  ];
  // Headers that signal the start of non-biographical content
  const stopHeaders = ["Activity", "Posts", "Articles", "All activity", "Show all"];

  // Find where non-bio content starts
  let stopIdx = text.length;
  for (const h of stopHeaders) {
    const idx = text.indexOf(h);
    if (idx > 300 && idx < stopIdx) stopIdx = idx;
  }

  // Extract content up to the stop point
  const bioText = text.slice(0, stopIdx).trim();

  // If we found something meaningful, return it; otherwise fall back to first 4k chars
  return bioText.length > 200 ? bioText : text.slice(0, 4_000);
}

async function fetchVia12ft(url: string): Promise<{ title: string; text: string; publishedAt: string | null } | null> {
  try {
    const { load } = await import("cheerio");
    const res = await fetch(`https://12ft.io/proxy?q=${encodeURIComponent(url)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = load(html);
    $("script[type!='application/ld+json'], style, nav, header, footer, aside, .ad, iframe, noscript").remove();
    const title =
      $("meta[property='og:title']").attr("content") ||
      $("title").text().trim() ||
      new URL(url).hostname;
    if (isLoginWall(title)) return null;
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
    $("script, style").remove();

    const container = $("article").length ? $("article") : $("main").length ? $("main") : $("body");
    let text = container.text().replace(/\s+/g, " ").trim();

    // For LinkedIn: extract only biographical sections, skip the activity/posts feed
    const isLinkedInProfile = /linkedin\.com\/(in|company)\//.test(url);
    if (isLinkedInProfile) {
      text = extractLinkedInBio(text);
    }

    text = text.slice(0, 12_000);
    if (!publishedAt) publishedAt = parseDateFromText(text);
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
    if (isLoginWall(title)) return null;
    const rawImg =
      $("meta[property='og:image']").attr("content") ||
      $("meta[name='twitter:image:src']").attr("content") ||
      $("meta[name='twitter:image']").attr("content");
    const imageUrl = toAbsoluteUrl(url, rawImg);
    const container = $("article").length ? $("article") : $("main").length ? $("main") : $("body");
    const text = container.text().replace(/\s+/g, " ").trim().slice(0, 12_000);
    if (!publishedAt) publishedAt = parseDateFromText(text);
    return text.length >= 100 ? { title, text, imageUrl, publishedAt } : null;
  } catch {
    return null;
  }
}

// ─── Card generation helper (mirrored from /api/stories) ─────────────────────

async function generateCards(
  text: string,
  title: string,
  source: string,
  mode: "article" | "profile" | "company" = "article"
): Promise<{ cards: StoryCard[]; category: string | null } | null> {
  const systemPrompt = mode === "profile" ? PROFILE_SYSTEM : mode === "company" ? COMPANY_SYSTEM : CLASSIFY_SYSTEM;
  const userMessage = mode === "profile" ? buildProfileUser(text, title) : mode === "company" ? buildCompanyUser(text, title) : buildClassifyUser(text, title, source);
  for (let attempt = 0; attempt < 2; attempt++) {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3072,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMessage }],
    });
    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) continue;
    try {
      const parsed = JSON.parse(match[0]);
      return { cards: parsed.cards as StoryCard[], category: parsed.category ?? null };
    } catch {
      continue;
    }
  }
  return null;
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const items = await listInboxItems(userId);
  return Response.json(items);
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const url = (body.url as string | undefined)?.trim() || null;
  const text = (body.text as string | undefined)?.trim() || null;

  if (!url && !text) {
    return Response.json({ error: "Provide a URL or text" }, { status: 400 });
  }

  const item = await createInboxItem(userId, url, url ? "url" : "text");

  try {
    let parseResult: { title: string; text: string; publishedAt?: string | null } | null = null;

    let coverImageUrl: string | null = null;

    const linkedInMode = (() => {
      if (!url) return null;
      try {
        const u = new URL(url);
        if (!u.hostname.includes("linkedin.com")) return null;
        if (u.pathname.startsWith("/in/")) return "profile" as const;
        if (u.pathname.startsWith("/company/")) return "company" as const;
      } catch {}
      return null;
    })();

    if (url) {
      const [jinaResult, ogImage] = await Promise.all([fetchViaJina(url), fetchOgImage(url)]);
      if (jinaResult) {
        parseResult = jinaResult;
        coverImageUrl = ogImage;
      } else {
        const via12ft = await fetchVia12ft(url);
        if (via12ft) {
          parseResult = via12ft;
          coverImageUrl = ogImage;
        } else if (linkedInMode) {
          // Jina + 12ft both failed for LinkedIn — direct fetch won't work either, fail fast
          await markInboxItemError(item.id, "LinkedIn requires login");
          const errMsg = linkedInMode === "company"
            ? "LinkedIn requires login to view this page. Copy the company description and paste it in the Text tab instead."
            : "LinkedIn requires login to view this profile. Copy the About section and paste it in the Text tab instead.";
          return Response.json({ error: errMsg }, { status: 422 });
        } else {
          const direct = await fetchDirect(url);
          if (!direct) {
            await markInboxItemError(item.id, "Could not fetch this URL");
            return Response.json({ error: "Could not fetch this URL. Try pasting the text directly." }, { status: 422 });
          }
          parseResult = direct;
          coverImageUrl = direct.imageUrl;
        }
      }
    } else {
      parseResult = { text: text!, title: "Pasted text" };
    }

    const generated = await generateCards(parseResult.text, parseResult.title, url ? "url" : "text", linkedInMode ?? "article");
    if (!generated) {
      await markInboxItemError(item.id, "Failed to generate story cards");
      return Response.json({ error: "Failed to generate story cards" }, { status: 500 });
    }

    const storySet: StorySet = {
      id: crypto.randomUUID(),
      title: parseResult.title,
      source: url ? "url" : "text",
      sourceUrl: url ?? undefined,
      coverImageUrl: coverImageUrl ?? undefined,
      category: generated.category ?? undefined,
      publishedAt: parseResult.publishedAt ?? undefined,
      cards: generated.cards,
      savedAt: new Date().toISOString(),
    };

    const id = await saveStorySet(userId, item.id, storySet, generated.cards);
    await markInboxItemDone(item.id, storySet.title);

    return Response.json({ id, title: storySet.title, itemId: item.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await markInboxItemError(item.id, msg).catch(() => {});
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await request.json();
  await deleteInboxItem(id as string, userId);
  return Response.json({ ok: true });
}
