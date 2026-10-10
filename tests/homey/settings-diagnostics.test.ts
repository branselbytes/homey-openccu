import { Blob, File } from "node:buffer";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import { describe, expect, it, vi } from "vitest";

class SettingsElement {
  value = "";
  textContent = "";
  hidden = true;
  disabled = false;
  children: SettingsElement[] = [];
  listeners = new Map<string, () => void | Promise<void>>();
  focus = vi.fn();
  select = vi.fn();
  setSelectionRange = vi.fn();
  click = vi.fn();
  remove = vi.fn();

  addEventListener(event: string, callback: () => void | Promise<void>): void {
    this.listeners.set(event, callback);
  }

  appendChild(element: SettingsElement): void {
    this.children.push(element);
  }

  replaceChildren(): void {
    this.children = [];
  }
}

function device(type = "HmIP-MOD-HO") {
  return {
    alias: "device-1",
    type,
    firmware: "1.0.0",
    availability: "online",
    channels: [
      {
        index: 1,
        type: "DOOR_RECEIVER",
        dataPoints: [
          {
            parameter: "DOOR_COMMAND",
            type: "ENUM",
            operations: 2,
            flags: 1,
            valueList: ["NOP", "OPEN", "STOP", "CLOSE", "PARTIAL_OPEN"],
            min: "NOP",
            max: "PARTIAL_OPEN",
          },
          {
            parameter: "DOOR_STATE",
            type: "ENUM",
            operations: 5,
            flags: 1,
            valueList: [
              "CLOSED",
              "OPEN",
              "VENTILATION_POSITION",
              "POSITION_UNKNOWN",
            ],
          },
        ],
      },
    ],
    mappings: [
      { driverId: type, generic: false, capabilities: ["garagedoor_closed"] },
    ],
  };
}

function report(devices = [device(), device("HmIP-PSM")]) {
  return {
    schemaVersion: 2,
    generatedAt: "2026-10-03T12:00:00.000Z",
    app: {
      id: "io.github.branselbytes.openccu",
      version: "0.1.3",
      node: "v22.0.0",
    },
    centrals: [
      {
        alias: "central-1",
        runtime: {
          connectionState: "healthy",
          deviceCount: devices.length,
          discoveryIssueCount: 0,
          metadataIssueCount: 1,
          systemInformationIssueCount: 0,
          transport: {
            totalRequests: 24,
            failedRequests: 1,
            timedOutRequests: 0,
            activeRequests: 0,
            queuedRequests: 0,
          },
          devices,
        },
      },
    ],
  };
}

function settingsView(
  options: {
    report?: unknown;
    navigator?: Record<string, unknown>;
    secure?: boolean;
    copySuccess?: boolean;
  } = {},
) {
  const html = readFileSync("settings/index.html", "utf8");
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  if (!script) throw new Error("Settings script is missing");
  const elements = new Map<string, SettingsElement>();
  const element = (id: string): SettingsElement => {
    let value = elements.get(id);
    if (value === undefined) {
      value = new SettingsElement();
      elements.set(id, value);
    }
    return value;
  };
  const body = new SettingsElement();
  const createObjectURL = vi
    .fn<(blob: Blob) => string>()
    .mockReturnValue("blob:test-diagnostics");
  const revokeObjectURL = vi.fn();
  const execCommand = vi.fn(() => options.copySuccess ?? true);
  const setTimeout = vi.fn();
  const homey = {
    __: (key: string) => key,
    get: (
      _key: string,
      callback: (error: undefined, values: unknown[]) => void,
    ) => {
      callback(undefined, []);
    },
    api: (
      _method: string,
      _path: string,
      callback: (error: undefined, value: unknown) => void,
    ) => {
      callback(undefined, options.report ?? report());
    },
    ready: vi.fn(),
    alert: vi.fn(),
  };
  const view = runInNewContext(
    `${script}\n({ onHomeyReady, summarizeDiagnostics, saveDiagnosticsFile, copyText });`,
    {
      Homey: homey,
      navigator: options.navigator ?? {},
      window: { isSecureContext: options.secure ?? true, setTimeout },
      document: {
        body,
        getElementById: element,
        createElement: () => new SettingsElement(),
        execCommand,
      },
      Blob,
      File,
      URL: { createObjectURL, revokeObjectURL },
    },
  ) as {
    onHomeyReady(homey: unknown): void;
    summarizeDiagnostics(value: unknown, model?: string): string;
    saveDiagnosticsFile(filename: string, value: string): Promise<string>;
    copyText(element: SettingsElement): Promise<void>;
  };
  view.onHomeyReady(homey);
  return {
    ...view,
    element,
    body,
    createObjectURL,
    revokeObjectURL,
    execCommand,
    setTimeout,
    async click(id: string): Promise<void> {
      const listener = element(id).listeners.get("click");
      if (!listener) throw new Error(`Click listener for ${id} is missing`);
      await listener();
    },
    async selectModel(model: string): Promise<void> {
      element("diagnostics-model").value = model;
      await element("diagnostics-model").listeners.get("change")?.();
    },
  };
}

