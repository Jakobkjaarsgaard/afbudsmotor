import { NextRequest, NextResponse } from "next/server";
import {
  atomicClaimOpenSlot,
  deactivatePatientsByPhone,
  findRecentOfferedSlotForPhone,
  logSmsMessage,
} from "@/lib/db";
import { sendSlotClaimedEmailAlert } from "@/lib/email";
import { emitSlotEvent } from "@/lib/realtime-bus";
import {
  buildAlreadyTakenSmsBody,
  buildOptOutSmsBody,
  buildWinnerSmsBody,
  sendSms,
} from "@/lib/sms";
import { normalizeDanishPhone } from "@/lib/validation";
import { formatTimeShort } from "@/lib/utils";

interface ParsedInboundSms {
  phoneE164: string;
  body: string;
  providerMessageId: string | null;
}

async function parseInboundPayload(
  req: NextRequest
): Promise<ParsedInboundSms | null> {
  const contentType = req.headers.get("content-type") ?? "";
  let rawPhone = "";
  let rawBody = "";
  let providerMessageId: string | null = null;

  if (contentType.includes("application/x-www-form-urlencoded")) {
    // Twilio webhook format
    const form = await req.formData();
    rawPhone = String(form.get("From") ?? "");
    rawBody = String(form.get("Body") ?? "");
    providerMessageId = form.get("MessageSid")
      ? String(form.get("MessageSid"))
      : null;
  } else {
    // GatewayAPI or Local Dev Simulator JSON format
    const json = (await req.json()) as Record<string, unknown>;
    rawPhone = String(
      json.phone_e164 ?? json.msisdn ?? json.from ?? json.From ?? ""
    );
    rawBody = String(json.body ?? json.message ?? json.Body ?? "");
    providerMessageId = json.id
      ? String(json.id)
      : json.provider_message_id
        ? String(json.provider_message_id)
        : null;
  }

  const normalizedPhone = normalizeDanishPhone(rawPhone);
  if (!normalizedPhone || !rawBody.trim()) {
    return null;
  }

  return {
    phoneE164: normalizedPhone,
    body: rawBody.trim(),
    providerMessageId,
  };
}

export async function POST(req: NextRequest) {
  try {
    const inbound = await parseInboundPayload(req);
    if (!inbound) {
      return NextResponse.json(
        { error: "Ugyldig SMS-payload (mangler gyldigt dansk telefonnummer eller tekst)" },
        { status: 400 }
      );
    }

    const normalizedBody = inbound.body.trim().toUpperCase();

    // 1. Opt-out handling: STOP or AFMELD
    if (normalizedBody === "STOP" || normalizedBody === "AFMELD") {
      const result = await deactivatePatientsByPhone(inbound.phoneE164);

      if (result) {
        await logSmsMessage({
          clinic_id: result.clinic.id,
          slot_id: null,
          patient_id: result.patient.id,
          direction: "inbound",
          phone_e164: inbound.phoneE164,
          body: inbound.body,
          provider_message_id: inbound.providerMessageId,
        });

        const replyBody = buildOptOutSmsBody(result.clinic.name);
        await sendSms({
          clinic: result.clinic,
          toPhoneE164: inbound.phoneE164,
          body: replyBody,
          patientId: result.patient.id,
        });

        emitSlotEvent({
          type: "sms_received",
          clinicId: result.clinic.id,
          patientName: result.patient.first_name,
          phoneE164: inbound.phoneE164,
          timestamp: new Date().toISOString(),
        });

        return NextResponse.json({
          outcome: "opted_out",
          reply: replyBody,
          patient_id: result.patient.id,
        });
      }

      return NextResponse.json({
        outcome: "ignored",
        reason: "Ingen aktiv tilmelding fundet for nummeret",
      });
    }

    // 2. Claim handling: starts with JA
    if (normalizedBody.startsWith("JA")) {
      const offer = await findRecentOfferedSlotForPhone(inbound.phoneE164);

      if (!offer) {
        return NextResponse.json({
          outcome: "no_recent_offer",
          reason: "Ingen aktiv afbudstid tilbudt inden for de seneste 12 timer",
        });
      }

      const { slot, patient, clinic } = offer;

      // Log inbound JA message
      await logSmsMessage({
        clinic_id: clinic.id,
        slot_id: slot.id,
        patient_id: patient.id,
        direction: "inbound",
        phone_e164: inbound.phoneE164,
        body: inbound.body,
        provider_message_id: inbound.providerMessageId,
      });

      // Atomic lock: only 1 concurrent JA can transition status 'open' -> 'claimed'
      const claimedSlot = await atomicClaimOpenSlot(slot.id, patient.id);

      if (claimedSlot) {
        const winnerReply = buildWinnerSmsBody({
          firstName: patient.first_name,
          clinicName: clinic.name,
          slotDate: claimedSlot.slot_date,
          slotTime: claimedSlot.slot_time,
        });

        await sendSms({
          clinic,
          toPhoneE164: patient.phone_e164,
          body: winnerReply,
          slotId: claimedSlot.id,
          patientId: patient.id,
        });

        await sendSlotClaimedEmailAlert({
          clinic,
          slot: claimedSlot,
          patient,
        });

        emitSlotEvent({
          type: "slot_claimed",
          clinicId: clinic.id,
          slotId: claimedSlot.id,
          patientName: patient.first_name,
          phoneE164: patient.phone_e164,
          slotTime: formatTimeShort(claimedSlot.slot_time),
          timestamp: new Date().toISOString(),
        });

        return NextResponse.json({
          outcome: "claimed",
          slot_id: claimedSlot.id,
          patient_id: patient.id,
          reply: winnerReply,
        });
      }

      // 0 rows updated -> slot was already claimed by another patient
      const alreadyTakenReply = buildAlreadyTakenSmsBody(patient.first_name);
      await sendSms({
        clinic,
        toPhoneE164: patient.phone_e164,
        body: alreadyTakenReply,
        slotId: slot.id,
        patientId: patient.id,
      });

      emitSlotEvent({
        type: "sms_received",
        clinicId: clinic.id,
        slotId: slot.id,
        patientName: patient.first_name,
        phoneE164: patient.phone_e164,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json({
        outcome: "already_taken",
        slot_id: slot.id,
        patient_id: patient.id,
        reply: alreadyTakenReply,
      });
    }

    // 3. Unrecognized inbound SMS — log if we can associate it with a recent offer
    const offer = await findRecentOfferedSlotForPhone(inbound.phoneE164);
    if (offer) {
      await logSmsMessage({
        clinic_id: offer.clinic.id,
        slot_id: offer.slot.id,
        patient_id: offer.patient.id,
        direction: "inbound",
        phone_e164: inbound.phoneE164,
        body: inbound.body,
        provider_message_id: inbound.providerMessageId,
      });
      emitSlotEvent({
        type: "sms_received",
        clinicId: offer.clinic.id,
        slotId: offer.slot.id,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      outcome: "logged_other",
      message: "Besked modtaget og logget",
    });
  } catch (error) {
    console.error("[AfbudsMotor] Webhook fejl:", error);
    return NextResponse.json(
      { error: "Intern fejl ved behandling af SMS-webhook" },
      { status: 500 }
    );
  }
}
