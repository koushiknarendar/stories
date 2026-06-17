export const runtime = "nodejs";
export const revalidate = 60;

export async function GET() {
  const key = process.env.FOOTBALL_DATA_API_KEY;
  if (!key) {
    return Response.json({ error: "FOOTBALL_DATA_API_KEY not set" }, { status: 500 });
  }

  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const yesterday = fmt(new Date(today.getTime() - 86_400_000));
  const tomorrow  = fmt(new Date(today.getTime() + 86_400_000));

  try {
    const res = await fetch(
      `https://api.football-data.org/v4/competitions/WC/matches?dateFrom=${yesterday}&dateTo=${tomorrow}`,
      {
        headers: { "X-Auth-Token": key },
        signal: AbortSignal.timeout(10_000),
      }
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
    const msg = err instanceof Error ? err.message : "Network error";
    return Response.json({ error: msg }, { status: 502 });
  }
}
