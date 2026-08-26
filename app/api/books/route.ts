export const runtime = "nodejs";

import { listBooks } from "@/lib/db";

export async function GET(request: Request) {
  const category = new URL(request.url).searchParams.get("category") ?? undefined;
  const books = await listBooks(category);
  return Response.json(books, { headers: { "Cache-Control": "public, max-age=60" } });
}
