export type MappingDecisionKind = "excluded" | "generic" | "profile" | "unsupported";

export interface MappingDecision {
  readonly channelAddress: string;
  readonly parameter: string;
  readonly kind: MappingDecisionKind;
  readonly capability?: string;
  readonly profile?: string;
  readonly reason: string;
}

export class MappingDecisionLog {
  readonly #maximum: number;
  readonly #decisions: MappingDecision[] = [];

  constructor(maximum = 1_000) {
    this.#maximum = maximum;
  }

  add(decision: MappingDecision): void {
    this.#decisions.push(Object.freeze({ ...decision }));
    if (this.#decisions.length > this.#maximum) this.#decisions.shift();
  }

  list(): readonly MappingDecision[] {
    return [...this.#decisions];
  }
}
