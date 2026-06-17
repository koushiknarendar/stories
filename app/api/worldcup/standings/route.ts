export const runtime = "nodejs";
export const revalidate = 300; // 5 min cache

export async function GET() {
  const key = process.env.FOOTBALL_DATA_API_KEY;
  if (!key) return Response.json({ error: "FOOTBALL_DATA_API_KEY not set" }, { status: 500 });

  try {
    const res = await fetch("https://api.football-data.org/v4/competitions/WC/standings", {
      headers: { "X-Auth-Token": key },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text();
      return Response.json({ error: `Football API error: ${res.status}`, detail: body }, { status: 502 });
    }
    const data = await res.json();
    return Response.json(data, {
      headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=900" },
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Network error" }, { status: 502 });
  }
}
