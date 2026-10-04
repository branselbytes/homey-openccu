import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HeatingScheduleService } from "../../src/heating/service";
import { parseHeatingSnapshot } from "../../src/heating/schedule";
import { HeatingError, type HeatingSlot } from "../../src/heating/types";
import type {
  ParameterDescription,
  ParamsetDescription,
  RpcValue,
} from "../../src/protocol/xmlrpc/types";
import { createFixture, requestOf } from "./fixture";

const address = "TEST-THERMOSTAT:1";

afterEach(() => vi.useRealTimers());

describe("heating schedule reads", () => {
  it("reads complete profiles and compacts unused slots after midnight", async () => {
    const { client } = createFixture();
    const schedule = await new HeatingScheduleService(client).read(address);
    expect(schedule).toMatchObject({
      writable: true,
      maxSlots: 13,
      temperatureMin: 5,
      temperatureMax: 30,
      endTimeMin: 5,
      activeProfile: 2,
      selectableProfiles: [1, 2, 3],
    });
    expect(schedule.revision).toMatch(/^[a-f0-9]{64}$/);
    expect(schedule.profiles).toHaveLength(3);
    expect(schedule.profiles[0].days.MONDAY).toEqual([
      { end: 360, temperature: 18 },
      { end: 1440, temperature: 20 },
    ]);
    expect(client.getParamsetDescription).toHaveBeenCalledWith(
      address,
      "MASTER",
    );
    expect(client.getParamset).toHaveBeenCalledWith(address, "VALUES");
    expect(client.putParamset).not.toHaveBeenCalled();
  });

  it("separates stored profiles from ACTIVE_PROFILE selection limits", async () => {
    const { client } = createFixture(6);
    const schedule = await new HeatingScheduleService(client).read(address);
    expect(schedule.profiles).toHaveLength(6);
    expect(schedule.selectableProfiles).toEqual([1, 2, 3]);
  });

  it("keeps MASTER editing available if optional VALUES reads fail", async () => {
    const { client, values, description } = createFixture();
    client.getParamsetDescription.mockImplementation((_address, key) =>
      key === "MASTER"
        ? Promise.resolve(description)
        : Promise.reject(new Error("private RPC failure")),
    );
    client.getParamset.mockImplementation((_address, key) =>
      key === "MASTER"
        ? Promise.resolve(values)
        : Promise.reject(new Error("private RPC failure")),
    );
    const schedule = await new HeatingScheduleService(client).read(address);
    expect(schedule.profiles).toHaveLength(3);
    expect(schedule.selectableProfiles).toEqual([]);
    expect(schedule.activeProfile).toBeUndefined();
  });

  it("makes the revision stable across key ordering and sensitive to address, data and relevant metadata", () => {
    const { description, values } = createFixture();
    const base = parseHeatingSnapshot(address, description, values).schedule
      .revision;
    const reordered = parseHeatingSnapshot(
      address,
      Object.fromEntries(Object.entries(description).reverse()),
      Object.fromEntries(Object.entries(values).reverse()),
    ).schedule.revision;
    expect(reordered).toBe(base);
    expect(
      parseHeatingSnapshot("OTHER:1", description, values).schedule.revision,
    ).not.toBe(base);
    expect(
      parseHeatingSnapshot(address, description, {
        ...values,
        CHILD_LOCK: false,
      }).schedule.revision,
    ).toBe(base);
    expect(
      parseHeatingSnapshot(address, description, {
        ...values,
        P1_TEMPERATURE_MONDAY_13: 21,
      }).schedule.revision,
    ).not.toBe(base);
    const changed = {
      ...description,
      P1_TEMPERATURE_MONDAY_1: {
        ...description.P1_TEMPERATURE_MONDAY_1,
        MAX: 29,
      },
    };
    expect(
      parseHeatingSnapshot(address, changed, values).schedule.revision,
    ).not.toBe(base);
  });

  it.each([
    [
      "missing weekday parameter",
      (fixture: ReturnType<typeof createFixture>) => {
        delete fixture.description.P1_ENDTIME_SUNDAY_13;
      },
    ],
    [
      "foreign profile schema",
      (fixture: ReturnType<typeof createFixture>) => {
        fixture.description.P7_ENDTIME_MONDAY_1 =
          fixture.description.P1_ENDTIME_MONDAY_1;
      },
    ],
    [
      "unsupported 14th slot",
      (fixture: ReturnType<typeof createFixture>) => {
        fixture.description.P1_ENDTIME_MONDAY_14 =
          fixture.description.P1_ENDTIME_MONDAY_1;
      },
    ],
    [
      "unreadable schedule",
      (fixture: ReturnType<typeof createFixture>) => {
        fixture.description.P1_ENDTIME_MONDAY_1 = {
          ...fixture.description.P1_ENDTIME_MONDAY_1,
          OPERATIONS: 2,
        };
      },
    ],
    [
      "wrong parameter type",
      (fixture: ReturnType<typeof createFixture>) => {
        fixture.description.P1_TEMPERATURE_MONDAY_1 = {
          ...fixture.description.P1_TEMPERATURE_MONDAY_1,
          TYPE: "STRING",
        };
      },
    ],
    [
      "missing value",
      (fixture: ReturnType<typeof createFixture>) => {
        delete fixture.values.P1_TEMPERATURE_SUNDAY_13;
      },
    ],
    [
      "nonfinite padding value",
      (fixture: ReturnType<typeof createFixture>) => {
        fixture.values.P1_TEMPERATURE_SUNDAY_13 = NaN;
      },
    ],
    [
      "temperature outside bounds",
      (fixture: ReturnType<typeof createFixture>) => {
        fixture.values.P1_TEMPERATURE_SUNDAY_13 = 31;
      },
    ],
    [
      "unordered active slots",
      (fixture: ReturnType<typeof createFixture>) => {
        fixture.values.P1_ENDTIME_MONDAY_2 = 300;
      },
    ],
    [
      "unterminated day",
      (fixture: ReturnType<typeof createFixture>) => {
        for (let slot = 1; slot <= 13; slot += 1)
          fixture.values[`P1_ENDTIME_MONDAY_${slot}`] = slot * 10;
      },
    ],
  ])("rejects %s without writing", async (_name, alter) => {
    const fixture = createFixture();
    alter(fixture);
    await expect(
      new HeatingScheduleService(fixture.client).read(address),
    ).rejects.toMatchObject({ code: "HEATING_UNSUPPORTED" });
    expect(fixture.client.putParamset).not.toHaveBeenCalled();
  });

  it("sanitizes remote read errors", async () => {
    const { client } = createFixture();
    client.getParamset.mockRejectedValue(
      new Error("password and address must not escape"),
    );
    await expect(
      new HeatingScheduleService(client).read(address),
    ).rejects.toEqual(new HeatingError("HEATING_READ_FAILED"));
  });
});

