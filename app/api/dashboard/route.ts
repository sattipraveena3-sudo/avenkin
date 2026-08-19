import { getChatGPTUser } from "../../chatgpt-auth";
import { addCareItem, addMember, completeCareItem, createFamily, getDashboard, getFamilyByOwner, sendTestAlert, updateAlertSettings } from "../../../lib/care-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    return Response.json(await getDashboard(user.email));
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const action = string(payload.action);
    if (action === "setup") {
      const parentName = string(payload.parentName);
      if (!parentName) return bad("Parent name is required");
      await createFamily({
        ownerEmail: user.email,
        ownerName: user.displayName,
        parentName,
        parentLocation: string(payload.parentLocation),
        timezone: string(payload.timezone) || "Asia/Kolkata",
        alertWindowMinutes: boundedNumber(payload.alertWindowMinutes, 15, 1440, 120),
      });
    } else {
      const family = await getFamilyByOwner(user.email);
      if (!family) return bad("Create a parent profile first");
      if (action === "addItem") {
        const type = string(payload.type);
        const title = string(payload.title);
        const scheduledFor = string(payload.scheduledFor);
        if ((type !== "medication" && type !== "appointment") || !title || !scheduledFor || Number.isNaN(Date.parse(scheduledFor))) return bad("Type, title and a valid schedule are required");
        await addCareItem({ familyId: family.id, type, title, details: string(payload.details), scheduledFor: new Date(scheduledFor).toISOString(), actor: user.displayName });
      } else if (action === "addMember") {
        const name = string(payload.name);
        const role = string(payload.role) || "Caregiver";
        if (!name) return bad("Member name is required");
        await addMember({ familyId: family.id, name, role, actor: user.displayName });
      } else if (action === "completeItem") {
        const itemId = Number(payload.itemId);
        if (!Number.isInteger(itemId)) return bad("A valid care item is required");
        await completeCareItem({ familyId: family.id, itemId, actor: user.displayName, note: string(payload.note) });
      } else if (action === "updateAlerts") {
        const notificationEmail = string(payload.notificationEmail);
        if (!/^\S+@\S+\.\S+$/.test(notificationEmail)) return bad("Enter a valid alert email address");
        await updateAlertSettings(family.id, {
          notificationEmail,
          emailAlertsEnabled: payload.emailAlertsEnabled !== false,
          alertWindowMinutes: boundedNumber(payload.alertWindowMinutes, 15, 1440, family.alertWindowMinutes),
        });
      } else if (action === "testEmail") {
        const result = await sendTestAlert(family);
        if (!result.sent) return Response.json({ error: result.reason || "Test alert could not be sent" }, { status: 503 });
      } else {
        return bad("Unknown action");
      }
    }
    return Response.json(await getDashboard(user.email));
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}

function string(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function boundedNumber(value: unknown, min: number, max: number, fallback: number) { const number = Number(value); return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback; }
function bad(error: string) { return Response.json({ error }, { status: 400 }); }
function message(error: unknown) {
  const detail = error instanceof Error ? error.message : "";
  if (detail.includes("Failed query") || detail.includes("no such table")) return "Care storage is starting up. Please refresh in a moment.";
  return detail || "Something went wrong";
}
