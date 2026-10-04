import { vi } from "vitest";
import {
  HEATING_WEEKDAYS,
  type HeatingSchedule,
  type HeatingWeekday,
} from "../../src/heating/types";
import type {
  ParameterDescription,
  ParamsetDescription,
  RpcValue,
  XmlRpcClient,
} from "../../src/protocol/xmlrpc/types";

export type MutableDays = Record<
  HeatingWeekday,
  { end: number; temperature: number }[]
>;

export function requestOf(schedule: HeatingSchedule, profile = 1) {
  const selected = schedule.profiles.find(({ id }) => id === profile);
  if (selected === undefined) throw new Error("Missing test profile");
  return {
    revision: schedule.revision,
    profile,
    days: Object.fromEntries(
      HEATING_WEEKDAYS.map((day) => [
        day,
        selected.days[day].map((slot) => ({ ...slot })),
      ]),
    ) as MutableDays,
  };
}

export function createFixture(profileCount = 3, maxSlots = 13) {
  const description: Record<string, ParameterDescription> = {};
  const values: Record<string, RpcValue> = {
    CONTROL_MODE: 0,
    CHILD_LOCK: true,
  };
  for (let profile = 1; profile <= profileCount; profile += 1) {
    for (const day of HEATING_WEEKDAYS) {
      for (let slot = 1; slot <= maxSlots; slot += 1) {
        const end = `P${profile}_ENDTIME_${day}_${slot}`;
        const temperature = `P${profile}_TEMPERATURE_${day}_${slot}`;
        description[end] = {
          TYPE: "INTEGER",
          MIN: 5,
          MAX: 1440,
          OPERATIONS: 3,
          FLAGS: 1,
        };
        description[temperature] = {
          TYPE: "FLOAT",
          MIN: 5,
          MAX: 30,
          OPERATIONS: 3,
          FLAGS: 1,
        };
        values[end] = slot === 1 && maxSlots > 1 ? 360 : 1440;
        values[temperature] = slot === 1 && maxSlots > 1 ? 18 : 20;
      }
    }
  }
  const activeDescription: ParamsetDescription = {
    ACTIVE_PROFILE: {
      TYPE: "INTEGER",
      MIN: 1,
      MAX: Math.min(profileCount, 3),
      OPERATIONS: 7,
      FLAGS: 1,
    },
  };
  const client = {
    getParamsetDescription: vi.fn((_address: string, key = "VALUES") =>
      Promise.resolve(key === "MASTER" ? description : activeDescription),
    ),
    getParamset: vi.fn(
      (
        _address: string,
        key = "VALUES",
      ): Promise<Readonly<Record<string, RpcValue>>> =>
        Promise.resolve(
          key === "MASTER" ? { ...values } : { ACTIVE_PROFILE: 2 },
        ),
    ),
    putParamset: vi.fn(
      (
        _address: string,
        _key: string,
        changes: Readonly<Record<string, RpcValue>>,
      ) => {
        Object.assign(values, changes);
        return Promise.resolve();
      },
    ),
  } satisfies Pick<
    XmlRpcClient,
    "getParamsetDescription" | "getParamset" | "putParamset"
  >;
  return { client, values, description, activeDescription };
}
