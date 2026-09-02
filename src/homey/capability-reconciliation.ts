export interface CapabilityChanges {
  readonly add: readonly string[];
  readonly remove: readonly string[];
}

export function reconcileCapabilities(
  current: readonly string[],
  desired: readonly string[],
): CapabilityChanges {
  const currentSet = new Set(current);
  const desiredUnique = [...new Set(desired)];
  const desiredSet = new Set(desiredUnique);
  return {
    add: desiredUnique.filter((capability) => !currentSet.has(capability)),
    remove: current.filter((capability) => !desiredSet.has(capability)),
  };
}
