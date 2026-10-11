import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  HandleStateUpdates,
  handleStateToken,
} from "../../src/homey/handle-state-updates";

function fixture() {
  let value: string | null = null;
  const statesDuringTrigger: (string | null)[] = [];
  const trigger = vi.fn(() => {
    statesDuringTrigger.push(value);
    return Promise.resolve();
  });
  const error = vi.fn();
  const updates = new HandleStateUpdates(
    (next) => {
      value = next;
      return Promise.resolve();
    },
    trigger,
    error,
  );
  return {
    updates,
    trigger,
    error,
    statesDuringTrigger,
    get value() {
      return value;
    },
  };
}

describe("handle change Flow", () => {
  it("initializes silently, deduplicates callbacks and updates conditions before triggering", async () => {
    const f = fixture();
    await f.updates.update("0");
    await f.updates.update("0", true);
    expect(f.trigger).not.toHaveBeenCalled();
    await Promise.all([
      f.updates.update("1", true),
      f.updates.update("1", true),
      f.updates.update("2", true),
      f.updates.update("0", true),
    ]);
    expect(f.trigger.mock.calls).toEqual([["1"], ["2"], ["0"]]);
    expect(f.statesDuringTrigger).toEqual(["1", "2", "0"]);
  });

  it("ignores stale initial reads and treats the first callback without a baseline as initialization", async () => {
    const f = fixture();
    const revision = f.updates.revision;
    await f.updates.update("1", true);
    await f.updates.update("0", false, revision);
    expect(f.value).toBe("1");
    expect(f.trigger).not.toHaveBeenCalled();
    await f.updates.update("2", true);
    expect(f.trigger).toHaveBeenCalledOnce();
  });

  it("does not infer transitions through unknown states or reconnect initialization", async () => {
    const f = fixture();
    await f.updates.update("0");
    await f.updates.update("3", true);
    expect(f.value).toBeNull();
    await f.updates.update("1", true);
    f.updates.reset();
    await f.updates.update("2");
    await f.updates.update("2", true);
    expect(f.trigger).not.toHaveBeenCalled();
    await f.updates.update("0", true);
    expect(f.trigger).toHaveBeenCalledOnce();
  });

  it("suppresses queued events on shutdown and recovers after a failed Flow", async () => {
    const f = fixture();
    await f.updates.update("0");
    const pending = f.updates.update("1", true);
    f.updates.reset();
    await pending;
    expect(f.trigger).not.toHaveBeenCalled();
    await f.updates.update("0");
    f.trigger.mockRejectedValueOnce(new Error("Flow unavailable"));
    await f.updates.update("1", true);
    expect(f.error).toHaveBeenCalledOnce();
    await f.updates.update("2", true);
    await f.updates.update("0", true);
    expect(f.statesDuringTrigger.at(-1)).toBe("0");
  });

  it.each(["de", "en"])("provides translated text tokens in %s", (language) => {
    const locale = JSON.parse(
      readFileSync(`locales/${language}.json`, "utf8"),
    ) as { handle_state: Record<string, string> };
    const translate = (key: string) => locale.handle_state[key.split(".")[1]];
    expect(
      ["0", "1", "2"].map((state) =>
        handleStateToken(state as "0" | "1" | "2", translate),
      ),
    ).toEqual(
      language === "de"
        ? ["Geschlossen", "Gekippt", "Offen"]
        : ["Closed", "Tilted", "Open"],
    );
    const card = JSON.parse(
      readFileSync(
        ".homeycompose/flow/triggers/handle_state_changed.json",
        "utf8",
      ),
    ) as {
      tokens: { name: string; type: string }[];
      args: { filter: string }[];
    };
    expect(card.tokens).toEqual([
      expect.objectContaining({ name: "handle_state", type: "string" }),
    ]);
    expect(card.args[0].filter).toBe(
      "driver_id=HmIP-SRH|openccu-generic&capabilities=homematic_rhs_state",
    );
  });
});
