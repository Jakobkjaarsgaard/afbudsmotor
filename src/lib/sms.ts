import crypto from "crypto";
import { logSmsMessage } from "@/lib/db";
import {
  formatDanishDateNumeric,
  formatTimeShort,
  getDanishDayName,
} from "@/lib/utils";
import type { Clinic, OpenSlot, WaitlistPatient } from "@/types/database";

export type SmsProviderType = "gatewayapi" | "twilio" | "simulator";

export function getActiveSmsProvider(): SmsProviderType {
  const explicit = process.env.SMS_PROVIDER?.toLowerCase();
  if (explicit === "gatewayapi" && process.env.GATEWAYAPI_TOKEN) {
    return "gatewayapi";
  }
  if (
    explicit === "twilio" &&
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN
  ) {
    return "twilio";
  }
  if (process.env.GATEWAYAPI_TOKEN) return "gatewayapi";
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    return "twilio";
  }
  return "simulator";
}

export function buildOfferSmsBody(params: {
  firstName: string;
  senderName: string;
  slotDate: string;
  slotTime: string;
  durationMinutes: number;
}): string {
  const dayName = getDanishDayName(params.slotDate);
  const dateStr = formatDanishDateNumeric(params.slotDate);
  const timeStr = formatTimeShort(params.slotTime);
  return `Hej ${params.firstName}, ${params.senderName} har fået en afbudstid ${dayName} d. ${dateStr} kl. ${timeStr} (${params.durationMinutes} min). Svar JA på denne SMS hvis du ønsker tiden. Først til mølle!`;
}

export function buildWinnerSmsBody(params: {
  firstName: string;
  clinicName: string;
  slotDate: string;
  slotTime: string;
}): string {
  const dayName = getDanishDayName(params.slotDate);
  const timeStr = formatTimeShort(params.slotTime);
  return `Super ${params.firstName}! Tiden ${dayName} kl. ${timeStr} er reserveret til dig hos ${params.clinicName}. Vi glæder os til at se dig.`;
}

export function buildAlreadyTakenSmsBody(firstName: string): string {
  return `Beklager ${firstName}, tiden blev desværre lige taget af en anden. Du står stadig på ventelisten til næste ledige tid!`;
}

export function buildOptOutSmsBody(clinicName: string): string {
  return `Du er nu frameldt afbudslisten hos ${clinicName}.`;
}

async function sendViaGatewayApi(params: {
  to: string;
  sender: string;
  body: string;
}): Promise<string> {
  const token = process.env.GATEWAYAPI_TOKEN!;
  const msisdn = Number(params.to.replace(/^\+/, ""));
  const res = await fetch("https://gatewayapi.com/rest/mtsms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${token}`,
    },
    body: JSON.stringify({
      sender: params.sender.slice(0, 11),
      message: params.body,
      recipients: [{ msisdn }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GatewayAPI fejl (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { ids?: number[] };
  return data.ids?.[0] ? `gw_${data.ids[0]}` : `gw_${crypto.randomUUID()}`;
}

async function sendViaTwilio(params: {
  to: string;
  body: string;
}): Promise<string> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_FROM_NUMBER!;

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const form = new URLSearchParams({
    To: params.to,
    From: from,
    Body: params.body,
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Twilio fejl (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { sid?: string };
  return data.sid ?? `tw_${crypto.randomUUID()}`;
}

export async function sendSms(params: {
  clinic: Clinic;
  toPhoneE164: string;
  body: string;
  slotId?: string | null;
  patientId?: string | null;
}): Promise<{ provider: SmsProviderType; providerMessageId: string }> {
  const provider = getActiveSmsProvider();
  let providerMessageId: string;

  if (provider === "gatewayapi") {
    providerMessageId = await sendViaGatewayApi({
      to: params.toPhoneE164,
      sender: params.clinic.sms_sender_name,
      body: params.body,
    });
  } else if (provider === "twilio") {
    providerMessageId = await sendViaTwilio({
      to: params.toPhoneE164,
      body: params.body,
    });
  } else {
    providerMessageId = `sim_${crypto.randomUUID().slice(0, 8)}`;
  }

  await logSmsMessage({
    clinic_id: params.clinic.id,
    slot_id: params.slotId ?? null,
    patient_id: params.patientId ?? null,
    direction: "outbound",
    phone_e164: params.toPhoneE164,
    body: params.body,
    provider_message_id: providerMessageId,
  });

  return { provider, providerMessageId };
}

export async function sendSlotOfferSms(params: {
  clinic: Clinic;
  slot: OpenSlot;
  patient: WaitlistPatient;
}) {
  const body = buildOfferSmsBody({
    firstName: params.patient.first_name,
    senderName: params.clinic.sms_sender_name,
    slotDate: params.slot.slot_date,
    slotTime: params.slot.slot_time,
    durationMinutes: params.slot.duration_minutes,
  });

  return sendSms({
    clinic: params.clinic,
    toPhoneE164: params.patient.phone_e164,
    body,
    slotId: params.slot.id,
    patientId: params.patient.id,
  });
}
