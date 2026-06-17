export const runtime = "nodejs";
export const maxDuration = 30;

import Anthropic from "@anthropic-ai/sdk";
import { LINEUP_PREDICTION_SYSTEM, buildLineupUser } from "@/lib/cardPrompt";

const client = new Anthropic();

export interface LineupData {
  home: { formation: string; gk: string[]; def: string[]; mid: string[]; att: string[] };
  away: { formation: string; gk: string[]; def: string[]; mid: string[]; att: string[] };
  keyBattle: string;
  tip: string;
}

export async function POST(request: Request) {
  const { homeTeam, awayTeam, stage, date } = await request.json();

  if (!homeTeam || !awayTeam) {
    return Response.json({ error: "homeTeam and awayTeam required" }, { status: 400 });
  }

  let lineup: LineupData | null = null;
  let lastRaw = "";

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: LINEUP_PREDICTION_SYSTEM,
        messages: [{ role: "user", content: buildLineupUser(homeTeam, awayTeam, stage, date) }],
      });

      lastRaw = message.content[0].type === "text" ? message.content[0].text : "";
      const match = lastRaw.match(/\{[\s\S]*\}/);
      if (!match) continue;

      try {
        const parsed = JSON.parse(match[0]);
        if (parsed.home && parsed.away) {
          lineup = parsed as LineupData;
          break;
        }
      } catch {
        continue;
      }
    }
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Claude API error" }, { status: 500 });
  }

  if (!lineup) {
    return Response.json({ error: "Failed to generate lineup prediction", raw: lastRaw.slice(0, 200) }, { status: 500 });
  }

  return Response.json(lineup);
}
