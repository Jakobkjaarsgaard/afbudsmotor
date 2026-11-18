"use client";

import * as React from "react";
import {
  CalendarCheck2,
  CheckCircle2,
  Clock,
  Phone,
  Plus,
  Send,
  TrendingUp,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Modal,
} from "@/components/ui/primitives";
import {
  cancelOpenSlotAction,
  createOpenSlotAction,
  markSlotEnteredInCalendarAction,
} from "@/app/actions";
import type { Clinic, DashboardMetrics, OpenSlot } from "@/types/database";
import {
  formatDanishDate,
  formatDanishPhoneDisplay,
  formatDkk,
  formatTimeShort,
  getDanishDayName,
  getLocalIsoDate,
} from "@/lib/utils";

const QUICK_TIMES = ["08:30", "09:30", "10:30", "12:30", "14:00", "15:15"];
const DURATIONS = [30, 45, 60];

export function DashboardClient({
  clinic,
  metrics,
  slots,
}: {
  clinic: Clinic;
  metrics: DashboardMetrics;
  slots: OpenSlot[];
}) {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [dateMode, setDateMode] = React.useState<"today" | "tomorrow" | "custom">("today");
  const [customDate, setCustomDate] = React.useState(getLocalIsoDate(0));
  const [slotTime, setSlotTime] = React.useState("10:30");
  const [duration, setDuration] = React.useState(30);
  const [practitioner, setPractitioner] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [busySlotId, setBusySlotId] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  const selectedDate =
    dateMode === "today"
      ? getLocalIsoDate(0)
      : dateMode === "tomorrow"
        ? getLocalIsoDate(1)
        : customDate;

  async function handleCreateSlot(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      const res = await createOpenSlotAction({
        slot_date: selectedDate,
        slot_time: slotTime,
        duration_minutes: duration,
        practitioner_name: practitioner,
      });

      if (!res.success) {
        setFormError(res.error ?? "Kunne ikke oprette afbudstid.");
        return;
      }

      const sent = res.data?.sentCount ?? 0;
      setModalOpen(false);
      setPractitioner("");
      setToast(
        sent > 0
          ? `Afbudstid oprettet! Bølge 1 sendt til ${sent} matchende patient${sent === 1 ? "" : "er"}.`
          : "Afbudstid oprettet, men ingen aktive patienter på ventelisten matchede dag/tidspunkt."
      );
      setTimeout(() => setToast(null), 6000);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMarkEntered(slotId: string) {
    setBusySlotId(slotId);
    try {
      await markSlotEnteredInCalendarAction(slotId);
    } finally {
      setBusySlotId(null);
    }
  }

  async function handleCancelSlot(slotId: string) {
    setBusySlotId(slotId);
    try {
      await cancelOpenSlotAction(slotId);
    } finally {
      setBusySlotId(null);
    }
  }

  // Partition slots by urgency for receptionists
  const actionRequiredSlots = slots.filter(
    (s) => s.status === "claimed" && !s.entered_in_calendar
  );
  const openSlots = slots.filter((s) => s.status === "open");
  const historySlots = slots.filter(
    (s) =>
      (s.status === "claimed" && s.entered_in_calendar) ||
      s.status === "expired" ||
      s.status === "cancelled"
  );

  const roiRatio =
    metrics.recovered_revenue_dkk > 0
      ? (metrics.recovered_revenue_dkk / 499).toFixed(1)
      : null;

  return (
    <div className="space-y-6">
      {/* Header + Hero CTA */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Afbudsoverblik
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Log et afbud på 5 sekunder — systemet sender automatisk SMS til ventelisten og låser tiden til første <strong className="font-semibold text-slate-800">JA</strong>.
          </p>
        </div>

        <Button
          id="hero-create-slot-btn"
          size="lg"
          onClick={() => setModalOpen(true)}
          className="h-12 shrink-0 px-6 text-base shadow-md"
        >
          <Plus className="h-5 w-5" />
          Opret Afbudstid
        </Button>
      </div>

      {toast && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-950">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-[#0f6e6e]" />
            <span>{toast}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-xs font-semibold text-teal-800 hover:underline cursor-pointer"
          >
            Luk
          </button>
        </div>
      )}

      {/* Top KPI Strip (ROI Anchor prominent) */}
      <section
        aria-label="Nøgletal denne måned"
        className="grid grid-cols-1 gap-4 md:grid-cols-3"
      >
        <Card className="relative overflow-hidden border-teal-200/80 bg-gradient-to-br from-white via-white to-teal-50/50 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#0f6e6e]">
                Indtjent via afbud denne måned
              </p>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 tabular-nums">
                {formatDkk(metrics.recovered_revenue_dkk)}
              </p>
              <p className="mt-1.5 text-xs text-slate-600">
                Baseret på {formatDkk(clinic.avg_slot_value_dkk)} pr. tid
                {roiRatio && (
                  <span className="ml-1.5 inline-flex items-center rounded-md bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-800">
                    {roiRatio}× ROI
                  </span>
                )}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100/80 text-[#0f6e6e]">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Afsatte afbudstider (denne md.)
              </p>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 tabular-nums">
                {metrics.filled_this_month}
              </p>
              <p className="mt-1.5 text-xs text-slate-500">
                {metrics.pending_calendar_entry_count > 0
                  ? `${metrics.pending_calendar_entry_count} afventer indtastning i kalender`
                  : "Alle besatte tider er i kalenderen"}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <CalendarCheck2 className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Aktive på venteliste
              </p>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 tabular-nums">
                {metrics.active_waitlist_count}
              </p>
              <p className="mt-1.5 text-xs text-slate-500">
                Klar til øjeblikkelig SMS-udsendelse (30-dages GDPR)
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Users className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </section>

      {/* Live Slot Feed */}
      <section aria-label="Aktive afbudstider" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            Live afbudsfeed
          </h2>
          <span className="text-xs font-medium text-slate-500">
            {openSlots.length} åbne · {actionRequiredSlots.length} skal i kalenderen
          </span>
        </div>

        {/* 1. Claimed — Action Required (Pulsing Green) */}
        {actionRequiredSlots.map((slot) => (
          <Card
            key={slot.id}
            className="animate-claimed-pulse border-2 border-emerald-500 bg-emerald-50/40 p-5"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="emerald" className="px-3 py-1 text-xs font-bold">
                    <span className="h-2 w-2 animate-ping rounded-full bg-emerald-600" />
                    BESAT — Sæt i kalender
                  </Badge>
                  <span className="text-xs font-medium text-emerald-900">
                    +{formatDkk(clinic.avg_slot_value_dkk)} sikret
                  </span>
                </div>

                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <p className="text-lg font-bold capitalize text-slate-900">
                    {getDanishDayName(slot.slot_date)} d.{" "}
                    {formatDanishDate(slot.slot_date)} kl.{" "}
                    <span className="tabular-nums">
                      {formatTimeShort(slot.slot_time)}
                    </span>
                  </p>
                  <span className="text-sm font-medium text-slate-600">
                    {slot.duration_minutes} min.
                    {slot.practitioner_name ? ` · ${slot.practitioner_name}` : ""}
                  </span>
                </div>

                {slot.claimed_by_patient && (
                  <div className="inline-flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-white px-3.5 py-2 text-sm">
                    <span className="flex items-center gap-1.5 font-bold text-slate-900">
                      <UserCheck className="h-4 w-4 text-emerald-600" />
                      {slot.claimed_by_patient.first_name}
                    </span>
                    <a
                      href={`tel:${slot.claimed_by_patient.phone_e164}`}
                      className="flex items-center gap-1 font-mono text-xs font-semibold text-[#0f6e6e] hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {formatDanishPhoneDisplay(slot.claimed_by_patient.phone_e164)}
                    </a>
                  </div>
                )}
              </div>

              <Button
                variant="success"
                size="lg"
                disabled={busySlotId === slot.id}
                onClick={() => handleMarkEntered(slot.id)}
                className="shrink-0"
              >
                <CheckCircle2 className="h-5 w-5" />
                Marker som indtastet i kalender
              </Button>
            </div>
          </Card>
        ))}

        {/* 2. Open — Awaiting SMS Replies (Amber) */}
        {openSlots.map((slot) => (
          <Card
            key={slot.id}
            className="border-amber-200/90 bg-white p-5 transition-shadow hover:shadow-sm"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="amber">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    Afventer svar ({slot.sent_sms_count ?? 0} SMS sendt)
                  </Badge>
                  <Badge variant="neutral">Bølge {slot.wave_count || 1} af 2</Badge>
                </div>

                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <p className="text-lg font-bold capitalize text-slate-900">
                    {getDanishDayName(slot.slot_date)} d.{" "}
                    {formatDanishDate(slot.slot_date)} kl.{" "}
                    <span className="tabular-nums">
                      {formatTimeShort(slot.slot_time)}
                    </span>
                  </p>
                  <span className="text-sm text-slate-600">
                    {slot.duration_minutes} min.
                    {slot.practitioner_name ? ` · ${slot.practitioner_name}` : ""}
                  </span>
                </div>

                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock className="h-3.5 w-3.5" />
                  Bølge 2 sendes automatisk efter 15 min., hvis ingen har svaret JA.
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                disabled={busySlotId === slot.id}
                onClick={() => handleCancelSlot(slot.id)}
                className="shrink-0 text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
              >
                <XCircle className="h-4 w-4" />
                Annuller tid
              </Button>
            </div>
          </Card>
        ))}

        {actionRequiredSlots.length === 0 && openSlots.length === 0 && (
          <Card className="border-dashed p-10 text-center">
            <p className="text-base font-semibold text-slate-800">
              Ingen aktive afbudstider lige nu
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Klik på <strong>+ Opret Afbudstid</strong> så snart en patient melder afbud, så går SMS-udsendelsen i gang med det samme.
            </p>
          </Card>
        )}
      </section>

      {/* Historical / Completed Slots */}
      {historySlots.length > 0 && (
        <section aria-label="Tidligere afbudstider" className="space-y-3 pt-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Seneste afsluttede tider
          </h2>
          <Card className="divide-y divide-slate-100 overflow-hidden">
            {historySlots.slice(0, 8).map((slot) => (
              <div
                key={slot.id}
                className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-sm font-semibold capitalize text-slate-800">
                    {getDanishDayName(slot.slot_date)} d.{" "}
                    {formatDanishDate(slot.slot_date)} kl.{" "}
                    <span className="tabular-nums">
                      {formatTimeShort(slot.slot_time)}
                    </span>
                  </span>
                  <span className="text-xs text-slate-500">
                    {slot.duration_minutes} min.
                    {slot.practitioner_name ? ` · ${slot.practitioner_name}` : ""}
                  </span>
                  {slot.claimed_by_patient && (
                    <span className="text-xs font-medium text-slate-700">
                      · Booket af {slot.claimed_by_patient.first_name} (
                      {formatDanishPhoneDisplay(slot.claimed_by_patient.phone_e164)})
                    </span>
                  )}
                </div>

                <div>
                  {slot.status === "claimed" && (
                    <Badge variant="teal">
                      <CheckCircle2 className="h-3 w-3" />
                      Indtastet i kalender
                    </Badge>
                  )}
                  {slot.status === "expired" && (
                    <Badge variant="neutral">Udløbet</Badge>
                  )}
                  {slot.status === "cancelled" && (
                    <Badge variant="rose">Annulleret</Badge>
                  )}
                </div>
              </div>
            ))}
          </Card>
        </section>
      )}

      {/* Fast Create Open Slot Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Opret Afbudstid"
        description="Systemet sender straks SMS (Bølge 1) til de 5 længst-ventende matchende patienter."
      >
        <form onSubmit={handleCreateSlot} className="space-y-5">
          {/* Date Quick Picker */}
          <div className="space-y-2">
            <Label>Dato</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "today" as const, label: "I dag" },
                { key: "tomorrow" as const, label: "I morgen" },
                { key: "custom" as const, label: "Vælg dato" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setDateMode(opt.key)}
                  className={`h-10 rounded-lg border text-sm font-semibold transition-colors cursor-pointer ${
                    dateMode === opt.key
                      ? "border-[#0f6e6e] bg-teal-50 text-[#0f6e6e]"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {dateMode === "custom" && (
              <Input
                type="date"
                value={customDate}
                min={getLocalIsoDate(0)}
                onChange={(e) => setCustomDate(e.target.value)}
                required
              />
            )}
          </div>

          {/* Time Picker */}
          <div className="space-y-2">
            <Label htmlFor="slot-time">Tidspunkt</Label>
            <Input
              id="slot-time"
              type="time"
              value={slotTime}
              onChange={(e) => setSlotTime(e.target.value)}
              required
              className="font-mono text-base"
            />
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TIMES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSlotTime(t)}
                  className={`rounded-md border px-2.5 py-1 font-mono text-xs font-semibold transition-colors cursor-pointer ${
                    slotTime === t
                      ? "border-[#0f6e6e] bg-[#0f6e6e] text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>Varighed</Label>
            <div className="grid grid-cols-3 gap-2">
              {DURATIONS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDuration(mins)}
                  className={`h-10 rounded-lg border text-sm font-semibold transition-colors cursor-pointer ${
                    duration === mins
                      ? "border-[#0f6e6e] bg-teal-50 text-[#0f6e6e]"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {mins} min.
                </button>
              ))}
            </div>
          </div>

          {/* Practitioner (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="practitioner-name">Behandler (valgfri)</Label>
            <Input
              id="practitioner-name"
              placeholder="F.eks. Anders eller Louise"
              value={practitioner}
              onChange={(e) => setPractitioner(e.target.value)}
            />
          </div>

          {formError && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {formError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModalOpen(false)}
            >
              Annuller
            </Button>
            <Button type="submit" size="lg" disabled={submitting}>
              <Send className="h-4 w-4" />
              {submitting ? "Sender SMS..." : "Opret & send SMS"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
