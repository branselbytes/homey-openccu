import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import { OpenCcuAppController } from "../../src/homey/app-controller";
import { OPENCCU_CONNECTIONS_SETTING } from "../../src/homey/settings-adapter";

describe("OpenCcuAppController", () => {
  it("starts once and reloads only for the OpenCCU connection setting", async () => {
    const settings = new EventEmitter();
    const lifecycle = {
      start: vi.fn().mockResolvedValue(undefined),
      reload: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    };
    const controller = new OpenCcuAppController(settings, lifecycle, {
      error: vi.fn(),
    });

    await controller.start();
    await controller.start();
    settings.emit("set", "unrelated");
    settings.emit("set", OPENCCU_CONNECTIONS_SETTING);
    await Promise.resolve();

    expect(lifecycle.start).toHaveBeenCalledOnce();
    expect(lifecycle.reload).toHaveBeenCalledOnce();
  });

  it("reports reload failures without leaking them as unhandled rejections", async () => {
    const settings = new EventEmitter();
    const logger = { error: vi.fn() };
    const lifecycle = {
      start: vi.fn().mockResolvedValue(undefined),
      reload: vi.fn().mockRejectedValue(new Error("invalid settings")),
      stop: vi.fn().mockResolvedValue(undefined),
    };
    const controller = new OpenCcuAppController(settings, lifecycle, logger);
    await controller.start();

    settings.emit("unset", OPENCCU_CONNECTIONS_SETTING);
    await new Promise((resolve) => setImmediate(resolve));

    expect(logger.error).toHaveBeenCalledWith(
      "Failed to reload OpenCCU settings",
      expect.any(Error),
    );
  });

  it("removes listeners before stopping runtimes", async () => {
    const settings = new EventEmitter();
    const lifecycle = {
      start: vi.fn().mockResolvedValue(undefined),
      reload: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    };
    const controller = new OpenCcuAppController(settings, lifecycle, {
      error: vi.fn(),
    });
    await controller.start();

    await controller.stop();
    settings.emit("set", OPENCCU_CONNECTIONS_SETTING);
    await Promise.resolve();

    expect(lifecycle.stop).toHaveBeenCalledOnce();
    expect(lifecycle.reload).not.toHaveBeenCalled();
  });
});
