import {
  getContactedPatientIdsForSlot,
  listWaitlistPatients,
  updateSlotWave,
} from "@/lib/db";
import { sendSlotOfferSms } from "@/lib/sms";
import { getTimeWindowForSlot, getWeekdayKey } from "@/lib/utils";
import type { Clinic, OpenSlot, WaitlistPatient } from "@/types/database";

const WAVE_BATCH_SIZE = 5;

export function doesPatientMatchSlot(
  patient: WaitlistPatient,
  slot: OpenSlot
): boolean {
  if (!patient.active) return false;
  if (new Date(patient.expires_at).getTime() <= Date.now()) return false;

  // Match weekday if slot falls on Mon-Fri
  const weekday = getWeekdayKey(slot.slot_date);
  if (weekday && !patient.preferred_days.includes(weekday)) {
    return false;
  }

  // Match time window ('morning' 08-12, 'afternoon' 12-17, 'any')
  const slotWindow = getTimeWindowForSlot(slot.slot_time);
  if (
    patient.preferred_window !== "any" &&
    patient.preferred_window !== slotWindow
  ) {
    return false;
  }

  // Match optional practitioner preference if both are specified
  if (
    patient.practitioner_preference &&
    slot.practitioner_name &&
    patient.practitioner_preference.trim().toLowerCase() !==
      slot.practitioner_name.trim().toLowerCase()
  ) {
    return false;
  }

  return true;
}

/**
 * Dispatches a staggered SMS wave (up to 5 longest-waiting matching patients)
 * who have not yet been contacted for this open slot.
 */
export async function dispatchWaveForSlot(params: {
  clinic: Clinic;
  slot: OpenSlot;
  waveNumber: number;
}): Promise<{ sentCount: number; recipients: WaitlistPatient[] }> {
  const [patients, alreadyContacted] = await Promise.all([
    listWaitlistPatients(params.clinic.id),
    getContactedPatientIdsForSlot(params.slot.id),
  ]);

  const candidates = patients
    .filter((p) => !alreadyContacted.has(p.id) && doesPatientMatchSlot(p, params.slot))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(0, WAVE_BATCH_SIZE);

  for (const patient of candidates) {
    await sendSlotOfferSms({
      clinic: params.clinic,
      slot: params.slot,
      patient,
    });
  }

  await updateSlotWave(params.slot.id, params.waveNumber);

  return {
    sentCount: candidates.length,
    recipients: candidates,
  };
}
