import type { ParameterType, XmlRpcClient } from "../protocol/xmlrpc/types";
import {
  heatingProfileChanges,
  compileHeatingSchema,
  parseHeatingSaveRequest,
  parseHeatingSnapshotWithSchema,
  type CompiledHeatingSchema,
  type HeatingSnapshot,
} from "./schedule";
import {
  HEATING_WEEKDAYS,
  HeatingError,
  type HeatingSaveResult,
  type HeatingSchedule,
} from "./types";

type HeatingClient = Pick<
  XmlRpcClient,
  "getParamsetDescription" | "getParamset" | "putParamset"
>;

const SCHEMA_TTL_MS = 5 * 60_000;
const MAX_CACHED_SCHEMAS = 4;
const MAX_PENDING_READS = 4;

/** Local device schedules; no timers, automatic retries, or runtime dependency. */
export class HeatingScheduleService {
  readonly #client: HeatingClient;
  readonly #saving = new Set<string>();
  readonly #schemas = new Map<
    string,
    { readonly schema: CompiledHeatingSchema; readonly expiresAt: number }
  >();
  readonly #reading = new Map<string, Promise<HeatingSchedule>>();
  #snapshotQueue: Promise<void> = Promise.resolve();

  constructor(client: HeatingClient) {
    this.#client = client;
  }

  async read(channelAddress: string): Promise<HeatingSchedule> {
    const existing = this.#reading.get(channelAddress);
    if (existing) return existing;
    if (
      this.#saving.has(channelAddress) ||
      this.#reading.size >= MAX_PENDING_READS
    )
      throw new HeatingError("HEATING_BUSY");
    const read = this.#readSnapshot(channelAddress, false).then(
      (snapshot) => snapshot.schedule,
    );
    this.#reading.set(channelAddress, read);
    const release = () => {
      this.#reading.delete(channelAddress);
    };
    void read.then(release, release);
    return read;
  }

  async save(
    channelAddress: string,
    input: unknown,
  ): Promise<HeatingSaveResult> {
    const request = parseHeatingSaveRequest(input);
    if (this.#saving.has(channelAddress))
      throw new HeatingError("HEATING_BUSY");
    this.#saving.add(channelAddress);
    try {
      const before = await this.#readSnapshot(channelAddress, true);
      if (request.revision !== before.schedule.revision)
        throw new HeatingError("HEATING_CONFLICT");
      const changes = heatingProfileChanges(before, request);
      if (Object.keys(changes).length === 0)
        return { status: "unchanged", schedule: before.schedule };
      try {
        // The transport must acknowledge the write. Never turn timeouts into
        // successes or retry an uncertain write to a physical heating device.
        const types: Record<string, ParameterType> = Object.fromEntries(
          Object.keys(changes).map((key) => [
            key,
            key.includes("_TEMPERATURE_") ? "FLOAT" : "INTEGER",
          ]),
        );
        await this.#client.putParamset(
          channelAddress,
          "MASTER",
          changes,
          undefined,
          types,
        );
      } catch {
        throw new HeatingError("HEATING_WRITE_FAILED");
      }
      try {
        const after = await this.#readSnapshot(channelAddress, true);
        const selected = after.schedule.profiles.find(
          ({ id }) => id === request.profile,
        );
        const confirmed =
          selected !== undefined &&
          HEATING_WEEKDAYS.every(
            (day) =>
              selected.days[day].length === request.days[day].length &&
              request.days[day].every(
                (slot, index) =>
                  selected.days[day][index].end === slot.end &&
                  selected.days[day][index].temperature === slot.temperature,
              ),
          ) &&
          Object.entries(changes).every(
            ([key, value]) => after.values[key] === value,
          );
        return {
          status: confirmed ? "confirmed" : "pending",
          schedule: after.schedule,
        };
      } catch {
        // An acknowledged write with unavailable/lagging readback is distinct
        // from confirmation. The caller can explicitly refresh later.
        return { status: "pending" };
      }
    } finally {
      this.#saving.delete(channelAddress);
    }
  }

  #readSnapshot(
    channelAddress: string,
    freshSchema: boolean,
  ): Promise<HeatingSnapshot> {
    // Serialize large reply parsing across targets and reads/writes. A stalled
    // write acknowledgement does not block another target's snapshot reads.
    const result = this.#snapshotQueue.then(() =>
      this.#readSnapshotNow(channelAddress, freshSchema),
    );
    this.#snapshotQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async #readSnapshotNow(
    channelAddress: string,
    freshSchema: boolean,
  ): Promise<HeatingSnapshot> {
    try {
      // Raw MASTER metadata can exceed 460 kB on the wire. Compile and release
      // it before fetching values; ordinary refreshes reuse only compact schema.
      const schema = await this.#readSchema(channelAddress, freshSchema);
      const values = await this.#client.getParamset(channelAddress, "MASTER");
      const [activeDescription, activeValues] = await Promise.all([
        this.#client
          .getParamsetDescription(channelAddress, "VALUES")
          .catch(() => undefined),
        this.#client
          .getParamset(channelAddress, "VALUES")
          .catch(() => undefined),
      ]);
      return parseHeatingSnapshotWithSchema(
        channelAddress,
        schema,
        values,
        activeDescription,
        activeValues,
      );
    } catch (error) {
      if (error instanceof HeatingError) throw error;
      throw new HeatingError("HEATING_READ_FAILED");
    }
  }

  async #readSchema(
    channelAddress: string,
    fresh: boolean,
  ): Promise<CompiledHeatingSchema> {
    const cached = this.#schemas.get(channelAddress);
    if (!fresh && cached && cached.expiresAt > Date.now()) {
      this.#schemas.delete(channelAddress);
      this.#schemas.set(channelAddress, cached);
      return cached.schema;
    }
    this.#schemas.delete(channelAddress);
    const schema = compileHeatingSchema(
      await this.#client.getParamsetDescription(channelAddress, "MASTER"),
    );
    while (this.#schemas.size >= MAX_CACHED_SCHEMAS) {
      const oldest = this.#schemas.keys().next().value;
      if (oldest === undefined) break;
      this.#schemas.delete(oldest);
    }
    this.#schemas.set(channelAddress, {
      schema,
      expiresAt: Date.now() + SCHEMA_TTL_MS,
    });
    return schema;
  }
}