describe("bounded heating metadata and read scheduling", () => {
  it("reuses compiled metadata while reading fresh schedule values on every refresh", async () => {
    const { client, values } = createFixture(6);
    const service = new HeatingScheduleService(client);
    const before = await service.read(address);
    values.P1_TEMPERATURE_MONDAY_1 = 21;
    const after = await service.read(address);
    expect(after.profiles[0].days.MONDAY[0].temperature).toBe(21);
    expect(after.revision).not.toBe(before.revision);
    expect(
      client.getParamsetDescription.mock.calls.filter(
        ([, key]) => key === "MASTER",
      ),
    ).toHaveLength(1);
    expect(
      client.getParamset.mock.calls.filter(([, key]) => key === "MASTER"),
    ).toHaveLength(2);
  });

  it("expires metadata after five minutes without installing a timer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const { client } = createFixture();
    const service = new HeatingScheduleService(client);
    await service.read(address);
    vi.setSystemTime(1000 + 299_999);
    await service.read(address);
    expect(
      client.getParamsetDescription.mock.calls.filter(
        ([, key]) => key === "MASTER",
      ),
    ).toHaveLength(1);
    vi.setSystemTime(1000 + 300_000);
    await service.read(address);
    expect(
      client.getParamsetDescription.mock.calls.filter(
        ([, key]) => key === "MASTER",
      ),
    ).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps at most four schemas and evicts the least recently used target", async () => {
    const { client } = createFixture();
    const service = new HeatingScheduleService(client);
    for (const target of [
      "A:1",
      "B:1",
      "C:1",
      "D:1",
      "A:1",
      "E:1",
      "A:1",
      "B:1",
    ])
      await service.read(target);
    expect(
      client.getParamsetDescription.mock.calls
        .filter(([, key]) => key === "MASTER")
        .map(([target]) => target),
    ).toEqual(["A:1", "B:1", "C:1", "D:1", "E:1", "B:1"]);
  });

  it("coalesces simultaneous reads of one target into one snapshot", async () => {
    const { client } = createFixture(6);
    const service = new HeatingScheduleService(client);
    const schedules = await Promise.all(
      Array.from({ length: 30 }, () => service.read(address)),
    );
    expect(schedules).toHaveLength(30);
    expect(
      schedules.every(
        (schedule) => schedule.revision === schedules[0].revision,
      ),
    ).toBe(true);
    expect(client.getParamsetDescription).toHaveBeenCalledTimes(2);
    expect(client.getParamset).toHaveBeenCalledTimes(2);
    await service.read(address);
    expect(client.getParamset).toHaveBeenCalledTimes(4);
  });

  it("bounds queued targets and finishes large metadata before fetching values or another target", async () => {
    const { client, description, activeDescription } = createFixture();
    let release = () => {};
    client.getParamsetDescription.mockImplementation((target, key) => {
      if (target === "A:1" && key === "MASTER")
        return new Promise((resolve) => {
          release = () => resolve(description);
        });
      return Promise.resolve(
        key === "MASTER" ? description : activeDescription,
      );
    });
    const service = new HeatingScheduleService(client);
    const reads = ["A:1", "B:1", "C:1", "D:1"].map((target) =>
      service.read(target),
    );
    await expect(service.read("E:1")).rejects.toMatchObject({
      code: "HEATING_BUSY",
    });
    expect(client.getParamsetDescription).toHaveBeenCalledExactlyOnceWith(
      "A:1",
      "MASTER",
    );
    expect(client.getParamset).not.toHaveBeenCalled();
    release();
    expect(await Promise.all(reads)).toHaveLength(4);
    await expect(service.read("E:1")).resolves.toMatchObject({ maxSlots: 13 });
  });

  it("always fetches fresh metadata for a save and its readback, even with a warm display cache", async () => {
    const { client } = createFixture();
    const service = new HeatingScheduleService(client);
    const request = requestOf(await service.read(address));
    request.days.MONDAY[0].temperature = 21;
    expect((await service.save(address, request)).status).toBe("confirmed");
    expect(
      client.getParamsetDescription.mock.calls.filter(
        ([, key]) => key === "MASTER",
      ),
    ).toHaveLength(3);
    await service.read(address);
    expect(
      client.getParamsetDescription.mock.calls.filter(
        ([, key]) => key === "MASTER",
      ),
    ).toHaveLength(3);
  });

  it("releases a rejected coalesced read and does not poison later queued reads", async () => {
    const { client } = createFixture();
    const service = new HeatingScheduleService(client);
    client.getParamsetDescription.mockRejectedValueOnce(
      new Error("private transport error"),
    );
    const first = service.read(address);
    const duplicate = service.read(address);
    const other = service.read("OTHER:1");
    await expect(first).rejects.toMatchObject({ code: "HEATING_READ_FAILED" });
    await expect(duplicate).rejects.toMatchObject({
      code: "HEATING_READ_FAILED",
    });
    await expect(other).resolves.toMatchObject({ maxSlots: 13 });
    await expect(service.read(address)).resolves.toMatchObject({
      maxSlots: 13,
    });
  });
});

