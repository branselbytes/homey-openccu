export function callbackHostFromLocalAddress(localAddress: string): string {
  const value = localAddress.trim();
  if (value === "") throw new Error("Homey local address is empty");

  if (value.startsWith("[") && value.includes("]")) {
    return value.slice(1, value.indexOf("]"));
  }

  try {
    const url = new URL(value.includes("://") ? value : `http://${value}`);
    return url.hostname.replace(/^\[|\]$/g, "");
  } catch {
    // Homey may return an unbracketed IPv6 address without a port.
    if (value.includes(":")) return value;
    throw new Error(`Invalid Homey local address: ${value}`);
  }
}
