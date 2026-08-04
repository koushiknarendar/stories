export const runtime = "nodejs";

import { auth } from "@clerk/nextjs/server";
import { listStorySets, deleteStorySet, saveStorySet, saveStorySetAnon, createInboxItem, markInboxItemDone } from "@/lib/db";
import type { StorySet } from "@/lib/types";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const sets = await listStorySets(userId);
  return Response.json(sets, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" },
  });
}

// Called when user taps Save in the story reader (guest flow → logged-in save)
export async function POST(request: Request) {
  const { userId } = await auth();

  const set = await request.json() as StorySet;
  const isShort = set?.source === "youtube-short";
  if (!set?.id || (!set?.cards?.length && !isShort)) {
    return Response.json({ error: "Invalid story set" }, { status: 400 });
  }

  if (!userId) {
    // Guest save — persist for shareability without linking to a user account.
    // Reuses an existing story if this URL was already converted by anyone.
    try {
      const id = await saveStorySetAnon(set, set.cards);
      return Response.json({ ok: true, id });
    } catch {
      return Response.json({ error: "Failed to save story" }, { status: 500 });
    }
  }

  // Skip if this exact story set is already saved
  const existing = await listStorySets(userId);
  const existingMatch = existing.find((s) => s.id === set.id || (set.sourceUrl && s.source_url === set.sourceUrl));
  if (existingMatch) {
    return Response.json({ ok: true, id: existingMatch.id });
  }

  const item = await createInboxItem(userId, set.sourceUrl ?? null, set.source);
  const id = await saveStorySet(userId, item.id, set, set.cards);
  await markInboxItemDone(item.id, set.title);

  return Response.json({ ok: true, id });
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await request.json();
  await deleteStorySet(id as string, userId);
  return Response.json({ ok: true });
}
