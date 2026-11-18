import { z } from "zod";
import type { Weekday } from "@/types/database";

const VALID_WEEKDAYS: [Weekday, ...Weekday[]] = ["mon", "tue", "wed", "thu", "fri"];

/**
 * Normalizes Danish mobile numbers into strict E.164 format (+45XXXXXXXX).
 * Accepts inputs such as "20 12 34 56", "20123456", "+45 20123456", or "004520123456".
 */
export function normalizeDanishPhone(input: string): string | null {
  const stripped = input.replace(/[\s\-().]/g, "");
  let national = stripped;

  if (national.startsWith("+45")) {
    national = national.slice(3);
  } else if (national.startsWith("0045")) {
    national = national.slice(4);
  } else if (national.startsWith("45") && national.length === 10) {
    national = national.slice(2);
  }

  if (!/^[2-9]\d{7}$/.test(national)) {
    return null;
  }

  return `+45${national}`;
}

export const danishPhoneSchema = z
  .string()
  .trim()
  .min(8, "Indtast et gyldigt dansk mobilnummer (8 cifre)")
  .transform((val, ctx) => {
    const normalized = normalizeDanishPhone(val);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indtast et gyldigt dansk mobilnummer (+45 og 8 cifre)",
      });
      return z.NEVER;
    }
    return normalized;
  });

export const createWaitlistPatientSchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(2, "Fornavn skal være mindst 2 tegn")
    .max(60, "Fornavn må højst være 60 tegn"),
  phone: danishPhoneSchema,
  practitioner_preference: z
    .string()
    .trim()
    .max(60, "Behandlernavn må højst være 60 tegn")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v : null)),
  preferred_days: z
    .array(z.enum(VALID_WEEKDAYS))
    .min(1, "Vælg mindst én foretrukken ugedag"),
  preferred_window: z.enum(["morning", "afternoon", "any"]),
  consent: z.literal(true, {
    message: "Samtykke til SMS-beskeder er påkrævet for at tilmelde ventelisten",
  }),
});

export const createOpenSlotSchema = z.object({
  slot_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Vælg en gyldig dato"),
  slot_time: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Vælg et gyldigt tidspunkt"),
  duration_minutes: z.coerce
    .number()
    .int()
    .min(10, "Varighed skal være mindst 10 min.")
    .max(180, "Varighed må højst være 180 min."),
  practitioner_name: z
    .string()
    .trim()
    .max(60, "Behandlernavn må højst være 60 tegn")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export const updateClinicSettingsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Kliniknavn skal være mindst 2 tegn")
    .max(80, "Kliniknavn må højst være 80 tegn"),
  sms_sender_name: z
    .string()
    .trim()
    .min(2, "SMS-afsender skal være mindst 2 tegn")
    .max(11, "SMS-afsender må højst være 11 tegn (GatewayAPI-grænse)")
    .regex(
      /^[A-Za-z0-9 ]+$/,
      "SMS-afsender må kun indeholde bogstaver (A-Z), tal og mellemrum"
    ),
  avg_slot_value_dkk: z.coerce
    .number()
    .int()
    .min(100, "Gennemsnitspris skal være mindst 100 kr.")
    .max(25000, "Gennemsnitspris må højst være 25.000 kr."),
  notification_email: z
    .string()
    .trim()
    .email("Indtast en gyldig e-mailadresse"),
  slug: z
    .string()
    .trim()
    .min(3, "URL-navn skal være mindst 3 tegn")
    .max(40, "URL-navn må højst være 40 tegn")
    .regex(
      /^[a-z0-9-]+$/,
      "URL-navn må kun indeholde små bogstaver, tal og bindestreger"
    ),
});
