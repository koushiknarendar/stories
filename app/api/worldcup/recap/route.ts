export const runtime = "nodejs";
export const maxDuration = 30;

import Anthropic from "@anthropic-ai/sdk";
import { loadStorySet, saveGeneratedStorySet } from "@/lib/db";
import { MATCH_RECAP_SYSTEM, buildMatchRecapUser } from "@/lib/cardPrompt";
import type { StoryCard } from "@/lib/types";

const client = new Anthropic();

export async function POST(request: Request) {
  const body = await request.json();
  const { matchId, homeTeam, awayTeam, homeScore, awayScore, stage, date, goals, group } = body;

  if (!matchId || !homeTeam || !awayTeam) {
    return Response.json({ error: "matchId, homeTeam, awayTeam required" }, { status: 400 });
  }

  const storyId = `wc_recap_${matchId}`;

  // Return cached recap if it exists
  const cached = await loadStorySet(storyId);
  if (cached) {
    return Response.json({ id: storyId, cached: true });
  }

  // Generate via Claude
  const userPrompt = buildMatchRecapUser({ homeTeam, awayTeam, homeScore, awayScore, stage, date, goals: goals ?? [], group });

  let cards: StoryCard[] | null = null;
  let lastRaw = "";

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: MATCH_RECAP_SYSTEM,
        messages: [{ role: "user", content: userPrompt }],
      });

      lastRaw = message.content[0].type === "text" ? message.content[0].text : "";
      const match = lastRaw.match(/\[[\s\S]*\]/);
      if (!match) continue;

      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed) && parsed.length === 5) {
          cards = parsed as StoryCard[];
          break;
        }
      } catch {
        continue;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Claude API error";
    return Response.json({ error: msg }, { status: 500 });
  }

  if (!cards?.length) {
    return Response.json({ error: "Failed to generate match recap", raw: lastRaw.slice(0, 200) }, { status: 500 });
  }

  const storySet = {
    id: storyId,
    title: `${homeTeam} ${homeScore}–${awayScore} ${awayTeam}`,
    source: "FIFA World Cup 2026",
    sourceUrl: undefined,
    coverImageUrl: undefined,
    category: "worldcup",
    publishedAt: date,
    savedAt: new Date().toISOString(),
    cards,
  };

  await saveGeneratedStorySet(storySet, "worldcup");

  return Response.json({ id: storyId, cached: false });
}
