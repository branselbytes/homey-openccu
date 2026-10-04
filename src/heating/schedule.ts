import { createHash } from "node:crypto";
import type {
  ParameterDescription,
  ParamsetDescription,
  RpcValue,
} from "../protocol/xmlrpc/types";
import {
  HEATING_WEEKDAYS,
  HeatingError,
  type HeatingProfile,
  type HeatingSaveRequest,
  type HeatingSchedule,
  type HeatingSlot,
  type HeatingWeekday,
} from "./types";

interface ScheduleParameter {
  readonly key: string;
  readonly type: "INTEGER" | "FLOAT";
  readonly operations: number;
  readonly min: number;
  readonly max: number;
}

interface SlotParameters {
  readonly end: ScheduleParameter;
  readonly temperature: ScheduleParameter;
}

interface ProfileParameters {
  readonly id: number;
  readonly days: Readonly<Record<HeatingWeekday, readonly SlotParameters[]>>;
}

/** A validated snapshot; transport replies never become write payloads. */
export interface HeatingSnapshot {
  readonly schedule: HeatingSchedule;
  readonly parameters: readonly ProfileParameters[];
  readonly values: Readonly<Record<string, number>>;
}

/** Validated metadata without the much larger raw XML-RPC description. */
export interface CompiledHeatingSchema {
  readonly parameters: readonly ProfileParameters[];
  readonly revision: string;
  readonly writable: boolean;
  readonly maxSlots: number;
  readonly temperatureMin: number;
  readonly temperatureMax: number;
  readonly endTimeMin: number;
}

const parameterPattern =
  /^P([1-6])_(ENDTIME|TEMPERATURE)_(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)_([1-9]|1[0-3])$/;

function unsupported(): never {
  throw new HeatingError("HEATING_UNSUPPORTED");
}

function invalid(): never {
  throw new HeatingError("HEATING_INVALID");
}

/** Accept data objects only, including JSON objects with a null prototype. */
function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Reflect.ownKeys(value).every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return (
      typeof key === "string" &&
      descriptor?.enumerable === true &&
      Object.hasOwn(descriptor, "value")
    );
  });
}

function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const found = Object.keys(value);
  return (
    found.length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function weekRecord<T>(
  create: (day: HeatingWeekday) => T,
): Record<HeatingWeekday, T> {
  return {
    MONDAY: create("MONDAY"),
    TUESDAY: create("TUESDAY"),
    WEDNESDAY: create("WEDNESDAY"),
    THURSDAY: create("THURSDAY"),
    FRIDAY: create("FRIDAY"),
    SATURDAY: create("SATURDAY"),
    SUNDAY: create("SUNDAY"),
  };
}

function readParameter(
  key: string,
  description: ParameterDescription,
  type: "INTEGER" | "FLOAT",
): ScheduleParameter {
  if (
    !isRecord(description) ||
    description.TYPE !== type ||
    !Number.isInteger(description.OPERATIONS) ||
    description.OPERATIONS < 0 ||
    description.OPERATIONS > 7 ||
    (description.OPERATIONS & 1) === 0 ||
    typeof description.MIN !== "number" ||
    !Number.isFinite(description.MIN) ||
    typeof description.MAX !== "number" ||
    !Number.isFinite(description.MAX) ||
    description.MIN > description.MAX
  )
    unsupported();
  if (
    type === "INTEGER" &&
    (!Number.isInteger(description.MIN) ||
      !Number.isInteger(description.MAX) ||
      description.MIN < 1 ||
      description.MAX !== 1440)
  )
    unsupported();
  return {
    key,
    type,
    operations: description.OPERATIONS,
    min: description.MIN,
    max: description.MAX,
  };
}

function parameterKey(
  profile: number,
  kind: "ENDTIME" | "TEMPERATURE",
  day: HeatingWeekday,
  slot: number,
): string {
  return `P${profile}_${kind}_${day}_${slot}`;
}

function readSchema(
  description: ParamsetDescription,
): readonly ProfileParameters[] {
  if (!isRecord(description)) unsupported();
  const keys = Object.keys(description).filter((key) =>
    /^P\d+_(?:ENDTIME|TEMPERATURE)_/.test(key),
  );
  if (keys.length === 0 || keys.some((key) => !parameterPattern.test(key)))
    unsupported();
  const profileIds = [...new Set(keys.map((key) => Number(key[1])))].sort(
    (a, b) => a - b,
  );
  // Known thermostat families expose contiguous P1..P3 or P1..P6 schemas.
  if (profileIds.some((id, index) => id !== index + 1)) unsupported();
  const slotCount = Math.max(
    ...keys.map((key) => Number(key.slice(key.lastIndexOf("_") + 1))),
  );
  if (
    keys.length !==
    profileIds.length * HEATING_WEEKDAYS.length * slotCount * 2
  )
    unsupported();
  return profileIds.map((id) => ({
    id,
    days: weekRecord((day) =>
      Array.from({ length: slotCount }, (_, index): SlotParameters => {
        const end = parameterKey(id, "ENDTIME", day, index + 1);
        const temperature = parameterKey(id, "TEMPERATURE", day, index + 1);
        if (
          !Object.hasOwn(description, end) ||
          !Object.hasOwn(description, temperature)
        )
          unsupported();
        return {
          end: readParameter(end, description[end], "INTEGER"),
          temperature: readParameter(
            temperature,
            description[temperature],
            "FLOAT",
          ),
        };
      }),
    ),
  }));
}

function validNumber(
  value: unknown,
  parameter: ScheduleParameter,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    (parameter.type !== "INTEGER" || Number.isInteger(value)) &&
    value >= parameter.min &&
    value <= parameter.max
  );
}

