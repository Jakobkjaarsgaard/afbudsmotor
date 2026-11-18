import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { SettingsForm } from "@/components/settings-form";
import { getTenantContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Indstillinger — AfbudsMotor",
};

export default async function SettingsPage() {
  const { clinic, isDemoMode } = await getTenantContext();

  return (
    <AppShell clinic={clinic} isDemoMode={isDemoMode}>
      <SettingsForm clinic={clinic} />
    </AppShell>
  );
}
