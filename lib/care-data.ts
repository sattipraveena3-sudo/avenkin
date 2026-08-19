import { and, asc, desc, eq, lt } from "drizzle-orm";
import { getDb, getRuntimeEnv } from "../db";
import { careItems, families, members, notifications, timelineEntries } from "../db/schema";

export type CareType = "medication" | "appointment";
export type AlertSettings = { notificationEmail: string; emailAlertsEnabled: boolean; alertWindowMinutes: number };

const nowIso = () => new Date().toISOString();

export async function getFamilyByOwner(ownerEmail: string) {
  const db = await getDb();
  const [family] = await db.select().from(families).where(eq(families.ownerEmail, ownerEmail)).limit(1);
  return family ?? null;
}

export async function createFamily(input: {
  ownerEmail: string;
  ownerName: string;
  parentName: string;
  parentLocation: string;
  timezone: string;
  alertWindowMinutes: number;
}) {
  const db = await getDb();
  const existing = await getFamilyByOwner(input.ownerEmail);
  if (existing) return existing;
  const createdAt = nowIso();
  const [family] = await db.insert(families).values({ ...input, notificationEmail: input.ownerEmail, createdAt }).returning();
  await db.batch([
    db.insert(members).values({ familyId: family.id, name: input.parentName, role: "Parent", accessToken: crypto.randomUUID().replaceAll("-", ""), createdAt }),
    db.insert(timelineEntries).values({ familyId: family.id, kind: "setup", actor: input.ownerName, message: `Created a shared care space for ${input.parentName}`, createdAt }),
  ]);
  return family;
}

export async function addCareItem(input: { familyId: number; type: CareType; title: string; details: string; scheduledFor: string; actor: string }) {
  const db = await getDb();
  const createdAt = nowIso();
  const [item] = await db.insert(careItems).values({ familyId: input.familyId, type: input.type, title: input.title, details: input.details, scheduledFor: input.scheduledFor, createdAt }).returning();
  await db.insert(timelineEntries).values({ familyId: input.familyId, careItemId: item.id, kind: "scheduled", actor: input.actor, message: `${input.type === "medication" ? "Medication" : "Appointment"} scheduled: ${input.title}`, createdAt });
  return item;
}

export async function addMember(input: { familyId: number; name: string; role: string; actor: string }) {
  const db = await getDb();
  const createdAt = nowIso();
  const [member] = await db.insert(members).values({ familyId: input.familyId, name: input.name, role: input.role, accessToken: crypto.randomUUID().replaceAll("-", ""), createdAt }).returning();
  await db.insert(timelineEntries).values({ familyId: input.familyId, kind: "member", actor: input.actor, message: `${input.name} joined as ${input.role}`, createdAt });
  return member;
}

export async function completeCareItem(input: { familyId: number; itemId: number; actor: string; note?: string }) {
  const db = await getDb();
  const [item] = await db.select().from(careItems).where(and(eq(careItems.id, input.itemId), eq(careItems.familyId, input.familyId))).limit(1);
  if (!item) throw new Error("Care item not found");
  if (item.status === "completed") return item;
  const completedAt = nowIso();
  const note = input.note?.trim() ?? "";
  const [updated] = await db.update(careItems).set({ status: "completed", completedAt, completedBy: input.actor, note }).where(eq(careItems.id, item.id)).returning();
  await db.insert(timelineEntries).values({ familyId: input.familyId, careItemId: item.id, kind: "checkin", actor: input.actor, message: `${item.title} marked ${item.type === "appointment" ? "attended" : "taken"}`, note, createdAt: completedAt });
  return updated;
}

export async function getDashboard(ownerEmail: string) {
  const family = await getFamilyByOwner(ownerEmail);
  if (!family) return { family: null, members: [], items: [], timeline: [] };
  await runAlertSweep(family);
  const db = await getDb();
  const [familyMembers, items, timeline, deliveryHistory, alertCapabilities] = await Promise.all([
    db.select().from(members).where(eq(members.familyId, family.id)).orderBy(asc(members.createdAt)),
    db.select().from(careItems).where(eq(careItems.familyId, family.id)).orderBy(asc(careItems.scheduledFor)),
    db.select().from(timelineEntries).where(eq(timelineEntries.familyId, family.id)).orderBy(desc(timelineEntries.createdAt)).limit(60),
    db.select().from(notifications).where(eq(notifications.familyId, family.id)).orderBy(desc(notifications.createdAt)).limit(20),
    getAlertCapabilities(),
  ]);
  return { family, members: familyMembers, items, timeline, notifications: deliveryHistory, alertCapabilities };
}

export async function updateAlertSettings(familyId: number, settings: AlertSettings) {
  const db = await getDb();
  const [family] = await db.update(families).set(settings).where(eq(families.id, familyId)).returning();
  return family;
}

export async function getAlertCapabilities() {
  const runtime = await getRuntimeEnv() as unknown as Record<string, string | undefined>;
  return {
    emailConfigured: Boolean(runtime.RESEND_API_KEY && runtime.ALERT_FROM_EMAIL),
    scheduledRunnerConfigured: Boolean(runtime.ALERT_RUNNER_ACTIVE === "true"),
  };
}

