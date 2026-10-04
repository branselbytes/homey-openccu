import { OpenCcuRuntimeProvider } from "../../src/homey/runtime-provider";
import type { OpenCcuRuntime } from "../../src/runtime/openccu-runtime";
import { ManagedCentralRuntimeFactory } from "../../src/runtime/managed-central-runtime";
import type {
  DeviceDescription,
  ParamsetDescription,
  RpcValue,
  XmlRpcClient,
} from "../../src/protocol/xmlrpc/types";

export interface GarageFixture {
  readonly description: DeviceDescription;
  readonly channels: readonly {
    readonly description: DeviceDescription;
    readonly parameters: ParamsetDescription;
  }[];
}

const CENTRAL_ID = "garage-simulation";
const INTERFACE_ID = "HmIP-RF";

/** Development-only RPC implementation. Never opens a socket or loads credentials. */
export class GarageSimulationClient implements XmlRpcClient {
  readonly #fixture: GarageFixture;
  readonly #values = new Map<string, Record<string, RpcValue>>();
  readonly #travelTimeMs: number;
  #timer?: ReturnType<typeof setTimeout>;
  #runtime?: OpenCcuRuntime;

  constructor(fixture: GarageFixture, travelTimeMs = 1_200) {
    this.#fixture = fixture;
    this.#travelTimeMs = travelTimeMs;
    for (const channel of fixture.channels) {
      this.#values.set(
        channel.description.ADDRESS,
        Object.fromEntries(
          Object.entries(channel.parameters).map(([parameter, metadata]) => [
            parameter,
            metadata.TYPE === "BOOL" ? false : 0,
          ]),
        ),
      );
    }
  }

  attach(runtime: OpenCcuRuntime): void {
    this.#runtime = runtime;
  }

  close(): void {
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#runtime = undefined;
  }

  listDevices(): Promise<readonly DeviceDescription[]> {
    return Promise.resolve([
      this.#fixture.description,
      ...this.#fixture.channels.map(({ description }) => description),
    ]);
  }

  getParamsetDescription(
    address: string,
    paramsetKey = "VALUES",
  ): Promise<ParamsetDescription> {
    if (paramsetKey !== "VALUES")
      throw new Error("Simulation supports VALUES only");
    const channel = this.#fixture.channels.find(
      ({ description }) => description.ADDRESS === address,
    );
    if (channel === undefined) throw new Error("Unknown simulated channel");
    return Promise.resolve(channel.parameters);
  }

  async getValue(address: string, parameter: string): Promise<RpcValue> {
    const values = await this.getParamset(address);
    if (!(parameter in values)) throw new Error("Unknown simulated datapoint");
    return values[parameter];
  }

  getParamset(
    address: string,
    paramsetKey = "VALUES",
  ): Promise<Readonly<Record<string, RpcValue>>> {
    if (paramsetKey !== "VALUES")
      throw new Error("Simulation supports VALUES only");
    const values = this.#values.get(address);
    if (values === undefined) throw new Error("Unknown simulated channel");
    return Promise.resolve({ ...values });
  }

  async setValue(
    address: string,
    parameter: string,
    value: RpcValue,
  ): Promise<void> {
    const device = this.#fixture.description.ADDRESS;
    if (
      address === `${device}:2` &&
      parameter === "STATE" &&
      typeof value === "boolean"
    ) {
      await this.#emit(address, parameter, value);
      return;
    }
    if (address !== `${device}:1` || parameter !== "DOOR_COMMAND") {
      throw new Error("Unsupported simulated write");
    }
    const commands = ["NOP", "OPEN", "STOP", "CLOSE", "PARTIAL_OPEN"];
    const command = typeof value === "number" ? commands[value] : value;
    if (typeof command !== "string" || !commands.includes(command)) {
      throw new Error("Invalid simulated door command");
    }
    if (command === "NOP") return;
    const wasMoving = this.#timer !== undefined;
    clearTimeout(this.#timer);
    this.#timer = undefined;
    if (command === "STOP") {
      if (wasMoving) await this.#emit(address, "DOOR_STATE", 3);
      await this.#emit(address, "PROCESS", 0);
      return;
    }
    await this.#emit(address, "DOOR_STATE", 3);
    await this.#emit(address, "PROCESS", 1);
    const state = command === "OPEN" ? 1 : command === "CLOSE" ? 0 : 2;
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      void this.#finishMovement(address, state);
    }, this.#travelTimeMs);
  }

  putParamset(): Promise<void> {
    return Promise.reject(
      new Error("Simulation does not accept configuration writes"),
    );
  }

  init(): Promise<void> {
    return Promise.resolve();
  }

  async #finishMovement(address: string, state: number): Promise<void> {
    await this.#emit(address, "DOOR_STATE", state);
    await this.#emit(address, "PROCESS", 0);
  }

  async #emit(
    address: string,
    parameter: string,
    value: RpcValue,
  ): Promise<void> {
    const values = this.#values.get(address);
    if (values === undefined) throw new Error("Unknown simulated channel");
    values[parameter] = value;
    await this.#runtime
      ?.createCallbackDispatcher()
      .dispatch("event", [INTERFACE_ID, address, parameter, value]);
  }
}

export async function createGarageSimulation(
  fixture: GarageFixture,
  name: string,
  travelTimeMs = 1_200,
): Promise<{
  readonly runtimeProvider: OpenCcuRuntimeProvider;
  readonly close: () => Promise<void>;
}> {
  const client = new GarageSimulationClient(fixture, travelTimeMs);
  let connected: (() => void) | undefined;
  let failed: ((error: unknown) => void) | undefined;
  const ready = new Promise<void>((resolve, reject) => {
    connected = resolve;
    failed = reject;
  });
  const factory = new ManagedCentralRuntimeFactory({
    callbackAdvertisedHost: "simulation.invalid",
    createClient: () => client,
    createCallbackServer: ({ runtime }) => {
      client.attach(runtime);
      return {
        ready: () => Promise.resolve(),
        close: () => {
          client.close();
          return Promise.resolve();
        },
      };
    },
    onConnectionState: (_central, _interface, state, error) => {
      if (state === "healthy") connected?.();
      if (state === "disconnected") failed?.(error);
    },
  });
  const managed = await factory.create({
    centralId: CENTRAL_ID,
    host: "simulation.invalid",
    hmIpRfPort: 2010,
    virtualDevicesPort: 9292,
    callbackPort: 12010,
    virtualDevicesCallbackPort: 12011,
    jsonRpcUrl: "http://simulation.invalid/api/homematic.cgi",
  });
  try {
    await ready;
  } catch (error) {
    await managed.stop();
    throw error;
  }
  managed.core.updateMetadata({
    metadata: {
      names: new Map([[fixture.description.ADDRESS, name]]),
      rooms: new Map(),
      functions: new Map(),
      programs: [],
      systemVariables: [],
    },
    issues: [],
  });
  const runtimeProvider = new OpenCcuRuntimeProvider({
    getRuntime: (centralId) => (centralId === CENTRAL_ID ? managed : undefined),
    runtimeEntries: () => [[CENTRAL_ID, managed]],
  });
  return { runtimeProvider, close: () => managed.stop() };
}
