# Master Spec: AfbudsMotor (B2B Micro-SaaS MVP)

## 1. Business & Product Context

- **Product:** A lightweight, calendar-agnostic SMS cancellation-fill and patient recall engine for private Danish clinics (physiotherapists, chiropractors, dentists, psychologists).
- **Core Problem:** Late cancellations (under 24 hours) cost clinics 600–1,200 DKK per empty slot. Receptionists do not have time to manually call down a waitlist.
- **Core Value Proposition:** When a cancellation happens, the receptionist logs the open time in 5 seconds. The system automatically texts matching waitlist patients, locks the slot to the first person who replies `JA`, and notifies the clinic to place them in their existing booking system.
- **MVP Wedge (No EHR Integration):** Do not build direct API integrations into ClinicCare, Terapeut Booking, or DentalSuite for v1. Build a standalone web app with audio/visual browser alerts and email notifications when a slot is claimed.
- **Monetization & ROI Anchor:** 499 DKK/month flat subscription per clinic. The dashboard must prominently display **"Indtjent via afbud denne måned"** (recovered revenue based on clinic's average treatment price) to make the ROI obvious and eliminate churn.

## 2. Strict Data Minimization & GDPR Rules

To avoid heavy clinical compliance (MDR / sundhedslovgivning) and keep the databehandleraftale simple:

- **Zero Clinical Data:** Never store CPR numbers, diagnoses, injury descriptions, or treatment notes.
- **Allowed Patient Fields Only:** First name, mobile phone number (E.164 format, e.g., `+45XXXXXXXX`), practitioner preference (optional), preferred days/time-of-day windows, and SMS consent timestamp.
- **Auto-Expiry:** Waitlist entries automatically expire and anonymize/delete after 30 days unless renewed, keeping the list fresh and compliant with GDPR storage limitation principles.

## 3. Recommended Tech Stack

- **Framework:** Next.js 15 (App Router, TypeScript, Server Actions)
- **Styling & UI:** Tailwind CSS + shadcn/ui (clean, high-contrast clinical aesthetic; mobile-first for receptionists)
- **Database & Auth:** Supabase (PostgreSQL + Row Level Security + Email/Magic Link Auth)
- **SMS Gateway:** Abstracted behind `lib/sms.ts` supporting GatewayAPI (preferred for Danish `+45` sender IDs and pricing) or Twilio, including an incoming webhook endpoint (`/api/webhooks/sms`).
- **Background Jobs / Cron:** Vercel Cron (runs every 5 minutes to advance staggered SMS waves and expire stale slots).

## 4. Database Schema (PostgreSQL)

```sql
-- Clinics (Tenants)
CREATE TABLE clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  avg_slot_value_dkk INTEGER NOT NULL DEFAULT 650,
  sms_sender_name TEXT NOT NULL DEFAULT 'Klinikken',
  notification_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Waitlist Patients (Non-clinical data only)
CREATE TABLE waitlist_patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  phone_e164 TEXT NOT NULL,
  preferred_days TEXT[] NOT NULL DEFAULT ARRAY['mon','tue','wed','thu','fri'],
  preferred_window TEXT NOT NULL DEFAULT 'any', -- 'morning' (08-12), 'afternoon' (12-17), 'any'
  active BOOLEAN NOT NULL DEFAULT true,
  consent_given_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Open Cancellation Slots
CREATE TABLE open_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  slot_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  practitioner_name TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'claimed', 'expired', 'cancelled'
  claimed_by_patient_id UUID REFERENCES waitlist_patients(id),
  claimed_at TIMESTAMPTZ,
  wave_count INTEGER NOT NULL DEFAULT 0,
  last_wave_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Outbound & Inbound SMS Audit Log
CREATE TABLE sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  slot_id UUID REFERENCES open_slots(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES waitlist_patients(id) ON DELETE SET NULL,
  direction TEXT NOT NULL, -- 'outbound' | 'inbound'
  phone_e164 TEXT NOT NULL,
  body TEXT NOT NULL,
  provider_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for webhook lookup and cron processing
CREATE INDEX idx_waitlist_active ON waitlist_patients(clinic_id, active);
CREATE INDEX idx_slots_status ON open_slots(status, slot_date);
CREATE INDEX idx_sms_phone ON sms_messages(phone_e164, created_at DESC);
```

## 5. Core Logic & SMS State Machine

### A. Cascade Broadcast Logic (Preventing Spam & Double-Booking)

- When a clinic creates an `open_slot` (e.g., Tomorrow at 10:30), query `waitlist_patients` where `active = true`, `expires_at` is in the future, and the slot's weekday and time window (morning vs. afternoon) match.
- **Wave 1:** Send an SMS to the top 5 longest-waiting matching patients:
  > "Hej {first_name}, {clinic.sms_sender_name} har fået en afbudstid {day_name} d. {date} kl. {time} ({duration} min). Svar JA på denne SMS hvis du ønsker tiden. Først til mølle!"
- **Wave 2 (Cron Job):** If `status` is still `'open'` after 15 minutes and `wave_count` is `1`, send to the next 5 matching patients.

### B. Atomic Slot-Claim Webhook (`/api/webhooks/sms`)

When an inbound SMS arrives from `{phone_e164}`:

1. Normalize body (`trim().toUpperCase()`).
2. **Opt-out handling:** If body is `STOP` or `AFMELD`, set `active = false` for that phone number and reply:
   > "Du er nu frameldt afbudslisten hos {clinic_name}."
3. **Claim handling:** If body starts with `JA`:
   - Find the most recent `open_slot` offered to this `phone_e164` within the last 12 hours.
   - Execute an atomic database update so two simultaneous replies cannot both win:
     ```sql
     UPDATE open_slots
     SET status = 'claimed', claimed_by_patient_id = $patient_id, claimed_at = now()
     WHERE id = $slot_id AND status = 'open'
     RETURNING *;
     ```
   - **If 1 row updated (Winner):**
     - Reply to patient:
       > "Super {first_name}! Tiden {day_name} kl. {time} er reserveret til dig hos {clinic_name}. Vi glæder os til at se dig."
     - Trigger real-time UI update (Supabase Realtime) + browser chime + email alert to `clinic.notification_email`:
       > "HANDLING PÅKRÆVET: {first_name} ({phone}) har taget afbudstiden kl. {time}. Sæt dem ind i kalenderen."
   - **If 0 rows updated (Slot already taken):**
     - Reply to patient:
       > "Beklager {first_name}, tiden blev desværre lige taget af en anden. Du står stadig på ventelisten til næste ledige tid!"

## 6. UI Screens & Components (All User-Facing Text in Danish)

- **`/dashboard` (Main Receptionist View):**
  - Top KPI Strip: *Afsatte afbudstider (denne md.)*, *Estimeret meromsætning (DKK)*, *Aktive på venteliste*.
  - Hero Action Button: Large `+ Opret Afbudstid` button opening a fast modal (Date: Today/Tomorrow/Pick date, Time picker, Duration: 30/45/60 min, Practitioner optional).
  - Live Slot Feed: Cards showing `Afventer svar (5 SMS sendt)` in amber, and `BESAT — Sæt i kalender` in pulsing green with a `Marker som indtastet i kalender` confirmation button.
- **`/waitlist` (Patient Management + QR Self-Signup):**
  - Quick-add form (Name, Mobile `+45`, Days checkboxes, Morning/Afternoon toggle).
  - Clinic QR Poster View (`/join/[clinicSlug]`): Public mobile page where patients in the waiting room can scan a QR code, enter their name/phone/preferences, tick GDPR consent, and add themselves to the waitlist without receptionist work.
- **`/settings` (Clinic Configuration):**
  - Edit clinic name, SMS sender ID (max 11 chars), average treatment value (DKK), and notification email.

## 7. Execution Roadmap for Agentic Coder

- **Phase 1 — Foundation:** Scaffold Next.js + TypeScript + Tailwind + shadcn/ui. Create Supabase client helpers, SQL migration file from Section 4, and mock auth/tenant context for local dev.
- **Phase 2 — Core UI & Waitlist:** Build `/dashboard`, `/waitlist`, and the public `/join/[clinicSlug]` QR signup form with full Danish UI copy and Zod validation for `+45` Danish phone numbers.
- **Phase 3 — SMS Engine & Simulator:** Implement `lib/sms.ts` (with a built-in Dev SMS Simulator drawer in the UI so outbound/inbound `JA` and `STOP` texts can be tested locally without spending SMS credits), plus `/api/webhooks/sms` with the atomic claim lock.
- **Phase 4 — Cron & Realtime Alerts:** Add Supabase Realtime subscription on `open_slots` for instant green-banner + audio alert when a slot flips to claimed, plus the Vercel Cron route for Wave 2 escalation and 30-day waitlist cleanup.
