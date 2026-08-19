import { completeCareItem, getCheckInSpace } from "../../../../lib/care-data";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: Context) {
  const { token } = await context.params;
  try {
    const space = await getCheckInSpace(token);
    if (!space) return Response.json({ error: "This check-in link is invalid or has expired." }, { status: 404 });
    return Response.json({ ...space, serverNow: new Date().toISOString() });
  } catch (error) {
    console.error("Check-in link lookup failed", error);
    return Response.json({ error: "This check-in link is unavailable. Ask the family organiser for a fresh link." }, { status: 500 });
  }
}

export async function POST(request: Request, context: Context) {
  const { token } = await context.params;
  try {
    const space = await getCheckInSpace(token);
    if (!space) return Response.json({ error: "This check-in link is invalid or has expired." }, { status: 404 });
    const payload = await request.json() as { itemId?: number; note?: string };
    const itemId = Number(payload.itemId);
    if (!Number.isInteger(itemId)) return Response.json({ error: "Choose a care item" }, { status: 400 });
    await completeCareItem({ familyId: space.family.id, itemId, actor: space.member.name, note: typeof payload.note === "string" ? payload.note : "" });
    const updated = await getCheckInSpace(token);
    return Response.json({ ...updated, serverNow: new Date().toISOString() });
  } catch (error) {
    console.error("Check-in update failed", error);
    return Response.json({ error: "We couldn’t share that update. Please try again." }, { status: 500 });
  }
}
