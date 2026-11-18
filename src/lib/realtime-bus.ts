import { EventEmitter } from "events";

export interface RealtimeSlotEvent {
  type: "slot_created" | "slot_claimed" | "slot_updated" | "sms_received" | "cron_ran";
  clinicId: string;
  slotId?: string;
  patientName?: string;
  phoneE164?: string;
  slotTime?: string;
  timestamp: string;
}

const globalForBus = globalThis as unknown as {
  __afbudsmotorRealtimeBus?: EventEmitter;
};

export const realtimeBus: EventEmitter =
  globalForBus.__afbudsmotorRealtimeBus ??
  (() => {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(100);
    globalForBus.__afbudsmotorRealtimeBus = emitter;
    return emitter;
  })();

export function emitSlotEvent(event: RealtimeSlotEvent): void {
  realtimeBus.emit("slot_event", event);
}
