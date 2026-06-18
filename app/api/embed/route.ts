import Anthropic from "@anthropic-ai/sdk";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { CLASSIFY_SYSTEM, buildClassifyUser } from "@/lib/cardPrompt";

export const runtime = "nodejs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Lazy-init so missing env vars don't crash unrelated routes
let ratelimit: Ratelimit | null = null;
function getRatelimit(): Ratelimit | null {
  if (ratelimit) return ratelimit;
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  ratelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(20, "1 h"),
    prefix: "storis:embed",
  });
  return ratelimit;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  // Rate limit by IP — 20 requests per hour
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "anonymous";

  const rl = getRatelimit();
  if (rl) {
    const { success, limit, remaining, reset } = await rl.limit(ip);
    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      return Response.json(
        { error: "Rate limit reached. Try again later." },
        {
          status: 429,
          headers: {
            ...CORS,
            "X-RateLimit-Limit":     String(limit),
            "X-RateLimit-Remaining": String(remaining),
            "Retry-After":           String(retryAfter),
          },
        },
      );
    }
  }

  let body: { url?: string; text?: string } | null = null;
  try { body = await request.json(); } catch {}

  if (!body?.url && !body?.text) {
    return Response.json({ error: "Provide url or text" }, { status: 400, headers: CORS });
  }

  let text = body.text ?? null;
  let title = "Article";
  const sourceUrl = body.url ?? null;

  if (body.url) {
    const parsed = await fetchViaJina(body.url);
    if (!parsed) {
      return Response.json(
        { error: "Couldn't fetch this page. The site may block scrapers." },
        { status: 422, headers: CORS },
      );
    }
    text = parsed.text;
    title = parsed.title;
  }

  const client = new Anthropic();
  let cards: unknown[] = [];
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: [{ type: "text", text: CLASSIFY_SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: buildClassifyUser(text!, title, "url") }],
      });
      const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
      const match = raw.match(/\{[\s\S]*\}/) ?? raw.match(/\[[\s\S]*\]/);
      if (!match) continue;
      try {
        const parsed = JSON.parse(match[0]);
        cards = Array.isArray(parsed) ? parsed : (parsed.cards ?? []);
        if (cards.length) break;
      } catch {}
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Claude API error";
    return Response.json({ error: msg }, { status: 500, headers: CORS });
  }

  if (!cards.length) {
    return Response.json({ error: "Could not generate story cards for this page." }, { status: 500, headers: CORS });
  }

  return Response.json({ cards, title, sourceUrl }, { headers: CORS });
}

async function fetchViaJina(url: string): Promise<{ title: string; text: string } | null> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { "X-Return-Format": "markdown" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const raw = await res.text();
    const titleMatch = raw.match(/^Title:\s*(.+)/m);
    const title = titleMatch?.[1]?.trim() || new URL(url).hostname;
    const text = raw
      .replace(/^(Title|URL Source|Published Time|Description|Warning|Markdown Content):.*\n?/gm, "")
      .replace(/!\[Image[^\]]*\]\([^)]*\)/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 12_000);
    return text.length >= 100 ? { title, text } : null;
  } catch {
    return null;
  }
}