describe("heating schedule writes", () => {
  it("writes only changed entries in the selected profile and confirms readback", async () => {
    const { client, values } = createFixture();
    const service = new HeatingScheduleService(client);
    const schedule = await service.read(address);
    const request = requestOf(schedule);
    request.days.MONDAY[0].temperature = 21;
    const result = await service.save(address, request);
    expect(client.putParamset).toHaveBeenCalledExactlyOnceWith(
      address,
      "MASTER",
      { P1_TEMPERATURE_MONDAY_1: 21 },
      undefined,
      { P1_TEMPERATURE_MONDAY_1: "FLOAT" },
    );
    expect(result.status).toBe("confirmed");
    expect(result.schedule?.revision).not.toBe(schedule.revision);
    expect(values.CONTROL_MODE).toBe(0);
    expect(values.CHILD_LOCK).toBe(true);
    expect(values.P2_TEMPERATURE_MONDAY_1).toBe(18);
  });

  it("fills unused entries with 24:00 and the final temperature", async () => {
    const { client, values } = createFixture();
    const service = new HeatingScheduleService(client);
    const request = requestOf(await service.read(address));
    request.days.MONDAY = [{ end: 1440, temperature: 22 }];
    expect((await service.save(address, request)).status).toBe("confirmed");
    for (let slot = 1; slot <= 13; slot += 1) {
      expect(values[`P1_ENDTIME_MONDAY_${slot}`]).toBe(1440);
      expect(values[`P1_TEMPERATURE_MONDAY_${slot}`]).toBe(22);
    }
    const submitted = client.putParamset.mock.calls[0][2];
    expect(Object.keys(submitted)).toHaveLength(14);
    expect(
      Object.keys(submitted).every((key) =>
        /^P1_(ENDTIME|TEMPERATURE)_MONDAY_\d+$/.test(key),
      ),
    ).toBe(true);
  });

  it("does not write no-op saves, even when CCU padding differs", async () => {
    const { client, values } = createFixture();
    values.P1_TEMPERATURE_MONDAY_13 = 15;
    const service = new HeatingScheduleService(client);
    const request = requestOf(await service.read(address));
    expect((await service.save(address, request)).status).toBe("unchanged");
    expect(client.putParamset).not.toHaveBeenCalled();
    expect(values.P1_TEMPERATURE_MONDAY_13).toBe(15);
  });

  it("preserves another day's unused entries when editing one day's plan", async () => {
    const { client, values } = createFixture();
    values.P1_TEMPERATURE_TUESDAY_13 = 15;
    values.P1_ENDTIME_TUESDAY_13 = 720;
    const service = new HeatingScheduleService(client);
    const request = requestOf(await service.read(address));
    request.days.MONDAY[0].temperature = 21;
    expect((await service.save(address, request)).status).toBe("confirmed");
    expect(client.putParamset).toHaveBeenCalledExactlyOnceWith(
      address,
      "MASTER",
      { P1_TEMPERATURE_MONDAY_1: 21 },
      undefined,
      { P1_TEMPERATURE_MONDAY_1: "FLOAT" },
    );
    expect(values.P1_TEMPERATURE_TUESDAY_13).toBe(15);
    expect(values.P1_ENDTIME_TUESDAY_13).toBe(720);
  });

  it.each(["values", "metadata", "address"])(
    "rejects a stale %s revision before writing",
    async (kind) => {
      const { client, values, description } = createFixture();
      const service = new HeatingScheduleService(client);
      const request = requestOf(await service.read(address));
      request.days.MONDAY[0].temperature = 21;
      if (kind === "values") values.P2_TEMPERATURE_SUNDAY_1 = 19;
      if (kind === "metadata")
        description.P1_TEMPERATURE_MONDAY_1 = {
          ...description.P1_TEMPERATURE_MONDAY_1,
          MAX: 29,
        };
      await expect(
        service.save(kind === "address" ? "OTHER:1" : address, request),
      ).rejects.toMatchObject({ code: "HEATING_CONFLICT" });
      expect(client.putParamset).not.toHaveBeenCalled();
    },
  );

  it("rejects read-only profiles without submitting partial writes", async () => {
    const { client, description } = createFixture();
    description.P1_TEMPERATURE_SUNDAY_13 = {
      ...description.P1_TEMPERATURE_SUNDAY_13,
      OPERATIONS: 1,
    };
    const service = new HeatingScheduleService(client);
    const schedule = await service.read(address);
    expect(schedule.writable).toBe(false);
    const request = requestOf(schedule);
    request.days.MONDAY[0].temperature = 21;
    await expect(service.save(address, request)).rejects.toMatchObject({
      code: "HEATING_READ_ONLY",
    });
    expect(client.putParamset).not.toHaveBeenCalled();
  });

  it("enforces actual per-slot limits, including generated padding", async () => {
    const { client, description } = createFixture();
    description.P1_TEMPERATURE_MONDAY_13 = {
      ...description.P1_TEMPERATURE_MONDAY_13,
      MAX: 21,
    };
    const service = new HeatingScheduleService(client);
    const request = requestOf(await service.read(address));
    request.days.MONDAY = [{ end: 1440, temperature: 22 }];
    await expect(service.save(address, request)).rejects.toMatchObject({
      code: "HEATING_INVALID",
    });
    expect(client.putParamset).not.toHaveBeenCalled();
  });

  it("requires the actual write acknowledgement even when failure is delayed", async () => {
    vi.useFakeTimers();
    const { client } = createFixture();
    client.putParamset.mockImplementation(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error("remote secret error")), 2000);
        }),
    );
    const service = new HeatingScheduleService(client);
    const request = requestOf(await service.read(address));
    request.days.MONDAY[0].temperature = 21;
    let settled = false;
    const save = service.save(address, request).finally(() => {
      settled = true;
    });
    const rejection = expect(save).rejects.toEqual(
      new HeatingError("HEATING_WRITE_FAILED"),
    );
    await vi.advanceTimersByTimeAsync(1501);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(499);
    await rejection;
    expect(client.putParamset).toHaveBeenCalledTimes(1);
    client.putParamset.mockResolvedValue(undefined);
    expect((await service.save(address, request)).status).toBe("pending");
  });

  it("reports an acknowledged write as pending when the device readback lags", async () => {
    const { client } = createFixture();
    client.putParamset.mockResolvedValue(undefined);
    const service = new HeatingScheduleService(client);
    const request = requestOf(await service.read(address));
    request.days.MONDAY[0].temperature = 21;
    expect(await service.save(address, request)).toMatchObject({
      status: "pending",
      schedule: { revision: request.revision },
    });
    expect(client.putParamset).toHaveBeenCalledTimes(1);
  });

  it("does not confirm a write when an untouched day changes concurrently", async () => {
    const { client, values } = createFixture();
    client.putParamset.mockImplementation((_address, _key, changes) => {
      Object.assign(values, changes);
      values.P1_TEMPERATURE_TUESDAY_1 = 19;
      return Promise.resolve();
    });
    const service = new HeatingScheduleService(client);
    const request = requestOf(await service.read(address));
    request.days.MONDAY[0].temperature = 21;
    expect((await service.save(address, request)).status).toBe("pending");
    expect(client.putParamset).toHaveBeenCalledTimes(1);
  });

  it("copies the incoming request before any asynchronous transport work", async () => {
    const { client, values } = createFixture();
    const service = new HeatingScheduleService(client);
    const request = requestOf(await service.read(address));
    request.days.MONDAY[0].temperature = 21;
    const result = service.save(address, request);
    request.days.MONDAY[0].temperature = 30;
    expect((await result).status).toBe("confirmed");
    expect(values.P1_TEMPERATURE_MONDAY_1).toBe(21);
  });

  it("releases the channel lock after a failed pre-write read", async () => {
    const { client } = createFixture();
    const service = new HeatingScheduleService(client);
    const request = requestOf(await service.read(address));
    request.days.MONDAY[0].temperature = 21;
    client.getParamset.mockRejectedValueOnce(
      new Error("private transport error"),
    );
    await expect(service.save(address, request)).rejects.toMatchObject({
      code: "HEATING_READ_FAILED",
    });
    expect(client.putParamset).not.toHaveBeenCalled();
    expect((await service.save(address, request)).status).toBe("confirmed");
  });

  it("reports pending without leaking a remote error if readback fails after acknowledgement", async () => {
    const { client } = createFixture();
    client.putParamset.mockImplementation(() => {
      client.getParamset.mockRejectedValue(
        new Error("private readback failure"),
      );
      return Promise.resolve();
    });
    const service = new HeatingScheduleService(client);
    const request = requestOf(await service.read(address));
    request.days.MONDAY[0].temperature = 21;
    expect(await service.save(address, request)).toEqual({ status: "pending" });
    expect(client.putParamset).toHaveBeenCalledTimes(1);
  });

  it("serializes saves for one channel while allowing different channels", async () => {
    const { client } = createFixture();
    let release = () => {};
    client.putParamset.mockImplementation((target) =>
      target === address
        ? new Promise<void>((resolve) => {
            release = resolve;
          })
        : Promise.resolve(),
    );
    const service = new HeatingScheduleService(client);
    const first = requestOf(await service.read(address));
    const other = requestOf(await service.read("OTHER:1"));
    first.days.MONDAY[0].temperature = 21;
    other.days.MONDAY[0].temperature = 22;
    const inFlight = service.save(address, first);
    await expect(service.save(address, first)).rejects.toMatchObject({
      code: "HEATING_BUSY",
    });
    expect((await service.save("OTHER:1", other)).status).toBe("pending");
    release();
    expect((await inFlight).status).toBe("pending");
    expect(client.putParamset).toHaveBeenCalledTimes(2);
  });
});

