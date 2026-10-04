/** Local CCU schedules, independent of Homey's capabilities and UI. */
export const HEATING_WEEKDAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

export type HeatingWeekday = (typeof HEATING_WEEKDAYS)[number];

export interface HeatingSlot {
  /** Exclusive interval end, in minutes after midnight; the last is 1440. */
  readonly end: number;
  readonly temperature: number;
}

export interface HeatingProfile {
  readonly id: number;
  readonly days: Readonly<Record<HeatingWeekday, readonly HeatingSlot[]>>;
}

export interface HeatingSchedule {
  readonly revision: string;
  readonly profiles: readonly HeatingProfile[];
  readonly writable: boolean;
  readonly maxSlots: number;
  readonly temperatureMin: number;
  readonly temperatureMax: number;
  readonly endTimeMin: number;
  /** Selection limits can differ from the number of stored schedules. */
  readonly selectableProfiles: readonly number[];
  readonly activeProfile?: number;
}

export interface HeatingSaveRequest {
  readonly revision: string;
  readonly profile: number;
  readonly days: Readonly<Record<HeatingWeekday, readonly HeatingSlot[]>>;
}

export interface HeatingSaveResult {
  readonly status: "unchanged" | "confirmed" | "pending";
  readonly schedule?: HeatingSchedule;
}

export interface HeatingTarget {
  readonly id: string;
  readonly name: string;
  readonly model: string;
  readonly isGroup: boolean;
}

/** Errors crossing the Homey bridge never include remote text or request data. */
export type HeatingErrorCode =
  | "HEATING_UNAVAILABLE"
  | "HEATING_UNSUPPORTED"
  | "HEATING_INVALID"
  | "HEATING_READ_ONLY"
  | "HEATING_CONFLICT"
  | "HEATING_BUSY"
  | "HEATING_READ_FAILED"
  | "HEATING_WRITE_FAILED";

export class HeatingError extends Error {
  constructor(readonly code: HeatingErrorCode) {
    super(code);
    this.name = "HeatingError";
  }
}
