"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Mail,
  MessageSquare,
  RefreshCw,
  Send,
  Smartphone,
  X,
  Zap,
} from "lucide-react";
import { Button, Badge, Input } from "@/components/ui/primitives";
import type { EmailAlert, OpenSlot, SmsMessage } from "@/types/database";
import { formatDanishPhoneDisplay } from "@/lib/utils";

interface SimulatorPatient {
  id: string;
  first_name: string;
  phone_e164: string;
  active: boolean;
}

interface SimulatorData {
  provider: string;
  messages: SmsMessage[];
  emailAlerts: EmailAlert[];
  openSlots: OpenSlot[];
  patients: SimulatorPatient[];
}

export function SmsSimulatorDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [data, setData] = React.useState<SimulatorData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<"sms" | "email">("sms");
  const [customReplies, setCustomReplies] = React.useState<Record<string, string>>({});
  const [statusNotice, setStatusNotice] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/simulator", { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as SimulatorData;
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, loadData]);

  async function sendInboundReply(phoneE164: string, body: string) {
    setBusyKey(`${phoneE164}:${body}`);
    setStatusNotice(null);
    try {
      const res = await fetch("/api/webhooks/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_e164: phoneE164, body }),
      });
      const json = (await res.json()) as { outcome?: string; reply?: string; reason?: string };
      if (json.outcome === "claimed") {
        setStatusNotice("Afbudstid BESAT — vinder fik bekræftelse og klinikken er alarmeret!");
      } else if (json.outcome === "already_taken") {
        setStatusNotice("Tiden var allerede taget — patienten fik venligt afslag.");
      } else if (json.outcome === "opted_out") {
        setStatusNotice("Patienten blev frameldt ventelisten (STOP).");
      } else {
        setStatusNotice(json.reason ?? "SMS behandlet.");
      }
      await loadData();
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  async function simulateRaceCondition() {
    if (!data) return;
    const latestOpenSlot = data.openSlots[0];
    if (!latestOpenSlot) {
      setStatusNotice("Opret først en åben afbudstid for at teste kapløb.");
      return;
    }

    const recipients = Array.from(
      new Set(
        data.messages
          .filter((m) => m.slot_id === latestOpenSlot.id && m.direction === "outbound")
          .map((m) => m.phone_e164)
      )
    ).slice(0, 2);

    if (recipients.length < 2) {
      setStatusNotice("Der skal være mindst 2 SMS-modtagere på den åbne tid for at simulere kapløb.");
      return;
    }

    setBusyKey("race");
    setStatusNotice(null);
    try {
      const results = await Promise.all(
        recipients.map((phone) =>
          fetch("/api/webhooks/sms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone_e164: phone, body: "JA" }),
          }).then((r) => r.json() as Promise<{ outcome?: string }>)
        )
      );

      const winners = results.filter((r) => r.outcome === "claimed").length;
      const losers = results.filter((r) => r.outcome === "already_taken").length;
      setStatusNotice(
        `Atomisk lås verificeret: 2 samtidige JA → ${winners} vinder, ${losers} fik "desværre lige taget".`
      );
      await loadData();
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  async function triggerCronNow() {
    setBusyKey("cron");
    setStatusNotice(null);
    try {
      const res = await fetch("/api/cron/process-waves?force=true", {
        method: "POST",
      });
      const json = (await res.json()) as {
        wave2_slots_advanced: number;
        wave2_sms_sent: number;
        expired_slots: number;
        purged_waitlist_patients: number;
      };
      setStatusNotice(
        `Cron kørt: Bølge 2 sendt til ${json.wave2_sms_sent} patienter (${json.wave2_slots_advanced} tid(er)), ${json.expired_slots} udløbne tider, ${json.purged_waitlist_patients} slettede GDPR-poster.`
      );
      await loadData();
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  if (!open) return null;

  // Group SMS messages by phone number (most recent thread first)
  const patientByPhone = new Map(
    (data?.patients ?? []).map((p) => [p.phone_e164, p])
  );
  const threadsMap = new Map<string, SmsMessage[]>();
  for (const msg of data?.messages ?? []) {
    const arr = threadsMap.get(msg.phone_e164) ?? [];
    arr.push(msg);
    threadsMap.set(msg.phone_e164, arr);
  }
  const threads = Array.from(threadsMap.entries()).sort((a, b) => {
    const aLast = a[1][a[1].length - 1]?.created_at ?? "";
    const bLast = b[1][b[1].length - 1]?.created_at ?? "";
    return bLast.localeCompare(aLast);
  });

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-[#0f6e6e]">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Dev SMS Simulator
              </h2>
              <p className="text-xs text-slate-500">
                Test udgående tilbud, indgående JA/STOP og Bølge 2 lokalt uden SMS-forbrug
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Luk simulator"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3">
          <Button
            size="sm"
            variant="outline"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Opdater
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={simulateRaceCondition}
            disabled={busyKey !== null || (data?.openSlots.length ?? 0) === 0}
          >
            <Zap className="h-3.5 w-3.5 text-amber-600" />
            Simulér kapløb (2× JA)
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={triggerCronNow}
            disabled={busyKey !== null}
          >
            <Clock className="h-3.5 w-3.5 text-[#0f6e6e]" />
            Kør Cron (Bølge 2)
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-5">
          <button
            type="button"
            onClick={() => setTab("sms")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
              tab === "sms"
                ? "border-[#0f6e6e] text-[#0f6e6e]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            SMS-tråde ({threads.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("email")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
              tab === "email"
                ? "border-[#0f6e6e] text-[#0f6e6e]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Mail className="h-3.5 w-3.5" />
            E-mail alerts ({data?.emailAlerts.length ?? 0})
          </button>
        </div>

        {statusNotice && (
          <div className="mx-5 mt-3 rounded-lg border border-teal-200 bg-teal-50 px-3.5 py-2.5 text-xs font-medium text-teal-900">
            {statusNotice}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === "sms" ? (
            threads.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                Ingen SMS-beskeder endnu. Opret en afbudstid på overblikket for at sende Bølge 1.
              </div>
            ) : (
              <div className="space-y-4">
                {threads.map(([phone, msgs]) => {
                  const patient = patientByPhone.get(phone);
                  const customText = customReplies[phone] ?? "";

                  return (
                    <div
                      key={phone}
                      className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div>
                          <span className="text-sm font-bold text-slate-900">
                            {patient?.first_name ?? "Patient"}
                          </span>
                          <span className="ml-2 font-mono text-xs text-slate-500">
                            {formatDanishPhoneDisplay(phone)}
                          </span>
                        </div>
                        {patient && (
                          <Badge variant={patient.active ? "teal" : "rose"}>
                            {patient.active ? "Aktiv på liste" : "Frameldt"}
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-2">
                        {msgs.map((m) => (
                          <div
                            key={m.id}
                            className={`flex ${
                              m.direction === "inbound"
                                ? "justify-end"
                                : "justify-start"
                            }`}
                          >
                            <div
                              className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                                m.direction === "inbound"
                                  ? "rounded-br-sm bg-[#0f6e6e] text-white"
                                  : "rounded-bl-sm border border-slate-200 bg-white text-slate-800"
                              }`}
                            >
                              <p>{m.body}</p>
                              <p
                                className={`mt-1 text-[10px] ${
                                  m.direction === "inbound"
                                    ? "text-teal-100"
                                    : "text-slate-400"
                                }`}
                              >
                                {m.direction === "inbound" ? "Patient → Klinik" : "Klinik → Patient"} ·{" "}
                                {new Date(m.created_at).toLocaleTimeString("da-DK", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Quick reply buttons */}
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200/80 pt-3">
                        <Button
                          size="sm"
                          variant="success"
                          disabled={busyKey !== null}
                          onClick={() => sendInboundReply(phone, "JA")}
                        >
                          Svar JA
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyKey !== null}
                          onClick={() => sendInboundReply(phone, "STOP")}
                        >
                          Svar STOP
                        </Button>
                        <form
                          className="flex flex-1 items-center gap-1.5"
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (!customText.trim()) return;
                            sendInboundReply(phone, customText.trim());
                            setCustomReplies((prev) => ({ ...prev, [phone]: "" }));
                          }}
                        >
                          <Input
                            value={customText}
                            onChange={(e) =>
                              setCustomReplies((prev) => ({
                                ...prev,
                                [phone]: e.target.value,
                              }))
                            }
                            placeholder="Eget svar..."
                            className="h-8 text-xs"
                          />
                          <Button
                            type="submit"
                            size="sm"
                            variant="secondary"
                            disabled={busyKey !== null || !customText.trim()}
                          >
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (data?.emailAlerts.length ?? 0) === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              Ingen e-mailnotifikationer sendt endnu.
            </div>
          ) : (
            <div className="space-y-3">
              {data?.emailAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-medium text-slate-700">
                      Til: {alert.to_email}
                    </span>
                    <span>
                      {new Date(alert.created_at).toLocaleTimeString("da-DK", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {alert.subject}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-700">
                    {alert.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
