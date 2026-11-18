-- AfbudsMotor Initial Schema
-- Strict GDPR Data Minimization: Zero clinical data (no CPR, diagnoses, or notes).

-- Clinics (Tenants)
CREATE TABLE IF NOT EXISTS clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avg_slot_value_dkk INTEGER NOT NULL DEFAULT 650,
  sms_sender_name TEXT NOT NULL DEFAULT 'Klinikken' CHECK (char_length(sms_sender_name) <= 11),
  notification_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Waitlist Patients (Non-clinical data only)
CREATE TABLE IF NOT EXISTS waitlist_patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  phone_e164 TEXT NOT NULL,
  practitioner_preference TEXT,
  preferred_days TEXT[] NOT NULL DEFAULT ARRAY['mon','tue','wed','thu','fri'],
  preferred_window TEXT NOT NULL DEFAULT 'any' CHECK (preferred_window IN ('morning', 'afternoon', 'any')), -- 'morning' (08-12), 'afternoon' (12-17), 'any'
  active BOOLEAN NOT NULL DEFAULT true,
  consent_given_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Open Cancellation Slots
CREATE TABLE IF NOT EXISTS open_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  slot_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  practitioner_name TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'expired', 'cancelled')),
  claimed_by_patient_id UUID REFERENCES waitlist_patients(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  entered_in_calendar BOOLEAN NOT NULL DEFAULT false,
  wave_count INTEGER NOT NULL DEFAULT 0,
  last_wave_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Outbound & Inbound SMS Audit Log
CREATE TABLE IF NOT EXISTS sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  slot_id UUID REFERENCES open_slots(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES waitlist_patients(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  phone_e164 TEXT NOT NULL,
  body TEXT NOT NULL,
  provider_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for webhook lookup and cron processing
CREATE INDEX IF NOT EXISTS idx_waitlist_active ON waitlist_patients(clinic_id, active);
CREATE INDEX IF NOT EXISTS idx_waitlist_expires ON waitlist_patients(expires_at) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_slots_status ON open_slots(status, slot_date);
CREATE INDEX IF NOT EXISTS idx_sms_phone ON sms_messages(phone_e164, created_at DESC);

-- Atomic slot-claim function to guarantee zero double-bookings under concurrent JA replies
CREATE OR REPLACE FUNCTION claim_open_slot(p_slot_id UUID, p_patient_id UUID)
RETURNS SETOF open_slots
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE open_slots
  SET
    status = 'claimed',
    claimed_by_patient_id = p_patient_id,
    claimed_at = now()
  WHERE id = p_slot_id
    AND status = 'open'
  RETURNING *;
$$;

-- Row Level Security (RLS)
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE open_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;

-- Clinics: Owners can read/update their own clinic; public can read slug + name for QR self-signup
CREATE POLICY "clinic_owner_select" ON clinics
  FOR SELECT USING (auth.uid() = owner_user_id);

CREATE POLICY "clinic_owner_update" ON clinics
  FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "clinic_public_slug_lookup" ON clinics
  FOR SELECT USING (true);

-- Waitlist: Clinic owners can manage their waitlist; public can insert via QR self-signup
CREATE POLICY "waitlist_clinic_all" ON waitlist_patients
  FOR ALL USING (
    clinic_id IN (SELECT id FROM clinics WHERE owner_user_id = auth.uid())
  );

CREATE POLICY "waitlist_public_signup_insert" ON waitlist_patients
  FOR INSERT WITH CHECK (true);

-- Open Slots: Clinic owners can manage their slots
CREATE POLICY "slots_clinic_all" ON open_slots
  FOR ALL USING (
    clinic_id IN (SELECT id FROM clinics WHERE owner_user_id = auth.uid())
  );

-- SMS Messages: Clinic owners can view their audit log
CREATE POLICY "sms_clinic_select" ON sms_messages
  FOR SELECT USING (
    clinic_id IN (SELECT id FROM clinics WHERE owner_user_id = auth.uid())
  );

-- Enable Supabase Realtime on open_slots for instant receptionist alerts
ALTER PUBLICATION supabase_realtime ADD TABLE open_slots;
