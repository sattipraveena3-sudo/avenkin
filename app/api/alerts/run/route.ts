import { getDb, getRuntimeEnv } from "../../../../db";
import { families } from "../../../../db/schema";
import { runAlertSweep } from "../../../../lib/care-data";

async function executeSweep(request: Request) {
  const runtime = await getRuntimeEnv() as unknown as Record<string, string | undefined>;
  const secret = runtime.ALERT_CRON_SECRET;
  if (!secret) return Response.json({ error: "Scheduled alert runner is not configured" }, { status: 503 });
  const requestKey = new URL(request.url).searchParams.get("key");
  if (request.headers.get("authorization") !== `Bearer ${secret}` && requestKey !== secret) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();
  const rows = await db.select().from(families);
  for (const family of rows) await runAlertSweep(family);
  return Response.json({ ok: true, checked: rows.length, checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) { return executeSweep(request); }
export async function POST(request: Request) { return executeSweep(request); }