export async function getCheckInSpace(accessToken: string) {
  const db = await getDb();
  const [member] = await db.select().from(members).where(eq(members.accessToken, accessToken)).limit(1);
  if (!member) return null;
  const [family] = await db.select().from(families).where(eq(families.id, member.familyId)).limit(1);
  if (!family) return null;
  await runAlertSweep(family);
  const items = await db.select().from(careItems).where(and(eq(careItems.familyId, family.id), eq(careItems.status, "pending"))).orderBy(asc(careItems.scheduledFor)).limit(20);
  return { member, family, items };
}

export async function runAlertSweep(family: typeof families.$inferSelect) {
  const db = await getDb();
  const cutoff = new Date(Date.now() - family.alertWindowMinutes * 60_000).toISOString();
  const overdue = await db.select().from(careItems).where(and(eq(careItems.familyId, family.id), eq(careItems.status, "pending"), lt(careItems.scheduledFor, cutoff))).limit(20);
  for (const item of overdue) {
    const createdAt = nowIso();
    await db.batch([
      db.update(careItems).set({ status: "missed" }).where(eq(careItems.id, item.id)),
      db.insert(timelineEntries).values({ familyId: family.id, careItemId: item.id, kind: "alert", actor: "Avenkin", message: `Check-in overdue: ${item.title}`, note: `No update within ${family.alertWindowMinutes} minutes of the scheduled time.`, createdAt }),
    ]);
    if (family.emailAlertsEnabled) {
      await db.insert(notifications).values({ familyId: family.id, careItemId: item.id, channel: "email", recipient: family.notificationEmail || family.ownerEmail, status: "queued", createdAt });
    }
  }
  await deliverQueuedEmails(family);
}

export async function sendTestAlert(family: typeof families.$inferSelect) {
  const runtime = await getRuntimeEnv() as unknown as Record<string, string | undefined>;
  const apiKey = runtime.RESEND_API_KEY;
  const from = runtime.ALERT_FROM_EMAIL;
  if (!apiKey || !from) return { sent: false, reason: "Email delivery provider is not connected yet." };
  const recipient = family.notificationEmail || family.ownerEmail;
  const createdAt = nowIso();
  const db = await getDb();
  try {
    const result = await sendEmail({ apiKey, from, to: recipient, subject: "Your Avenkin alerts are ready", html: alertEmailHtml(family, "Test alert", "This is a test. Future missed check-ins will appear in your timeline and be sent to this address.") });
    await db.insert(notifications).values({ familyId: family.id, channel: "email", recipient, status: "sent", providerId: result.id ?? null, sentAt: nowIso(), createdAt });
    return { sent: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Email delivery failed";
    await db.insert(notifications).values({ familyId: family.id, channel: "email", recipient, status: "failed", errorMessage: reason, createdAt });
    return { sent: false, reason };
  }
}

async function deliverQueuedEmails(family: typeof families.$inferSelect) {
  if (!family.emailAlertsEnabled) return;
  const runtime = await getRuntimeEnv() as unknown as Record<string, string | undefined>;
  const apiKey = runtime.RESEND_API_KEY;
  const from = runtime.ALERT_FROM_EMAIL;
  if (!apiKey || !from) return;
  const db = await getDb();
  const queued = await db.select().from(notifications).where(and(eq(notifications.familyId, family.id), eq(notifications.channel, "email"), eq(notifications.status, "queued"))).orderBy(asc(notifications.createdAt)).limit(20);
  for (const notification of queued) {
    if (!notification.careItemId) continue;
    const [item] = await db.select().from(careItems).where(eq(careItems.id, notification.careItemId)).limit(1);
    if (!item) {
      await db.update(notifications).set({ status: "failed", errorMessage: "Care item no longer exists" }).where(eq(notifications.id, notification.id));
      continue;
    }
    try {
      const result = await sendEmail({
        apiKey,
        from,
        to: notification.recipient,
        subject: `Avenkin alert: ${item.title} needs a check-in`,
        html: alertEmailHtml(family, item.title, `No update was received within ${family.alertWindowMinutes} minutes of the scheduled time.`),
      });
      await db.update(notifications).set({ status: "sent", providerId: result.id ?? null, sentAt: nowIso(), errorMessage: null }).where(eq(notifications.id, notification.id));
    } catch (error) {
      await db.update(notifications).set({ status: "failed", errorMessage: error instanceof Error ? error.message : "Email delivery failed" }).where(eq(notifications.id, notification.id));
    }
  }
}

async function sendEmail(input: { apiKey: string; from: string; to: string; subject: string; html: string }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${input.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: input.from, to: [input.to], subject: input.subject, html: input.html }),
  });
  const result = await response.json() as { id?: string; message?: string };
  if (!response.ok) throw new Error(result.message || "Email provider rejected the alert");
  return result;
}

function alertEmailHtml(family: typeof families.$inferSelect, title: string, detail: string) {
  return `<div style="font-family:Arial,sans-serif;max-width:560px"><div style="color:#2d706a;font-weight:700">AVENKIN</div><h2 style="color:#173b3b">A care check-in needs attention</h2><p><strong>${escapeHtml(title)}</strong> for ${escapeHtml(family.parentName)}.</p><p>${escapeHtml(detail)}</p><p>Please contact your parent or caregiver directly if you are concerned.</p><p style="color:#657776;font-size:12px">Avenkin coordinates family-entered information. It does not provide medical advice or emergency monitoring.</p></div>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] ?? char);
}
