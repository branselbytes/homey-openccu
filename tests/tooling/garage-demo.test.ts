import { afterEach, describe, expect, it, vi } from "vitest";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  createGarageSimulation,
  GarageSimulationClient,
  type GarageFixture,
} from "../../scripts/garage-demo/simulation";
import { DeviceBindingController } from "../../src/homey/device-binding-controller";
import type { RpcValue } from "../../src/protocol/xmlrpc/types";

const root = path.resolve(__dirname, "../..");
async function fixture(): Promise<GarageFixture> {
  return JSON.parse(
    await readFile(
      path.join(root, "tests/fixtures/hoermann-mod-ho.json"),
      "utf8",
    ),
  ) as GarageFixture;
}

afterEach(() => vi.useRealTimers());

describe("isolated garage simulation", () => {
  it("uses the production device mapping, synchronized light controls and simulated door callbacks", async () => {
    vi.useFakeTimers();
    const simulation = await createGarageSimulation(
      await fixture(),
      "Garagentor (Simulation)",
    );
    const candidate =
      simulation.runtimeProvider.pairingCandidates("HmIP-MOD-HO")[0];
    expect(candidate.name).toBe("Garagentor (Simulation)");
    const runtime = simulation.runtimeProvider.get(candidate.data.centralId);
    if (runtime === undefined) throw new Error("Missing simulated runtime");
    const values = new Map<string, RpcValue>();
    const writes = new Map<string, (value: RpcValue) => Promise<void>>();
    const controller = new DeviceBindingController(
      runtime,
      {
        getCapabilities: () => [],
        addCapability: () => Promise.resolve(),
        removeCapability: () => Promise.resolve(),
        setCapabilityValue: (id, value) => {
          values.set(id, value);
          return Promise.resolve();
        },
        triggerButtonEvent: () => Promise.resolve(),
        onCapabilityWrite: (id, listener) => {
          writes.set(id, listener);
          return () => undefined;
        },
        setAvailable: () => Promise.resolve(),
        setUnavailable: () => Promise.resolve(),
        log: () => undefined,
        error: (message) => {
          throw new Error(message);
        },
      },
      candidate.store.bindings,
    );
    const write = async (id: string, value: RpcValue): Promise<void> => {
      const listener = writes.get(id);
      if (listener === undefined) throw new Error(`No listener for ${id}`);
      await listener(value);
    };
    try {
      await controller.start();
      expect(candidate.capabilities).toEqual(
        expect.arrayContaining([
          "garagedoor_closed",
          "onoff",
          "homematic_garage_state",
          "homematic_garage_command",
          "homematic_garage_ventilation",
          "homematic_garage_light",
        ]),
      );
      expect(values.get("garagedoor_closed")).toBe(true);
      expect(values.get("onoff")).toBe(false);
      await write("homematic_garage_light", true);
      expect(values.get("onoff")).toBe(true);
      expect(values.get("homematic_garage_light")).toBe(true);
      await write("onoff", false);
      expect(values.get("homematic_garage_light")).toBe(false);
      await write("garagedoor_closed", false);
      await vi.advanceTimersByTimeAsync(1_200);
      expect(values.get("homematic_garage_state")).toBe("open");
      expect(values.get("garagedoor_closed")).toBe(false);
      await write("homematic_garage_command", "down");
      await vi.advanceTimersByTimeAsync(1_200);
      expect(values.get("homematic_garage_state")).toBe("closed");
      await write("homematic_garage_ventilation", true);
      await vi.advanceTimersByTimeAsync(1_200);
      expect(values.get("homematic_garage_state")).toBe("ventilation");
      await write("homematic_garage_command", "up");
      await write("homematic_garage_command", "idle");
      await vi.advanceTimersByTimeAsync(2_000);
      expect(values.get("homematic_garage_state")).toBe("unknown");
      expect(await runtime.readChannelValues("HOERMANN1:1")).toMatchObject({
        PROCESS: 0,
      });
      expect(values.get("onoff")).toBe(false);
    } finally {
      controller.stop();
      await simulation.close();
    }
  });

  it("rejects writes outside the simulated door and lamp datapoints", async () => {
    const client = new GarageSimulationClient(await fixture());
    await expect(
      client.setValue("REAL_DEVICE:2", "STATE", true),
    ).rejects.toThrow("Unsupported simulated write");
    await expect(
      client.setValue("HOERMANN1:2", "STATE", "true"),
    ).rejects.toThrow("Unsupported simulated write");
    await expect(
      client.setValue("HOERMANN1:1", "DOOR_COMMAND", 99),
    ).rejects.toThrow("Invalid simulated door command");
    await expect(client.putParamset()).rejects.toThrow("configuration writes");
    expect(await client.getValue("HOERMANN1:2", "STATE")).toBe(false);
    client.close();
  });

  it("refuses generating inside the production repository", () => {
    expect(() =>
      execFileSync(
        process.execPath,
        [
          path.join(root, "scripts/create-garage-demo.mjs"),
          "--output",
          path.join(root, "generated-demo-must-not-exist"),
        ],
        { stdio: "pipe" },
      ),
    ).toThrow();
  });

  it("generates a separate app without live settings and refuses overwriting it", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "openccu-demo-test-"));
    const output = path.join(directory, "app");
    const args = [
      path.join(root, "scripts/create-garage-demo.mjs"),
      "--output",
      output,
    ];
    try {
      execFileSync(process.execPath, args, { stdio: "pipe" });
      const manifest = JSON.parse(
        await readFile(path.join(output, ".homeycompose/app.json"), "utf8"),
      ) as { id: string; name: { de: string }; permissions: string[] };
      expect(manifest.id).toBe("io.github.branselbytes.openccu-demo");
      expect(manifest.name.de).toContain("Simulation");
      expect(manifest.permissions).toEqual([]);
      await expect(
        readFile(path.join(output, "settings/index.html")),
      ).rejects.toThrow();
      expect(
        await readFile(
          path.join(output, "drivers/HmIP-MOD-HO/device.ts"),
          "utf8",
        ),
      ).toBe(
        await readFile(
          path.join(root, "drivers/HmIP-MOD-HO/device.ts"),
          "utf8",
        ),
      );
      expect(() =>
        execFileSync(process.execPath, args, { stdio: "pipe" }),
      ).toThrow();
      expect(
        JSON.parse(
          await readFile(path.join(output, ".homeycompose/app.json"), "utf8"),
        ),
      ).toEqual(manifest);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
