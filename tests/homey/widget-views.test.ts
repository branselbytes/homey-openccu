import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

import { describe, expect, it, vi } from "vitest";

type WidgetId = "system-status" | "service-messages";

class ViewElement {
  children: ViewElement[] = [];
  className = "";
  title = "";
  disabled = false;
  dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  #text = "";

  get textContent(): string {
    return (
      this.#text + this.children.map((child) => child.textContent).join("")
    );
  }

  set textContent(value: string) {
    this.#text = value;
    this.children = [];
  }

  append(...children: ViewElement[]): void {
    this.children.push(...children);
  }

  prepend(child: ViewElement): void {
    this.children.unshift(child);
  }

  replaceChildren(...children: ViewElement[]): void {
    this.#text = "";
    this.children = children;
  }

  setAttribute(key: string, value: string): void {
    this.attributes.set(key, value);
  }

  removeAttribute(key: string): void {
    this.attributes.delete(key);
    if (key === "title") this.title = "";
  }

  addEventListener(): void {}

  getBoundingClientRect(): { bottom: number } {
    return { bottom: 200 };
  }
}

function descendants(element: ViewElement, className: string): ViewElement[] {
  return element.children.flatMap((child) => [
    ...(child.className === className ? [child] : []),
    ...descendants(child, className),
  ]);
}

function translationAt(value: unknown, key: string): string {
  for (const part of key.split(".")) {
    if (typeof value !== "object" || value === null) return key;
    value = (value as Record<string, unknown>)[part];
  }
  return typeof value === "string" ? value : key;
}

async function widgetView(
  id: WidgetId,
  language: "en" | "de" = "en",
  response: unknown = { refreshedAt: "2026-10-03T10:00:00Z", centrals: [] },
) {
  const html = await readFile(`widgets/${id}/public/index.html`, "utf8");
  const locale: unknown = JSON.parse(
    await readFile(`locales/${language}.json`, "utf8"),
  );
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  if (script === undefined) throw new Error("Widget script is missing");

  const elements = new Map<string, ViewElement>();
  const element = (key: string): ViewElement => {
    let value = elements.get(key);
    if (value === undefined) {
      value = new ViewElement();
      elements.set(key, value);
    }
    return value;
  };
  const subtitle = new ViewElement();
  subtitle.dataset.i18n = "title";
  const documentElement = { lang: "" };
  const api = vi.fn().mockResolvedValue(response);
  const homey = {
    __: vi.fn((key: string) => translationAt(locale, key)),
    api,
    ready: vi.fn(),
    setHeight: vi.fn().mockResolvedValue(undefined),
  };
  const view = runInNewContext(
    `${script}\n({ onHomeyReady, refresh, renderOverview });`,
    {
      navigator: { language: language === "de" ? "en-US" : "de-DE" },
      document: {
        documentElement,
        body: new ViewElement(),
        createElement: () => new ViewElement(),
        createElementNS: () => new ViewElement(),
        getElementById: element,
        querySelectorAll: () => [subtitle],
      },
      window: { addEventListener: vi.fn() },
      requestAnimationFrame: (callback: () => void) => callback(),
      getComputedStyle: () => ({ paddingBottom: "16px" }),
      setInterval: vi.fn(),
      clearInterval: vi.fn(),
    },
  ) as {
    onHomeyReady(homey: unknown): void;
    refresh(): Promise<void>;
    renderOverview(overview: unknown): void;
  };

  return {
    ...view,
    start: () => view.onHomeyReady(homey),
    element,
    subtitle,
    documentElement,
    homey,
  };
}

describe.each<WidgetId>(["system-status", "service-messages"])(
  "%s widget view",
  (id) => {
    it.each(["en", "de"] as const)(
      "uses Homey's %s translations when the browser language differs",
      async (language) => {
        const view = await widgetView(id, language);
        view.start();
        await view.refresh();

        expect(view.documentElement.lang).toBe(language);
        expect(view.element("refresh").title).toBe(
          language === "de" ? "Aktualisieren" : "Refresh",
        );
        expect(view.subtitle.textContent).toBe(
          id === "system-status"
            ? language === "de"
              ? "Systemstatus"
              : "System status"
            : language === "de"
              ? "Servicemeldungen"
              : "Service messages",
        );
      },
    );

    it("coalesces overlapping refreshes and retains visible content during polling", async () => {
      const view = await widgetView(id);
      view.start();
      await view.refresh();
      const content = view.element(
        id === "system-status" ? "centrals" : "summary",
      );
      const previousText = content.textContent;
      let resolveResponse!: (response: unknown) => void;
      view.homey.api.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveResponse = resolve;
          }),
      );

      const request = view.refresh();
      await view.refresh();
      expect(view.homey.api).toHaveBeenCalledTimes(2);
      expect(view.element("refresh").disabled).toBe(true);
      expect(content.textContent).toBe(previousText);

      resolveResponse({ refreshedAt: "2026-10-03T10:01:00Z", centrals: [] });
      await request;
      expect(view.element("refresh").disabled).toBe(false);
      expect(content.attributes.get("aria-busy")).toBe("false");
    });
  },
);

describe("system status widget reporting", () => {
  it.each([
    {
      connectionState: "healthy",
      unavailable: true,
      label: "Status nicht verfügbar",
    },
    { connectionState: "healthy", partial: true, label: "Daten unvollständig" },
    { connectionState: "future-state", label: "Unbekannt" },
  ])(
    "reports $label without presenting stale metrics as fresh",
    async (status) => {
      const view = await widgetView("system-status", "de", {
        refreshedAt: "2026-10-03T10:00:00Z",
        centrals: [
          {
            centralId: "ccu-1",
            deviceCount: 123,
            dutyCycle: 37,
            carrierSense: 42,
            serviceMessageCount: 2,
            radioInterfaces: [],
            ...status,
          },
        ],
      });
      view.start();
      await view.refresh();
      const content = view.element("centrals");

      expect(descendants(content, "state")[0].textContent).toBe(status.label);
      if (status.unavailable) {
        expect(
          descendants(content, "metric-value").map(
            (value) => value.textContent,
          ),
        ).toEqual(["—", "—", "—", "—"]);
        expect(descendants(content, "updated")[0].textContent).toBe("—");
        expect(descendants(content, "updated")[0].title).toBe("");
      } else {
        expect(descendants(content, "metric-value")[0].textContent).toBe("123");
      }
    },
  );
});

it("reports unavailable service data as unknown instead of all clear", async () => {
  const view = await widgetView("service-messages", "de", {
    refreshedAt: "2026-10-03T10:00:00Z",
    centrals: [{ centralId: "ccu-1", messages: [], unavailable: true }],
  });
  view.start();
  await view.refresh();

  expect(view.element("status").textContent).toBe("Unbekannt");
  expect(view.element("summary").textContent).toBe(
    "Details derzeit nicht verfügbar",
  );
  expect(view.element("messages").textContent).not.toContain(
    "Keine aktiven Servicemeldungen",
  );
});