describe("strict heating request boundary", () => {
  const malformed: readonly [
    string,
    (request: ReturnType<typeof requestOf>) => unknown,
  ][] = [
    ["null", () => null],
    ["array", () => []],
    [
      "foreign root field",
      (request) => ({ ...request, parameters: { CHILD_LOCK: false } }),
    ],
    ["inherited fields", (request) => Object.create(request) as unknown],
    [
      "hidden field",
      (request) => Object.defineProperty(request, "hidden", { value: true }),
    ],
    [
      "symbol field",
      (request) => Object.assign(request, { [Symbol("foreign")]: true }),
    ],
    [
      "getter field",
      (request) =>
        Object.defineProperty(request, "revision", {
          get: () => "a".repeat(64),
        }),
    ],
    [
      "prototype field",
      (request) =>
        Object.assign(
          request,
          JSON.parse('{"__proto__":{"polluted":true}}') as unknown,
        ),
    ],
    [
      "missing day",
      (request) => {
        Reflect.deleteProperty(request.days, "SUNDAY");
        return request;
      },
    ],
    [
      "foreign day",
      (request) => ({ ...request, days: { ...request.days, HOLIDAY: [] } }),
    ],
    [
      "foreign slot field",
      (request) => {
        Object.assign(request.days.MONDAY[0], { parameter: "CHILD_LOCK" });
        return request;
      },
    ],
    [
      "empty day",
      (request) => {
        request.days.MONDAY = [];
        return request;
      },
    ],
    [
      "sparse array",
      (request) => {
        Reflect.deleteProperty(request.days.MONDAY, "0");
        return request;
      },
    ],
    [
      "array property",
      (request) => {
        Object.assign(request.days.MONDAY, { injected: true });
        return request;
      },
    ],
    [
      "getter slot",
      (request) => {
        Object.defineProperty(request.days.MONDAY, "0", {
          get: () => ({ end: 360, temperature: 18 }),
        });
        return request;
      },
    ],
    [
      "too many slots",
      (request) => {
        request.days.MONDAY = Array.from({ length: 14 }, (_, i) => ({
          end: (i + 1) * 100,
          temperature: 20,
        }));
        return request;
      },
    ],
    [
      "nonfinite temperature",
      (request) => {
        request.days.MONDAY[0].temperature = NaN;
        return request;
      },
    ],
    [
      "infinite temperature",
      (request) => {
        request.days.MONDAY[0].temperature = Infinity;
        return request;
      },
    ],
    [
      "numeric string",
      (request) => {
        Object.assign(request.days.MONDAY[0], { temperature: "21" });
        return request;
      },
    ],
    [
      "unordered intervals",
      (request) => {
        request.days.MONDAY = [
          { end: 500, temperature: 20 },
          { end: 500, temperature: 18 },
          { end: 1440, temperature: 20 },
        ];
        return request;
      },
    ],
    [
      "fractional time",
      (request) => {
        request.days.MONDAY[0].end = 5.5;
        return request;
      },
    ],
    [
      "unbounded time",
      (request) => {
        request.days.MONDAY[0].end = -1;
        return request;
      },
    ],
    [
      "missing midnight",
      (request) => {
        request.days.MONDAY[1].end = 1439;
        return request;
      },
    ],
    [
      "invalid revision",
      (request) => ({ ...request, revision: "not-a-revision" }),
    ],
    ["invalid profile", (request) => ({ ...request, profile: 7 })],
    ["fractional profile", (request) => ({ ...request, profile: 1.5 })],
  ];
  it.each(malformed)(
    "rejects %s before transport access",
    async (_name, alter) => {
      const { client } = createFixture();
      const service = new HeatingScheduleService(client);
      const request = requestOf(await service.read(address));
      client.getParamset.mockClear();
      client.getParamsetDescription.mockClear();
      await expect(service.save(address, alter(request))).rejects.toMatchObject(
        { code: "HEATING_INVALID" },
      );
      expect(client.getParamset).not.toHaveBeenCalled();
      expect(client.getParamsetDescription).not.toHaveBeenCalled();
      expect(client.putParamset).not.toHaveBeenCalled();
    },
  );

  it.each([4, 31])(
    "rejects out-of-range temperature %s against current metadata",
    async (temperature) => {
      const { client } = createFixture();
      const service = new HeatingScheduleService(client);
      const request = requestOf(await service.read(address));
      request.days.MONDAY[0].temperature = temperature;
      await expect(service.save(address, request)).rejects.toMatchObject({
        code: "HEATING_INVALID",
      });
      expect(client.putParamset).not.toHaveBeenCalled();
    },
  );

  it("rejects a profile outside the device's actual storage", async () => {
    const { client } = createFixture();
    const service = new HeatingScheduleService(client);
    const request = requestOf(await service.read(address));
    request.profile = 6;
    await expect(service.save(address, request)).rejects.toMatchObject({
      code: "HEATING_INVALID",
    });
    expect(client.putParamset).not.toHaveBeenCalled();
  });

  it("enforces the actual slot count and minimum time", async () => {
    const { client } = createFixture(3, 2);
    const service = new HeatingScheduleService(client);
    const request = requestOf(await service.read(address));
    request.days.MONDAY[0].end = 4;
    await expect(service.save(address, request)).rejects.toMatchObject({
      code: "HEATING_INVALID",
    });
    request.days.MONDAY = [
      { end: 5, temperature: 20 },
      { end: 10, temperature: 20 },
      { end: 1440, temperature: 20 },
    ];
    await expect(service.save(address, request)).rejects.toMatchObject({
      code: "HEATING_INVALID",
    });
    expect(client.putParamset).not.toHaveBeenCalled();
  });
});

