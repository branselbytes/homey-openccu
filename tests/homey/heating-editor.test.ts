import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import { describe, expect, it, vi } from "vitest";

import {
  HEATING_WEEKDAYS,
  type HeatingSaveRequest,
  type HeatingSaveResult,
  type HeatingSchedule,
  type HeatingTarget,
} from "../../src/heating/types";

type Handler = () => unknown;

class Element {
  value = "";
  textContent = "";
  hidden = false;
  disabled = false;
  readOnly = false;
  className = "";
  children: Element[] = [];
  attributes = new Map<string, string>();
  listeners = new Map<string, Handler>();
  classList = { add: vi.fn() };
  focus = vi.fn();

  constructor(
    readonly tagName: string,
    readonly ownerDocument: Document,
  ) {}

  get options(): Element[] {
    return this.children.filter((child) => child.tagName === "option");
  }
  append(...children: Element[]): void {
    this.children.push(...children);
    if (this.tagName === "select" && !this.value)
      this.value = this.options[0]?.value ?? "";
  }
  replaceChildren(...children: Element[]): void {
    this.children = [];
    if (this.tagName === "select") this.value = "";
    this.append(...children);
  }
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  addEventListener(event: string, handler: Handler): void {
    this.listeners.set(event, handler);
  }
  async dispatch(event: string): Promise<void> {
    await this.listeners.get(event)?.();
  }
}

class Document {
  createElement(tagName: string): Element {
    return new Element(tagName, this);
  }
}

interface EditorHandle {
  ready: Promise<void>;
  reload(): Promise<void>;
  destroy(): void;
}
interface EditorOptions {
  homey: { __(key: string): string };
  target?: HeatingTarget;
  listTargets(): Promise<HeatingTarget[]>;
  read(targetId: string): Promise<HeatingSchedule>;
  save(
    targetId: string,
    request: HeatingSaveRequest,
  ): Promise<HeatingSaveResult>;
}

const targets: HeatingTarget[] = [
  {
    id: "opaque-1",
    name: "Living room <script>",
    model: "HmIP-HEATING",
    isGroup: true,
  },
  { id: "opaque-2", name: "Bedroom", model: "HmIP-eTRV-2", isGroup: false },
];

function daySlots(id: number) {
  return [
    { end: 360, temperature: 17 },
    { end: 1320, temperature: 20 + id / 2 },
    { end: 1440, temperature: 17 },
  ];
}

function schedule(): HeatingSchedule {
  return {
    revision: "revision-1",
    writable: true,
    maxSlots: 13,
    temperatureMin: 5,
    temperatureMax: 30,
    endTimeMin: 0,
    selectableProfiles: [1, 2, 3],
    activeProfile: 1,
    profiles: [1, 2, 3, 4, 5, 6].map((id) => ({
      id,
      days: {
        MONDAY: daySlots(id),
        TUESDAY: daySlots(id),
        WEDNESDAY: daySlots(id),
        THURSDAY: daySlots(id),
        FRIDAY: daySlots(id),
        SATURDAY: daySlots(id),
        SUNDAY: daySlots(id),
      },
    })),
  };
}

function view(overrides: Partial<EditorOptions> = {}) {
  const document = new Document();
  const root = document.createElement("section");
  const listTargets = vi.fn(() => Promise.resolve(targets));
  const read = vi.fn(() => Promise.resolve(schedule()));
  const save =
    vi.fn<
      (
        targetId: string,
        request: HeatingSaveRequest,
      ) => Promise<HeatingSaveResult>
    >();
  const options: EditorOptions = {
    homey: { __: (key) => key },
    listTargets,
    read,
    save,
    ...overrides,
  };
  const window: {
    OpenCcuHeatingEditor?: {
      mount(root: Element, options: EditorOptions): EditorHandle;
    };
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  } = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
  runInNewContext(readFileSync("assets/heating-editor.js", "utf8"), { window });
  if (!window.OpenCcuHeatingEditor) throw new Error("Editor factory missing");
  const handle = window.OpenCcuHeatingEditor.mount(root, options);
  const all = (element: Element): Element[] => [
    element,
    ...element.children.flatMap(all),
  ];
  const element = (key: string): Element => {
    const found = all(root).find(
      (item) => item.attributes.get("data-heating") === key,
    );
    if (!found) throw new Error(`Missing element ${key}`);
    return found;
  };
  const set = async (key: string, value: string, event = "change") => {
    element(key).value = value;
    await element(key).dispatch(event);
  };
  return { handle, root, element, set, listTargets, read, save, window, all };
}

