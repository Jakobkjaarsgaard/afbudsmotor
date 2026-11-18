import { logEmailAlert } from "@/lib/db";
import { formatDanishPhoneDisplay, formatTimeShort } from "@/lib/utils";
import type { Clinic, OpenSlot, WaitlistPatient } from "@/types/database";

export async function sendSlotClaimedEmailAlert(params: {
  clinic: Clinic;
  slot: OpenSlot;
  patient: WaitlistPatient;
}): Promise<void> {
  const timeStr = formatTimeShort(params.slot.slot_time);
  const phoneDisplay = formatDanishPhoneDisplay(params.patient.phone_e164);
  const subject = `HANDLING PÅKRÆVET: ${params.patient.first_name} har taget afbudstiden kl. ${timeStr}`;
  const body = `HANDLING PÅKRÆVET: ${params.patient.first_name} (${phoneDisplay}) har taget afbudstiden kl. ${timeStr}. Sæt dem ind i kalenderen.`;

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? "AfbudsMotor <noreply@afbudsmotor.dk>",
          to: [params.clinic.notification_email],
          subject,
          text: body,
        }),
      });
    } catch (err) {
      console.error("[AfbudsMotor] Kunne ikke sende e-mailnotifikation:", err);
    }
  }

  await logEmailAlert({
    clinic_id: params.clinic.id,
    slot_id: params.slot.id,
    to_email: params.clinic.notification_email,
    subject,
    body,
  });
}