interface Recording {
  readonly models: readonly {
    readonly model: string;
    readonly master: readonly {
      readonly channel: number;
      readonly parameters: ParamsetDescription;
    }[];
    readonly activeProfile: readonly {
      readonly channel: number;
      readonly parameter: ParameterDescription;
    }[];
  }[];
}

const recording = JSON.parse(
  readFileSync("tests/fixtures/heating-master.json", "utf8"),
) as Recording;

describe("recorded thermostat MASTER metadata integration", () => {
  it.each(recording.models)(
    "reads and edits $model using its recorded schema",
    async (model) => {
      const master = model.master.find(
        ({ channel }) => channel === 1,
      )?.parameters;
      const active = model.activeProfile.find(
        ({ channel }) => channel === 1,
      )?.parameter;
      expect(master).toBeDefined();
      expect(active).toBeDefined();
      if (master === undefined || active === undefined)
        throw new Error("Incomplete recorded schema");
      // Only metadata was recorded. All temperatures, callbacks and acknowledgements
      // here are synthetic; the integration test never operates physical devices.
      const values: Record<string, RpcValue> = Object.fromEntries(
        Object.keys(master).map((key) => [
          key,
          key.includes("_ENDTIME_") ? (key.endsWith("_1") ? 360 : 1440) : 20,
        ]),
      );
      const client = {
        getParamsetDescription: vi.fn((_address: string, key = "VALUES") =>
          Promise.resolve(
            key === "MASTER" ? master : { ACTIVE_PROFILE: active },
          ),
        ),
        getParamset: vi.fn((_address: string, key = "VALUES") =>
          Promise.resolve(
            key === "MASTER" ? { ...values } : { ACTIVE_PROFILE: 1 },
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
      };
      const service = new HeatingScheduleService(client);
      const schedule = await service.read(address);
      expect(schedule.profiles).toHaveLength(
        model.model.startsWith("HmIP-eTRV") ? 3 : 6,
      );
      expect(schedule.maxSlots).toBe(13);
      expect(schedule.selectableProfiles).toHaveLength(Number(active.MAX));
      // Copying or creating a plan fills an existing slot, including a stored
      // P6 that a heating group's ACTIVE_PROFILE metadata cannot select.
      const lastProfile = schedule.profiles.length;
      const request = requestOf(schedule, lastProfile);
      request.days.FRIDAY = [
        { end: 420, temperature: 18 },
        { end: 1320, temperature: 22 },
        { end: 1440, temperature: 18 },
      ];
      const result = await service.save(address, request);
      expect(result.status).toBe("confirmed");
      expect(result.schedule?.profiles[lastProfile - 1].days.FRIDAY).toEqual(
        request.days.FRIDAY satisfies readonly HeatingSlot[],
      );
      expect(
        Object.keys(client.putParamset.mock.calls[0][2]).every((key) =>
          key.startsWith(`P${lastProfile}_`),
        ),
      ).toBe(true);
    },
  );
});
