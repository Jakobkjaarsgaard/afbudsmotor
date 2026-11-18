import { NextRequest, NextResponse } from "next/server";
import { dispatchWaveForSlot } from "@/lib/cascade";
import {
  expireStaleSlots,
  findSlotsNeedingWave2,
  getClinicById,
  purgeExpiredWaitlistPatients,
} from "@/lib/db";
import { emitSlotEvent } from "@/lib/realtime-bus";

async function runCronTasks(forceImmediateWave2: boolean) {
  // 1. Advance Wave 2 for slots open > 15 minutes with wave_count === 1
  const minAgeMinutes = forceImmediateWave2 ? 0 : 15;
  const slotsForWave2 = await findSlotsNeedingWave2(minAgeMinutes);

  let wave2SlotsAdvanced = 0;
  let wave2SmsSent = 0;

  for (const slot of slotsForWave2) {
    const clinic = await getClinicById(slot.clinic_id);
    if (!clinic) continue;

    const result = await dispatchWaveForSlot({
      clinic,
      slot,
      waveNumber: 2,
    });

    wave2SlotsAdvanced++;
    wave2SmsSent += result.sentCount;

    emitSlotEvent({
      type: "cron_ran",
      clinicId: clinic.id,
      slotId: slot.id,
      timestamp: new Date().toISOString(),
    });
  }

  // 2. Expire stale open slots whose appointment time has passed
  const expiredSlotsCount = await expireStaleSlots();

  // 3. GDPR 30-day waitlist auto-expiry cleanup
  const purgedPatientsCount = await purgeExpiredWaitlistPatients();

  return {
    ok: true,
    wave2_slots_advanced: wave2SlotsAdvanced,
    wave2_sms_sent: wave2SmsSent,
    expired_slots: expiredSlotsCount,
    purged_waitlist_patients: purgedPatientsCount,
    ran_at: new Date().toISOString(),
  };
}

function isAuthorizedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || process.env.NODE_ENV !== "production") return true;
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const force = req.nextUrl.searchParams.get("force") === "true";
  const summary = await runCronTasks(force);
  return NextResponse.json(summary);
}

export async function POST(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const force = req.nextUrl.searchParams.get("force") === "true";
  const summary = await runCronTasks(force);
  return NextResponse.json(summary);
}
