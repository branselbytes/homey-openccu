import { expect, it, vi } from "vitest";
import { CapabilityWriteListeners } from "../../src/homey/capability-write-listeners";

it("registers once across controller replacement and isolates stale cleanup", async () => {
  const register = vi.fn();
  const listeners = new CapabilityWriteListeners(register);
  const old = vi.fn().mockResolvedValue(undefined);
  const current = vi.fn().mockResolvedValue(undefined);
  const stopOld = listeners.bind("windowcoverings_state", old);
  const stopCurrent = listeners.bind("windowcoverings_state", current);
  stopOld();
  expect(register).toHaveBeenCalledOnce();
  const dispatch = register.mock.calls[0][1] as (
    value: string,
  ) => Promise<void>;
  await dispatch("up");
  expect(current).toHaveBeenCalledExactlyOnceWith("up");
  expect(old).not.toHaveBeenCalled();
  stopCurrent();
  await expect(dispatch("down")).rejects.toThrow("unavailable");
  expect(current).toHaveBeenCalledTimes(1);
});

it("re-registers after an actual capability removal", () => {
  const register = vi.fn();
  const listeners = new CapabilityWriteListeners(register);
  const listener = vi.fn().mockResolvedValue(undefined);
  listeners.bind("onoff", listener);
  listeners.removed("onoff");
  listeners.bind("onoff", listener);
  expect(register).toHaveBeenCalledTimes(2);
});
