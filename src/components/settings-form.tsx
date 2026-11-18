"use client";

import * as React from "react";
import { CheckCircle2, Save, ShieldCheck } from "lucide-react";
import { Button, Card, Input, Label } from "@/components/ui/primitives";
import { updateClinicSettingsAction } from "@/app/actions";
import type { Clinic } from "@/types/database";
import { formatDkk } from "@/lib/utils";

export function SettingsForm({ clinic }: { clinic: Clinic }) {
  const [name, setName] = React.useState(clinic.name);
  const [smsSenderName, setSmsSenderName] = React.useState(clinic.sms_sender_name);
  const [avgSlotValue, setAvgSlotValue] = React.useState(
    String(clinic.avg_slot_value_dkk)
  );
  const [notificationEmail, setNotificationEmail] = React.useState(
    clinic.notification_email
  );
  const [slug, setSlug] = React.useState(clinic.slug);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [saved, setSaved] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    setSaved(false);

    try {
      const res = await updateClinicSettingsAction({
        name,
        sms_sender_name: smsSenderName,
        avg_slot_value_dkk: Number(avgSlotValue),
        notification_email: notificationEmail,
        slug,
      });

      if (!res.success) {
        setError(res.error ?? "Kunne ikke gemme indstillinger.");
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } finally {
      setSubmitting(false);
    }
  }

  const parsedValue = Number(avgSlotValue) || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Klinikindstillinger
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Tilpas afsendernavn på SMS, gennemsnitlig behandlingspris og modtager-e-mail for besatte tider.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="p-6 lg:col-span-7">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="clinic-name">Kliniknavn</Label>
              <Input
                id="clinic-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              {fieldErrors.name?.[0] && (
                <p className="text-xs text-rose-600">{fieldErrors.name[0]}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="sms-sender">SMS-afsender (Afsender-ID)</Label>
                <span
                  className={`font-mono text-xs ${
                    smsSenderName.length > 11
                      ? "font-bold text-rose-600"
                      : "text-slate-500"
                  }`}
                >
                  {smsSenderName.length}/11 tegn
                </span>
              </div>
              <Input
                id="sms-sender"
                maxLength={11}
                value={smsSenderName}
                onChange={(e) => setSmsSenderName(e.target.value)}
                required
              />
              <p className="text-xs text-slate-500">
                Vises som afsender på patientens mobil (maks. 11 bogstaver/tal uden specialtegn).
              </p>
              {fieldErrors.sms_sender_name?.[0] && (
                <p className="text-xs text-rose-600">
                  {fieldErrors.sms_sender_name[0]}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="avg-value">
                Gennemsnitlig behandlingspris (DKK)
              </Label>
              <Input
                id="avg-value"
                type="number"
                min={100}
                max={25000}
                step={25}
                value={avgSlotValue}
                onChange={(e) => setAvgSlotValue(e.target.value)}
                required
                className="font-mono"
              />
              <p className="text-xs text-slate-500">
                Bruges til at beregne &ldquo;Indtjent via afbud denne måned&rdquo; på overblikket.
              </p>
              {fieldErrors.avg_slot_value_dkk?.[0] && (
                <p className="text-xs text-rose-600">
                  {fieldErrors.avg_slot_value_dkk[0]}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notif-email">E-mail til notifikationer</Label>
              <Input
                id="notif-email"
                type="email"
                value={notificationEmail}
                onChange={(e) => setNotificationEmail(e.target.value)}
                required
              />
              <p className="text-xs text-slate-500">
                Modtager straks en &ldquo;HANDLING PÅKRÆVET&rdquo;-mail, når en patient svarer JA.
              </p>
              {fieldErrors.notification_email?.[0] && (
                <p className="text-xs text-rose-600">
                  {fieldErrors.notification_email[0]}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="clinic-slug">QR-tilmeldingslink (URL-navn)</Label>
              <div className="flex items-center rounded-lg border border-slate-300 bg-slate-50 pl-3">
                <span className="text-xs text-slate-500">/join/</span>
                <Input
                  id="clinic-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  required
                  className="border-0 bg-transparent font-mono focus:ring-0"
                />
              </div>
              {fieldErrors.slug?.[0] && (
                <p className="text-xs text-rose-600">{fieldErrors.slug[0]}</p>
              )}
            </div>

            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                {error}
              </p>
            )}

            {saved && (
              <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                Indstillinger gemt!
              </p>
            )}

            <Button type="submit" size="lg" disabled={submitting}>
              <Save className="h-4 w-4" />
              {submitting ? "Gemmer..." : "Gem indstillinger"}
            </Button>
          </form>
        </Card>

        {/* Side Info Cards */}
        <div className="space-y-4 lg:col-span-5">
          <Card className="p-5">
            <h2 className="text-sm font-bold text-slate-900">
              Abonnement &amp; ROI-beregning
            </h2>
            <p className="mt-1.5 text-sm text-slate-600">
              AfbudsMotor koster <strong>499 kr./md.</strong> fast pr. klinik — uanset antal afbudstider.
            </p>
            <div className="mt-4 rounded-xl bg-teal-50/70 p-4 text-xs text-teal-950">
              <p className="font-semibold">
                Blot 1 fyldt afbudstid om måneden dækker abonnementet:
              </p>
              <p className="mt-1 text-teal-800">
                5 fyldte tider/md. × {formatDkk(parsedValue)} ={" "}
                <strong className="font-bold">
                  {formatDkk(parsedValue * 5)}
                </strong>{" "}
                i reddet omsætning.
              </p>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-[#0f6e6e]" />
              GDPR &amp; Dataminimering
            </div>
            <ul className="mt-2.5 space-y-2 text-xs leading-relaxed text-slate-600">
              <li>
                • <strong>Ingen kliniske data:</strong> Systemet gemmer aldrig CPR-numre, diagnoser eller journalnoter.
              </li>
              <li>
                • <strong>30-dages auto-sletning:</strong> Venteliste-poster slettes automatisk efter 30 dage via daglig oprydning.
              </li>
              <li>
                • <strong>Øjeblikkelig framelding:</strong> Patienter kan altid svare <code>STOP</code> eller <code>AFMELD</code> på SMS.
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
