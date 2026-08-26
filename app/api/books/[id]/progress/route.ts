export const runtime = "nodejs";

import { auth } from "@clerk/nextjs/server";
import { getBookProgress, upsertBookProgress, updateUserStreak } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  return Response.json(await getBookProgress(userId, id));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { cardIndex, completed } = await request.json().catch(() => ({}));
  if (typeof cardIndex !== "number") return Response.json({ error: "cardIndex is required" }, { status: 400 });

  await upsertBookProgress(userId, id, cardIndex, Boolean(completed));
  await updateUserStreak(userId);

  return Response.json({ ok: true });
}
