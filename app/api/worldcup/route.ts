export const runtime = "nodejs";

export async function GET(request: Request) {
  const key = process.env.FOOTBALL_DATA_API_KEY;
  if (!key) return Response.json({ error: "FOOTBALL_DATA_API_KEY not set" }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const dateFrom = searchParams.get("dateFrom") ?? fmt(new Date(today.getTime() - 86_400_000));
  const dateTo   = searchParams.get("dateTo")   ?? fmt(new Date(today.getTime() + 86_400_000));

  try {
    const res = await fetch(
      `https://api.football-data.org/v4/competitions/WC/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`,
      { headers: { "X-Auth-Token": key }, signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) {
      const body = await res.text();
      return Response.json({ error: `Football API error: ${res.status}`, detail: body }, { status: 502 });
    }
    const data = await res.json();
    return Response.json(data, {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Network error" }, { status: 502 });
  }
}
