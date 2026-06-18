export const runtime = "nodejs";
export const maxDuration = 30;

import Anthropic from "@anthropic-ai/sdk";
import { searchStorySets, saveGeneratedStorySet } from "@/lib/db";
import { TOPIC_SYSTEM, buildTopicUser } from "@/lib/cardPrompt";
import type { StorySet } from "@/lib/types";

const client = new Anthropic();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return Response.json({ stories: [] });

  const stories = await searchStorySets(q);

  if (searchParams.get("generate") === "true") {
    const generated = await generateTopicSet(q);
    if (generated) {
      await saveGeneratedStorySet(generated, "search").catch(() => {});
      return Response.json({ stories: [toClientShape(generated), ...stories], generated: generated.id });
    }
  }

  return Response.json({ stories });
}

function toClientShape(set: StorySet) {
  return {
    id: set.id,
    title: set.title,
    source: set.source,
    source_url: null as string | null,
    cover_image_url: null as string | null,
    category: null as string | null,
    saved_at: set.savedAt,
    published_at: null as string | null,
  };
}

async function generateTopicSet(topic: string): Promise<StorySet | null> {
  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: [{ type: "text", text: TOPIC_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildTopicUser(topic) }],
    });
    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed.cards) || !parsed.cards.length) return null;
    return {
      id: crypto.randomUUID(),
      title: parsed.title || `What to know about ${topic}`,
      source: "Storis AI",
      cards: parsed.cards,
      savedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