describe("settings diagnostics exports", () => {
  it("shows a short overview and offers separate per-model datapoint definitions", async () => {
    const view = settingsView();
    await view.click("download-diagnostics");
    expect(view.element("diagnostics-export").hidden).toBe(false);
    expect(
      view.element("diagnostics-model").children.map((option) => option.value),
    ).toEqual(["", "HmIP-MOD-HO", "HmIP-PSM"]);
    const overview = view.element("diagnostics-content").value;
    expect(overview).toContain("HmIP-MOD-HO: 1 device(s)");
    expect(overview).toContain("HmIP-PSM: 1 device(s)");
    expect(overview).toContain("issues discovery=0, metadata=1, system=0");
    expect(overview).not.toContain("DOOR_COMMAND");
    await view.selectModel("HmIP-MOD-HO");
    const focused = view.element("diagnostics-content").value;
    expect(focused).not.toContain("HmIP-PSM");
    expect(focused).toContain(
      "DOOR_COMMAND: ENUM; operations=2; enum=NOP,OPEN,STOP,CLOSE,PARTIAL_OPEN",
    );
    expect(focused).toContain(
      "DOOR_STATE: ENUM; operations=5; enum=CLOSED,OPEN,VENTILATION_POSITION,POSITION_UNKNOWN",
    );
  });

  it("keeps identical model schemas compact while preserving different definitions", () => {
    const view = settingsView();
    const changed = device();
    changed.channels[0].dataPoints[0].valueList.push("EXTRA_COMMAND");
    const summary = view.summarizeDiagnostics(
      report([device(), device(), changed]),
      "HmIP-MOD-HO",
    );
    expect(summary).toContain("3 device(s)");
    expect(summary.match(/Channel 1: DOOR_RECEIVER/gu)).toHaveLength(2);
    expect(summary).toContain("EXTRA_COMMAND");
  });

  it("caps large summaries with a visible omission notice without changing the full report", () => {
    const full = report(
      Array.from({ length: 500 }, (_, index) => device(`Model-${index}`)),
    );
    const original = JSON.stringify(full);
    const view = settingsView();
    const summary = view.summarizeDiagnostics(full);
    expect(summary.length).toBeLessThanOrEqual(12000);
    expect(summary).toContain("App: io.github.branselbytes.openccu 0.1.3");
    expect(summary).toContain("Summary shortened. Attach the full JSON file");
    expect(JSON.stringify(full)).toBe(original);
  });

  it("omits names, identifiers, credentials and live values even if input gains extra fields", () => {
    const full = report();
    const extended = full as unknown as Record<string, unknown>;
    extended.password = "never-export-password";
    Object.assign(full.centrals[0].runtime.devices[0], {
      address: "never-export-address",
      name: "never-export-name",
      value: "never-export-value",
    });
    const summary = settingsView().summarizeDiagnostics(full, "HmIP-MOD-HO");
    expect(summary).not.toContain("never-export");
    expect(summary).not.toContain("device-1");
  });

  it("includes safe XML-RPC fault context without copying raw error messages", () => {
    const full = report();
    Object.assign(full.centrals[0].runtime.transport, {
      lastError: {
        method: "setValue",
        code: "remote-fault",
        faultCode: -5,
        faultString: "never-export-sensitive-message",
        message: "never-export-sensitive-message",
      },
    });
    const summary = settingsView().summarizeDiagnostics(full, "HmIP-MOD-HO");
    expect(summary).toContain(
      "Last XML-RPC error: method=setValue; code=remote-fault; faultCode=-5",
    );
    expect(summary).not.toContain("never-export");
  });

  it("does not expose unexpected error method or code text", () => {
    const full = report();
    const view = settingsView();
    for (const lastError of [
      { method: "never-export-method", code: "remote-fault" },
      { method: "setValue", code: "never-export-code" },
    ]) {
      Object.assign(full.centrals[0].runtime.transport, { lastError });
      expect(view.summarizeDiagnostics(full)).not.toContain("never-export");
    }
    Object.assign(full.centrals[0].runtime.transport, {
      lastError: {
        method: "setValue",
        code: "remote-fault",
        faultCode: "never-export-fault",
      },
    });
    expect(view.summarizeDiagnostics(full)).toContain(
      "Last XML-RPC error: method=setValue; code=remote-fault",
    );
    expect(view.summarizeDiagnostics(full)).not.toContain("faultCode=");
  });

  it("copies the selected short summary and always saves the complete valid JSON report", async () => {
    const full = report();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const view = settingsView({
      report: full,
      navigator: { clipboard: { writeText } },
    });
    await view.click("download-diagnostics");
    await view.selectModel("HmIP-MOD-HO");
    await view.click("copy-diagnostics");
    expect(writeText).toHaveBeenCalledWith(
      view.element("diagnostics-content").value,
    );
    await view.click("save-diagnostics");
    const blob = view.createObjectURL.mock.calls[0]?.[0];
    expect(blob).toBeDefined();
    expect(JSON.parse(await blob.text())).toEqual(full);
    expect(view.body.children[0]?.click).toHaveBeenCalledOnce();
    expect(view.element("diagnostics-status").textContent).toBe(
      "settings.diagnostics.saved",
    );
  });

  it("uses browser download when file sharing is advertised but denied", async () => {
    const share = vi.fn().mockRejectedValue({ name: "NotAllowedError" });
    const view = settingsView({ navigator: { share, canShare: () => true } });
    expect(await view.saveDiagnosticsFile("report.json", "{}")).toBe(
      "downloaded",
    );
    expect(share).toHaveBeenCalledOnce();
    expect(view.createObjectURL).toHaveBeenCalledOnce();
    expect(view.revokeObjectURL).not.toHaveBeenCalled();
    expect(view.setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000);
  });

  it("does not start an unwanted download when the user cancels sharing", async () => {
    const view = settingsView({
      navigator: {
        share: vi.fn().mockRejectedValue({ name: "AbortError" }),
        canShare: () => true,
      },
    });
    await expect(
      view.saveDiagnosticsFile("report.json", "{}"),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(view.createObjectURL).not.toHaveBeenCalled();
  });

  it("falls back to selected-text copying when clipboard permission is denied", async () => {
    const view = settingsView({
      navigator: {
        clipboard: {
          writeText: vi.fn().mockRejectedValue({ name: "NotAllowedError" }),
        },
      },
    });
    const textarea = view.element("diagnostics-content");
    textarea.value = "short support summary";
    await view.copyText(textarea);
    expect(textarea.focus).toHaveBeenCalledOnce();
    expect(textarea.setSelectionRange).toHaveBeenCalledWith(
      0,
      textarea.value.length,
    );
    expect(view.execCommand).toHaveBeenCalledWith("copy");
  });

  it("leaves the short text selected with manual-copy instructions if both copy methods fail", async () => {
    const view = settingsView({
      copySuccess: false,
      navigator: {
        clipboard: {
          writeText: vi.fn().mockRejectedValue({ name: "NotAllowedError" }),
        },
      },
    });
    await view.click("download-diagnostics");
    await view.click("copy-diagnostics");
    expect(view.element("diagnostics-content").select).toHaveBeenCalledOnce();
    expect(view.element("diagnostics-status").textContent).toBe(
      "settings.diagnostics.copy_failed",
    );
  });
});

it("includes classic devices in the model picker and labels their interface in summaries", async () => {
  const primary = report([]);
  const classic = report([device("HM-PB-2-FM")]);
  const combined = {
    ...primary,
    centrals: primary.centrals.map((central) => ({
      ...central,
      interfaces: [
        { interfaceId: "BidCos-RF", runtime: classic.centrals[0].runtime },
      ],
    })),
  };
  const view = settingsView({ report: combined });
  await view.click("download-diagnostics");
  expect(
    view.element("diagnostics-model").children.map((option) => option.value),
  ).toContain("HM-PB-2-FM");
  await view.selectModel("HM-PB-2-FM");
  expect(view.element("diagnostics-content").value).toContain(
    "Central 1 / BidCos-RF",
  );
  expect(view.element("diagnostics-content").value).toContain(
    "HM-PB-2-FM: 1 device(s)",
  );
});
