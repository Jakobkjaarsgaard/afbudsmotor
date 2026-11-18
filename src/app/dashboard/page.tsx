import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { DashboardClient } from "@/components/dashboard-client";
import { getTenantContext } from "@/lib/auth";
import { getDashboardMetrics, listOpenSlots } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Overblik — AfbudsMotor",
};

export default async function DashboardPage() {
  const { clinic, isDemoMode } = await getTenantContext();
  const [metrics, slots] = await Promise.all([
    getDashboardMetrics(clinic),
    listOpenSlots(clinic.id),
  ]);

  return (
    <AppShell clinic={clinic} isDemoMode={isDemoMode}>
      <DashboardClient clinic={clinic} metrics={metrics} slots={slots} />
    </AppShell>
  );
}
