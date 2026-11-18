# AfbudsMotor (B2B Micro-SaaS MVP)

Kalenderuafhængig SMS-afbudsmotor til private danske klinikker (fysioterapeuter, kiropraktorer, tandlæger, psykologer).

Se den fulde tekniske og forretningsmæssige specifikation i [`SPEC.md`](./SPEC.md).

## Funktioner (Fase 1–4 implementeret)

- **Fase 1 — Foundation:** Next.js 15 (App Router, TypeScript, Server Actions), Tailwind CSS, Supabase SSR/Admin-klienter, PostgreSQL-migrering ([`supabase/migrations/001_initial_schema.sql`](./supabase/migrations/001_initial_schema.sql)) med RLS + atomisk `claim_open_slot`-funktion, samt zero-config lokal dev-store så appen kører med det samme.
- **Fase 2 — Core UI & Venteliste:** Dansk receptions-dashboard (`/dashboard`) med ROI-ankret *"Indtjent via afbud denne måned"*, 5-sekunders *"+ Opret Afbudstid"*-modal, ventelistestyring (`/waitlist`) med printbar QR-plakat, offentlig mobil-selvtilmelding (`/join/[clinicSlug]`), klinikindstillinger (`/settings`) og streng Zod-validering af danske `+45`-numre.
- **Fase 3 — SMS-motor & Simulator:** `lib/sms.ts` med understøttelse for **GatewayAPI**, **Twilio** og indbygget **Dev SMS Simulator** i brugerfladen, kaskade-udsendelse i bølger á 5 patienter (`lib/cascade.ts`), samt `/api/webhooks/sms` med `STOP`/`AFMELD`-framelding og atomisk `JA`-lås mod dobbeltbooking.
- **Fase 4 — Cron & Realtime Alerts:** Supabase Realtime-abonnement (samt lokal SSE-stream i dev-mode) med øjeblikkeligt grønt banner og Web Audio-lydsignal når en tid bliver besat, plus Vercel Cron (`/api/cron/process-waves`, hvert 5. minut via `vercel.json`) til Bølge 2-eskalering, udløb af gamle tider og 30-dages GDPR-oprydning.

## Kom hurtigt i gang lokalt

```bash
npm install
npm run dev
```

Åbn [http://localhost:3000/dashboard](http://localhost:3000/dashboard). Uden miljøvariabler kører appen automatisk i **Local Dev / Demo Mode** med seedet demoklinik (*FysioHuset Aarhus*) og den indbyggede **SMS Simulator**-skuffe (klik på **SMS Simulator** i topbaren for at simulere `JA`, `STOP`, kapløb mellem 2 samtidige `JA`-svar og Bølge 2 Cron).

## Produktion (Supabase + GatewayAPI + Vercel)

1. Kør [`supabase/migrations/001_initial_schema.sql`](./supabase/migrations/001_initial_schema.sql) i dit Supabase-projekt.
2. Kopiér `.env.example` til `.env.local` og udfyld `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GATEWAYAPI_TOKEN` og `CRON_SECRET`.
3. Konfigurér GatewayAPI/Twilio inbound SMS webhook til `POST https://<dit-domæne>/api/webhooks/sms`.
4. Deploy på Vercel — `vercel.json` aktiverer automatisk Cron hvert 5. minut.
