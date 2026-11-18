import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { TimeWindow, Weekday } from "@/types/database";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const WEEKDAY_OPTIONS: { key: Weekday; short: string; full: string }[] = [
  { key: "mon", short: "Man", full: "mandag" },
  { key: "tue", short: "Tir", full: "tirsdag" },
  { key: "wed", short: "Ons", full: "onsdag" },
  { key: "thu", short: "Tor", full: "torsdag" },
  { key: "fri", short: "Fre", full: "fredag" },
];

export const TIME_WINDOW_LABELS: Record<TimeWindow, string> = {
  morning: "Formiddag (08–12)",
  afternoon: "Eftermiddag (12–17)",
  any: "Hele dagen",
};

export function formatDkk(amount: number): string {
  return new Intl.NumberFormat("da-DK", {
    style: "decimal",
    maximumFractionDigits: 0,
  }).format(amount) + " kr.";
}

export function formatTimeShort(time: string): string {
  return time.slice(0, 5);
}

export function parseSlotDateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function getWeekdayKey(dateStr: string): Weekday | null {
  const day = parseSlotDateLocal(dateStr).getDay();
  const map: Record<number, Weekday> = {
    1: "mon",
    2: "tue",
    3: "wed",
    4: "thu",
    5: "fri",
  };
  return map[day] ?? null;
}

export function getDanishDayName(dateStr: string): string {
  const days = [
    "søndag",
    "mandag",
    "tirsdag",
    "onsdag",
    "torsdag",
    "fredag",
    "lørdag",
  ];
  return days[parseSlotDateLocal(dateStr).getDay()] ?? "i dag";
}

export function formatDanishDate(dateStr: string): string {
  const date = parseSlotDateLocal(dateStr);
  const day = date.getDate();
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "maj",
    "jun",
    "jul",
    "aug",
    "sep",
    "okt",
    "nov",
    "dec",
  ];
  return `${day}. ${months[date.getMonth()]}`;
}

export function formatDanishDateNumeric(dateStr: string): string {
  const date = parseSlotDateLocal(dateStr);
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

export function getTimeWindowForSlot(slotTime: string): "morning" | "afternoon" {
  const hour = parseInt(slotTime.slice(0, 2), 10);
  return hour < 12 ? "morning" : "afternoon";
}

export function formatDanishPhoneDisplay(phoneE164: string): string {
  const digits = phoneE164.replace(/^\+45/, "");
  if (digits.length === 8) {
    return `+45 ${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)}`;
  }
  return phoneE164;
}

export function daysUntilExpiry(expiresAt: string): number {
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function getLocalIsoDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isSlotInPast(slotDate: string, slotTime: string): boolean {
  const [y, m, d] = slotDate.split("-").map(Number);
  const [hh, mm] = slotTime.split(":").map(Number);
  const slotDateTime = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0);
  return slotDateTime.getTime() < Date.now();
}
