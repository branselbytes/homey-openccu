import {
  parseOpenCcuSettings,
  type OpenCcuConnectionConfig,
} from "../config/openccu-config";

export const OPENCCU_CONNECTIONS_SETTING = "openccu_connections";

export interface SettingsReader {
  get(key: string): unknown;
}

export function loadOpenCcuConnections(settings: SettingsReader): readonly OpenCcuConnectionConfig[] {
  const stored = settings.get(OPENCCU_CONNECTIONS_SETTING);
  if (stored === undefined || stored === null) return [];
  if (!Array.isArray(stored)) throw new TypeError("OpenCCU connections setting must be an array");

  const centralIds = new Set<string>();
  return stored.map((value, index) => {
    if (!isRecord(value)) throw new TypeError(`OpenCCU connection at index ${index} must be an object`);
    const config = parseOpenCcuSettings(value);
    if (centralIds.has(config.centralId)) {
      throw new Error(`Duplicate OpenCCU centralId: ${config.centralId}`);
    }
    centralIds.add(config.centralId);
    return config;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
