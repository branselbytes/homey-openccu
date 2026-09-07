import type { JsonRpcSession } from "./metadata";

export interface OpenCcuServiceMessage {
  readonly id: string;
  readonly code: string;
  readonly type: number;
  readonly address?: string;
  readonly deviceName?: string;
  readonly occurredAt?: string;
  readonly lastOccurredAt?: string;
  readonly occurrenceCount: number;
}

interface RawServiceMessage {
  readonly id?: unknown;
  readonly name?: unknown;
  readonly type?: unknown;
  readonly address?: unknown;
  readonly device_name?: unknown;
  readonly timestamp?: unknown;
  readonly last_timestamp?: unknown;
  readonly counter?: unknown;
}

// ReGa has no read-only JSON-RPC method for detailed service messages. Names
// are URI encoded in the script so arbitrary CCU labels cannot break the JSON.
const ACTIVE_SERVICE_MESSAGES_SCRIPT = `
string alarmId;
boolean first = true;
Write('[');
object services = dom.GetObject(ID_SERVICES);
if (services) {
  foreach(alarmId, services.EnumIDs()) {
    object alarm = dom.GetObject(alarmId);
    if (alarm && (alarm.AlState() == 1)) {
      string rawName = alarm.Name();
      string encodedName = "";
      if (rawName) { encodedName = rawName.UriEncode(); } else { rawName = ""; }
      string occurredAt = "";
      time occurrence = alarm.AlOccurrenceTime();
      if (occurrence) { occurredAt = occurrence.ToString(); }
      string lastOccurredAt = "";
      time lastOccurrence = alarm.Timestamp();
      if (lastOccurrence) { lastOccurredAt = lastOccurrence.ToString(); }
      string address = "";
      string deviceName = "";
      integer triggerId = alarm.AlTriggerDP();
      if (triggerId) {
        object trigger = dom.GetObject(triggerId);
        if (trigger) {
          integer channelId = trigger.Channel();
          if (channelId) {
            object channel = dom.GetObject(channelId);
            if (channel) {
              address = channel.Address();
              deviceName = channel.Name();
              if (deviceName) { deviceName = deviceName.UriEncode(); } else { deviceName = ""; }
            }
          }
        }
      }
      if (first) { first = false; } else { Write(','); }
      Write('{"id":"' # alarm.ID() # '",');
      Write('"name":"' # encodedName # '",');
      Write('"type":' # alarm.AlType() # ',');
      Write('"address":"' # address # '",');
      Write('"device_name":"' # deviceName # '",');
      Write('"timestamp":"' # occurredAt # '",');
      Write('"last_timestamp":"' # lastOccurredAt # '",');
      Write('"counter":' # alarm.AlCounter() # '}');
    }
  }
}
Write(']');
`;

export async function loadOpenCcuServiceMessages(
  session: JsonRpcSession,
  signal?: AbortSignal,
): Promise<readonly OpenCcuServiceMessage[]> {
  const result = await session.call(
    "ReGa.runScript",
    { script: ACTIVE_SERVICE_MESSAGES_SCRIPT },
    signal,
  );
  const parsed = parseScriptResult(result);
  if (!Array.isArray(parsed)) {
    throw new TypeError("OpenCCU service-message result is not an array");
  }
  return parsed.flatMap(parseServiceMessage);
}

function parseScriptResult(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch (error) {
    throw new TypeError("OpenCCU service-message result is not valid JSON", {
      cause: error,
    });
  }
}

function parseServiceMessage(value: unknown): OpenCcuServiceMessage[] {
  if (typeof value !== "object" || value === null) return [];
  const raw = value as RawServiceMessage;
  if (typeof raw.id !== "string" || typeof raw.name !== "string") return [];
  const decodedName = decodeCcuUri(raw.name);
  return [
    {
      id: raw.id,
      code: extractMessageCode(decodedName),
      type: toFiniteNumber(raw.type, 0),
      occurrenceCount: Math.max(0, toFiniteNumber(raw.counter, 0)),
      ...optionalString("address", raw.address),
      ...optionalDecodedString("deviceName", raw.device_name),
      ...optionalString("occurredAt", raw.timestamp),
      ...optionalString("lastOccurredAt", raw.last_timestamp),
    },
  ];
}

function extractMessageCode(name: string): string {
  const separator = name.lastIndexOf(".");
  const code = (separator >= 0 ? name.slice(separator + 1) : name).trim();
  return code === "" ? "UNKNOWN" : code.toUpperCase();
}

function decodeCcuUri(value: string): string {
  return value.replace(/%([0-9a-f]{2})/gi, (_, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
}

function optionalString<Key extends string>(
  key: Key,
  value: unknown,
): Partial<Record<Key, string>> {
  return typeof value === "string" && value.trim() !== ""
    ? ({ [key]: value.trim() } as Partial<Record<Key, string>>)
    : {};
}

function optionalDecodedString<Key extends string>(
  key: Key,
  value: unknown,
): Partial<Record<Key, string>> {
  return typeof value === "string" && value !== ""
    ? ({ [key]: decodeCcuUri(value).trim() } as Partial<Record<Key, string>>)
    : {};
}

function toFiniteNumber(value: unknown, fallback: number): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}
