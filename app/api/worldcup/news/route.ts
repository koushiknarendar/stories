export const runtime = "nodejs";
export const maxDuration = 60;

import { getOrGenerateDiscoverStories } from "@/lib/discover";

export async function GET() {
  try {
    const stories = await getOrGenerateDiscoverStories(["worldcup"]);
    return Response.json({ stories }, {
      headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch WC news";
    return Response.json({ error: msg }, { status: 500 });
  }
}