function activeProfiles(
  description: ParamsetDescription | undefined,
  values: Readonly<Record<string, RpcValue>> | undefined,
  profileIds: readonly number[],
): Pick<HeatingSchedule, "selectableProfiles" | "activeProfile"> {
  const parameter = description?.ACTIVE_PROFILE;
  if (
    parameter === undefined ||
    !isRecord(parameter) ||
    !["INTEGER", "ENUM"].includes(parameter.TYPE) ||
    !Number.isInteger(parameter.OPERATIONS) ||
    (parameter.OPERATIONS & 1) === 0 ||
    typeof parameter.MIN !== "number" ||
    !Number.isInteger(parameter.MIN) ||
    typeof parameter.MAX !== "number" ||
    !Number.isInteger(parameter.MAX) ||
    parameter.MIN < 1 ||
    parameter.MAX > 6 ||
    parameter.MIN > parameter.MAX
  )
    return { selectableProfiles: [] };
  const min = parameter.MIN;
  const max = parameter.MAX;
  const selectableProfiles = profileIds.filter((id) => id >= min && id <= max);
  const active = values?.ACTIVE_PROFILE;
  return {
    selectableProfiles,
    ...(typeof active === "number" &&
    Number.isInteger(active) &&
    selectableProfiles.includes(active)
      ? { activeProfile: active }
      : {}),
  };
}

export function parseHeatingSnapshot(
  channelAddress: string,
  description: ParamsetDescription,
  values: Readonly<Record<string, RpcValue>>,
  activeDescription?: ParamsetDescription,
  activeValues?: Readonly<Record<string, RpcValue>>,
): HeatingSnapshot {
  return parseHeatingSnapshotWithSchema(
    channelAddress,
    compileHeatingSchema(description),
    values,
    activeDescription,
    activeValues,
  );
}

export function compileHeatingSchema(
  description: ParamsetDescription,
): CompiledHeatingSchema {
  const parameters = readSchema(description);
  const ordered = parameters.flatMap((profile) =>
    HEATING_WEEKDAYS.flatMap((day) =>
      profile.days[day].flatMap((pair) => [pair.end, pair.temperature]),
    ),
  );
  const ends = ordered.filter((parameter) => parameter.type === "INTEGER");
  const temperatures = ordered.filter(
    (parameter) => parameter.type === "FLOAT",
  );
  const temperatureMin = Math.max(
    ...temperatures.map((parameter) => parameter.min),
  );
  const temperatureMax = Math.min(
    ...temperatures.map((parameter) => parameter.max),
  );
  if (temperatureMin > temperatureMax) unsupported();
  return {
    parameters,
    revision: createHash("sha256")
      .update(JSON.stringify(ordered))
      .digest("hex"),
    writable: ordered.every((parameter) => (parameter.operations & 2) !== 0),
    maxSlots: parameters[0].days.MONDAY.length,
    temperatureMin,
    temperatureMax,
    endTimeMin: Math.max(...ends.map((parameter) => parameter.min)),
  };
}

export function parseHeatingSnapshotWithSchema(
  channelAddress: string,
  schema: CompiledHeatingSchema,
  values: Readonly<Record<string, RpcValue>>,
  activeDescription?: ParamsetDescription,
  activeValues?: Readonly<Record<string, RpcValue>>,
): HeatingSnapshot {
  if (!isRecord(values)) unsupported();
  const { parameters } = schema;
  const relevantValues: Record<string, number> = {};
  const profiles: HeatingProfile[] = parameters.map((profile) => {
    const days = weekRecord((day) => {
      const slots: HeatingSlot[] = [];
      let previousEnd = 0;
      let complete = false;
      for (const pair of profile.days[day]) {
        const end = values[pair.end.key];
        const temperature = values[pair.temperature.key];
        if (
          !Object.hasOwn(values, pair.end.key) ||
          !Object.hasOwn(values, pair.temperature.key) ||
          !validNumber(end, pair.end) ||
          !validNumber(temperature, pair.temperature)
        )
          unsupported();
        relevantValues[pair.end.key] = end;
        relevantValues[pair.temperature.key] = temperature;
        // CCU devices retain unused values following the first 24:00 entry.
        // Validate their type and bounds, but keep them out of the editor.
        if (complete) continue;
        if (end <= previousEnd) unsupported();
        slots.push({ end, temperature });
        previousEnd = end;
        complete = end === 1440;
      }
      if (!complete) unsupported();
      return slots;
    });
    return { id: profile.id, days };
  });
  const revision = createHash("sha256")
    .update(
      JSON.stringify({
        address: channelAddress,
        metadata: schema.revision,
        values: relevantValues,
      }),
    )
    .digest("hex");
  return {
    parameters,
    values: relevantValues,
    schedule: {
      revision,
      profiles,
      writable: schema.writable,
      maxSlots: schema.maxSlots,
      temperatureMin: schema.temperatureMin,
      temperatureMax: schema.temperatureMax,
      endTimeMin: schema.endTimeMin,
      ...activeProfiles(
        activeDescription,
        activeValues,
        profiles.map((profile) => profile.id),
      ),
    },
  };
}

