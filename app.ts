import Homey from "homey";
import { isIP } from "node:net";

import { VersionedCache } from "./src/cache/versioned-cache";
import { createSupportReport } from "./src/diagnostics/support-report";
import { safeErrorKind } from "./src/diagnostics/safe-error";
import { OpenCcuAppController } from "./src/homey/app-controller";
import { loadOpenCcuConnections } from "./src/homey/settings-adapter";
import { HomeySettingsCacheStorage } from "./src/homey/cache-storage";
import { registerHubFlowCards } from "./src/homey/hub-flow-controller";
import { registerThermostatFlowCards } from "./src/homey/thermostat-flow-controller";
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
  #controller?: OpenCcuAppController;

  async onInit(): Promise<void> {
    const localAddress = await this.homey.cloud.getLocalAddress();
    const descriptionCache = new VersionedCache<ParamsetDescription>(
      new HomeySettingsCacheStorage(this.homey.settings),
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
    registerHubFlowCards(this.homey.flow, this.runtimeProvider);
    this.log("OpenCCU Local initialized");
  }

  onUninit(): Promise<void> {
    return this.#controller?.stop() ?? Promise.resolve();
  }

  generateSupportReport(): unknown {
    return createSupportReport({
      app: {
        id: this.id,
        version: manifestVersion(this.manifest as unknown),
        node: process.version,
      },
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
