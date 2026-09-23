/**
 * A credential that cannot be printed. `toJSON`, `toString` and Node's inspection all answer
 * `[redacted]`, so a secret cannot reach a log line through a config dump or a template literal.
 */
export class Secret {
  readonly #value: string;

  public constructor(value: string) {
    this.#value = value;
  }

  public reveal(): string {
    return this.#value;
  }

  public toJSON(): string {
    return "[redacted]";
  }

  public toString(): string {
    return "[redacted]";
  }

  public [Symbol.for("nodejs.util.inspect.custom")](): string {
    return "[redacted]";
  }
}
