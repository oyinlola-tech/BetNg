export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogCategory =
  "api" | "realtime" | "ui" | "flow" | "performance" | "auth";

export interface LogEntry {
  readonly level: LogLevel;
  readonly category: LogCategory;
  readonly message: string;
  readonly context?: Readonly<Record<string, unknown>>;
  readonly at: string;
}

export type LogSink = (entry: LogEntry) => void;

export interface Logger {
  readonly debug: (category: LogCategory, message: string, context?: Record<string, unknown>) => void;
  readonly info: (category: LogCategory, message: string, context?: Record<string, unknown>) => void;
  readonly warn: (category: LogCategory, message: string, context?: Record<string, unknown>) => void;
  readonly error: (category: LogCategory, message: string, context?: Record<string, unknown>) => void;
  readonly addSink: (sink: LogSink) => () => void;
}

const SENSITIVE =
  /pass(word|code)?|(^|_)pin($|_)|pin$|token|secret|authorization|cookie|otp|verification|balance|amount|stake|payout|email|phone/i;
const LEVELS: readonly LogLevel[] = ["debug", "info", "warn", "error"];

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[depth]";
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redact(item, depth + 1));
  if (typeof value !== "object" || value === null) return value;

  const out: Record<string, unknown> = {};

  for (const [key, inner] of Object.entries(value)) {
    out[key] = SENSITIVE.test(key) ? "[redacted]" : redact(inner, depth + 1);
  }

  return out;
}

export const consoleSink: LogSink = (entry) => {
  const line = `[${entry.category}] ${entry.message}`;

  console[entry.level === "debug" ? "log" : entry.level](line, entry.context ?? "");
};

export function createLogger(options: {
  readonly minLevel?: LogLevel;
  readonly sinks?: readonly LogSink[];
} = {}): Logger {
  const sinks = new Set<LogSink>(options.sinks ?? []);
  const threshold = LEVELS.indexOf(options.minLevel ?? "info");

  const write = (level: LogLevel) =>
    (category: LogCategory, message: string, context?: Record<string, unknown>): void => {
      if (LEVELS.indexOf(level) < threshold) return;

      const entry: LogEntry = {
        level,
        category,
        message,
        ...(context === undefined ? {} : { context: redact(context) as Record<string, unknown> }),
        at: new Date().toISOString(),
      };

      for (const sink of sinks) {
        try {
          sink(entry);
        } catch {
          /* A failing sink must not break the caller. */
        }
      }
    };

  return {
    debug: write("debug"),
    info: write("info"),
    warn: write("warn"),
    error: write("error"),
    addSink: (sink) => {
      sinks.add(sink);

      return () => {
        sinks.delete(sink);
      };
    },
  };
}