async function tick(): Promise<void> {
  for (let index = 0; index < 12; index++) await Promise.resolve();
}

async function editAndReview(editor: ReturnType<typeof view>): Promise<void> {
  await editor.set("temperature-1", "23", "input");
  await editor.element("save").dispatch("click");
  await tick();
}

describe("shared heating editor", () => {
  it("packages identical shared sources through the Compose repair assets mechanism", () => {
    const template = readFileSync(
      ".homeycompose/drivers/repair/heating_profiles/index.html",
      "utf8",
    );
    for (const filename of ["heating-editor.js", "heating-editor.css"]) {
      expect(template).toContain(`{{assets}}/${filename}`);
      expect(
        readFileSync(
          `.homeycompose/drivers/repair/heating_profiles/assets/${filename}`,
          "utf8",
        ),
      ).toBe(readFileSync(`assets/${filename}`, "utf8"));
    }
    expect(template).not.toContain("../../../assets/");
  });

  it.each([
    ["HEATING_UNSUPPORTED", "HEATING_UNSUPPORTED"],
    ["server password=private HEATING_UNSUPPORTED", "HEATING_UNSUPPORTED"],
    ["server password=private", "HEATING_UNAVAILABLE"],
  ])(
    "localizes repair bootstrap failure %s without remote text",
    async (message, expected) => {
      const template = readFileSync(
        ".homeycompose/drivers/repair/heating_profiles/index.html",
        "utf8",
      );
      const script = template.match(/<script>([\s\S]*?)<\/script>/)?.[1];
      if (!script) throw new Error("Repair script missing");
      const root = { textContent: "" };
      const mount = vi.fn();
      runInNewContext(script, {
        Homey: {
          __: (key: string) => key,
          emit: () => Promise.reject(new Error(message)),
        },
        document: { getElementById: () => root },
        window: { OpenCcuHeatingEditor: { mount } },
      });
      await tick();
      expect(root.textContent).toBe(`heating.errors.${expected}`);
      expect(mount).not.toHaveBeenCalled();
    },
  );

  it("provides German and English text for every static editor label", () => {
    const source = readFileSync("assets/heating-editor.js", "utf8");
    const keys = [
      ...[
        ...source.matchAll(
          /(?:\bt|\bfield|\bbutton|\bsetStatus)\(\s*"([^"$]+)"/g,
        ),
      ].map((match) => match[1]),
      ...HEATING_WEEKDAYS.flatMap((day) => [
        `days.${day}`,
        `days_short.${day}`,
      ]),
    ];
    for (const language of ["de", "en"]) {
      const locale = JSON.parse(
        readFileSync(`locales/${language}.json`, "utf8"),
      ) as { heating: Record<string, unknown> };
      for (const key of keys) {
        const value = key
          .split(".")
          .reduce<unknown>(
            (entry, part) =>
              entry && typeof entry === "object"
                ? (entry as Record<string, unknown>)[part]
                : undefined,
            locale.heating,
          );
        expect(typeof value, `${language}: heating.${key}`).toBe("string");
      }
    }
  });

  it("reads targets without writing and distinguishes stored from selectable profile slots", async () => {
    const editor = view();
    await editor.handle.ready;
    expect(editor.read).toHaveBeenCalledWith("opaque-1");
    expect(editor.save).not.toHaveBeenCalled();
    expect(editor.element("profile").options).toHaveLength(6);
    expect(editor.element("profile-hint").textContent).toContain("1, 2, 3");
    expect(editor.element("target-info").textContent).toContain(
      "Living room <script>",
    );
    expect(editor.element("save").disabled).toBe(true);
    expect(editor.element("end-2").readOnly).toBe(true);
    for (const [details, summary] of [
      ["copy-tools", "copy-tools-toggle"],
      ["schedule-info", "info-toggle"],
    ]) {
      expect(editor.element(details).tagName).toBe("details");
      expect(editor.element(summary).tagName).toBe("summary");
      expect(editor.element(details).children[0]).toBe(editor.element(summary));
    }
  });

  it("makes all weekdays reachable and preserves marked drafts without backend calls", async () => {
    const editor = view();
    await editor.handle.ready;
    expect(editor.read).toHaveBeenCalledTimes(1);
    for (const day of HEATING_WEEKDAYS) {
      const button = editor.element(`day-${day}`);
      expect(button.tagName).toBe("button");
      expect(button.disabled).toBe(false);
      expect(button.attributes.get("aria-pressed")).toBe(
        day === "MONDAY" ? "true" : "false",
      );
      expect(button.attributes.get("data-changed")).not.toBe("true");
    }

    await editor.set("temperature-1", "23", "input");
    expect(editor.element("day-MONDAY").attributes.get("data-changed")).toBe(
      "true",
    );
    for (const day of HEATING_WEEKDAYS.slice(1)) {
      await editor.element(`day-${day}`).dispatch("click");
      expect(editor.element("temperature-1").value).toBe("20.5");
      for (const candidate of HEATING_WEEKDAYS)
        expect(
          editor.element(`day-${candidate}`).attributes.get("aria-pressed"),
        ).toBe(candidate === day ? "true" : "false");
      expect(editor.element("day-MONDAY").attributes.get("data-changed")).toBe(
        "true",
      );
    }
    await editor.set("temperature-1", "22", "input");
    expect(editor.element("day-SUNDAY").attributes.get("data-changed")).toBe(
      "true",
    );
    await editor.element("day-MONDAY").dispatch("click");
    expect(editor.element("temperature-1").value).toBe("23");
    await editor.element("day-SUNDAY").dispatch("click");
    expect(editor.element("temperature-1").value).toBe("22");
    expect(editor.read).toHaveBeenCalledTimes(1);
    expect(editor.save).not.toHaveBeenCalled();
  });

  it("keeps weekday drafts and guards a profile switch", async () => {
    const editor = view();
    await editor.handle.ready;
    await editor.set("temperature-1", "23", "input");
    await editor.element("day-TUESDAY").dispatch("click");
    expect(editor.element("temperature-1").value).toBe("20.5");
    await editor.element("day-MONDAY").dispatch("click");
    expect(editor.element("temperature-1").value).toBe("23");
    const switchProfile = editor.set("profile", "2");
    await tick();
    expect(editor.element("profile").value).toBe("1");
    await editor.element("confirm-no").dispatch("click");
    await switchProfile;
    expect(editor.element("temperature-1").value).toBe("23");
    const nextSwitch = editor.set("profile", "2");
    await tick();
    await editor.element("confirm-yes").dispatch("click");
    await nextSwitch;
    expect(editor.element("profile").value).toBe("2");
    expect(editor.element("temperature-1").value).toBe("21");
    expect(editor.save).not.toHaveBeenCalled();
  });

  it("validates every weekday before opening a write confirmation", async () => {
    const editor = view();
    await editor.handle.ready;
    await editor.set("end-0", "24:01", "input");
    await editor.element("day-TUESDAY").dispatch("click");
    await editor.element("save").dispatch("click");
    await tick();
    expect(editor.element("status").textContent).toBe(
      "heating.errors.HEATING_INVALID",
    );
    expect(editor.element("confirmation").hidden).toBe(true);
    expect(editor.save).not.toHaveBeenCalled();
  });

  it("requires explicit confirmation and sends only the selected profile with the read revision", async () => {
    const editor = view();
    await editor.handle.ready;
    editor.save.mockImplementation((_target, request) =>
      Promise.resolve({
        status: "confirmed",
        schedule: {
          ...schedule(),
          revision: "revision-2",
          profiles: schedule().profiles.map((profile) =>
            profile.id === request.profile
              ? { ...profile, days: request.days }
              : profile,
          ),
        },
      }),
    );
    await editAndReview(editor);
    expect(editor.element("confirmation").hidden).toBe(false);
    expect(editor.save).not.toHaveBeenCalled();
    await editor.element("confirm-no").dispatch("click");
    await tick();
    expect(editor.save).not.toHaveBeenCalled();
    await editor.element("save").dispatch("click");
    await tick();
    await editor.element("confirm-yes").dispatch("click");
    await tick();
    expect(editor.save).toHaveBeenCalledTimes(1);
    expect(editor.save.mock.calls[0]?.[1]).toMatchObject({
      revision: "revision-1",
      profile: 1,
      days: {
        MONDAY: [
          { end: 360, temperature: 17 },
          { end: 1320, temperature: 23 },
          { end: 1440, temperature: 17 },
        ],
      },
    });
    expect(editor.element("status").textContent).toBe("heating.confirmed");
    expect(editor.element("save").disabled).toBe(true);
  });

  it("retains pending drafts, prevents another write and accepts a confirming read", async () => {
    const editor = view();
    await editor.handle.ready;
    editor.save.mockResolvedValue({ status: "pending" });
    await editAndReview(editor);
    await editor.element("confirm-yes").dispatch("click");
    await tick();
    expect(editor.element("temperature-1").value).toBe("23");
    expect(editor.element("save").disabled).toBe(true);
    await editor.element("save").dispatch("click");
    expect(editor.save).toHaveBeenCalledTimes(1);
    const request = editor.save.mock.calls[0]?.[1];
    if (!request) throw new Error("Missing save request");
    editor.read.mockResolvedValue({
      ...schedule(),
      revision: "revision-2",
      profiles: schedule().profiles.map((profile) =>
        profile.id === 1 ? { ...profile, days: request.days } : profile,
      ),
    });
    await editor.handle.reload();
    expect(editor.element("status").textContent).toBe("heating.confirmed");
    expect(editor.element("temperature-1").value).toBe("23");
    expect(editor.save).toHaveBeenCalledTimes(1);
  });

  it("does not discard an unconfirmed draft on read without explicit consent", async () => {
    const editor = view();
    await editor.handle.ready;
    editor.save.mockResolvedValue({ status: "pending" });
    await editAndReview(editor);
    await editor.element("confirm-yes").dispatch("click");
    await tick();
    const refresh = editor.handle.reload();
    await tick();
    await editor.element("confirm-no").dispatch("click");
    await refresh;
    expect(editor.element("temperature-1").value).toBe("23");
    expect(editor.element("save").disabled).toBe(true);
    const secondRefresh = editor.handle.reload();
    await tick();
    await editor.element("confirm-yes").dispatch("click");
    await secondRefresh;
    expect(editor.element("temperature-1").value).toBe("20.5");
    expect(editor.save).toHaveBeenCalledTimes(1);
  });

  it("redacts remote errors and blocks stale writes after a conflict", async () => {
    const editor = view();
    await editor.handle.ready;
    editor.save.mockRejectedValue(
      new Error("Remote token=private HEATING_CONFLICT"),
    );
    await editAndReview(editor);
    await editor.element("confirm-yes").dispatch("click");
    await tick();
    expect(editor.element("status").textContent).toBe(
      "heating.errors.HEATING_CONFLICT",
    );
    expect(editor.element("save").disabled).toBe(true);
    expect(
      editor
        .all(editor.root)
        .some((item) => item.textContent.includes("private")),
    ).toBe(false);
  });

  it("copies days and stored profiles only into a draft", async () => {
    const editor = view();
    await editor.handle.ready;
    await editor.set("temperature-1", "23", "input");
    await editor.element("copy-day").dispatch("click");
    await editor.element("day-SUNDAY").dispatch("click");
    expect(editor.element("temperature-1").value).toBe("23");
    await editor.set("copy-profile-source", "6");
    const copy = editor.element("copy-profile").dispatch("click");
    await tick();
    await editor.element("confirm-yes").dispatch("click");
    await copy;
    expect(editor.element("temperature-1").value).toBe("23");
    expect(editor.element("profile").value).toBe("1");
    expect(editor.save).not.toHaveBeenCalled();
  });

  it("honors read-only metadata and fixed repair targets", async () => {
    const editor = view({
      target: targets[1],
      read: () => Promise.resolve({ ...schedule(), writable: false }),
    });
    await editor.handle.ready;
    expect(editor.listTargets).not.toHaveBeenCalled();
    expect(editor.element("status").textContent).toBe("heating.read_only");
    await editor.set("temperature-1", "24", "input");
    await editor.element("save").dispatch("click");
    await tick();
    expect(editor.save).not.toHaveBeenCalled();
  });

  it("can recover from an empty target list by reading again", async () => {
    const listTargets = vi
      .fn<() => Promise<HeatingTarget[]>>()
      .mockResolvedValueOnce([])
      .mockResolvedValue(targets);
    const editor = view({ listTargets });
    await editor.handle.ready;
    expect(editor.element("status").textContent).toBe("heating.empty");
    expect(editor.read).not.toHaveBeenCalled();
    await editor.handle.reload();
    expect(editor.read).toHaveBeenCalledWith("opaque-1");
  });

  it("ignores a response received after the view is destroyed", async () => {
    let complete: ((value: HeatingSchedule) => void) | undefined;
    const editor = view({
      read: () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    });
    await tick();
    editor.handle.destroy();
    complete?.(schedule());
    await editor.handle.ready;
    expect(editor.root.children).toHaveLength(0);
    expect(editor.window.removeEventListener).toHaveBeenCalled();
  });
});
