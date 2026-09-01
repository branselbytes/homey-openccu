import { describe, expect, it, vi } from "vitest";

import { TypedEventBus } from "../../src/events/event-bus";

describe("TypedEventBus", () => {
  it("unsubscribes only the requested listener", () => {
    const bus = new TypedEventBus<{ state: number }>();
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribe = bus.subscribe("state", first);
    bus.subscribe("state", second);
    unsubscribe();
    bus.publish("state", 42);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(42);
  });
});
