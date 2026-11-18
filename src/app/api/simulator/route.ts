import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
import {
  listEmailAlerts,
  listOpenSlots,
  listSmsMessages,
  listWaitlistPatients,
} from "@/lib/db";
import { getActiveSmsProvider } from "@/lib/sms";

export const dynamic = "force-dynamic";

export async function GET() {
  const { clinic } = await getTenantContext();
  const [messages, emailAlerts, slots, patients] = await Promise.all([
    listSmsMessages(clinic.id),
    listEmailAlerts(clinic.id),
    listOpenSlots(clinic.id),
    listWaitlistPatients(clinic.id),
  ]);

  return NextResponse.json({
    provider: getActiveSmsProvider(),
    clinic,
    messages,
    emailAlerts,
    openSlots: slots.filter((s) => s.status === "open"),
    patients: patients.map((p) => ({
      id: p.id,
      first_name: p.first_name,
      phone_e164: p.phone_e164,
      active: p.active,
    })),
  });
}
