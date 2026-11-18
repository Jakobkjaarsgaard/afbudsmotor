import type { Metadata } from "next";
import QRCode from "qrcode";
import { AppShell } from "@/components/app-shell";
import { WaitlistClient } from "@/components/waitlist-client";
import { getTenantContext } from "@/lib/auth";
import { listWaitlistPatients } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Venteliste & QR — AfbudsMotor",
};

export default async function WaitlistPage() {
  const { clinic, isDemoMode } = await getTenantContext();
  const patients = await listWaitlistPatients(clinic.id);

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";
  const joinUrl = `${baseUrl}/join/${clinic.slug}`;

  const qrSvg = await QRCode.toString(joinUrl, {
    type: "svg",
    margin: 1,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });

  return (
    <AppShell clinic={clinic} isDemoMode={isDemoMode}>
      <WaitlistClient
        clinic={clinic}
        patients={patients}
        joinUrl={joinUrl}
        qrSvg={qrSvg}
      />
    </AppShell>
  );
}