/** Validate the boundary before any read or write; never accept parameter names. */
export function parseHeatingSaveRequest(input: unknown): HeatingSaveRequest {
  try {
    if (
      !isRecord(input) ||
      !exactKeys(input, ["revision", "profile", "days"]) ||
      typeof input.revision !== "string" ||
      !/^[a-f0-9]{64}$/.test(input.revision) ||
      typeof input.profile !== "number" ||
      !Number.isInteger(input.profile) ||
      input.profile < 1 ||
      input.profile > 6 ||
      !isRecord(input.days) ||
      !exactKeys(input.days, HEATING_WEEKDAYS)
    )
      invalid();
    const inputDays = input.days;
    const days = weekRecord((day) => {
      const slots: unknown = inputDays[day];
      if (
        !Array.isArray(slots) ||
        Object.getPrototypeOf(slots) !== Array.prototype ||
        slots.length < 1 ||
        slots.length > 13 ||
        Reflect.ownKeys(slots).length !== slots.length + 1 ||
        !Array.from({ length: slots.length }, (_, index) =>
          Object.getOwnPropertyDescriptor(slots, String(index)),
        ).every(
          (descriptor) =>
            descriptor !== undefined && Object.hasOwn(descriptor, "value"),
        )
      )
        invalid();
      let previousEnd = 0;
      const parsed = Array.from(slots as unknown[], (slot): HeatingSlot => {
        if (
          !isRecord(slot) ||
          !exactKeys(slot, ["end", "temperature"]) ||
          typeof slot.end !== "number" ||
          !Number.isInteger(slot.end) ||
          slot.end <= previousEnd ||
          slot.end > 1440 ||
          typeof slot.temperature !== "number" ||
          !Number.isFinite(slot.temperature)
        )
          invalid();
        previousEnd = slot.end;
        return { end: slot.end, temperature: slot.temperature };
      });
      if (previousEnd !== 1440) invalid();
      return parsed;
    });
    return { revision: input.revision, profile: input.profile, days };
  } catch {
    return invalid();
  }
}

/** Build only known, changed MASTER entries for one validated profile. */
export function heatingProfileChanges(
  snapshot: HeatingSnapshot,
  request: HeatingSaveRequest,
): Readonly<Record<string, number>> {
  const profile = snapshot.parameters.find(({ id }) => id === request.profile);
  if (profile === undefined) invalid();
  const changes: Record<string, number> = {};
  const existing = snapshot.schedule.profiles.find(
    ({ id }) => id === request.profile,
  );
  for (const day of HEATING_WEEKDAYS) {
    const slots = request.days[day];
    const pairs = profile.days[day];
    if (slots.length > pairs.length) invalid();
    const existingSlots = existing?.days[day];
    const dayChanged =
      existingSlots?.length !== slots.length ||
      slots.some(
        (slot, index) =>
          slot.end !== existingSlots[index].end ||
          slot.temperature !== existingSlots[index].temperature,
      );
    for (const [index, pair] of pairs.entries()) {
      if (
        (pair.end.operations & 2) === 0 ||
        (pair.temperature.operations & 2) === 0
      )
        throw new HeatingError("HEATING_READ_ONLY");
      const slot = slots[Math.min(index, slots.length - 1)];
      const end = index < slots.length ? slot.end : 1440;
      if (
        !validNumber(end, pair.end) ||
        !validNumber(slot.temperature, pair.temperature)
      )
        invalid();
      // Validate the full submitted week, but preserve unused CCU entries
      // on every unchanged day when a different day's plan is edited.
      if (!dayChanged) continue;
      if (snapshot.values[pair.end.key] !== end) changes[pair.end.key] = end;
      if (snapshot.values[pair.temperature.key] !== slot.temperature)
        changes[pair.temperature.key] = slot.temperature;
    }
  }
  return changes;
}
