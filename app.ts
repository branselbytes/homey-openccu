import Homey from "homey";
import { isIP } from "node:net";

import { VersionedCache } from "./src/cache/versioned-cache";
import { MemoryCacheStorage } from "./src/cache/memory-storage";
import { createSupportReport } from "./src/diagnostics/support-report";
import { safeErrorKind } from "./src/diagnostics/safe-error";
import { ProcessMemoryDiagnostics } from "./src/diagnostics/process-memory";
import { OpenCcuAppController } from "./src/homey/app-controller";
import { loadOpenCcuConnections } from "./src/homey/settings-adapter";
import { registerHubFlowCards } from "./src/homey/hub-flow-controller";
import { registerThermostatFlowCards } from "./src/homey/thermostat-flow-controller";
import { registerHandleFlowCards } from "./src/homey/handle-flow-controller";
import { registerGarageFlowCards } from "./src/homey/garage-flow-controller";
import { HeatingController } from "./src/homey/heating-controller";
import { callbackHostFromLocalAddress } from "./src/homey/callback-host";
import { OpenCcuRuntimeProvider } from "./src/homey/runtime-provider";
import type { ParamsetDescription } from "./src/protocol/xmlrpc/types";
import {
  discoverOpenCcus,
  type DiscoveredOpenCcu,
} from "./src/protocol/udp-discovery";
import { OpenCcuApplicationLifecycle } from "./src/runtime/application-lifecycle";
import {
  ManagedCentralRuntime,
  ManagedCentralRuntimeFactory,
} from "./src/runtime/managed-central-runtime";

export = class OpenCcuApp extends Homey.App {
  runtimeProvider?: OpenCcuRuntimeProvider;
  readonly heatingController = new HeatingController(
    () =>
      Object.values(this.homey.drivers.getDrivers()).flatMap((driver) =>
        driver.getDevices(),
      ),
    () => this.runtimeProvider,
  );
  #controller?: OpenCcuAppController;
  readonly #memory = new ProcessMemoryDiagnostics();
  readonly #onMemoryWarning = (warning: unknown): void => {
    this.#memory.onWarning(warning);
  };

  async onInit(): Promise<void> {
    this.homey.on("memwarn", this.#onMemoryWarning);
    const localAddress = await this.homey.cloud.getLocalAddress();
    const descriptionCache = new VersionedCache<ParamsetDescription>(
      new MemoryCacheStorage(),
      "openccu_paramsets",
      1,
    );
    const factory = new ManagedCentralRuntimeFactory({
      callbackAdvertisedHost: callbackHostFromLocalAddress(localAddress),
      descriptionCache,
      enableVirtualDevices: true,
      onConnectionState: (_centralId, interfaceId, state, error) => {
        const errorKind =
          error === undefined ? "" : ` (${safeErrorKind(error)})`;
        this.log(`OpenCCU ${interfaceId}: ${state}${errorKind}`);
      },
      onMetadataLoaded: (_centralId, { metadata, issues }) => {
        this.log(
          "OpenCCU metadata loaded " +
            `(names=${metadata.names.size}, rooms=${metadata.rooms.size}, ` +
            `functions=${metadata.functions.size}, programs=${metadata.programs.length}, ` +
            `systemVariables=${metadata.systemVariables.length}, issues=${issues.length})`,
        );
      },
    });
    const lifecycle = new OpenCcuApplicationLifecycle<ManagedCentralRuntime>(
      this.homey.settings,
      factory,
    );
    this.runtimeProvider = new OpenCcuRuntimeProvider(lifecycle);
    this.#controller = new OpenCcuAppController(
      this.homey.settings,
      lifecycle,
      {
        error: (message, error) => this.error(message, safeErrorKind(error)),
      },
    );
    await this.#controller.start();
    registerThermostatFlowCards(this.homey.flow);
    registerGarageFlowCards(this.homey.flow);
    registerHandleFlowCards(this.homey.flow);
    registerHubFlowCards(this.homey.flow, this.runtimeProvider);
    this.log("OpenCCU Local initialized");
  }

  onUninit(): Promise<void> {
    this.homey.removeListener("memwarn", this.#onMemoryWarning);
    return this.#controller?.stop() ?? Promise.resolve();
  }

  getMemoryDiagnostics(): unknown {
    return this.#memory.snapshot();
  }

  generateSupportReport(): unknown {
    return createSupportReport({
      app: {
        id: this.id,
        version: manifestVersion(this.manifest as unknown),
        node: process.version,
      },
      memory: this.#memory.snapshot(),
      runtimes: this.runtimeProvider?.diagnostics() ?? [],
    });
  }

  discoverOpenCcus(): Promise<readonly DiscoveredOpenCcu[]> {
    let unicastAddresses: readonly string[] = [];
    try {
      unicastAddresses = loadOpenCcuConnections(this.homey.settings)
        .map(({ host }) => host)
        .filter((host) => isIP(host) === 4);
    } catch {
      // Invalid stored settings must not disable broadcast discovery or manual setup.
    }
    return discoverOpenCcus({ unicastAddresses });
  }
};

function manifestVersion(manifest: unknown): string {
  if (
    typeof manifest === "object" &&
    manifest !== null &&
    "version" in manifest &&
    typeof manifest.version === "string"
  ) {
    return manifest.version;
  }
  return "unknown";
}
