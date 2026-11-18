"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  BellOff,
  CheckCircle2,
  LayoutDashboard,
  Settings,
  Smartphone,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { SmsSimulatorDrawer } from "@/components/sms-simulator-drawer";
import { playClaimChime } from "@/lib/chime";
import { createClient, isSupabaseClientConfigured } from "@/lib/supabase/client";
import type { Clinic } from "@/types/database";

interface LiveBannerState {
  patientName: string;
  slotTime: string;
  phoneE164?: string;
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overblik", icon: LayoutDashboard },
  { href: "/waitlist", label: "Venteliste & QR", icon: Users },
  { href: "/settings", label: "Indstillinger", icon: Settings },
];

export function AppShell({
  clinic,
  isDemoMode,
  children,
}: {
  clinic: Clinic;
  isDemoMode: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [simulatorOpen, setSimulatorOpen] = React.useState(false);
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [liveBanner, setLiveBanner] = React.useState<LiveBannerState | null>(
    null
  );

  const soundEnabledRef = React.useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  // Realtime subscription: Supabase Realtime when configured, else local SSE stream
  React.useEffect(() => {
    if (isSupabaseClientConfigured()) {
      const supabase = createClient();
      if (!supabase) return;

      const channel = supabase
        .channel(`open_slots_${clinic.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "open_slots",
            filter: `clinic_id=eq.${clinic.id}`,
          },
          (payload) => {
            const nextRow = payload.new as {
              status?: string;
              slot_time?: string;
            } | null;
            const prevRow = payload.old as { status?: string } | null;

            if (
              nextRow?.status === "claimed" &&
              prevRow?.status !== "claimed"
            ) {
              if (soundEnabledRef.current) playClaimChime();
              setLiveBanner({
                patientName: "En patient",
                slotTime: (nextRow.slot_time ?? "").slice(0, 5),
              });
            }
            router.refresh();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    // Local dev SSE realtime listener
    const source = new EventSource(
      `/api/realtime/slots?clinicId=${encodeURIComponent(clinic.id)}`
    );

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as {
          type?: string;
          patientName?: string;
          slotTime?: string;
          phoneE164?: string;
        };

        if (data.type === "slot_claimed") {
          if (soundEnabledRef.current) playClaimChime();
          setLiveBanner({
            patientName: data.patientName ?? "En patient",
            slotTime: data.slotTime ?? "",
            phoneE164: data.phoneE164,
          });
          router.refresh();
        } else if (
          data.type === "slot_created" ||
          data.type === "slot_updated" ||
          data.type === "cron_ran"
        ) {
          router.refresh();
        }
      } catch {
        // Ignore malformed SSE frames
      }
    };

    return () => {
      source.close();
    };
  }, [clinic.id, router]);

  return (
    <div className="min-h-screen bg-[#f6f8f9]">
      {/* Top Navigation */}
      <header className="no-print sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="flex items-center gap-2.5 text-slate-900"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0f6e6e] text-white shadow-xs">
                <Activity className="h-5 w-5" />
              </span>
              <div className="leading-tight">
                <span className="block text-base font-bold tracking-tight">
                  AfbudsMotor
                </span>
                <span className="block text-[11px] font-medium text-slate-500">
                  {clinic.name}
                </span>
              </div>
            </Link>

            <nav className="hidden items-center gap-1 md:flex" aria-label="Hovednavigation">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? "bg-teal-50 text-[#0f6e6e]"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled((v) => !v)}
              title={
                soundEnabled
                  ? "Lydsignal ved besat tid er slået til"
                  : "Lydsignal er slået fra"
              }
              className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                soundEnabled
                  ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  : "border-slate-200 bg-slate-100 text-slate-400"
              }`}
            >
              {soundEnabled ? (
                <Bell className="h-4 w-4" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
            </button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setSimulatorOpen(true)}
              className="border-teal-200 bg-teal-50/70 text-[#0f6e6e] hover:bg-teal-100/70"
            >
              <Smartphone className="h-4 w-4" />
              <span className="hidden sm:inline">SMS Simulator</span>
              {isDemoMode && (
                <span className="rounded bg-[#0f6e6e] px-1.5 py-0.5 text-[10px] font-bold text-white">
                  DEV
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Bottom-of-Header Nav */}
        <nav
          className="flex border-t border-slate-100 px-2 py-1.5 md:hidden"
          aria-label="Mobilnavigation"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold ${
                  active
                    ? "bg-teal-50 text-[#0f6e6e]"
                    : "text-slate-600"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Instant Claimed Banner */}
      {liveBanner && (
        <div className="no-print border-b border-emerald-300 bg-emerald-600 text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2.5 text-sm font-semibold">
              <CheckCircle2 className="h-5 w-5 shrink-0 animate-bounce" />
              <span>
                BESAT — {liveBanner.patientName} har taget afbudstiden
                {liveBanner.slotTime ? ` kl. ${liveBanner.slotTime}` : ""}! Sæt patienten ind i kalenderen.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setLiveBanner(null)}
              className="rounded-md bg-emerald-700/80 px-2.5 py-1 text-xs font-semibold hover:bg-emerald-800 cursor-pointer"
            >
              Forstået
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <SmsSimulatorDrawer
        open={simulatorOpen}
        onClose={() => setSimulatorOpen(false)}
      />
    </div>
  );
}
