export const runtime = "nodejs";

import { auth } from "@clerk/nextjs/server";
import { listUserBookProgress } from "@/lib/db";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json([]);
  return Response.json(await listUserBookProgress(userId));
}
