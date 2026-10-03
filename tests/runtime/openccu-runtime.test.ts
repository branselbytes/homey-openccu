import { describe, expect, it, vi } from "vitest";

import { OpenCcuRuntime } from "../../src/runtime/openccu-runtime";
import type {
  ParamsetDescription,
  RpcValue,
  XmlRpcClient,
} from "../../src/protocol/xmlrpc/types";

function createClient() {
  return {
    listDevices: vi.fn<XmlRpcClient["listDevices"]>().mockResolvedValue([
      { ADDRESS: "301", TYPE: "HmIP-PS", CHILDREN: ["301:3"] },
      {
        ADDRESS: "301:3",
        TYPE: "SWITCH",
        PARENT: "301",
        PARAMSETS: ["VALUES"],
      },
    ]),
    getParamsetDescription: vi.fn().mockResolvedValue({
      STATE: { TYPE: "BOOL", OPERATIONS: 7, FLAGS: 1 },
    }),
    getValue: vi.fn(),
    getParamset: vi.fn().mockResolvedValue({ STATE: true }),
    setValue: vi.fn(),
    putParamset: vi.fn(),
    init: vi.fn(),
  } satisfies XmlRpcClient;
}

describe("OpenCcuRuntime", () => {
  it("validates and normalizes hub commands through the JSON-RPC session", async () => {
    let logicValue = "false";
    const call = vi.fn((method: string, params?: Record<string, unknown>) => {
      if (method === "Program.execute") return Promise.resolve(true);
      if (method === "SysVar.setValue") {
        logicValue = String(params?.value);
        return Promise.resolve(true);
      }
      if (method === "Program.getAll") {
        return Promise.resolve([{ id: "20", name: "Night", isActive: true }]);
      }
      if (method === "SysVar.getAll") {
        return Promise.resolve([
          { id: "30", name: "Away", type: "LOGIC", value: logicValue },
        ]);
      }
      return Promise.resolve([]);
    });
    const runtime = new OpenCcuRuntime(createClient(), {
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
      jsonRpcSession: { call },
    });
    await runtime.refreshMetadata();

    await runtime.executeProgram("20");
    await runtime.setSystemVariable("30", "true");
    await expect(runtime.systemVariableEquals("30", "true")).resolves.toBe(
      true,
    );

    expect(call).toHaveBeenCalledWith(
      "Program.execute",
      { id: "20" },
      undefined,
    );
    expect(call).toHaveBeenCalledWith(
      "SysVar.setValue",
      { id: "30", value: true },
      undefined,
    );
  });

  it("uses OpenCCU metadata names for pairing and exposes safe counts", async () => {
    const runtime = new OpenCcuRuntime(createClient(), {
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
    });
    await runtime.refresh();
    runtime.updateMetadata({
      metadata: {
        names: new Map([["301", "Hall thermostat"]]),
        rooms: new Map([["Hall", ["10"]]]),
        functions: new Map([["Climate", ["10"]]]),
        programs: [{ id: "20", name: "Night", active: true }],
        systemVariables: [
          { id: "30", name: "Away", type: "LOGIC", value: false },
        ],
      },
      issues: [],
    });

    expect(runtime.pairingCandidates()[0]?.name).toBe("Hall thermostat");
    expect(runtime.getDiagnostics().metadataCounts).toEqual({
      names: 1,
      rooms: 1,
      functions: 1,
      programs: 1,
      systemVariables: 1,
    });
    expect(runtime.getDiagnostics().devices).toEqual([
      {
        alias: "device-1",
        type: "HmIP-PS",
        availability: "unknown",
        channels: [
          {
            index: 3,
            type: "SWITCH",
            dataPoints: [
              {
                parameter: "STATE",
                type: "BOOL",
                operations: 7,
                flags: 1,
              },
            ],
          },
        ],
        mappings: [
          {
            driverId: "HMIP-PSM",
            profileId: "hmip-switch",
            generic: false,
            capabilities: ["onoff"],
          },
        ],
      },
    ]);
    expect(JSON.stringify(runtime.getDiagnostics())).not.toContain("301");
  });
  it("retains the latest connection state for late subscribers", () => {
    const runtime = new OpenCcuRuntime(createClient(), {
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
    });

    expect(runtime.connectionState).toBe("stopped");
    runtime.publishConnectionState("connecting");
    expect(runtime.connectionState).toBe("connecting");
    runtime.publishConnectionState("healthy");
    expect(runtime.connectionState).toBe("healthy");
    expect(runtime.getDiagnostics()).toMatchObject({
      connectionState: "healthy",
      deviceCount: 0,
      discoveryIssueCount: 0,
    });
  });

  it("provides pairing candidates only after a successful refresh", async () => {
    const runtime = new OpenCcuRuntime(createClient(), {
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
    });
    expect(runtime.pairingCandidates()).toEqual([]);

    await runtime.refresh();

    expect(
      runtime.pairingCandidates(new Map([["301", "Licht"]])),
    ).toMatchObject([
      { driverId: "HMIP-PSM", name: "Licht", capabilities: ["onoff"] },
    ]);
  });

  it("uses profile-owned MASTER configuration for RGBW pairing topology", async () => {
    const getParamsetDescription = vi.fn(
      (_address: string, paramsetKey = "VALUES") => {
        const response: ParamsetDescription =
          paramsetKey === "MASTER"
            ? {
                DEVICE_OPERATION_MODE: {
                  TYPE: "ENUM" as const,
                  OPERATIONS: 3,
                  FLAGS: 1,
                  VALUE_LIST: ["RGB", "RGBW", "2_TUNABLE_WHITE", "4_PWM"],
                },
              }
            : {
                LEVEL: { TYPE: "FLOAT" as const, OPERATIONS: 7, FLAGS: 1 },
              };
        return Promise.resolve(response);
      },
    );
    const client: XmlRpcClient = {
      ...createClient(),
      listDevices: vi.fn().mockResolvedValue([
        {
          ADDRESS: "501",
          TYPE: "HmIP-RGBW",
          CHILDREN: ["501:0", "501:1", "501:2", "501:3", "501:4"],
        },
        {
          ADDRESS: "501:0",
          TYPE: "DEVICE_CONFIG",
          PARENT: "501",
          PARAMSETS: ["MASTER"],
        },
        ...[1, 2, 3, 4].map((channel) => ({
          ADDRESS: `501:${channel}`,
          TYPE: "DIMMER",
          PARENT: "501",
          PARAMSETS: ["VALUES"],
        })),
      ]),
      getParamsetDescription,
      getParamset: vi.fn((_address: string, paramsetKey = "VALUES") => {
        const response: Readonly<Record<string, RpcValue>> =
          paramsetKey === "MASTER"
            ? { DEVICE_OPERATION_MODE: 3 }
            : { LEVEL: 0 };
        return Promise.resolve(response);
      }),
    };
    const runtime = new OpenCcuRuntime(client, {
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
    });

    await runtime.refresh();

    expect(
      runtime.pairingCandidates().map(({ driverId, data }) => ({
        driverId,
        logicalId: data.logicalId,
      })),
    ).toEqual(
      [1, 2, 3, 4].map((channel) => ({
        driverId: "HmIP-RGBW",
        logicalId: `output-${channel}`,
      })),
    );
  });

  it.each(["initial", "reconnect"] as const)(
    "acknowledges %s registration callbacks without nested discovery RPCs",
    async (phase) => {
      const client = createClient();
      const runtime = new OpenCcuRuntime(client, {
        centralId: "ccu-1",
        interfaceId: "HmIP-RF",
      });
      if (phase === "reconnect") await runtime.refresh();
      vi.mocked(client.listDevices).mockClear();
      runtime.publishConnectionState("connecting");
      const dispatcher = runtime.createCallbackDispatcher();

      await dispatcher.dispatch("newDevices", [
        "HmIP-RF",
        [{ ADDRESS: "301", TYPE: "HmIP-PS", CHILDREN: ["301:3"] }],
      ]);

      expect(client.listDevices).not.toHaveBeenCalled();
      await runtime.refresh();
      runtime.publishConnectionState("healthy");
      expect(runtime.pairingCandidates()).toHaveLength(1);
    },
  );

  it("leaves queued rediscovery to the supervisor when reconnect starts", async () => {
    const client = createClient();
    let finishInvalidation!: () => void;
    const cache = {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            finishInvalidation = resolve;
          }),
      ),
    };
    const runtime = new OpenCcuRuntime(client, {
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
      descriptionCache: cache,
    });
    await runtime.refresh();
    const changed = runtime
      .createCallbackDispatcher()
      .dispatch("newDevices", [
        "HmIP-RF",
        [{ ADDRESS: "301", TYPE: "HmIP-PS" }],
      ]);
    await vi.waitFor(() => expect(cache.delete).toHaveBeenCalledOnce());
    runtime.publishConnectionState("connecting");
    finishInvalidation();
    await changed;

    expect(client.listDevices).toHaveBeenCalledOnce();
  });

  it.each(["during", "after"] as const)(
    "catches up once for callbacks %s initial discovery before healthy",
    async (phase) => {
      const client = createClient();
      let finishInitial!: () => void;
      client.listDevices.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishInitial = () => resolve([]);
          }),
      );
      const runtime = new OpenCcuRuntime(client, {
        centralId: "ccu-1",
        interfaceId: "HmIP-RF",
      });
      runtime.publishConnectionState("connecting");
      const initial = runtime.refresh();
      await vi.waitFor(() => expect(client.listDevices).toHaveBeenCalledOnce());
      if (phase === "after") {
        finishInitial();
        await initial;
      }
      const dispatcher = runtime.createCallbackDispatcher();
      await dispatcher.dispatch("newDevices", [
        "HmIP-RF",
        [{ ADDRESS: "301", TYPE: "HmIP-PS" }],
      ]);
      await dispatcher.dispatch("updateDevice", ["HmIP-RF", "301", 0]);
      if (phase === "during") {
        finishInitial();
        await initial;
      }
      expect(client.listDevices).toHaveBeenCalledOnce();
      expect(runtime.pairingCandidates()).toEqual([]);

      runtime.publishConnectionState("healthy");
      await vi.waitFor(() =>
        expect(runtime.pairingCandidates()).toHaveLength(1),
      );
      expect(client.listDevices).toHaveBeenCalledTimes(2);
      runtime.publishConnectionState("healthy");
      await Promise.resolve();
      expect(client.listDevices).toHaveBeenCalledTimes(2);
    },
  );

  it("catches up on deleted devices after initial discovery during metadata loading", async () => {
    const client = createClient();
    const runtime = new OpenCcuRuntime(client, {
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
    });
    runtime.publishConnectionState("connecting");
    await runtime.refresh();
    client.listDevices.mockResolvedValue([]);
    await runtime
      .createCallbackDispatcher()
      .dispatch("deleteDevices", ["HmIP-RF", ["301"]]);
    expect(runtime.pairingCandidates()).toHaveLength(1);

    runtime.publishConnectionState("healthy");
    await vi.waitFor(() => expect(runtime.pairingCandidates()).toEqual([]));
    expect(client.listDevices).toHaveBeenCalledTimes(2);
  });

  it("drops deferred device discovery when the lifecycle stops", async () => {
    const client = createClient();
    const controller = new AbortController();
    const runtime = new OpenCcuRuntime(client, {
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
    });
    runtime.publishConnectionState("connecting");
    await runtime.refresh(controller.signal);
    await runtime
      .createCallbackDispatcher()
      .dispatch("deleteDevices", ["HmIP-RF", ["301"]]);
    runtime.publishConnectionState("healthy");
    controller.abort();
    runtime.publishConnectionState("stopped");
    await Promise.resolve();
    await Promise.resolve();

    expect(client.listDevices).toHaveBeenCalledOnce();
    expect(runtime.pairingCandidates()).toHaveLength(1);
  });

  it("reports deferred discovery failure and recovers on a later callback", async () => {
    const client = createClient();
    const runtime = new OpenCcuRuntime(client, {
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
    });
    runtime.publishConnectionState("connecting");
    await runtime.refresh();
    client.listDevices.mockRejectedValueOnce(
      new Error("private transport details"),
    );
    const dispatcher = runtime.createCallbackDispatcher();
    await dispatcher.dispatch("deleteDevices", ["HmIP-RF", ["301"]]);
    runtime.publishConnectionState("healthy");
    await vi.waitFor(() =>
      expect(runtime.discoveryIssues).toContainEqual({
        channelAddress: "301",
        message: "Deferred device discovery failed",
      }),
    );
    client.listDevices.mockResolvedValue([]);
    await dispatcher.dispatch("deleteDevices", ["HmIP-RF", ["301"]]);

    expect(runtime.pairingCandidates()).toEqual([]);
    expect(runtime.discoveryIssues).toEqual([]);
  });

  it("bypasses persisted descriptions after failed invalidation and keeps device changes working", async () => {
    const client = createClient();
    const cache = {
      get: vi.fn().mockResolvedValue({
        STATE: { TYPE: "BOOL", OPERATIONS: 7, FLAGS: 1 },
      }),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockRejectedValue(new Error("private storage details")),
    };
    const runtime = new OpenCcuRuntime(client, {
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
      descriptionCache: cache,
    });
    await runtime.refresh();
    expect(client.getParamsetDescription).not.toHaveBeenCalled();
    client.getParamsetDescription.mockResolvedValue({});
    const dispatcher = runtime.createCallbackDispatcher();
    await dispatcher.dispatch("updateDevice", ["HmIP-RF", "301", 0]);

    expect(cache.get).toHaveBeenCalledOnce();
    expect(client.getParamsetDescription).toHaveBeenCalledOnce();
    expect(
      runtime.devices.get("301")?.channels.get("301:3")?.dataPoints.size,
    ).toBe(0);
    expect(runtime.discoveryIssues).toContainEqual({
      channelAddress: "301:3",
      message: "Paramset description cache invalidation failed; cache disabled",
    });
    client.listDevices.mockResolvedValue([]);
    await dispatcher.dispatch("deleteDevices", ["HmIP-RF", ["301"]]);
    expect(runtime.devices.size).toBe(0);
    expect(runtime.pairingCandidates()).toEqual([]);
    expect(cache.delete).toHaveBeenCalledOnce();
    expect(JSON.stringify(runtime.discoveryIssues)).not.toContain(
      "private storage details",
    );
  });

  it("refreshes pairing candidates when new OpenCCU devices arrive", async () => {
    const client = createClient();
    const descriptions = await client.listDevices();
    vi.mocked(client.listDevices).mockResolvedValueOnce([]);
    const runtime = new OpenCcuRuntime(client, {
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
    });
    await runtime.refresh();
    expect(runtime.pairingCandidates()).toEqual([]);
    const discovery = vi.fn();
    runtime.subscribe("discovery", discovery);

    await runtime
      .createCallbackDispatcher()
      .dispatch("newDevices", ["HmIP-RF", descriptions]);

    expect(runtime.pairingCandidates()).toMatchObject([
      { data: { address: "301" }, capabilities: ["onoff"] },
    ]);
    expect(discovery).toHaveBeenCalledOnce();
  });

  it("removes deleted OpenCCU devices and invalidates child description caches", async () => {
    const client = createClient();
    const cache = {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const runtime = new OpenCcuRuntime(client, {
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
      descriptionCache: cache,
    });
    await runtime.refresh();
    vi.mocked(client.listDevices).mockResolvedValue([]);

    await runtime
      .createCallbackDispatcher()
      .dispatch("deleteDevices", ["HmIP-RF", ["301"]]);

    expect(runtime.pairingCandidates()).toEqual([]);
    expect(runtime.devices.size).toBe(0);
    expect(cache.delete).toHaveBeenCalledWith("ccu-1/HmIP-RF/301%3A3/VALUES");
  });

  it("serializes overlapping device changes and retries after a failed refresh", async () => {
    const client = createClient();
    const runtime = new OpenCcuRuntime(client, {
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
    });
    await runtime.refresh();
    let rejectDiscovery!: (error: Error) => void;
    vi.mocked(client.listDevices)
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectDiscovery = reject;
          }),
      )
      .mockResolvedValueOnce([]);
    const dispatcher = runtime.createCallbackDispatcher();
    const first = dispatcher.dispatch("newDevices", [
      "HmIP-RF",
      [{ ADDRESS: "301", TYPE: "HmIP-PS" }],
    ]);
    const failed = expect(first).rejects.toThrow("offline");
    await vi.waitFor(() => expect(client.listDevices).toHaveBeenCalledTimes(2));
    const second = dispatcher.dispatch("deleteDevices", ["HmIP-RF", ["301"]]);
    await Promise.resolve();
    expect(client.listDevices).toHaveBeenCalledTimes(2);
    rejectDiscovery(new Error("offline"));
    await failed;
    await second;

    expect(client.listDevices).toHaveBeenCalledTimes(3);
    expect(runtime.pairingCandidates()).toEqual([]);
  });

  it("does not publish callback discovery or start queued RPCs after shutdown", async () => {
    const client = createClient();
    const controller = new AbortController();
    const runtime = new OpenCcuRuntime(client, {
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
    });
    await runtime.refresh(controller.signal);
    let finishDiscovery!: () => void;
    vi.mocked(client.listDevices).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishDiscovery = () => resolve([]);
        }),
    );
    const discovery = vi.fn();
    runtime.subscribe("discovery", discovery);
    const dispatcher = runtime.createCallbackDispatcher();
    const first = dispatcher.dispatch("deleteDevices", ["HmIP-RF", ["301"]]);
    const aborted = expect(first).rejects.toThrow();
    await vi.waitFor(() => expect(client.listDevices).toHaveBeenCalledTimes(2));
    const queued = dispatcher.dispatch("deleteDevices", ["HmIP-RF", ["301"]]);
    controller.abort();
    finishDiscovery();
    await aborted;
    await queued;
    await dispatcher.dispatch("newDevices", ["HmIP-RF", []]);

    expect(client.listDevices).toHaveBeenCalledTimes(2);
    expect(discovery).not.toHaveBeenCalled();
    expect(runtime.pairingCandidates()).toHaveLength(1);
  });

  it("routes callback events through listener-specific subscriptions", async () => {
    const runtime = new OpenCcuRuntime(createClient(), {
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
    });
    const listener = vi.fn();
    const unsubscribe = runtime.subscribe("datapoint", listener);
    const dispatcher = runtime.createCallbackDispatcher();

    await dispatcher.dispatch("event", ["HmIP-RF", "301:3", "STATE", true]);
    unsubscribe();
    await dispatcher.dispatch("event", ["HmIP-RF", "301:3", "STATE", false]);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({
      interfaceId: "HmIP-RF",
      channelAddress: "301:3",
      parameter: "STATE",
      value: true,
    });
  });

  it.each([
    ["up", "LEVEL", 1],
    ["down", "LEVEL", 0],
    ["idle", "STOP", true],
  ] as const)(
    "maps Homey cover state %s to OpenCCU %s",
    async (state, parameter, value) => {
      const setValue = vi.fn();
      const client = { ...createClient(), setValue };
      const runtime = new OpenCcuRuntime(client, {
        centralId: "ccu-1",
        interfaceId: "HmIP-RF",
      });

      await runtime.write(
        {
          capability: "windowcoverings_state",
          channelAddress: "301:3",
          parameter: "ACTIVITY_STATE",
          writeChannelAddress: "301:4",
          writeParameter: "LEVEL",
          writeStrategy: "cover-state",
          readable: true,
          writable: true,
          transform: "activity-state-to-cover-state",
        },
        state,
      );

      expect(setValue).toHaveBeenCalledWith(
        "301:4",
        parameter,
        value,
        undefined,
      );
    },
  );

  it.each([
    [true, "CLOSE"],
    [false, "OPEN"],
  ] as const)(
    "maps Homey garage closed=%s to OpenCCU %s",
    async (closed, command) => {
      const setValue = vi.fn();
      const runtime = new OpenCcuRuntime(
        { ...createClient(), setValue },
        { centralId: "ccu-1", interfaceId: "HmIP-RF" },
      );
      await runtime.write(
        {
          capability: "garagedoor_closed",
          channelAddress: "401:1",
          parameter: "DOOR_STATE",
          writeChannelAddress: "401:1",
          writeParameter: "DOOR_COMMAND",
          writeStrategy: "garage-closed",
          readable: true,
          writable: true,
          transform: "garage-door-state-to-closed",
        },
        closed,
      );
      expect(setValue).toHaveBeenCalledWith(
        "401:1",
        "DOOR_COMMAND",
        command,
        undefined,
      );
    },
  );

  it.each([
    [
      true,
      {
        ACOUSTIC_ALARM_SELECTION: "FREQUENCY_RISING_AND_FALLING",
        OPTICAL_ALARM_SELECTION: "BLINKING_ALTERNATELY_REPEATING",
        DURATION_UNIT: "S",
        DURATION_VALUE: 30,
      },
    ],
    [
      false,
      {
        ACOUSTIC_ALARM_SELECTION: "DISABLE_ACOUSTIC_SIGNAL",
        OPTICAL_ALARM_SELECTION: "DISABLE_OPTICAL_SIGNAL",
        DURATION_UNIT: "S",
        DURATION_VALUE: 0,
      },
    ],
  ] as const)(
    "writes the default HmIP siren state %s atomically",
    async (enabled, values) => {
      const putParamset = vi.fn();
      const runtime = new OpenCcuRuntime(
        { ...createClient(), putParamset },
        { centralId: "ccu-1", interfaceId: "HmIP-RF" },
      );
      await runtime.write(
        {
          capability: "onoff",
          channelAddress: "701:3",
          parameter: "ACOUSTIC_ALARM_ACTIVE",
          writeChannelAddress: "701:3",
          writeParameter: "ACOUSTIC_ALARM_SELECTION",
          writeStrategy: "siren-default",
          readable: true,
          writable: true,
          transform: "boolean",
        },
        enabled,
      );
      expect(putParamset).toHaveBeenCalledWith(
        "701:3",
        "VALUES",
        values,
        undefined,
      );
    },
  );

  it.each([
    [true, "INTRUSION_ALARM"],
    [false, "INTRUSION_ALARM_OFF"],
  ] as const)(
    "maps the smoke detector siren state %s to %s",
    async (enabled, command) => {
      const setValue = vi.fn();
      const runtime = new OpenCcuRuntime(
        { ...createClient(), setValue },
        { centralId: "ccu-1", interfaceId: "HmIP-RF" },
      );
      await runtime.write(
        {
          capability: "onoff",
          channelAddress: "801:1",
          parameter: "SMOKE_DETECTOR_ALARM_STATUS",
          writeChannelAddress: "801:1",
          writeParameter: "SMOKE_DETECTOR_COMMAND",
          writeStrategy: "smoke-siren",
          readable: true,
          writable: true,
          transform: "smoke-status-to-boolean",
        },
        enabled,
      );
      expect(setValue).toHaveBeenCalledWith(
        "801:1",
        "SMOKE_DETECTOR_COMMAND",
        command,
        undefined,
      );
    },
  );
});
