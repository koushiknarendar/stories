export const runtime = "nodejs";

import { getBook } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(book);
}
