import crypto from "crypto";
import type {
  Clinic,
  DashboardMetrics,
  EmailAlert,
  OpenSlot,
  SmsDirection,
  SmsMessage,
  TimeWindow,
  WaitlistPatient,
  Weekday,
} from "@/types/database";
import {
  createAdminSupabaseClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import {
  DEMO_CLINIC_ID,
  mutateLocalStore,
  readLocalStore,
} from "@/lib/local-store";
import { isSlotInPast } from "@/lib/utils";

export function isUsingSupabase(): boolean {
  return isSupabaseAdminConfigured();
}

export async function getClinicById(clinicId: string): Promise<Clinic | null> {
  if (isUsingSupabase()) {
    const supabase = createAdminSupabaseClient()!;
    const { data } = await supabase
      .from("clinics")
      .select("*")
      .eq("id", clinicId)
      .maybeSingle();
    return (data as Clinic | null) ?? null;
  }

  const store = readLocalStore();
  return store.clinics.find((c) => c.id === clinicId) ?? store.clinics[0] ?? null;
}

export async function getClinicBySlug(slug: string): Promise<Clinic | null> {
  if (isUsingSupabase()) {
    const supabase = createAdminSupabaseClient()!;
    const { data } = await supabase
      .from("clinics")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    return (data as Clinic | null) ?? null;
  }

  const store = readLocalStore();
  return store.clinics.find((c) => c.slug === slug) ?? null;
}

export async function getDefaultClinic(): Promise<Clinic> {
  const clinic = await getClinicById(DEMO_CLINIC_ID);
  if (clinic) return clinic;

  if (isUsingSupabase()) {
    const supabase = createAdminSupabaseClient()!;
    const { data } = await supabase.from("clinics").select("*").limit(1).single();
    if (data) return data as Clinic;
  }

  const store = readLocalStore();
  return store.clinics[0];
}

export async function updateClinic(
  clinicId: string,
  updates: Pick<
    Clinic,
    "name" | "sms_sender_name" | "avg_slot_value_dkk" | "notification_email" | "slug"
  >
): Promise<Clinic> {
  if (isUsingSupabase()) {
    const supabase = createAdminSupabaseClient()!;
    const { data, error } = await supabase
      .from("clinics")
      .update(updates)
      .eq("id", clinicId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as Clinic;
  }

  return mutateLocalStore((store) => {
    const clinic = store.clinics.find((c) => c.id === clinicId);
    if (!clinic) throw new Error("Klinik blev ikke fundet");
    Object.assign(clinic, updates);
    return { ...clinic };
  });
}

export async function listWaitlistPatients(
  clinicId: string
): Promise<WaitlistPatient[]> {
  if (isUsingSupabase()) {
    const supabase = createAdminSupabaseClient()!;
    const { data, error } = await supabase
      .from("waitlist_patients")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data as WaitlistPatient[]) ?? [];
  }

  const store = readLocalStore();
  return store.waitlist_patients
    .filter((p) => p.clinic_id === clinicId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function createWaitlistPatient(input: {
  clinic_id: string;
  first_name: string;
  phone_e164: string;
  practitioner_preference: string | null;
  preferred_days: Weekday[];
  preferred_window: TimeWindow;
}): Promise<WaitlistPatient> {
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  if (isUsingSupabase()) {
    const supabase = createAdminSupabaseClient()!;
    const { data, error } = await supabase
      .from("waitlist_patients")
      .insert({
        clinic_id: input.clinic_id,
        first_name: input.first_name,
        phone_e164: input.phone_e164,
        practitioner_preference: input.practitioner_preference,
        preferred_days: input.preferred_days,
        preferred_window: input.preferred_window,
        active: true,
        consent_given_at: now.toISOString(),
        expires_at: expires.toISOString(),
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as WaitlistPatient;
  }

  return mutateLocalStore((store) => {
    const patient: WaitlistPatient = {
      id: crypto.randomUUID(),
      clinic_id: input.clinic_id,
      first_name: input.first_name,
      phone_e164: input.phone_e164,
      practitioner_preference: input.practitioner_preference,
      preferred_days: input.preferred_days,
      preferred_window: input.preferred_window,
      active: true,
      consent_given_at: now.toISOString(),
      expires_at: expires.toISOString(),
      created_at: now.toISOString(),
    };
    store.waitlist_patients.push(patient);
    return patient;
  });
}

export async function setWaitlistPatientActive(
  clinicId: string,
  patientId: string,
  active: boolean
): Promise<WaitlistPatient | null> {
  if (isUsingSupabase()) {
    const supabase = createAdminSupabaseClient()!;
    const { data } = await supabase
      .from("waitlist_patients")
      .update({ active })
      .eq("id", patientId)
      .eq("clinic_id", clinicId)
      .select("*")
      .maybeSingle();
    return (data as WaitlistPatient | null) ?? null;
  }

  return mutateLocalStore((store) => {
    const p = store.waitlist_patients.find(
      (item) => item.id === patientId && item.clinic_id === clinicId
    );
    if (!p) return null;
    p.active = active;
    return { ...p };
  });
}

export async function renewWaitlistPatient(
  clinicId: string,
  patientId: string
): Promise<WaitlistPatient | null> {
  const expiresAt = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  if (isUsingSupabase()) {
    const supabase = createAdminSupabaseClient()!;
    const { data } = await supabase
      .from("waitlist_patients")
      .update({ active: true, expires_at: expiresAt })
      .eq("id", patientId)
      .eq("clinic_id", clinicId)
      .select("*")
      .maybeSingle();
    return (data as WaitlistPatient | null) ?? null;
  }

  return mutateLocalStore((store) => {
    const p = store.waitlist_patients.find(
      (item) => item.id === patientId && item.clinic_id === clinicId
    );
    if (!p) return null;
    p.active = true;
    p.expires_at = expiresAt;
    return { ...p };
  });
}

export async function deleteWaitlistPatient(
  clinicId: string,
  patientId: string
): Promise<void> {
  if (isUsingSupabase()) {
    const supabase = createAdminSupabaseClient()!;
    await supabase
      .from("waitlist_patients")
      .delete()
      .eq("id", patientId)
      .eq("clinic_id", clinicId);
    return;
  }

  mutateLocalStore((store) => {
    store.waitlist_patients = store.waitlist_patients.filter(
      (p) => !(p.id === patientId && p.clinic_id === clinicId)
    );
  });
}

export async function deactivatePatientsByPhone(
  phoneE164: string
): Promise<{ clinic: Clinic; patient: WaitlistPatient } | null> {
  if (isUsingSupabase()) {
    const supabase = createAdminSupabaseClient()!;
    const { data: patients } = await supabase
      .from("waitlist_patients")
      .select("*")
      .eq("phone_e164", phoneE164)
      .eq("active", true)
      .order("created_at", { ascending: false });

    const first = (patients as WaitlistPatient[] | null)?.[0];
    if (!first) return null;

    await supabase
      .from("waitlist_patients")
      .update({ active: false })
      .eq("phone_e164", phoneE164);

    const clinic = await getClinicById(first.clinic_id);
    if (!clinic) return null;
    return { clinic, patient: { ...first, active: false } };
  }

  return mutateLocalStore((store) => {
    const matching = store.waitlist_patients.filter(
      (p) => p.phone_e164 === phoneE164 && p.active
    );
    if (matching.length === 0) return null;

    for (const p of matching) {
      p.active = false;
    }

    const latest = matching[matching.length - 1];
    const clinic = store.clinics.find((c) => c.id === latest.clinic_id);
    if (!clinic) return null;
    return { clinic: { ...clinic }, patient: { ...latest } };
  });
}

export async function listOpenSlots(clinicId: string): Promise<OpenSlot[]> {
  if (isUsingSupabase()) {
    const supabase = createAdminSupabaseClient()!;
    const [{ data: slots }, { data: patients }, { data: sms }] =
      await Promise.all([
        supabase
          .from("open_slots")
          .select("*")
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false }),
        supabase
          .from("waitlist_patients")
          .select("id, first_name, phone_e164")
          .eq("clinic_id", clinicId),
        supabase
          .from("sms_messages")
          .select("slot_id, direction")
          .eq("clinic_id", clinicId)
          .eq("direction", "outbound"),
      ]);

    const patientMap = new Map(
      ((patients as Pick<WaitlistPatient, "id" | "first_name" | "phone_e164">[]) ?? []).map(
        (p) => [p.id, p]
      )
    );
    const smsCountMap = new Map<string, number>();
    for (const m of (sms as { slot_id: string | null }[]) ?? []) {
      if (m.slot_id) {
        smsCountMap.set(m.slot_id, (smsCountMap.get(m.slot_id) ?? 0) + 1);
      }
    }

    return ((slots as OpenSlot[]) ?? []).map((slot) => ({
      ...slot,
      claimed_by_patient: slot.claimed_by_patient_id
        ? patientMap.get(slot.claimed_by_patient_id) ?? null
        : null,
      sent_sms_count: smsCountMap.get(slot.id) ?? 0,
    }));
  }

  const store = readLocalStore();
  const patientMap = new Map(
    store.waitlist_patients.map((p) => [
      p.id,
      { id: p.id, first_name: p.first_name, phone_e164: p.phone_e164 },
    ])
  );

  return store.open_slots
    .filter((s) => s.clinic_id === clinicId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((slot) => ({
      ...slot,
      claimed_by_patient: slot.claimed_by_patient_id
        ? patientMap.get(slot.claimed_by_patient_id) ?? null
        : null,
      sent_sms_count: store.sms_messages.filter(
        (m) => m.slot_id === slot.id && m.direction === "outbound"
      ).length,
    }));
}

export async function createOpenSlot(input: {
  clinic_id: string;
  slot_date: string;
  slot_time: string;
  duration_minutes: number;
  practitioner_name: string | null;
}): Promise<OpenSlot> {
  if (isUsingSupabase()) {
    const supabase = createAdminSupabaseClient()!;
    const { data, error } = await supabase
      .from("open_slots")
      .insert({
        clinic_id: input.clinic_id,
        slot_date: input.slot_date,
        slot_time: input.slot_time,
        duration_minutes: input.duration_minutes,
        practitioner_name: input.practitioner_name,
        status: "open",
        wave_count: 0,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as OpenSlot;
  }

  return mutateLocalStore((store) => {
    const slot: OpenSlot = {
      id: crypto.randomUUID(),
      clinic_id: input.clinic_id,
      slot_date: input.slot_date,
      slot_time: input.slot_time,
      duration_minutes: input.duration_minutes,
      practitioner_name: input.practitioner_name,
      status: "open",
      claimed_by_patient_id: null,
      claimed_at: null,
      entered_in_calendar: false,
      wave_count: 0,
      last_wave_at: null,
      created_at: new Date().toISOString(),
    };
    store.open_slots.unshift(slot);
    return { ...slot };
  });
}

export async function updateSlotWave(
  slotId: string,
  waveCount: number
): Promise<void> {
  const now = new Date().toISOString();
  if (isUsingSupabase()) {
    const supabase = createAdminSupabaseClient()!;
    await supabase
      .from("open_slots")
      .update({ wave_count: waveCount, last_wave_at: now })
      .eq("id", slotId);
    return;
  }

  mutateLocalStore((store) => {
    const slot = store.open_slots.find((s) => s.id === slotId);
    if (slot) {
      slot.wave_count = waveCount;
      slot.last_wave_at = now;
    }
  });
}

export async function markSlotEnteredInCalendar(
  clinicId: string,
  slotId: string
): Promise<OpenSlot | null> {
  if (isUsingSupabase()) {
    const supabase = createAdminSupabaseClient()!;
    const { data } = await supabase
      .from("open_slots")
      .update({ entered_in_calendar: true })
      .eq("id", slotId)
      .eq("clinic_id", clinicId)
      .select("*")
      .maybeSingle();
    return (data as OpenSlot | null) ?? null;
  }

  return mutateLocalStore((store) => {
    const slot = store.open_slots.find(
      (s) => s.id === slotId && s.clinic_id === clinicId
    );
    if (!slot) return null;
    slot.entered_in_calendar = true;
    return { ...slot };
  });
}

export async function cancelOpenSlot(
  clinicId: string,
  slotId: string
): Promise<OpenSlot | null> {
  if (isUsingSupabase()) {
    const supabase = createAdminSupabaseClient()!;
    const { data } = await supabase
      .from("open_slots")
      .update({ status: "cancelled" })
      .eq("id", slotId)
      .eq("clinic_id", clinicId)
      .eq("status", "open")
      .select("*")
      .maybeSingle();
    return (data as OpenSlot | null) ?? null;
  }

  return mutateLocalStore((store) => {
    const slot = store.open_slots.find(
      (s) => s.id === slotId && s.clinic_id === clinicId && s.status === "open"
    );
    if (!slot) return null;
    slot.status = "cancelled";
    return { ...slot };
  });
}

export async function logSmsMessage(input: {
  clinic_id: string;
  slot_id: string | null;
  patient_id: string | null;
  direction: SmsDirection;
  phone_e164: string;
  body: string;
  provider_message_id: string | null;
}): Promise<SmsMessage> {
  if (isUsingSupabase()) {
    const supabase = createAdminSupabaseClient()!;
    const { data, error } = await supabase
      .from("sms_messages")
      .insert(input)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as SmsMessage;
  }

  return mutateLocalStore((store) => {
    const msg: SmsMessage = {
      id: crypto.randomUUID(),
      ...input,
      created_at: new Date().toISOString(),
    };
    store.sms_messages.push(msg);
    return msg;
  });
}

export async function listSmsMessages(clinicId: string): Promise<SmsMessage[]> {
  if (isUsingSupabase()) {
    const supabase = createAdminSupabaseClient()!;
    const { data } = await supabase
      .from("sms_messages")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: true })
      .limit(200);
    return (data as SmsMessage[]) ?? [];
  }

  const store = readLocalStore();
  return store.sms_messages
    .filter((m) => m.clinic_id === clinicId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function getContactedPatientIdsForSlot(
  slotId: string
): Promise<Set<string>> {
  if (isUsingSupabase()) {
    const supabase = createAdminSupabaseClient()!;
    const { data } = await supabase
      .from("sms_messages")
      .select("patient_id")
      .eq("slot_id", slotId)
      .eq("direction", "outbound");
    return new Set(
      ((data as { patient_id: string | null }[]) ?? [])
        .map((r) => r.patient_id)
        .filter((id): id is string => Boolean(id))
    );
  }

  const store = readLocalStore();
  return new Set(
    store.sms_messages
      .filter((m) => m.slot_id === slotId && m.direction === "outbound" && m.patient_id)
      .map((m) => m.patient_id as string)
  );
}

/**
 * Finds the most recent slot offered to a phone number within the last 12 hours.
 */
export async function findRecentOfferedSlotForPhone(phoneE164: string): Promise<{
  slot: OpenSlot;
  patient: WaitlistPatient;
  clinic: Clinic;
} | null> {
  const cutoffIso = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

  if (isUsingSupabase()) {
    const supabase = createAdminSupabaseClient()!;
    const { data: offers } = await supabase
      .from("sms_messages")
      .select("slot_id, patient_id, clinic_id")
      .eq("phone_e164", phoneE164)
      .eq("direction", "outbound")
      .not("slot_id", "is", null)
      .gte("created_at", cutoffIso)
      .order("created_at", { ascending: false })
      .limit(1);

    const offer = (offers as { slot_id: string; patient_id: string; clinic_id: string }[] | null)?.[0];
    if (!offer) return null;

    const [{ data: slot }, { data: patient }, clinic] = await Promise.all([
      supabase.from("open_slots").select("*").eq("id", offer.slot_id).maybeSingle(),
      supabase.from("waitlist_patients").select("*").eq("id", offer.patient_id).maybeSingle(),
      getClinicById(offer.clinic_id),
    ]);

    if (!slot || !patient || !clinic) return null;
    return {
      slot: slot as OpenSlot,
      patient: patient as WaitlistPatient,
      clinic,
    };
  }

  const store = readLocalStore();
  const offer = [...store.sms_messages]
    .reverse()
    .find(
      (m) =>
        m.phone_e164 === phoneE164 &&
        m.direction === "outbound" &&
        m.slot_id !== null &&
        m.created_at >= cutoffIso
    );

  if (!offer || !offer.slot_id) return null;

  const slot = store.open_slots.find((s) => s.id === offer.slot_id);
  const patient = store.waitlist_patients.find(
    (p) => p.id === offer.patient_id || p.phone_e164 === phoneE164
  );
  const clinic = store.clinics.find((c) => c.id === offer.clinic_id);

  if (!slot || !patient || !clinic) return null;
  return { slot: { ...slot }, patient: { ...patient }, clinic: { ...clinic } };
}

/**
 * Atomic slot-claim lock:
 * UPDATE open_slots SET status = 'claimed', claimed_by_patient_id = $patient_id, claimed_at = now()
 * WHERE id = $slot_id AND status = 'open' RETURNING *;
 */
export async function atomicClaimOpenSlot(
  slotId: string,
  patientId: string
): Promise<OpenSlot | null> {
  if (isUsingSupabase()) {
    const supabase = createAdminSupabaseClient()!;
    const { data, error } = await supabase.rpc("claim_open_slot", {
      p_slot_id: slotId,
      p_patient_id: patientId,
    });
    if (error) {
      // Fallback to direct conditional update if RPC wasn't applied yet
      const { data: updated } = await supabase
        .from("open_slots")
        .update({
          status: "claimed",
          claimed_by_patient_id: patientId,
          claimed_at: new Date().toISOString(),
        })
        .eq("id", slotId)
        .eq("status", "open")
        .select("*")
        .maybeSingle();
      return (updated as OpenSlot | null) ?? null;
    }
    const rows = data as OpenSlot[] | null;
    return rows && rows.length > 0 ? rows[0] : null;
  }

  // Synchronous single-threaded critical section in local dev store guarantees atomicity
  return mutateLocalStore((store) => {
    const slot = store.open_slots.find(
      (s) => s.id === slotId && s.status === "open"
    );
    if (!slot) return null;
    slot.status = "claimed";
    slot.claimed_by_patient_id = patientId;
    slot.claimed_at = new Date().toISOString();
    return { ...slot };
  });
}

export async function logEmailAlert(input: {
  clinic_id: string;
  slot_id: string;
  to_email: string;
  subject: string;
  body: string;
}): Promise<EmailAlert> {
  if (!isUsingSupabase()) {
    return mutateLocalStore((store) => {
      const alert: EmailAlert = {
        id: crypto.randomUUID(),
        ...input,
        created_at: new Date().toISOString(),
      };
      store.email_alerts.unshift(alert);
      return alert;
    });
  }

  return {
    id: crypto.randomUUID(),
    ...input,
    created_at: new Date().toISOString(),
  };
}

export async function listEmailAlerts(clinicId: string): Promise<EmailAlert[]> {
  if (isUsingSupabase()) return [];
  const store = readLocalStore();
  return store.email_alerts.filter((e) => e.clinic_id === clinicId);
}

export async function getDashboardMetrics(
  clinic: Clinic
): Promise<DashboardMetrics> {
  const [slots, patients] = await Promise.all([
    listOpenSlots(clinic.id),
    listWaitlistPatients(clinic.id),
  ]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const filledThisMonth = slots.filter(
    (s) => s.status === "claimed" && (s.claimed_at ?? s.created_at) >= monthStart
  ).length;

  const activeWaitlistCount = patients.filter(
    (p) => p.active && new Date(p.expires_at).getTime() > Date.now()
  ).length;

  const openSlotsCount = slots.filter((s) => s.status === "open").length;
  const pendingCalendarEntryCount = slots.filter(
    (s) => s.status === "claimed" && !s.entered_in_calendar
  ).length;

  return {
    filled_this_month: filledThisMonth,
    recovered_revenue_dkk: filledThisMonth * clinic.avg_slot_value_dkk,
    active_waitlist_count: activeWaitlistCount,
    open_slots_count: openSlotsCount,
    pending_calendar_entry_count: pendingCalendarEntryCount,
  };
}

export async function findSlotsNeedingWave2(
  minAgeMinutes = 15
): Promise<OpenSlot[]> {
  const cutoffIso = new Date(
    Date.now() - minAgeMinutes * 60 * 1000
  ).toISOString();

  if (isUsingSupabase()) {
    const supabase = createAdminSupabaseClient()!;
    const { data } = await supabase
      .from("open_slots")
      .select("*")
      .eq("status", "open")
      .eq("wave_count", 1)
      .lte("last_wave_at", cutoffIso);
    return (data as OpenSlot[]) ?? [];
  }

  const store = readLocalStore();
  return store.open_slots.filter(
    (s) =>
      s.status === "open" &&
      s.wave_count === 1 &&
      s.last_wave_at !== null &&
      s.last_wave_at <= cutoffIso
  );
}

export async function expireStaleSlots(): Promise<number> {
  if (isUsingSupabase()) {
    const supabase = createAdminSupabaseClient()!;
    const { data } = await supabase
      .from("open_slots")
      .select("*")
      .eq("status", "open");
    const staleIds = ((data as OpenSlot[]) ?? [])
      .filter((s) => isSlotInPast(s.slot_date, s.slot_time))
      .map((s) => s.id);
    if (staleIds.length === 0) return 0;
    await supabase
      .from("open_slots")
      .update({ status: "expired" })
      .in("id", staleIds);
    return staleIds.length;
  }

  return mutateLocalStore((store) => {
    let count = 0;
    for (const slot of store.open_slots) {
      if (slot.status === "open" && isSlotInPast(slot.slot_date, slot.slot_time)) {
        slot.status = "expired";
        count++;
      }
    }
    return count;
  });
}

/**
 * GDPR Storage Limitation: Automatically deletes expired waitlist entries (> 30 days).
 */
export async function purgeExpiredWaitlistPatients(): Promise<number> {
  const nowIso = new Date().toISOString();

  if (isUsingSupabase()) {
    const supabase = createAdminSupabaseClient()!;
    const { data } = await supabase
      .from("waitlist_patients")
      .delete()
      .lte("expires_at", nowIso)
      .select("id");
    return (data as { id: string }[] | null)?.length ?? 0;
  }

  return mutateLocalStore((store) => {
    const before = store.waitlist_patients.length;
    store.waitlist_patients = store.waitlist_patients.filter(
      (p) => p.expires_at > nowIso
    );
    return before - store.waitlist_patients.length;
  });
}
