export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri";

export type TimeWindow = "morning" | "afternoon" | "any";

export type SlotStatus = "open" | "claimed" | "expired" | "cancelled";

export type SmsDirection = "outbound" | "inbound";

export interface Clinic {
  id: string;
  slug: string;
  name: string;
  avg_slot_value_dkk: number;
  sms_sender_name: string;
  notification_email: string;
  created_at: string;
}

export interface WaitlistPatient {
  id: string;
  clinic_id: string;
  first_name: string;
  phone_e164: string;
  practitioner_preference: string | null;
  preferred_days: Weekday[];
  preferred_window: TimeWindow;
  active: boolean;
  consent_given_at: string;
  expires_at: string;
  created_at: string;
}

export interface OpenSlot {
  id: string;
  clinic_id: string;
  slot_date: string; // YYYY-MM-DD
  slot_time: string; // HH:MM or HH:MM:SS
  duration_minutes: number;
  practitioner_name: string | null;
  status: SlotStatus;
  claimed_by_patient_id: string | null;
  claimed_at: string | null;
  entered_in_calendar: boolean;
  wave_count: number;
  last_wave_at: string | null;
  created_at: string;
  // Enriched view fields
  claimed_by_patient?: Pick<WaitlistPatient, "id" | "first_name" | "phone_e164"> | null;
  sent_sms_count?: number;
}

export interface SmsMessage {
  id: string;
  clinic_id: string;
  slot_id: string | null;
  patient_id: string | null;
  direction: SmsDirection;
  phone_e164: string;
  body: string;
  provider_message_id: string | null;
  created_at: string;
}

export interface EmailAlert {
  id: string;
  clinic_id: string;
  slot_id: string;
  to_email: string;
  subject: string;
  body: string;
  created_at: string;
}

export interface DashboardMetrics {
  filled_this_month: number;
  recovered_revenue_dkk: number;
  active_waitlist_count: number;
  open_slots_count: number;
  pending_calendar_entry_count: number;
}
