import type { OpenCcuDevice } from "../domain/model";

/** Candidate detection is based on discovered channels, not copied product drivers. */
export function findHeatingChannel(device: OpenCcuDevice): string | undefined {
  const channel = [...device.channels.values()].find(
    (candidate) => candidate.index === 1,
  );
  if (
    !channel?.paramsets.includes("MASTER") ||
    !channel.dataPoints.has("SET_POINT_TEMPERATURE") ||
    !channel.dataPoints.has("ACTIVE_PROFILE")
  )
    return undefined;
  return channel.address;
}
