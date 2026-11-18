"use client";

import * as React from "react";
import { CheckCircle2, ShieldCheck, Smartphone } from "lucide-react";
import { Button, Card, Input, Label } from "@/components/ui/primitives";
import { publicJoinWaitlistAction } from "@/app/actions";
import type { Clinic, TimeWindow, Weekday } from "@/types/database";
import { WEEKDAY_OPTIONS } from "@/lib/utils";

export function PublicJoinForm({ clinic }: { clinic: Clinic }) {
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
  const [consent, setConsent] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [submitted, setSubmitted] = React.useState(false);

  function toggleDay(day: Weekday) {
    setPreferredDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      const res = await publicJoinWaitlistAction(clinic.slug, {
        first_name: firstName,
        phone,
        practitioner_preference: practitionerPref,
        preferred_days: preferredDays,
        preferred_window: preferredWindow,
        consent,
      });

      if (!res.success) {
        setError(res.error ?? "Kunne ikke gemme din tilmelding.");
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }

      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card className="p-7 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-slate-900">
          Du står nu på afbudslisten!
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Tak, <strong>{firstName}</strong>. Når {clinic.name} får en ledig afbudstid der passer til dine ønsker, får du en SMS. Svar blot <strong>JA</strong> for at sikre dig tiden.
        </p>
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Din tilmelding slettes automatisk efter 30 dage. Du kan når som helst svare <strong>STOP</strong> på en SMS for at afmelde.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="join-first-name">Dit fornavn</Label>
          <Input
            id="join-first-name"
            placeholder="F.eks. Sofie"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            autoComplete="given-name"
          />
          {fieldErrors.first_name?.[0] && (
            <p className="text-xs text-rose-600">{fieldErrors.first_name[0]}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="join-phone">Dit mobilnummer (+45)</Label>
          <Input
            id="join-phone"
            type="tel"
            placeholder="20 12 34 56"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            autoComplete="tel"
            className="font-mono text-base"
          />
          {fieldErrors.phone?.[0] && (
            <p className="text-xs text-rose-600">{fieldErrors.phone[0]}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Hvilke dage kan du møde ind?</Label>
          <div className="grid grid-cols-5 gap-1.5">
            {WEEKDAY_OPTIONS.map((d) => {
              const selected = preferredDays.includes(d.key);
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => toggleDay(d.key)}
                  className={`h-11 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                    selected
                      ? "border-[#0f6e6e] bg-[#0f6e6e] text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {d.short}
                </button>
              );
            })}
          </div>
          {fieldErrors.preferred_days?.[0] && (
            <p className="text-xs text-rose-600">{fieldErrors.preferred_days[0]}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Hvornår på dagen passer det bedst?</Label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { key: "morning", label: "Formiddag", sub: "08–12" },
                { key: "afternoon", label: "Eftermiddag", sub: "12–17" },
                { key: "any", label: "Hele dagen", sub: "08–17" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setPreferredWindow(opt.key)}
                className={`rounded-lg border px-2 py-2.5 text-center transition-colors cursor-pointer ${
                  preferredWindow === opt.key
                    ? "border-[#0f6e6e] bg-teal-50 text-[#0f6e6e]"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="block text-xs font-bold">{opt.label}</span>
                <span className="block text-[11px] opacity-75">{opt.sub}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="join-practitioner">
            Ønsket behandler <span className="font-normal text-slate-400">(valgfri)</span>
          </Label>
          <Input
            id="join-practitioner"
            placeholder="Lad feltet stå tomt for alle behandlere"
            value={practitionerPref}
            onChange={(e) => setPractitionerPref(e.target.value)}
          />
        </div>

        {/* Explicit GDPR consent */}
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-[#0f6e6e]"
          />
          <span>
            Jeg giver samtykke til, at <strong>{clinic.name}</strong> må sende mig SMS-beskeder ved ledige afbudstider. Mine oplysninger slettes automatisk efter 30 dage, og jeg kan til enhver tid svare <strong>STOP</strong>.
          </span>
        </label>
        {fieldErrors.consent?.[0] && (
          <p className="text-xs text-rose-600">{fieldErrors.consent[0]}</p>
        )}

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          <Smartphone className="h-4 w-4" />
          {submitting ? "Tilmelder..." : "Tilmeld afbudslisten"}
        </Button>

        <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-[#0f6e6e]" />
          <span>Vi gemmer aldrig CPR-nummer eller helbredsoplysninger</span>
        </div>
      </form>
    </Card>
  );
}
