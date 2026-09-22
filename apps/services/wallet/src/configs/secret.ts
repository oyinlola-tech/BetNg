const REDACTED = "[redacted]";

/** Holds a credential so that logging, JSON or inspecting a settings object never prints it. */
export class Secret {
  readonly #value: string;

  public constructor(value: string) {
    this.#value = value;
  }

  public reveal(): string {
    return this.#value;
  }

  public toJSON(): string {
    return REDACTED;
  }

  public toString(): string {
    return REDACTED;
  }

  public [Symbol.for("nodejs.util.inspect.custom")](): string {
    return REDACTED;
  }
}
