"use client";

import * as React from "react";
import Link from "next/link";
import {
  ExternalLink,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
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
  addWaitlistPatientAction,
  deleteWaitlistPatientAction,
  renewWaitlistPatientAction,
  toggleWaitlistPatientActiveAction,
} from "@/app/actions";
import type {
  Clinic,
  TimeWindow,
  WaitlistPatient,
  Weekday,
} from "@/types/database";
import {
  daysUntilExpiry,
  formatDanishPhoneDisplay,
  TIME_WINDOW_LABELS,
  WEEKDAY_OPTIONS,
} from "@/lib/utils";

export function WaitlistClient({
  clinic,
  patients,
  joinUrl,
  qrSvg,
}: {
  clinic: Clinic;
  patients: WaitlistPatient[];
  joinUrl: string;
  qrSvg: string;
}) {
  const [firstName, setFirstName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [practitionerPref, setPractitionerPref] = React.useState("");
  const [preferredDays, setPreferredDays] = React.useState<Weekday[]>([
    "mon",
    "tue",
    "wed",
    "thu",
    "fri",
  ]);
  const [preferredWindow, setPreferredWindow] = React.useState<TimeWindow>("any");
  const [consent, setConsent] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [qrModalOpen, setQrModalOpen] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  function toggleDay(day: Weekday) {
    setPreferredDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  async function handleAddPatient(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    setSuccessMsg(null);

    try {
      const res = await addWaitlistPatientAction({
        first_name: firstName,
        phone,
        practitioner_preference: practitionerPref,
        preferred_days: preferredDays,
        preferred_window: preferredWindow,
        consent,
      });

      if (!res.success) {
        setError(res.error ?? "Kunne ikke tilføje patient.");
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }

      setFirstName("");
      setPhone("");
      setPractitionerPref("");
      setPreferredDays(["mon", "tue", "wed", "thu", "fri"]);
      setPreferredWindow("any");
      setSuccessMsg("Patient tilføjet til afbudslisten (udløber automatisk om 30 dage).");
      setTimeout(() => setSuccessMsg(null), 5000);
    } finally {
      setSubmitting(false);
    }
  }

  const filteredPatients = patients.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.first_name.toLowerCase().includes(q) ||
      p.phone_e164.includes(q) ||
      (p.practitioner_preference?.toLowerCase().includes(q) ?? false)
    );
  });

  const activeCount = patients.filter((p) => p.active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="no-print flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Venteliste &amp; QR-selvtilmelding
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Kun fornavn, dansk mobilnummer og tidspunktsønsker — aldrig CPR-numre eller helbredsoplysninger.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setQrModalOpen(true)}
            className="border-teal-200 bg-teal-50/70 text-[#0f6e6e] hover:bg-teal-100/80"
          >
            <QrCode className="h-4 w-4" />
            QR-plakat til venteværelse
          </Button>
          <Link
            href={`/join/${clinic.slug}`}
            target="_blank"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ExternalLink className="h-4 w-4" />
            Åbn tilmeldingsside
          </Link>
        </div>
      </div>

      {/* Main 2-column layout */}
      <div className="no-print grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Quick-Add Form */}
        <Card className="p-5 lg:col-span-4">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-[#0f6e6e]">
              <UserPlus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Hurtig tilmelding
              </h2>
              <p className="text-xs text-slate-500">
                Tilføj en patient direkte ved skranken
              </p>
            </div>
          </div>

          <form onSubmit={handleAddPatient} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="wl-first-name">Fornavn</Label>
              <Input
                id="wl-first-name"
                placeholder="F.eks. Mette"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
              {fieldErrors.first_name?.[0] && (
                <p className="text-xs text-rose-600">{fieldErrors.first_name[0]}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wl-phone">Dansk mobilnummer (+45)</Label>
              <Input
                id="wl-phone"
                type="tel"
                placeholder="20 12 34 56"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="font-mono"
              />
              {fieldErrors.phone?.[0] && (
                <p className="text-xs text-rose-600">{fieldErrors.phone[0]}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wl-practitioner">Behandlerønske (valgfri)</Label>
              <Input
                id="wl-practitioner"
                placeholder="Alle behandlere"
                value={practitionerPref}
                onChange={(e) => setPractitionerPref(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Foretrukne dage</Label>
              <div className="grid grid-cols-5 gap-1.5">
                {WEEKDAY_OPTIONS.map((d) => {
                  const selected = preferredDays.includes(d.key);
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => toggleDay(d.key)}
                      className={`h-9 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                        selected
                          ? "border-[#0f6e6e] bg-[#0f6e6e] text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {d.short}
                    </button>
                  );
                })}
              </div>
              {fieldErrors.preferred_days?.[0] && (
                <p className="text-xs text-rose-600">
                  {fieldErrors.preferred_days[0]}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Tidspunkt på dagen</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { key: "morning", label: "08–12" },
                    { key: "afternoon", label: "12–17" },
                    { key: "any", label: "Hele dagen" },
                  ] as const
                ).map((w) => (
                  <button
                    key={w.key}
                    type="button"
                    onClick={() => setPreferredWindow(w.key)}
                    className={`h-9 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      preferredWindow === w.key
                        ? "border-[#0f6e6e] bg-teal-50 text-[#0f6e6e]"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[#0f6e6e]"
              />
              <span>
                Patienten har givet mundtligt samtykke til SMS ved afbudstider (slettes automatisk efter 30 dage).
              </span>
            </label>

            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                {error}
              </p>
            )}
            {successMsg && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                {successMsg}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              <UserPlus className="h-4 w-4" />
              {submitting ? "Gemmer..." : "Tilføj til venteliste"}
            </Button>
          </form>
        </Card>

        {/* Waitlist Table / Cards */}
        <div className="space-y-4 lg:col-span-8">
          <Card className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Søg på fornavn, telefonnummer eller behandler..."
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <ShieldCheck className="h-4 w-4 text-[#0f6e6e]" />
                {activeCount} aktive af {patients.length} i alt
              </div>
            </div>
          </Card>

          <Card className="divide-y divide-slate-100 overflow-hidden">
            {filteredPatients.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                Ingen patienter matcher din søgning.
              </div>
            ) : (
              filteredPatients.map((p) => {
                const daysLeft = daysUntilExpiry(p.expires_at);
                const isBusy = busyId === p.id;
                return (
                  <div
                    key={p.id}
                    className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${
                      p.active ? "bg-white" : "bg-slate-50/70 opacity-75"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {p.first_name}
                        </span>
                        <span className="font-mono text-xs text-slate-600">
                          {formatDanishPhoneDisplay(p.phone_e164)}
                        </span>
                        <Badge variant={p.active ? "teal" : "neutral"}>
                          {p.active ? "Aktiv" : "Pauset / Frameldt"}
                        </Badge>
                        {p.practitioner_preference && (
                          <Badge variant="neutral">
                            Behandler: {p.practitioner_preference}
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span>
                          Dage:{" "}
                          <strong className="font-medium text-slate-700">
                            {p.preferred_days
                              .map(
                                (d) =>
                                  WEEKDAY_OPTIONS.find((o) => o.key === d)?.short ??
                                  d
                              )
                              .join(", ")}
                          </strong>
                        </span>
                        <span>·</span>
                        <span>{TIME_WINDOW_LABELS[p.preferred_window]}</span>
                        <span>·</span>
                        <span
                          className={
                            daysLeft <= 5 ? "font-semibold text-amber-700" : ""
                          }
                        >
                          Udløber om {daysLeft} dage
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isBusy}
                        onClick={async () => {
                          setBusyId(p.id);
                          try {
                            await renewWaitlistPatientAction(p.id);
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        title="Forlæng GDPR-udløb med 30 dage"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        +30 dage
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isBusy}
                        onClick={async () => {
                          setBusyId(p.id);
                          try {
                            await toggleWaitlistPatientActiveAction(p.id, !p.active);
                          } finally {
                            setBusyId(null);
                          }
                        }}
                      >
                        {p.active ? "Pause" : "Aktivér"}
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={isBusy}
                        aria-label={`Slet ${p.first_name}`}
                        onClick={async () => {
                          setBusyId(p.id);
                          try {
                            await deleteWaitlistPatientAction(p.id);
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        className="text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </Card>
        </div>
      </div>

      {/* Printable QR Poster Modal */}
      <Modal
        open={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        title="QR-plakat til venteværelset"
        description="Udskriv og sæt i receptionen — patienter tilmelder sig selv på 20 sekunder."
      >
        <div className="space-y-5">
          <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-[#0f6e6e]">
              {clinic.name}
            </p>
            <h3 className="mt-2 text-xl font-extrabold text-slate-900">
              Vil du have en hurtigere tid?
            </h3>
            <p className="mx-auto mt-1.5 max-w-xs text-sm text-slate-600">
              Scan QR-koden og få automatisk en SMS, når vi får en ledig afbudstid.
            </p>

            <div
              className="mx-auto my-5 flex h-52 w-52 items-center justify-center rounded-xl border border-slate-200 bg-white p-3 [&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />

            <p className="font-mono text-xs text-slate-500 break-all">
              {joinUrl}
            </p>
            <p className="mt-2 text-[11px] text-slate-400">
              Ingen CPR-nr. · Svar STOP når som helst · Slettes automatisk efter 30 dage
            </p>
          </div>

          <div className="no-print flex items-center justify-between gap-2">
            <Link
              href={`/join/${clinic.slug}`}
              target="_blank"
              className="text-sm font-semibold text-[#0f6e6e] hover:underline"
            >
              Forhåndsvis mobilside →
            </Link>
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Udskriv plakat
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
