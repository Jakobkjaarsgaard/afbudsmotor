import fs from "fs";
import path from "path";
import crypto from "crypto";
import type {
  Clinic,
  EmailAlert,
  OpenSlot,
  SmsMessage,
  WaitlistPatient,
} from "@/types/database";
import { getLocalIsoDate } from "@/lib/utils";

export interface LocalStoreData {
  clinics: Clinic[];
  waitlist_patients: WaitlistPatient[];
  open_slots: OpenSlot[];
  sms_messages: SmsMessage[];
  email_alerts: EmailAlert[];
}

export const DEMO_CLINIC_ID = "11111111-1111-4111-8111-111111111111";

const STORE_DIR = path.join(process.cwd(), ".local-data");
const STORE_PATH = path.join(STORE_DIR, "afbudsmotor.json");

function createSeedData(): LocalStoreData {
  const now = new Date();
  const daysFromNow = (days: number) =>
    new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
  const hoursAgo = (hours: number) =>
    new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
  const daysAgo = (days: number) =>
    new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

  const clinic: Clinic = {
    id: DEMO_CLINIC_ID,
    slug: "fysiohuset-aarhus",
    name: "FysioHuset Aarhus",
    avg_slot_value_dkk: 750,
    sms_sender_name: "FysioHuset",
    notification_email: "reception@fysiohuset-aarhus.dk",
    created_at: daysAgo(45),
  };

  const p1 = "22222222-2222-4222-8222-222222222201";
  const p2 = "22222222-2222-4222-8222-222222222202";
  const p3 = "22222222-2222-4222-8222-222222222203";
  const p4 = "22222222-2222-4222-8222-222222222204";
  const p5 = "22222222-2222-4222-8222-222222222205";
  const p6 = "22222222-2222-4222-8222-222222222206";
  const p7 = "22222222-2222-4222-8222-222222222207";
  const p8 = "22222222-2222-4222-8222-222222222208";

  const patients: WaitlistPatient[] = [
    {
      id: p1,
      clinic_id: DEMO_CLINIC_ID,
      first_name: "Mette",
      phone_e164: "+4520112233",
      practitioner_preference: "Anders",
      preferred_days: ["mon", "tue", "wed", "thu", "fri"],
      preferred_window: "any",
      active: true,
      consent_given_at: daysAgo(12),
      expires_at: daysFromNow(18),
      created_at: daysAgo(12),
    },
    {
      id: p2,
      clinic_id: DEMO_CLINIC_ID,
      first_name: "Kasper",
      phone_e164: "+4521445566",
      practitioner_preference: null,
      preferred_days: ["mon", "tue", "wed", "thu", "fri"],
      preferred_window: "morning",
      active: true,
      consent_given_at: daysAgo(10),
      expires_at: daysFromNow(20),
      created_at: daysAgo(10),
    },
    {
      id: p3,
      clinic_id: DEMO_CLINIC_ID,
      first_name: "Sofie",
      phone_e164: "+4522778899",
      practitioner_preference: "Louise",
      preferred_days: ["mon", "tue", "wed", "thu", "fri"],
      preferred_window: "any",
      active: true,
      consent_given_at: daysAgo(9),
      expires_at: daysFromNow(21),
      created_at: daysAgo(9),
    },
    {
      id: p4,
      clinic_id: DEMO_CLINIC_ID,
      first_name: "Henrik",
      phone_e164: "+4523102030",
      practitioner_preference: null,
      preferred_days: ["mon", "tue", "wed", "thu", "fri"],
      preferred_window: "afternoon",
      active: true,
      consent_given_at: daysAgo(7),
      expires_at: daysFromNow(23),
      created_at: daysAgo(7),
    },
    {
      id: p5,
      clinic_id: DEMO_CLINIC_ID,
      first_name: "Camilla",
      phone_e164: "+4524304050",
      practitioner_preference: null,
      preferred_days: ["mon", "tue", "wed", "thu", "fri"],
      preferred_window: "any",
      active: true,
      consent_given_at: daysAgo(6),
      expires_at: daysFromNow(24),
      created_at: daysAgo(6),
    },
    {
      id: p6,
      clinic_id: DEMO_CLINIC_ID,
      first_name: "Jonas",
      phone_e164: "+4525607080",
      practitioner_preference: "Anders",
      preferred_days: ["mon", "tue", "wed", "thu", "fri"],
      preferred_window: "any",
      active: true,
      consent_given_at: daysAgo(5),
      expires_at: daysFromNow(25),
      created_at: daysAgo(5),
    },
    {
      id: p7,
      clinic_id: DEMO_CLINIC_ID,
      first_name: "Freja",
      phone_e164: "+4526901020",
      practitioner_preference: null,
      preferred_days: ["mon", "tue", "wed", "thu", "fri"],
      preferred_window: "morning",
      active: true,
      consent_given_at: daysAgo(3),
      expires_at: daysFromNow(27),
      created_at: daysAgo(3),
    },
    {
      id: p8,
      clinic_id: DEMO_CLINIC_ID,
      first_name: "Mikkel",
      phone_e164: "+4527113355",
      practitioner_preference: null,
      preferred_days: ["mon", "tue", "wed", "thu", "fri"],
      preferred_window: "any",
      active: true,
      consent_given_at: daysAgo(1),
      expires_at: daysFromNow(29),
      created_at: daysAgo(1),
    },
  ];

  const claimedSlotId = "33333333-3333-4333-8333-333333333301";
  const historicalSlot1 = "33333333-3333-4333-8333-333333333302";
  const historicalSlot2 = "33333333-3333-4333-8333-333333333303";

  const openSlots: OpenSlot[] = [
    {
      id: claimedSlotId,
      clinic_id: DEMO_CLINIC_ID,
      slot_date: getLocalIsoDate(0),
      slot_time: "14:30",
      duration_minutes: 45,
      practitioner_name: "Louise",
      status: "claimed",
      claimed_by_patient_id: p3,
      claimed_at: hoursAgo(0.2),
      entered_in_calendar: false,
      wave_count: 1,
      last_wave_at: hoursAgo(0.4),
      created_at: hoursAgo(0.4),
    },
    {
      id: historicalSlot1,
      clinic_id: DEMO_CLINIC_ID,
      slot_date: getLocalIsoDate(-2),
      slot_time: "10:00",
      duration_minutes: 30,
      practitioner_name: "Anders",
      status: "claimed",
      claimed_by_patient_id: p1,
      claimed_at: daysAgo(2),
      entered_in_calendar: true,
      wave_count: 1,
      last_wave_at: daysAgo(2),
      created_at: daysAgo(2),
    },
    {
      id: historicalSlot2,
      clinic_id: DEMO_CLINIC_ID,
      slot_date: getLocalIsoDate(-4),
      slot_time: "13:15",
      duration_minutes: 45,
      practitioner_name: "Louise",
      status: "claimed",
      claimed_by_patient_id: p4,
      claimed_at: daysAgo(4),
      entered_in_calendar: true,
      wave_count: 2,
      last_wave_at: daysAgo(4),
      created_at: daysAgo(4),
    },
  ];

  const smsMessages: SmsMessage[] = [
    {
      id: crypto.randomUUID(),
      clinic_id: DEMO_CLINIC_ID,
      slot_id: claimedSlotId,
      patient_id: p3,
      direction: "outbound",
      phone_e164: "+4522778899",
      body: `Hej Sofie, FysioHuset har fået en afbudstid i dag kl. 14:30 (45 min). Svar JA på denne SMS hvis du ønsker tiden. Først til mølle!`,
      provider_message_id: "sim_seed_1",
      created_at: hoursAgo(0.4),
    },
    {
      id: crypto.randomUUID(),
      clinic_id: DEMO_CLINIC_ID,
      slot_id: claimedSlotId,
      patient_id: p3,
      direction: "inbound",
      phone_e164: "+4522778899",
      body: "JA",
      provider_message_id: "sim_seed_2",
      created_at: hoursAgo(0.2),
    },
    {
      id: crypto.randomUUID(),
      clinic_id: DEMO_CLINIC_ID,
      slot_id: claimedSlotId,
      patient_id: p3,
      direction: "outbound",
      phone_e164: "+4522778899",
      body: "Super Sofie! Tiden i dag kl. 14:30 er reserveret til dig hos FysioHuset Aarhus. Vi glæder os til at se dig.",
      provider_message_id: "sim_seed_3",
      created_at: hoursAgo(0.2),
    },
  ];

  const emailAlerts: EmailAlert[] = [
    {
      id: crypto.randomUUID(),
      clinic_id: DEMO_CLINIC_ID,
      slot_id: claimedSlotId,
      to_email: clinic.notification_email,
      subject: "HANDLING PÅKRÆVET: Afbudstid kl. 14:30 er besat",
      body: "HANDLING PÅKRÆVET: Sofie (+4522778899) har taget afbudstiden kl. 14:30. Sæt dem ind i kalenderen.",
      created_at: hoursAgo(0.2),
    },
  ];

  return {
    clinics: [clinic],
    waitlist_patients: patients,
    open_slots: openSlots,
    sms_messages: smsMessages,
    email_alerts: emailAlerts,
  };
}

const globalForStore = globalThis as unknown as {
  __afbudsmotorStoreCache?: LocalStoreData;
};

function ensureLoaded(): LocalStoreData {
  if (globalForStore.__afbudsmotorStoreCache) {
    return globalForStore.__afbudsmotorStoreCache;
  }

  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, "utf-8");
      const parsed = JSON.parse(raw) as LocalStoreData;
      globalForStore.__afbudsmotorStoreCache = parsed;
      return parsed;
    }
  } catch {
    // Corrupted local store — re-seed cleanly.
  }

  const seeded = createSeedData();
  persistStore(seeded);
  globalForStore.__afbudsmotorStoreCache = seeded;
  return seeded;
}

function persistStore(data: LocalStoreData): void {
  try {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // In read-only environments (e.g., serverless preview without Supabase), keep in-memory cache.
  }
}

export function readLocalStore(): LocalStoreData {
  return ensureLoaded();
}

export function mutateLocalStore<T>(mutator: (store: LocalStoreData) => T): T {
  const store = ensureLoaded();
  const result = mutator(store);
  persistStore(store);
  return result;
}
