"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import { dispatchWaveForSlot } from "@/lib/cascade";
import {
  cancelOpenSlot,
  createOpenSlot,
  createWaitlistPatient,
  deleteWaitlistPatient,
  getClinicBySlug,
  markSlotEnteredInCalendar,
  renewWaitlistPatient,
  setWaitlistPatientActive,
  updateClinic,
} from "@/lib/db";
import { emitSlotEvent } from "@/lib/realtime-bus";
import {
  createOpenSlotSchema,
  createWaitlistPatientSchema,
  updateClinicSettingsSchema,
} from "@/lib/validation";

export interface ActionResult<T = undefined> {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  data?: T;
}

export async function createOpenSlotAction(input: {
  slot_date: string;
  slot_time: string;
  duration_minutes: number;
  practitioner_name?: string;
}): Promise<ActionResult<{ slotId: string; sentCount: number }>> {
  const parsed = createOpenSlotSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Tjek venligst felterne og prøv igen.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { clinic } = await getTenantContext();
  const slot = await createOpenSlot({
    clinic_id: clinic.id,
    slot_date: parsed.data.slot_date,
    slot_time: parsed.data.slot_time,
    duration_minutes: parsed.data.duration_minutes,
    practitioner_name: parsed.data.practitioner_name,
  });

  // Immediately fire Wave 1 SMS broadcast to top 5 longest-waiting matching patients
  const waveResult = await dispatchWaveForSlot({
    clinic,
    slot,
    waveNumber: 1,
  });

  emitSlotEvent({
    type: "slot_created",
    clinicId: clinic.id,
    slotId: slot.id,
    timestamp: new Date().toISOString(),
  });

  revalidatePath("/dashboard");

  return {
    success: true,
    data: { slotId: slot.id, sentCount: waveResult.sentCount },
  };
}

export async function markSlotEnteredInCalendarAction(
  slotId: string
): Promise<ActionResult> {
  const { clinic } = await getTenantContext();
  const updated = await markSlotEnteredInCalendar(clinic.id, slotId);
  if (!updated) {
    return { success: false, error: "Afbudstiden blev ikke fundet." };
  }

  emitSlotEvent({
    type: "slot_updated",
    clinicId: clinic.id,
    slotId,
    timestamp: new Date().toISOString(),
  });

  revalidatePath("/dashboard");
  return { success: true };
}

export async function cancelOpenSlotAction(
  slotId: string
): Promise<ActionResult> {
  const { clinic } = await getTenantContext();
  const updated = await cancelOpenSlot(clinic.id, slotId);
  if (!updated) {
    return {
      success: false,
      error: "Kun åbne afbudstider kan annulleres.",
    };
  }

  emitSlotEvent({
    type: "slot_updated",
    clinicId: clinic.id,
    slotId,
    timestamp: new Date().toISOString(),
  });

  revalidatePath("/dashboard");
  return { success: true };
}

export async function addWaitlistPatientAction(input: {
  first_name: string;
  phone: string;
  practitioner_preference?: string;
  preferred_days: string[];
  preferred_window: string;
  consent: boolean;
}): Promise<ActionResult<{ patientId: string }>> {
  const parsed = createWaitlistPatientSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Ret venligst de markerede felter.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { clinic } = await getTenantContext();
  const patient = await createWaitlistPatient({
    clinic_id: clinic.id,
    first_name: parsed.data.first_name,
    phone_e164: parsed.data.phone,
    practitioner_preference: parsed.data.practitioner_preference,
    preferred_days: parsed.data.preferred_days,
    preferred_window: parsed.data.preferred_window,
  });

  revalidatePath("/waitlist");
  revalidatePath("/dashboard");

  return { success: true, data: { patientId: patient.id } };
}

export async function publicJoinWaitlistAction(
  clinicSlug: string,
  input: {
    first_name: string;
    phone: string;
    practitioner_preference?: string;
    preferred_days: string[];
    preferred_window: string;
    consent: boolean;
  }
): Promise<ActionResult<{ clinicName: string }>> {
  const clinic = await getClinicBySlug(clinicSlug);
  if (!clinic) {
    return {
      success: false,
      error: "Klinikken blev ikke fundet. Kontrollér venligst QR-koden.",
    };
  }

  const parsed = createWaitlistPatientSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Tjek venligst dine oplysninger og prøv igen.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await createWaitlistPatient({
    clinic_id: clinic.id,
    first_name: parsed.data.first_name,
    phone_e164: parsed.data.phone,
    practitioner_preference: parsed.data.practitioner_preference,
    preferred_days: parsed.data.preferred_days,
    preferred_window: parsed.data.preferred_window,
  });

  revalidatePath("/waitlist");
  revalidatePath("/dashboard");

  return { success: true, data: { clinicName: clinic.name } };
}

export async function toggleWaitlistPatientActiveAction(
  patientId: string,
  active: boolean
): Promise<ActionResult> {
  const { clinic } = await getTenantContext();
  await setWaitlistPatientActive(clinic.id, patientId, active);
  revalidatePath("/waitlist");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function renewWaitlistPatientAction(
  patientId: string
): Promise<ActionResult> {
  const { clinic } = await getTenantContext();
  await renewWaitlistPatient(clinic.id, patientId);
  revalidatePath("/waitlist");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteWaitlistPatientAction(
  patientId: string
): Promise<ActionResult> {
  const { clinic } = await getTenantContext();
  await deleteWaitlistPatient(clinic.id, patientId);
  revalidatePath("/waitlist");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateClinicSettingsAction(input: {
  name: string;
  sms_sender_name: string;
  avg_slot_value_dkk: number;
  notification_email: string;
  slug: string;
}): Promise<ActionResult> {
  const parsed = updateClinicSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Ret venligst de markerede felter.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { clinic } = await getTenantContext();
  await updateClinic(clinic.id, parsed.data);

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/waitlist");
  return { success: true };
}
