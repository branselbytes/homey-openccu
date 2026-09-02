import Homey from "homey";

import { OpenCcuAppController } from "./src/homey/app-controller";
import { callbackHostFromLocalAddress } from "./src/homey/callback-host";
import { OpenCcuRuntimeProvider } from "./src/homey/runtime-provider";
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
    const factory = new ManagedCentralRuntimeFactory({
      callbackAdvertisedHost: callbackHostFromLocalAddress(localAddress),
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
        error: (message, error) => this.error(message, error),
      },
    );
    await this.#controller.start();
    this.log("OpenCCU for Homey initialized");
  }

  onUninit(): Promise<void> {
    return this.#controller?.stop() ?? Promise.resolve();
  }
};
