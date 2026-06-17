import Anthropic from "@anthropic-ai/sdk";
import { CLASSIFY_SYSTEM, buildClassifyUser } from "@/lib/cardPrompt";

export const runtime = "nodejs";

const client = new Anthropic();

export async function POST(request: Request) {
  const { text, title, source, sourceUrl, imageUrl, publishedAt } = await request.json();

  if (!text) {
    return Response.json({ error: "text is required" }, { status: 400 });
  }

  let cards;
  let category: string | null = null;
  let lastRaw = "";
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 3072,
        system: [{ type: "text", text: CLASSIFY_SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: buildClassifyUser(text, title, source) }],
      });

      lastRaw = message.content[0].type === "text" ? message.content[0].text : "";
      // Try to find JSON object first, then JSON array (discover route uses array)
      const match = lastRaw.match(/\{[\s\S]*\}/) ?? lastRaw.match(/\[[\s\S]*\]/);
      if (!match) continue;

      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) {
          cards = parsed;
        } else {
          cards = parsed.cards;
          category = parsed.category ?? null;
        }
        if (cards?.length) break;
      } catch {
        continue;
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Claude API error";
    return Response.json({ error: msg }, { status: 500 });
  }

  if (!cards?.length) {
    // Surface what Claude actually said to help diagnose content issues
    const hint = lastRaw.length > 0
      ? "Content may be too short, non-textual, or in an unsupported language."
      : "No response from Claude.";
    return Response.json({ error: `Failed to generate story cards. ${hint}` }, { status: 500 });
  }

  return Response.json({ cards, title, source, sourceUrl, imageUrl: imageUrl ?? null, category, publishedAt: publishedAt ?? null });
}
